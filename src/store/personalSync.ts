import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSafeStorage } from '../lib/safeStorage';
import {
  QueApiError,
  deleteBlocks,
  getBlocks,
  getDayReviews,
  putBlocks,
  putDayReviews,
  type QueBlockPut,
  type QueBlockRecord,
  type QueReviewRecord,
} from '../lib/queApi';
import { shiftDateKey, toDateKey } from '../lib/time';
import { BLOCK_COLOR_KEYS } from '../lib/tokens';
import { useAuthStore } from './authStore';
import { ALARM_OFFSETS, useBlocksStore, type NewBlockInput } from './blocksStore';
import { useReviewStore, type DayPlanSnapshot, type PlanItem } from './reviewStore';
import type { AlarmOffset, BlockColor, TimeBlock } from '../types';

// 개인 블록·See 스냅샷 동기화 레이어 — DESIGN.md §14.10
//
// Que Task 연동(queSync.ts)과 별개 축이다. queSync는 queTaskId 있는 '연동 블록'의 완료/재일정을
// Que Task로 라이트백한다. 이쪽은 queTaskId 없는 '순수 개인 블록'과 See 스냅샷을 Que 서버의
// 개인 저장소(/api/blocks·/api/day-reviews)에 미러링한다. **이중 저장 금지** — 연동 블록은
// 여기서 제외한다(그건 tasks 라이트백 소관).
//
// 로컬 우선(§14.1): localStorage=진실, 서버=백업. 오프라인이어도 앱은 완전 동작한다.
// - 풀(pull): 부팅·재로그인 시 최근 14일 블록 GET → id 단위 LWW 병합. 스냅샷은 최근 7일 GET →
//   로컬에 없는 날만 채움(불변이라 충돌 없음). applyingRemote 플래그로 라이트백 에코를 차단.
// - 푸시(push): blocksStore 구독 → 개인 블록 변경만 아웃박스(blockId 단위 코얼레스: upsert/delete
//   최신 의도만) → 30초 플러시·지수 백오프·오프라인 보존. 스냅샷 생성은 reviewStore 구독 → PUT.
// - 실패(§14.7): 401→authStore.expire()(아웃박스 보존), 5xx·네트워크→백오프 재시도, 4xx→드롭.

const FLUSH_TICK_MS = 30_000; // 주기 플러시(§14.7 — queSync와 동일 규범)
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 10 * 60_000;
const PULL_BLOCK_DAYS = 14; // 부팅 시 최근 14일 블록 풀(계약 ≤31일, §14.10)
const PULL_REVIEW_DAYS = 7; // 최근 7일 스냅샷 풀
const PUT_CHUNK = 100; // /api/blocks upsert·delete 배치 상한(계약)
const REVIEW_CHUNK = 31; // /api/day-reviews upsert 배치 상한(계약)
const PAYLOAD_MAX_BYTES = 8192; // 블록 payload 상한(계약) — 초과 시 스킵+경고

/** 아웃박스 op — blockId 단위 코얼레스(같은 블록의 연속 변경은 마지막 의도만, §14.10). */
type PersonalOp = { kind: 'upsert'; id: string } | { kind: 'delete'; id: string };

interface PersistedPersonalSync {
  outbox: Record<string, PersonalOp>; // key = blockId
  reviewOutbox: Record<string, true>; // key = dateKey(스냅샷 불변 → PUT 재시도만)
}

interface PersonalSyncState extends PersistedPersonalSync {
  syncing: boolean; // 플러시 진행 중(휘발)
}

interface PersonalSyncActions {
  /** 수동 새로고침(풀+플러시) — 백오프 리셋. */
  refresh(): void;
}

function sanitizeOutbox(raw: unknown): Record<string, PersonalOp> {
  const out: Record<string, PersonalOp> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [key, v] of Object.entries(raw)) {
    if (typeof v !== 'object' || v === null) continue;
    const o = v as Record<string, unknown>;
    if (typeof o.id !== 'string' || o.id === '') continue;
    if (o.kind === 'upsert' || o.kind === 'delete') out[key] = { kind: o.kind, id: o.id };
  }
  return out;
}

function sanitizeReviewOutbox(raw: unknown): Record<string, true> {
  const out: Record<string, true> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [key, v] of Object.entries(raw)) if (v === true) out[key] = true;
  return out;
}

export const usePersonalSyncStore = create<PersonalSyncState & PersonalSyncActions>()(
  persist(
    (_set, _get) => ({
      outbox: {},
      reviewOutbox: {},
      syncing: false,

      refresh: () => {
        resetBackoff();
        void pull();
        void flush();
      },
    }),
    {
      name: 'dayblocks:personalSync',
      storage: createSafeStorage<PersistedPersonalSync>(),
      partialize: (s) => ({ outbox: s.outbox, reviewOutbox: s.reviewOutbox }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedPersonalSync>;
        return {
          ...current,
          outbox: sanitizeOutbox(p.outbox),
          reviewOutbox: sanitizeReviewOutbox(p.reviewOutbox),
        };
      },
    },
  ),
);

// ---------- 모듈 상태(스케줄러 — main.tsx에서 1회 배선) ----------

let started = false;
let ready = false; // 하이드레이션 이후에만 변경 감지(그 전엔 baseline만)
let applyingRemote = false; // 블록 풀 적용 중 — 에코 차단(§14.10)
let applyingRemoteReview = false; // 스냅샷 풀 적용 중 — 에코 차단
let prevBlocks: Record<string, TimeBlock> = {};
let prevSnapshotKeys = new Set<string>();
// 지수 백오프(§14.7) — 재시도성 실패가 연속되면 주기 틱을 늦춘다. 사용자 명시 행동은 리셋.
let retryFailCount = 0;
let nextRetryAt = 0;

// ---------- 아웃박스 헬퍼 ----------

function setBlockOp(op: PersonalOp): void {
  usePersonalSyncStore.setState((s) => ({ outbox: { ...s.outbox, [op.id]: op } }));
}

function removeBlockOp(id: string): void {
  usePersonalSyncStore.setState((s) => {
    if (!(id in s.outbox)) return s;
    const rest = { ...s.outbox };
    delete rest[id];
    return { outbox: rest };
  });
}

function hasBlockOp(id: string): boolean {
  return id in usePersonalSyncStore.getState().outbox;
}

function enqueueReview(dateKey: string): void {
  usePersonalSyncStore.setState((s) => ({ reviewOutbox: { ...s.reviewOutbox, [dateKey]: true } }));
}

function removeReviewOp(dateKey: string): void {
  usePersonalSyncStore.setState((s) => {
    if (!(dateKey in s.reviewOutbox)) return s;
    const rest = { ...s.reviewOutbox };
    delete rest[dateKey];
    return { reviewOutbox: rest };
  });
}

// ---------- payload 직렬화(§14.10) ----------

/** 개인 블록 → 서버 payload(연동 필드 제외). 8KB 초과 시 null+경고(정상 블록은 수백 바이트라 실질 미발생). */
function serializeBlock(block: TimeBlock): QueBlockPut | null {
  // 방어적 제외: queTaskId/syncState는 개인 블록엔 없어야 하지만 명시적으로 payload에서 뺀다(이중 저장 금지).
  const { queTaskId: _q, syncState: _s, ...rest } = block;
  const payload = rest; // 서버가 JSON으로 저장
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).length;
  if (bytes > PAYLOAD_MAX_BYTES) {
    console.warn(`[personalSync] 블록 ${block.id} payload ${bytes}B > ${PAYLOAD_MAX_BYTES}B — 스킵`);
    return null;
  }
  return { id: block.id, dateKey: block.dateKey, payload };
}

// ---------- 변경 감지(§14.10 푸시) ----------

/** blocksStore 구독 — 순수 개인 블록(queTaskId 없음)의 생성/변경/삭제만 아웃박스에 적재. */
function onBlocksChanged(state: { blocks: Record<string, TimeBlock> }): void {
  const next = state.blocks;
  if (next === prevBlocks) return; // blocks 무변경 틱(firedAlarms 등) 무시
  if (!ready || applyingRemote) {
    prevBlocks = next; // 하이드레이션·풀 적용 — baseline만 갱신(에코 방지)
    return;
  }
  for (const id in next) {
    const b = next[id];
    const prev = prevBlocks[id];
    if (b.queTaskId) {
      // 연동 블록 — 개인 동기화 대상 아님(tasks 라이트백 소관). 단, 개인→연동 전환이면 서버에서 제거.
      if (prev && !prev.queTaskId) setBlockOp({ kind: 'delete', id });
      continue;
    }
    // 여기부터 개인 블록. 신규·연동해제 전환·내용 변경(updatedAt bump)이면 upsert.
    if (!prev || prev.queTaskId || prev.updatedAt !== b.updatedAt) {
      setBlockOp({ kind: 'upsert', id });
    }
  }
  // 로컬 삭제 — 개인 블록이 사라졌으면 DELETE 아웃박스(§14.10). 연동 블록 삭제는 queSync 소관.
  for (const id in prevBlocks) {
    if (next[id] || prevBlocks[id].queTaskId) continue;
    setBlockOp({ kind: 'delete', id });
  }
  prevBlocks = next;
  scheduleFlush();
}

/** reviewStore 구독 — 로컬 스냅샷 생성(불변) 감지 시 PUT 아웃박스에 적재(§14.10). */
function onReviewChanged(state: { snapshots: Record<string, DayPlanSnapshot> }): void {
  const keys = Object.keys(state.snapshots);
  if (!ready || applyingRemoteReview) {
    prevSnapshotKeys = new Set(keys); // baseline만 갱신(에코 방지)
    return;
  }
  for (const key of keys) {
    if (!prevSnapshotKeys.has(key)) enqueueReview(key); // 새로 생긴 날만
  }
  prevSnapshotKeys = new Set(keys);
  scheduleFlush();
}

let flushScheduled = false;

/** 마이크로태스크로 플러시 — 구독 콜백 내 재진입 회피. */
function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    void flush();
  });
}

// ---------- 풀(§14.10) ----------

/** payload(문자열 또는 객체)에서 TimeBlock 후보 파싱. 구조 불량이면 null. */
function parseBlockPayload(record: QueBlockRecord): Record<string, unknown> | null {
  let p: unknown = record.payload;
  if (typeof p === 'string') {
    try {
      p = JSON.parse(p);
    } catch {
      return null;
    }
  }
  if (typeof p !== 'object' || p === null) return null;
  const o = p as Record<string, unknown>;
  if (typeof o.startMin !== 'number' || typeof o.endMin !== 'number') return null;
  return o;
}

async function pullBlocks(): Promise<void> {
  const today = toDateKey(new Date());
  const from = shiftDateKey(today, -PULL_BLOCK_DAYS);

  let records: QueBlockRecord[];
  try {
    records = await getBlocks(from, today);
  } catch (e) {
    if (e instanceof QueApiError && e.status === 401) useAuthStore.getState().expire();
    return; // 오프라인/실패 — 로컬 유지(로컬 우선)
  }

  applyingRemote = true;
  try {
    const blocks = useBlocksStore.getState();
    for (const record of records) {
      const id = record.id;
      if (typeof id !== 'string' || id === '') continue;
      const local = blocks.blocks[id];
      // 로컬에 미전송 변경(아웃박스 잔존)이 있으면 로컬 승(LWW 로컬 우선, §14.10).
      if (hasBlockOp(id)) continue;
      // 로컬이 연동 블록이면 개인 미러로 덮지 않는다(연동 축이 관리).
      if (local?.queTaskId) continue;

      const p = parseBlockPayload(record);
      if (!p) continue;
      const dateKey = typeof p.dateKey === 'string' ? p.dateKey : record.dateKey;
      const remoteMs = typeof p.updatedAt === 'number' ? p.updatedAt : 0;
      const color: BlockColor | undefined =
        typeof p.color === 'string' && (BLOCK_COLOR_KEYS as readonly string[]).includes(p.color)
          ? (p.color as BlockColor)
          : undefined; // 무효 → addBlock 기본값('blue')
      const alarm: AlarmOffset | null =
        typeof p.alarm === 'number' && (ALARM_OFFSETS as readonly number[]).includes(p.alarm)
          ? (p.alarm as AlarmOffset)
          : null;

      const input: NewBlockInput = {
        id,
        dateKey,
        startMin: p.startMin as number,
        endMin: p.endMin as number,
        title: typeof p.title === 'string' ? p.title : '',
        icon: typeof p.icon === 'string' ? p.icon : undefined,
        color,
        alarm,
        endAlarm: p.endAlarm === true ? true : undefined,
        note: typeof p.note === 'string' ? p.note : '',
        project: typeof p.project === 'string' ? p.project : '',
      };

      if (!local) {
        // 신규 — 서버 id 보존해 재생성(§14.10). completed는 addBlock이 false 고정이라 별도 반영(queSync 패턴).
        const created = blocks.addBlock(input);
        if (p.completed === true) blocks.updateBlock(created.id, { completed: true });
      } else if (remoteMs > local.updatedAt) {
        // id 단위 LWW — 원격이 최신일 때만 갱신(§14.10).
        blocks.updateBlock(id, {
          dateKey,
          startMin: input.startMin,
          endMin: input.endMin,
          title: input.title,
          note: input.note,
          project: input.project,
          completed: p.completed === true,
        });
      }
    }
  } finally {
    applyingRemote = false;
    prevBlocks = useBlocksStore.getState().blocks; // 원격 적용분을 baseline에 반영(재에코 방지)
  }
}

/** snapshot(문자열 또는 객체)에서 DayPlanSnapshot 파싱. */
function parseSnapshot(record: QueReviewRecord): DayPlanSnapshot | null {
  let s: unknown = record.snapshot;
  if (typeof s === 'string') {
    try {
      s = JSON.parse(s);
    } catch {
      return null;
    }
  }
  if (typeof s !== 'object' || s === null) return null;
  const o = s as Record<string, unknown>;
  if (!Array.isArray(o.items)) return null;
  const items: PlanItem[] = [];
  for (const it of o.items) {
    if (typeof it !== 'object' || it === null) continue;
    const item = it as Record<string, unknown>;
    if (typeof item.id !== 'string' || typeof item.startMin !== 'number' || typeof item.endMin !== 'number') continue;
    items.push({
      id: item.id,
      title: typeof item.title === 'string' ? item.title : '',
      startMin: item.startMin,
      endMin: item.endMin,
    });
  }
  return {
    dateKey: record.dateKey,
    capturedAt: typeof o.capturedAt === 'number' ? o.capturedAt : Date.now(),
    items,
  };
}

async function pullReviews(): Promise<void> {
  const today = toDateKey(new Date());
  const from = shiftDateKey(today, -PULL_REVIEW_DAYS);

  let records: QueReviewRecord[];
  try {
    records = await getDayReviews(from, today);
  } catch (e) {
    if (e instanceof QueApiError && e.status === 401) useAuthStore.getState().expire();
    return;
  }

  applyingRemoteReview = true;
  try {
    const review = useReviewStore.getState();
    for (const record of records) {
      if (typeof record.dateKey !== 'string') continue;
      const snap = parseSnapshot(record);
      if (snap) review.applyRemoteSnapshot(snap); // 로컬에 없는 날만 채움(불변, 스토어가 no-op 처리)
    }
  } finally {
    applyingRemoteReview = false;
    prevSnapshotKeys = new Set(Object.keys(useReviewStore.getState().snapshots));
  }
}

async function pull(): Promise<void> {
  const auth = useAuthStore.getState();
  if (auth.status !== 'authed' || !auth.token) return; // anon 게이트 — 로컬 전용(§14.10)
  await pullBlocks();
  await pullReviews();
}

// ---------- 플러시(§14.10·§14.7) ----------

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function flush(): Promise<void> {
  const auth = useAuthStore.getState();
  if (auth.status !== 'authed' || !auth.token) return; // 토큰 없으면 대기(아웃박스 보존)
  if (usePersonalSyncStore.getState().syncing) return;

  usePersonalSyncStore.setState({ syncing: true });
  let sawRetryable = false;
  try {
    await flushBlocks(() => {
      sawRetryable = true;
    });
    await flushReviews(() => {
      sawRetryable = true;
    });
  } finally {
    usePersonalSyncStore.setState({ syncing: false });
    if (sawRetryable) {
      retryFailCount += 1;
      nextRetryAt = Date.now() + Math.min(BACKOFF_BASE_MS * 2 ** (retryFailCount - 1), BACKOFF_MAX_MS);
    } else {
      retryFailCount = 0;
      nextRetryAt = 0;
    }
  }
}

/** 401은 상위로 전파해 즉시 중단(아웃박스 보존). 그 외는 삼켜서 sawRetryable/드롭 처리. */
function isExpire(e: unknown): boolean {
  if (e instanceof QueApiError && e.status === 401) {
    useAuthStore.getState().expire();
    return true;
  }
  return false;
}

async function flushBlocks(markRetry: () => void): Promise<void> {
  const outbox = usePersonalSyncStore.getState().outbox;
  const blocks = useBlocksStore.getState().blocks;

  const puts: QueBlockPut[] = [];
  const deleteIds: string[] = [];
  for (const op of Object.values(outbox)) {
    const block = blocks[op.id];
    if (op.kind === 'delete' || !block) {
      // 삭제 의도 또는 로컬에서 이미 사라진 블록 → DELETE(연동 블록으로 전환된 것도 여기서 제거).
      deleteIds.push(op.id);
    } else if (block.queTaskId) {
      // 연동 블록으로 바뀌었으면 개인 저장소에서 제거(이중 저장 금지).
      deleteIds.push(op.id);
    } else {
      const put = serializeBlock(block);
      if (put) puts.push(put);
      else removeBlockOp(op.id); // 8KB 초과 — 스킵(경고는 serializeBlock)
    }
  }

  for (const batch of chunk(puts, PUT_CHUNK)) {
    try {
      const result = await putBlocks(batch);
      for (const id of result.saved) removeBlockOp(id);
      for (const rej of result.rejected) {
        // rejected(남의 id 충돌 등, 실질 uuid라 미발생) — 재시도 무의미. 경고+드롭(§14.7 비재시도 분류).
        console.warn(`[personalSync] 블록 ${rej.id} rejected: ${rej.reason} — 드롭`);
        removeBlockOp(rej.id);
      }
    } catch (e) {
      if (isExpire(e)) return;
      if (e instanceof QueApiError && !e.retryable) {
        for (const b of batch) removeBlockOp(b.id); // 4xx — 사용자 개입 불필요, 드롭
      } else {
        markRetry(); // 네트워크·5xx — 아웃박스 유지, 백오프 재시도
      }
    }
  }

  for (const batch of chunk(deleteIds, PUT_CHUNK)) {
    try {
      await deleteBlocks(batch);
      for (const id of batch) removeBlockOp(id);
    } catch (e) {
      if (isExpire(e)) return;
      if (e instanceof QueApiError && (e.status === 404 || !e.retryable)) {
        for (const id of batch) removeBlockOp(id); // 이미 없음/4xx — 삭제 완료로 간주
      } else {
        markRetry();
      }
    }
  }
}

async function flushReviews(markRetry: () => void): Promise<void> {
  const reviewOutbox = usePersonalSyncStore.getState().reviewOutbox;
  const snapshots = useReviewStore.getState().snapshots;

  const puts = Object.keys(reviewOutbox)
    .map((dateKey) => snapshots[dateKey])
    .filter((s): s is DayPlanSnapshot => Boolean(s))
    .map((snap) => ({ dateKey: snap.dateKey, snapshot: snap }));

  // 로컬에서 사라진 날(정리로 만료)의 잔여 op는 폐기.
  for (const dateKey of Object.keys(reviewOutbox)) {
    if (!snapshots[dateKey]) removeReviewOp(dateKey);
  }

  for (const batch of chunk(puts, REVIEW_CHUNK)) {
    try {
      const result = await putDayReviews(batch);
      // saved가 비어도(구현차) 성공 응답이면 배치 전체 완료로 간주 — 스냅샷은 불변이라 재전송 무해.
      const saved = result.saved.length > 0 ? result.saved : batch.map((b) => b.dateKey);
      for (const dateKey of saved) removeReviewOp(dateKey);
    } catch (e) {
      if (isExpire(e)) return;
      if (e instanceof QueApiError && !e.retryable) {
        for (const b of batch) removeReviewOp(b.dateKey); // 4xx — 드롭
      } else {
        markRetry();
      }
    }
  }
}

function resetBackoff(): void {
  retryFailCount = 0;
  nextRetryAt = 0;
}

// ---------- 부팅/트리거 ----------

async function initialSync(): Promise<void> {
  resetBackoff();
  await pull();
  await flush();
}

function onOnline(): void {
  resetBackoff();
  void pull();
  void flush();
}

interface PersistLike {
  hasHydrated: () => boolean;
  onFinishHydration: (fn: () => void) => () => void;
}

/**
 * 개인 블록·리뷰 동기화 시작 — main.tsx에서 1회 배선(§14.10). 멱등.
 * 변경 구독은 즉시(ready 게이트가 하이드레이션 전 에코를 막음), 초기 풀/플러시는
 * blocks·review·auth·personalSync 하이드레이션 완료 후.
 */
export function startPersonalSync(): void {
  if (started) return;
  started = true;

  prevBlocks = useBlocksStore.getState().blocks;
  prevSnapshotKeys = new Set(Object.keys(useReviewStore.getState().snapshots));
  useBlocksStore.subscribe(onBlocksChanged);
  useReviewStore.subscribe(onReviewChanged);
  useAuthStore.subscribe((s, p) => {
    if (s.status === p.status) return;
    if (s.status === 'authed') void initialSync(); // 로그인·재로그인 → 초기 동기화
  });

  const boot = () => {
    prevBlocks = useBlocksStore.getState().blocks;
    prevSnapshotKeys = new Set(Object.keys(useReviewStore.getState().snapshots));
    ready = true;
    void initialSync();
    window.addEventListener('online', onOnline);
    window.setInterval(() => {
      if (Date.now() < nextRetryAt) return; // 백오프 창 안에서는 건너뜀(§14.7)
      void flush();
    }, FLUSH_TICK_MS);
  };

  let remaining = 4;
  const done = () => {
    remaining -= 1;
    if (remaining === 0) boot();
  };
  const wait = (p: PersistLike) => {
    if (p.hasHydrated()) done();
    else p.onFinishHydration(done);
  };
  wait(useBlocksStore.persist);
  wait(useReviewStore.persist);
  wait(useAuthStore.persist);
  wait(usePersonalSyncStore.persist);
}
