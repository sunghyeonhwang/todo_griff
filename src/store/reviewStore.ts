import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSafeStorage } from '../lib/safeStorage';

// 하루 계획 스냅샷 스토어 — DESIGN.md §16 (Plan-Do-See의 See)
//
// 그날 첫 조회 시점의 '계획'을 불변으로 저장해, 저녁에 계획 대비 실행을 돌아볼 수 있게 한다.
// - blocksStore 규율(§3.1) 준수: 스냅샷 데이터의 유일한 변이 초크포인트는 이 스토어의 액션이다.
//   컴포넌트/훅의 localStorage 직접 접근 금지 — safeStorage 어댑터 1곳만 통과.
// - 스냅샷은 날짜당 1회·불변(첫 조회 시점 고정). 최근 7일만 보관(용량, §16).
// - 개인 시간 회고 전용 — Que 팀 회고와 분업(§16). Que와 동기화하지 않는다.
// - ⚠ 향후 Supabase 저장 전환 예정(사용자 결정): 스냅샷 로직을 이 스토어 액션으로 격리해
//   교체 지점을 명확히 한다 — 저장 백엔드가 바뀌어도 captureSnapshot 시그니처는 유지.

const RETENTION_DAYS = 7; // 스냅샷 보관 개수(날짜 기준)

/** 계획 스냅샷의 블록 1건 — 그날 첫 조회 시점의 계획(불변) */
export interface PlanItem {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
}

/** 날짜별 계획 스냅샷 — 불변, 날짜당 1개 */
export interface DayPlanSnapshot {
  dateKey: string;
  capturedAt: number; // epoch ms — 스냅샷 시각(감사용)
  items: PlanItem[];
}

interface ReviewState {
  snapshots: Record<string, DayPlanSnapshot>; // dateKey → 스냅샷
}

interface ReviewActions {
  /** 그날 첫 조회 시 계획 스냅샷 저장 — 이미 있으면 no-op(불변). 저장 후 최근 7일로 정리(§16). */
  captureSnapshot(dateKey: string, items: PlanItem[]): void;
}

type PersistedReviewState = Pick<ReviewState, 'snapshots'>;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 최근 RETENTION_DAYS개 dateKey만 남긴다(문자열 내림차순 = 최신 우선) */
function pruneSnapshots(snapshots: Record<string, DayPlanSnapshot>): Record<string, DayPlanSnapshot> {
  const keys = Object.keys(snapshots)
    .filter((k) => DATE_KEY_RE.test(k))
    .sort((a, b) => b.localeCompare(a));
  const kept: Record<string, DayPlanSnapshot> = {};
  for (const key of keys.slice(0, RETENTION_DAYS)) kept[key] = snapshots[key];
  return kept;
}

/** 로드 시 구조 가드 — 잘못된 항목 드롭 후 7일 정리(§3.1 sanitize 규율 계승) */
function sanitizeSnapshots(raw: unknown): Record<string, DayPlanSnapshot> {
  const out: Record<string, DayPlanSnapshot> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!DATE_KEY_RE.test(key)) continue;
    if (typeof value !== 'object' || value === null) continue;
    const snap = value as Record<string, unknown>;
    if (!Array.isArray(snap.items)) continue;
    const items: PlanItem[] = [];
    for (const it of snap.items) {
      if (typeof it !== 'object' || it === null) continue;
      const item = it as Record<string, unknown>;
      if (
        typeof item.id !== 'string' ||
        typeof item.startMin !== 'number' ||
        typeof item.endMin !== 'number'
      )
        continue;
      items.push({
        id: item.id,
        title: typeof item.title === 'string' ? item.title : '',
        startMin: item.startMin,
        endMin: item.endMin,
      });
    }
    out[key] = {
      dateKey: key,
      capturedAt: typeof snap.capturedAt === 'number' ? snap.capturedAt : Date.now(),
      items,
    };
  }
  return pruneSnapshots(out);
}

// 타입 주석은 create<T>()(persist(...)) 추론에 맡김(persist 뮤테이터 타이핑 보존 — §3.1).
export const useReviewStore = create<ReviewState & ReviewActions>()(
  persist(
    (set, get) => ({
      snapshots: {},

      captureSnapshot: (dateKey, items) => {
        if (get().snapshots[dateKey]) return; // 불변 — 첫 조회 시점 고정(§16)
        const snapshot: DayPlanSnapshot = { dateKey, capturedAt: Date.now(), items };
        set((s) => ({ snapshots: pruneSnapshots({ ...s.snapshots, [dateKey]: snapshot }) }));
      },
    }),
    {
      name: 'dayblocks:review',
      version: 1,
      storage: createSafeStorage<PersistedReviewState>(),
      partialize: (s) => ({ snapshots: s.snapshots }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Record<keyof PersistedReviewState, unknown>>;
        return { ...current, snapshots: sanitizeSnapshots(p.snapshots) };
      },
    },
  ),
);
