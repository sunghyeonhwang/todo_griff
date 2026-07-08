import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSafeStorage } from '../lib/safeStorage';
import { STRINGS } from '../lib/strings';
import {
  QueApiError,
  blockToScheduleRange,
  getMyTasks,
  inboxTaskToBlockInput,
  mapTimedTask,
  moveTask,
  setTaskStatus,
  type QueTask,
} from '../lib/queApi';
import { DAY_MINUTES, DEFAULT_DURATION, nowMinutes } from '../lib/time';
import { useAuthStore } from './authStore';
import { useBlocksStore, type BlockPatch } from './blocksStore';
import { useUiStore } from './uiStore';
import type { TimeBlock } from '../types';

// Que 동기화 레이어 — DESIGN.md §14.1·§14.6·§14.7
//
// 로컬 우선(§14.1): localStorage가 진실의 소스, Que는 미러. 모든 UI 조작은 store 8액션으로
// 즉시 로컬 커밋되고 Que 반영은 뒤따른다. 네트워크가 없어도 앱은 완전히 동작한다.
// - 풀(pull): getMyTasks → 시간있음=연동 블록 upsert(queTaskId 기준), 무시간=인박스.
//   원격 적용은 store 액션(add/update)으로만 하되 withRemoteApply로 라이트백 에코를 차단.
// - 라이트백(§14.6): blocksStore.subscribe로 연동 블록의 완료/시간 변경을 감지 → 아웃박스
//   적재(블록별 최신 의도로 코얼레스) → 플러시. syncState 전이는 updateBlock으로만(초크포인트 유지).
// - 오프라인/실패(§14.7): 재시도성(네트워크·5xx) 아웃박스 유지·pending, 비재시도(4xx) error·토스트,
//   401 → authStore.expire()(아웃박스 보존, 재로그인 유도).

const FLUSH_TICK_MS = 30_000; // 주기 플러시(§14.7)

/** 아웃박스 작업 — queTaskId+kind로 코얼레스(같은 블록의 연속 변경은 마지막만, §14.7). */
type OutboxOp =
  | { kind: 'move'; queTaskId: string; blockId: string; startAt: string; endAt: string }
  | { kind: 'status'; queTaskId: string; blockId: string; to: 'done' | 'in_progress' };

interface PersistedSync {
  outbox: Record<string, OutboxOp>; // key = `${queTaskId}:${kind}`
  inbox: QueTask[]; // 무시간 태스크(오프라인 시작에도 보이도록 영속)
}

interface QueSyncState extends PersistedSync {
  syncing: boolean; // 플러시 진행 중(휘발) — UI 표시용
}

interface QueSyncActions {
  /** 인박스 항목을 활성 날짜/다음 정시에 배치 → 연동 블록 생성(§14.6). */
  placeInboxTask(taskId: string): void;
  /** 수동 새로고침(풀). */
  refresh(): void;
}

function opKey(op: OutboxOp): string {
  return `${op.queTaskId}:${op.kind}`;
}

function sanitizeOutbox(raw: unknown): Record<string, OutboxOp> {
  const out: Record<string, OutboxOp> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [key, v] of Object.entries(raw)) {
    if (typeof v !== 'object' || v === null) continue;
    const o = v as Record<string, unknown>;
    if (typeof o.queTaskId !== 'string' || typeof o.blockId !== 'string') continue;
    if (o.kind === 'move' && typeof o.startAt === 'string' && typeof o.endAt === 'string') {
      out[key] = { kind: 'move', queTaskId: o.queTaskId, blockId: o.blockId, startAt: o.startAt, endAt: o.endAt };
    } else if (o.kind === 'status' && (o.to === 'done' || o.to === 'in_progress')) {
      out[key] = { kind: 'status', queTaskId: o.queTaskId, blockId: o.blockId, to: o.to };
    }
  }
  return out;
}

export const useQueSyncStore = create<QueSyncState & QueSyncActions>()(
  persist(
    (set, get) => ({
      outbox: {},
      inbox: [],
      syncing: false,

      placeInboxTask: (taskId) => {
        const task = get().inbox.find((t) => t.id === taskId);
        if (!task) return;
        const startMin = Math.min(Math.ceil(nowMinutes() / 60) * 60, DAY_MINUTES - DEFAULT_DURATION);
        const dateKey = useUiStore.getState().activeDateKey;
        // 생성 초크포인트 유지(§14.6) — addBlock 1회. subscribe가 move 라이트백을 큐잉한다.
        useBlocksStore.getState().addBlock(inboxTaskToBlockInput(task, dateKey, startMin));
        set((s) => ({ inbox: s.inbox.filter((t) => t.id !== taskId) }));
        useUiStore.getState().showToast(STRINGS.que.toast.placed);
      },

      refresh: () => {
        void pull();
      },
    }),
    {
      name: 'dayblocks:queSync',
      storage: createSafeStorage<PersistedSync>(),
      partialize: (s) => ({ outbox: s.outbox, inbox: s.inbox }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedSync>;
        return {
          ...current,
          outbox: sanitizeOutbox(p.outbox),
          inbox: Array.isArray(p.inbox) ? p.inbox : [],
        };
      },
    },
  ),
);

// ---------- 모듈 상태(스케줄러 — main.tsx에서 1회 배선) ----------

let started = false;
let ready = false; // 하이드레이션 이후에만 라이트백 감지(그 전엔 baseline만)
let applyingRemote = false; // 풀 적용 중 — 라이트백 에코 차단(§14.6)
let prevBlocks: Record<string, TimeBlock> = {};

// ---------- 아웃박스 헬퍼 ----------

function setOp(op: OutboxOp): void {
  useQueSyncStore.setState((s) => ({ outbox: { ...s.outbox, [opKey(op)]: op } }));
}

function removeOp(key: string): void {
  useQueSyncStore.setState((s) => {
    const rest = { ...s.outbox };
    delete rest[key];
    return { outbox: rest };
  });
}

function hasPendingOp(blockId: string): boolean {
  return Object.values(useQueSyncStore.getState().outbox).some((o) => o.blockId === blockId);
}

function setInbox(inbox: QueTask[]): void {
  useQueSyncStore.setState({ inbox });
}

// ---------- syncState 전이(§14.6 — updateBlock으로만, 초크포인트 유지) ----------

function setSyncState(blockId: string, syncState: TimeBlock['syncState']): void {
  const b = useBlocksStore.getState().blocks[blockId];
  if (!b || !b.queTaskId || b.syncState === syncState) return;
  useBlocksStore.getState().updateBlock(blockId, { syncState });
}

// ---------- 라이트백 감지(§14.6) ----------

function enqueueMove(block: TimeBlock): void {
  if (!block.queTaskId) return;
  const { startAt, endAt } = blockToScheduleRange(block.dateKey, block.startMin, block.endMin);
  setOp({ kind: 'move', queTaskId: block.queTaskId, blockId: block.id, startAt, endAt });
}

function enqueueStatus(block: TimeBlock): void {
  if (!block.queTaskId) return;
  // 완료 해제는 안전 기본값 in_progress(진행 재개, §14.4).
  setOp({ kind: 'status', queTaskId: block.queTaskId, blockId: block.id, to: block.completed ? 'done' : 'in_progress' });
}

let flushScheduled = false;
const pendingMarks = new Set<string>();

/** 마이크로태스크로 pending 마킹 + 플러시 — 구독 콜백 내 재진입 회피. */
function scheduleFlush(markIds: string[]): void {
  for (const id of markIds) pendingMarks.add(id);
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    const ids = [...pendingMarks];
    pendingMarks.clear();
    for (const id of ids) setSyncState(id, 'pending');
    void flush();
  });
}

/** blocksStore 구독 콜백 — 연동 블록의 시간/완료 변경만 라이트백 큐잉(§14.6). */
function onBlocksChanged(state: { blocks: Record<string, TimeBlock> }): void {
  const next = state.blocks;
  if (next === prevBlocks) return; // firedAlarms 등 blocks 무변경 틱은 무시
  if (!ready || applyingRemote) {
    prevBlocks = next; // 하이드레이션·풀 적용 — baseline만 갱신(에코 방지)
    return;
  }
  const touched: string[] = [];
  for (const id in next) {
    const b = next[id];
    if (!b.queTaskId) continue; // 로컬 전용 블록은 라이트백 없음
    const prev = prevBlocks[id];
    if (!prev) {
      enqueueMove(b); // 인박스 배치로 신규 연동 블록 → 최초 일정 부여(§14.6)
      touched.push(id);
      continue;
    }
    if (prev.startMin !== b.startMin || prev.endMin !== b.endMin || prev.dateKey !== b.dateKey) {
      enqueueMove(b);
      touched.push(id);
    }
    if (prev.completed !== b.completed) {
      enqueueStatus(b);
      touched.push(id);
    }
  }
  prevBlocks = next;
  if (touched.length > 0) scheduleFlush(touched);
}

// ---------- 풀(§14.1·§14.7) ----------

async function pull(): Promise<void> {
  const auth = useAuthStore.getState();
  if (auth.status !== 'authed' || !auth.user) return;

  let tasks: QueTask[];
  try {
    tasks = await getMyTasks(auth.user.id);
  } catch (e) {
    if (e instanceof QueApiError && e.status === 401) useAuthStore.getState().expire();
    return; // 오프라인/실패 — 기존 로컬 유지(로컬 우선)
  }

  const inbox: QueTask[] = [];
  applyingRemote = true;
  try {
    const blocks = useBlocksStore.getState().blocks;
    const linkedByTask = new Map<string, TimeBlock>();
    for (const b of Object.values(blocks)) if (b.queTaskId) linkedByTask.set(b.queTaskId, b);

    for (const task of tasks) {
      if (task.status === 'cancelled' || task.status === 'merged') continue; // 능동 화면에서 숨김(§14.2)
      const mapped = mapTimedTask(task);
      if (!mapped) {
        // 무시간 미완료 → 인박스. 단 이미 타임라인에 배치된(연동 블록 존재) 태스크는
        // 인박스에 다시 넣지 않는다 — 배치 후 move 라이트백이 아직 안 flush된(오프라인/재연결)
        // 상태에서 서버가 여전히 무시간이면 중복 블록이 생기는 것을 막는다(queTaskId upsert 중복방지).
        if (task.status !== 'done' && !linkedByTask.has(task.id)) inbox.push(task);
        continue;
      }
      const existing = linkedByTask.get(task.id);
      if (!existing) {
        const created = useBlocksStore.getState().addBlock(mapped.input);
        if (mapped.completed) useBlocksStore.getState().updateBlock(created.id, { completed: true });
      } else if (existing.syncState !== 'pending') {
        // LWW(§14.7): 미플러시 pending은 로컬 우선. 그 외엔 원격이 최신일 때만 갱신.
        const remoteMs = mapped.lastChangedAt ? Date.parse(mapped.lastChangedAt) : 0;
        const remoteProject = mapped.input.project ?? '';
        const patch: BlockPatch = {};
        if (Number.isFinite(remoteMs) && remoteMs > existing.updatedAt) {
          patch.dateKey = mapped.input.dateKey;
          patch.startMin = mapped.input.startMin;
          patch.endMin = mapped.input.endMin;
          patch.title = mapped.input.title;
          patch.completed = mapped.completed;
          patch.syncState = 'synced';
        }
        // 프로젝트는 연동 블록에서 Que 파생 — 다르면 항상 갱신(자동 채움, 풀 시 반영 §14.4).
        // updateBlock이 updatedAt을 bump하나(§13.3), 시계 오차 창 1회 한정 — 기존 LWW가 이미 수용하는 급.
        if (existing.project !== remoteProject) patch.project = remoteProject;
        if (Object.keys(patch).length > 0) useBlocksStore.getState().updateBlock(existing.id, patch);
      }
    }
  } finally {
    applyingRemote = false;
    prevBlocks = useBlocksStore.getState().blocks; // 원격 적용분을 baseline에 반영(재에코 방지)
  }

  setInbox(inbox);
}

// ---------- 플러시(§14.6·§14.7) ----------

async function flush(): Promise<void> {
  const auth = useAuthStore.getState();
  if (auth.status !== 'authed' || !auth.token) return; // 토큰 없으면 대기(아웃박스 보존)
  if (useQueSyncStore.getState().syncing) return;
  const ops = Object.values(useQueSyncStore.getState().outbox);
  if (ops.length === 0) return;

  useQueSyncStore.setState({ syncing: true });
  let sawError = false;
  try {
    for (const op of ops) {
      const key = opKey(op);
      try {
        if (op.kind === 'move') await moveTask(op.queTaskId, op.startAt, op.endAt);
        else await setTaskStatus(op.queTaskId, op.to);
        removeOp(key);
        if (!hasPendingOp(op.blockId)) setSyncState(op.blockId, 'synced');
      } catch (e) {
        if (e instanceof QueApiError && e.status === 401) {
          useAuthStore.getState().expire(); // 아웃박스·pending 보존, 재로그인 후 플러시(§14.7)
          return;
        }
        if (e instanceof QueApiError && !e.retryable) {
          removeOp(key); // 403/404/409/422 — 재시도 안 함, 사용자 개입(§14.7)
          setSyncState(op.blockId, 'error');
          sawError = true;
        }
        // 재시도성(네트워크·5xx·429): 아웃박스 유지, pending 유지 → 다음 틱 재시도
      }
    }
  } finally {
    useQueSyncStore.setState({ syncing: false });
  }
  if (sawError) useUiStore.getState().showToast(STRINGS.que.toast.syncFailed);
}

// ---------- 부팅/트리거 ----------

async function initialSync(): Promise<void> {
  await pull();
  await flush();
}

function onOnline(): void {
  void pull();
  void flush();
}

interface PersistLike {
  hasHydrated: () => boolean;
  onFinishHydration: (fn: () => void) => () => void;
}

/**
 * 동기화 시작 — main.tsx에서 1회 배선(§14). 멱등.
 * 라이트백 구독은 즉시(ready 게이트가 하이드레이션 전 에코를 막음), 초기 풀/플러시는
 * blocks·auth·queSync 하이드레이션 완료 후.
 */
export function startQueSync(): void {
  if (started) return;
  started = true;

  prevBlocks = useBlocksStore.getState().blocks;
  useBlocksStore.subscribe(onBlocksChanged);
  // 인증 전이 — 로그인 시 초기 동기화, 로그아웃/만료 시 인박스 비움.
  useAuthStore.subscribe((s, p) => {
    if (s.status === p.status) return;
    if (s.status === 'authed') void initialSync();
    else setInbox([]);
  });

  const boot = () => {
    prevBlocks = useBlocksStore.getState().blocks; // 하이드레이션 이후 baseline(기존 연동 블록 오인 방지)
    ready = true;
    void initialSync();
    window.addEventListener('online', onOnline);
    window.setInterval(() => void flush(), FLUSH_TICK_MS);
  };

  let remaining = 3;
  const done = () => {
    remaining -= 1;
    if (remaining === 0) boot();
  };
  const wait = (p: PersistLike) => {
    if (p.hasHydrated()) done();
    else p.onFinishHydration(done);
  };
  wait(useBlocksStore.persist);
  wait(useAuthStore.persist);
  wait(useQueSyncStore.persist);
}
