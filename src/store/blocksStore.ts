import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AlarmOffset, BlockColor, TimeBlock } from '../types';
import { DAY_MINUTES, MIN_DURATION, STORE_SNAP, clamp, snapMin } from '../lib/time';
import { DEFAULT_EMOJI } from '../lib/emojis';
import { createSafeStorage } from '../lib/safeStorage';
import { STRINGS } from '../lib/strings';
import { BLOCK_COLOR_KEYS } from '../lib/tokens';

// 영속 데이터 스토어 — DESIGN.md §3.1
// 이 액션 8개가 앱의 유일한 데이터 변이 초크포인트다(§13.1) —
// 컴포넌트·훅의 직접 상태 조작 및 localStorage 직접 접근 금지.
// 모든 기하 불변식(5분 배수, 최소 15분, 일 경계 클램프)은 여기서 강제한다 — 호출자가 아님.
// 제스처는 15분 스냅 값을 넘기지만 스토어는 5분만 검증(§1 스냅 2단계).

export const DEFAULT_COLOR: BlockColor = 'blue'; // §2 TimeBlock.color 기본
export const ALARM_OFFSETS: readonly AlarmOffset[] = [0, 5, 10, 15, 30, 60]; // §2와 1:1

/** addBlock 입력 — 생략 필드는 스토어가 기본값을 채운다(§3.1) */
export interface NewBlockInput {
  dateKey: string;
  startMin: number;
  endMin: number;
  title?: string;
  emoji?: string;
  color?: BlockColor;
  alarm?: AlarmOffset | null;
  note?: string;
}

/** updateBlock 패치 — id/createdAt 불변, updatedAt은 스토어가 스탬프(§13.3 LWW) */
export type BlockPatch = Partial<Omit<TimeBlock, 'id' | 'createdAt' | 'updatedAt'>>;

interface BlocksState {
  blocks: Record<string, TimeBlock>;   // id로 정규화된 flat map (날짜별 인덱스 명시적 기각 — §3.1)
  firedAlarms: Record<string, true>;   // 발화된 알림 키 집합 `id|dateKey|fireAtMin`(§7)
}

interface BlocksActions {
  addBlock(input: NewBlockInput): TimeBlock;
  updateBlock(id: string, patch: BlockPatch): void;
  deleteBlock(id: string): void;
  toggleComplete(id: string): void;
  moveBlock(id: string, newStartMin: number): void;
  resizeBlock(id: string, edge: 'top' | 'bottom', edgeMin: number): void;
  markAlarmFired(key: string): void;
  pruneFiredAlarms(todayKey: string): void;
}

type PersistedBlocksState = Pick<BlocksState, 'blocks' | 'firedAlarms'>;

// ---------- 불변식 정규화 ----------

/** 빈/공백 제목 → '새 일정'(§2 — 제목 때문에 저장이 막히는 일 없음) */
function normalizeTitle(title: string): string {
  const t = title.trim();
  return t === '' ? STRINGS.editor.defaultTitle : t;
}

/** 5분 스냅 + 일 경계 클램프 + 최소 15분 — 시작 고정, 종료를 보정(§3.1, §4.10) */
function normalizeRange(startMin: number, endMin: number): { startMin: number; endMin: number } {
  const s = clamp(snapMin(startMin, STORE_SNAP), 0, DAY_MINUTES - MIN_DURATION);
  const e = clamp(snapMin(endMin, STORE_SNAP), s + MIN_DURATION, DAY_MINUTES);
  return { startMin: s, endMin: e };
}

// ---------- sanitize (매 로드마다 — §3.1) ----------

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isBlockColor(v: unknown): v is BlockColor {
  return typeof v === 'string' && (BLOCK_COLOR_KEYS as readonly string[]).includes(v);
}

function isAlarmOffset(v: unknown): v is AlarmOffset {
  return typeof v === 'number' && (ALARM_OFFSETS as readonly number[]).includes(v);
}

/** 구조 가드 실패 항목은 드롭, 필드 단위 이상은 기본값 보정. 미지 필드는 보존(§13.2 tombstone 대비). */
function sanitizeBlock(fallbackId: string, v: unknown): TimeBlock | null {
  if (typeof v !== 'object' || v === null) return null;
  const b = v as Record<string, unknown>;
  if (typeof b.dateKey !== 'string' || !DATE_KEY_RE.test(b.dateKey)) return null;
  if (typeof b.startMin !== 'number' || !Number.isFinite(b.startMin)) return null;
  if (typeof b.endMin !== 'number' || !Number.isFinite(b.endMin)) return null;
  const now = Date.now();
  return {
    ...b, // 미지 필드 보존 — 서버 마이그레이션 하위 호환(§13.2)
    id: typeof b.id === 'string' && b.id !== '' ? b.id : fallbackId,
    dateKey: b.dateKey,
    ...normalizeRange(b.startMin, b.endMin),
    title: normalizeTitle(typeof b.title === 'string' ? b.title : ''),
    emoji: typeof b.emoji === 'string' && b.emoji !== '' ? b.emoji : DEFAULT_EMOJI,
    color: isBlockColor(b.color) ? b.color : DEFAULT_COLOR, // 알 수 없는 color → 'blue'(§3.1)
    alarm: isAlarmOffset(b.alarm) ? b.alarm : null,
    note: typeof b.note === 'string' ? b.note : '',
    completed: b.completed === true,
    createdAt: typeof b.createdAt === 'number' && Number.isFinite(b.createdAt) ? b.createdAt : now,
    updatedAt: typeof b.updatedAt === 'number' && Number.isFinite(b.updatedAt) ? b.updatedAt : now,
  };
}

function sanitizeBlocks(raw: unknown): Record<string, TimeBlock> {
  const out: Record<string, TimeBlock> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [id, value] of Object.entries(raw)) {
    const block = sanitizeBlock(id, value);
    if (block) out[block.id] = block;
  }
  return out;
}

function sanitizeFiredAlarms(raw: unknown): Record<string, true> {
  const out: Record<string, true> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (value === true) out[key] = true;
  }
  return out;
}

// ---------- 스토어 ----------
// 타입 주석은 create<T>()(persist(...)) 추론에 맡김 — 명시 주석은 persist 뮤테이터
// 타이핑을 지워 persist.onFinishHydration 등이 타입에서 사라진다(§3.1).

export const useBlocksStore = create<BlocksState & BlocksActions>()(
  persist(
    (set, get) => ({
      blocks: {},
      firedAlarms: {},

      addBlock: (input) => {
        const now = Date.now();
        const block: TimeBlock = {
          id: crypto.randomUUID(),
          dateKey: input.dateKey,
          ...normalizeRange(input.startMin, input.endMin),
          title: normalizeTitle(input.title ?? ''),
          emoji: input.emoji ?? DEFAULT_EMOJI,
          color: input.color ?? DEFAULT_COLOR,
          alarm: input.alarm ?? null,
          note: input.note ?? '',
          completed: false,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ blocks: { ...s.blocks, [block.id]: block } }));
        return block;
      },

      updateBlock: (id, patch) => {
        const prev = get().blocks[id];
        if (!prev) return;
        const merged: TimeBlock = { ...prev, ...patch };
        const next: TimeBlock = {
          ...merged,
          ...normalizeRange(merged.startMin, merged.endMin),
          title: normalizeTitle(merged.title),
          updatedAt: Date.now(),
        };
        set((s) => ({ blocks: { ...s.blocks, [id]: next } }));
      },

      deleteBlock: (id) => {
        if (!get().blocks[id]) return;
        set((s) => {
          const rest = { ...s.blocks };
          delete rest[id];
          return { blocks: rest };
        });
      },

      toggleComplete: (id) => {
        const prev = get().blocks[id];
        if (!prev) return;
        set((s) => ({
          blocks: {
            ...s.blocks,
            [id]: { ...prev, completed: !prev.completed, updatedAt: Date.now() },
          },
        }));
      },

      // 길이 보존, [0, 1440-길이] 클램프(§3.1) — 제스처당 1회(pointer-up)만 호출(§3.2)
      moveBlock: (id, newStartMin) => {
        const prev = get().blocks[id];
        if (!prev) return;
        const len = prev.endMin - prev.startMin;
        const startMin = clamp(snapMin(newStartMin, STORE_SNAP), 0, DAY_MINUTES - len);
        if (startMin === prev.startMin) return;
        set((s) => ({
          blocks: {
            ...s.blocks,
            [id]: { ...prev, startMin, endMin: startMin + len, updatedAt: Date.now() },
          },
        }));
      },

      // 반대편 고정, 최소 15분에서 클램프 — 반전/이동 전환 없음(§4.4, §4.10)
      resizeBlock: (id, edge, edgeMin) => {
        const prev = get().blocks[id];
        if (!prev) return;
        const m = snapMin(edgeMin, STORE_SNAP);
        const next: TimeBlock =
          edge === 'top'
            ? { ...prev, startMin: clamp(m, 0, prev.endMin - MIN_DURATION) }
            : { ...prev, endMin: clamp(m, prev.startMin + MIN_DURATION, DAY_MINUTES) };
        if (next.startMin === prev.startMin && next.endMin === prev.endMin) return;
        set((s) => ({
          blocks: { ...s.blocks, [id]: { ...next, updatedAt: Date.now() } },
        }));
      },

      markAlarmFired: (key) => {
        set((s) => ({ firedAlarms: { ...s.firedAlarms, [key]: true } }));
      },

      // 지난 날짜 키 정리 — 앱 시작 시 1회(§3.1, 호출 배선은 Stage 6 스케줄러)
      pruneFiredAlarms: (todayKey) => {
        set((s) => {
          const kept: Record<string, true> = {};
          for (const key of Object.keys(s.firedAlarms)) {
            const dateKey = key.split('|')[1]; // firedKey = id|dateKey|fireAtMin(§7)
            if (dateKey !== undefined && dateKey >= todayKey) kept[key] = true;
          }
          return { firedAlarms: kept };
        });
      },
    }),
    {
      name: 'dayblocks:data',
      version: 1,
      storage: createSafeStorage<PersistedBlocksState>(),
      partialize: (s) => ({ blocks: s.blocks, firedAlarms: s.firedAlarms }),
      // 버전 업 시 case 폴스루로 단계 변환(§3.1). v1이 최초 스키마 — 현재는 통과만.
      migrate: (persisted) => persisted as PersistedBlocksState,
      // merge는 매 하이드레이션마다 실행 — "매 로드마다 sanitize"를 여기서 보장(§3.1).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Record<keyof PersistedBlocksState, unknown>>;
        return {
          ...current,
          blocks: sanitizeBlocks(p.blocks),
          firedAlarms: sanitizeFiredAlarms(p.firedAlarms),
        };
      },
    },
  ),
);
