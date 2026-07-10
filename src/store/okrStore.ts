import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { KeyResult, Objective } from '../types';
import { createSafeStorage } from '../lib/safeStorage';
import { STRINGS } from '../lib/strings';

// OKR 영속 스토어 — DESIGN.md §15 (앱 로컬 전용, Que 동기화 없음)
// blocksStore(§3.1)와 같은 규율: 이 액션들이 OKR 데이터의 유일한 변이 초크포인트고,
// 불변식(빈 제목 대체, target>0, current≥0)은 전부 여기서 강제한다. 매 로드마다 sanitize.

const QUARTER_RE = /^\d{4}-Q[1-4]$/;

/** addKeyResult 입력 — 생략 필드는 스토어가 기본값을 채운다. */
export interface NewKrInput {
  objectiveId: string;
  title?: string;
  target?: number;
  current?: number;
  unit?: string;
}

interface OkrState {
  objectives: Record<string, Objective>; // id로 정규화된 flat map(§3.1 관례)
  keyResults: Record<string, KeyResult>;
}

interface OkrActions {
  addObjective(quarter: string, title?: string): Objective;
  updateObjective(id: string, patch: Partial<Pick<Objective, 'title'>>): void;
  /** 목표 삭제 — 소속 KR 연쇄 삭제. */
  deleteObjective(id: string): void;
  addKeyResult(input: NewKrInput): KeyResult | null;
  updateKeyResult(
    id: string,
    patch: Partial<Pick<KeyResult, 'title' | 'target' | 'current' | 'unit'>>,
  ): void;
  deleteKeyResult(id: string): void;
  /** 진척 ±1 — 카드에서 즉시 커밋(명시적 저장 원칙의 예외, 체크박스 §4.9와 동급). */
  bumpKeyResult(id: string, delta: 1 | -1): void;
}

type PersistedOkr = Pick<OkrState, 'objectives' | 'keyResults'>;

// ---------- 불변식 정규화 ----------

function normalizeObjectiveTitle(title: string): string {
  const t = title.trim();
  return t === '' ? STRINGS.okr.defaultObjectiveTitle : t;
}

function normalizeKrTitle(title: string): string {
  const t = title.trim();
  return t === '' ? STRINGS.okr.defaultKrTitle : t;
}

/** target은 0보다 큰 유한수(아니면 1로 보정), current는 0 이상 유한수. */
function normalizeTarget(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function normalizeCurrent(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// ---------- sanitize (매 로드마다 — §3.1 계승) ----------

function sanitizeObjectives(raw: unknown): Record<string, Objective> {
  const out: Record<string, Objective> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  const now = Date.now();
  for (const [id, v] of Object.entries(raw)) {
    if (typeof v !== 'object' || v === null) continue;
    const o = v as Record<string, unknown>;
    if (typeof o.quarter !== 'string' || !QUARTER_RE.test(o.quarter)) continue;
    const key = typeof o.id === 'string' && o.id !== '' ? o.id : id;
    out[key] = {
      id: key,
      quarter: o.quarter,
      title: normalizeObjectiveTitle(typeof o.title === 'string' ? o.title : ''),
      createdAt: typeof o.createdAt === 'number' && Number.isFinite(o.createdAt) ? o.createdAt : now,
      updatedAt: typeof o.updatedAt === 'number' && Number.isFinite(o.updatedAt) ? o.updatedAt : now,
    };
  }
  return out;
}

function sanitizeKeyResults(
  raw: unknown,
  objectives: Record<string, Objective>,
): Record<string, KeyResult> {
  const out: Record<string, KeyResult> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  const now = Date.now();
  for (const [id, v] of Object.entries(raw)) {
    if (typeof v !== 'object' || v === null) continue;
    const k = v as Record<string, unknown>;
    // 고아 KR(소속 Objective 없음)은 드롭 — 화면에 도달할 수 없는 데이터를 남기지 않는다.
    if (typeof k.objectiveId !== 'string' || !objectives[k.objectiveId]) continue;
    const key = typeof k.id === 'string' && k.id !== '' ? k.id : id;
    out[key] = {
      id: key,
      objectiveId: k.objectiveId,
      title: normalizeKrTitle(typeof k.title === 'string' ? k.title : ''),
      target: normalizeTarget(k.target),
      current: normalizeCurrent(k.current),
      unit: typeof k.unit === 'string' ? k.unit.trim() : '',
      createdAt: typeof k.createdAt === 'number' && Number.isFinite(k.createdAt) ? k.createdAt : now,
      updatedAt: typeof k.updatedAt === 'number' && Number.isFinite(k.updatedAt) ? k.updatedAt : now,
    };
  }
  return out;
}

// ---------- 파생(순수 헬퍼 — 컴포넌트가 공유) ----------

/** KR 진행률 0..1 (target 초과는 1로 클램프). */
export function krProgress(kr: KeyResult): number {
  return Math.min(kr.current / kr.target, 1);
}

/** Objective 진행률 0..1 = 소속 KR 진행률 평균(KR 없으면 0). */
export function objectiveProgress(krs: KeyResult[]): number {
  if (krs.length === 0) return 0;
  return krs.reduce((sum, kr) => sum + krProgress(kr), 0) / krs.length;
}

// ---------- 스토어 ----------

export const useOkrStore = create<OkrState & OkrActions>()(
  persist(
    (set, get) => ({
      objectives: {},
      keyResults: {},

      addObjective: (quarter, title) => {
        const now = Date.now();
        const objective: Objective = {
          id: crypto.randomUUID(),
          quarter,
          title: normalizeObjectiveTitle(title ?? ''),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ objectives: { ...s.objectives, [objective.id]: objective } }));
        return objective;
      },

      updateObjective: (id, patch) => {
        const prev = get().objectives[id];
        if (!prev) return;
        set((s) => ({
          objectives: {
            ...s.objectives,
            [id]: {
              ...prev,
              title: normalizeObjectiveTitle(patch.title ?? prev.title),
              updatedAt: Date.now(),
            },
          },
        }));
      },

      deleteObjective: (id) => {
        if (!get().objectives[id]) return;
        set((s) => {
          const objectives = { ...s.objectives };
          delete objectives[id];
          const keyResults: Record<string, KeyResult> = {};
          for (const kr of Object.values(s.keyResults)) {
            if (kr.objectiveId !== id) keyResults[kr.id] = kr; // 연쇄 삭제
          }
          return { objectives, keyResults };
        });
      },

      addKeyResult: (input) => {
        if (!get().objectives[input.objectiveId]) return null; // 고아 생성 차단
        const now = Date.now();
        const kr: KeyResult = {
          id: crypto.randomUUID(),
          objectiveId: input.objectiveId,
          title: normalizeKrTitle(input.title ?? ''),
          target: normalizeTarget(input.target ?? 1),
          current: normalizeCurrent(input.current ?? 0),
          unit: (input.unit ?? '').trim(),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ keyResults: { ...s.keyResults, [kr.id]: kr } }));
        return kr;
      },

      updateKeyResult: (id, patch) => {
        const prev = get().keyResults[id];
        if (!prev) return;
        set((s) => ({
          keyResults: {
            ...s.keyResults,
            [id]: {
              ...prev,
              title: normalizeKrTitle(patch.title ?? prev.title),
              target: patch.target !== undefined ? normalizeTarget(patch.target) : prev.target,
              current: patch.current !== undefined ? normalizeCurrent(patch.current) : prev.current,
              unit: patch.unit !== undefined ? patch.unit.trim() : prev.unit,
              updatedAt: Date.now(),
            },
          },
        }));
      },

      deleteKeyResult: (id) => {
        if (!get().keyResults[id]) return;
        set((s) => {
          const keyResults = { ...s.keyResults };
          delete keyResults[id];
          return { keyResults };
        });
      },

      bumpKeyResult: (id, delta) => {
        const prev = get().keyResults[id];
        if (!prev) return;
        set((s) => ({
          keyResults: {
            ...s.keyResults,
            [id]: { ...prev, current: normalizeCurrent(prev.current + delta), updatedAt: Date.now() },
          },
        }));
      },
    }),
    {
      name: 'dayblocks:okr',
      version: 1,
      storage: createSafeStorage<PersistedOkr>(),
      partialize: (s) => ({ objectives: s.objectives, keyResults: s.keyResults }),
      migrate: (persisted) => persisted as PersistedOkr,
      // 매 하이드레이션마다 sanitize(§3.1 계승) — KR은 Objective sanitize 결과에 대해 고아 검증.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Record<keyof PersistedOkr, unknown>>;
        const objectives = sanitizeObjectives(p.objectives);
        return {
          ...current,
          objectives,
          keyResults: sanitizeKeyResults(p.keyResults, objectives),
        };
      },
    },
  ),
);
