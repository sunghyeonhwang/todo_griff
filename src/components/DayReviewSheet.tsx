import { useMemo } from 'react';
import BottomSheet from './BottomSheet';
import { STRINGS } from '../lib/strings';
import { formatFullDate, formatMinutes } from '../lib/time';
import { useBlocksStore } from '../store/blocksStore';
import { useReviewStore } from '../store/reviewStore';
import { useUiStore } from '../store/uiStore';

// 하루 마감 See 카드 — DESIGN.md §16 (Plan-Do-See의 See)
//
// 조회 전용. 그날 첫 조회 시점의 계획 스냅샷(reviewStore) vs 실제 실행(blocksStore 완료 블록)을
// 비교해 개인 시간을 돌아본다. 개인 시간 회고 전용 — 팀 회고는 Que에서 별도로 한다(§16 분업).
// - 계획 N개·N시간 vs 완료 M개·M시간, 계획 실행률(완료된 계획 / 계획 수).
// - 계획에 없던 추가 블록 수(스냅샷에 없던 id).
// - 밀린(미완료) 계획 목록.
// 스냅샷이 없는 날짜(앱을 안 켠 과거 등)는 교육형 빈 상태. 데이터 변이 없음(BottomSheet 재사용).

/** 분 합을 '2시간 30분' 라벨로 */
function hoursLabel(totalMin: number): string {
  return STRINGS.duration(totalMin);
}

export default function DayReviewSheet({ dateKey }: { dateKey: string }) {
  const open = useUiStore((s) => s.reviewOpen);
  const closeReview = useUiStore((s) => s.closeReview);
  const snapshot = useReviewStore((s) => s.snapshots[dateKey]);
  const blocks = useBlocksStore((s) => s.blocks);

  // 파생 지표 — 셀렉터에서 filter 금지(§3.3): 안정된 맵/스냅샷 선택 후 useMemo로 계산.
  const review = useMemo(() => {
    const dayBlocks = Object.values(blocks).filter((b) => b.dateKey === dateKey);
    const byId = new Map(dayBlocks.map((b) => [b.id, b]));
    const planItems = snapshot?.items ?? [];
    const planIds = new Set(planItems.map((it) => it.id));

    const plannedCount = planItems.length;
    const plannedMin = planItems.reduce((sum, it) => sum + (it.endMin - it.startMin), 0);

    const doneBlocks = dayBlocks.filter((b) => b.completed);
    const doneCount = doneBlocks.length;
    const doneMin = doneBlocks.reduce((sum, b) => sum + (b.endMin - b.startMin), 0);

    // 계획 실행률 = 완료된 계획 항목 / 계획 수 (추가로 완료한 건 addedCount로 별도 표기)
    const completedPlanned = planItems.filter((it) => byId.get(it.id)?.completed).length;
    const rate = plannedCount > 0 ? Math.round((completedPlanned / plannedCount) * 100) : 0;

    // 계획에 없던 추가 블록 수(스냅샷 이후 새로 만든 것)
    const addedCount = dayBlocks.filter((b) => !planIds.has(b.id)).length;

    // 밀린 계획 = 아직 살아있고 미완료인 계획 항목(삭제된 것은 제외)
    const missed = planItems.filter((it) => {
      const b = byId.get(it.id);
      return b && !b.completed;
    });

    return { plannedCount, plannedMin, doneCount, doneMin, rate, addedCount, missed };
  }, [blocks, snapshot, dateKey]);

  const hasSnapshot = snapshot !== undefined;

  return (
    <BottomSheet open={open} onClose={closeReview} label={STRINGS.review.title}>
      <div className="flex flex-col gap-4 pb-4">
        {/* 헤더 */}
        <div>
          <h2 className="text-xl font-bold text-text-primary">{STRINGS.review.title}</h2>
          <p className="mt-0.5 text-sm text-text-secondary">{formatFullDate(dateKey)}</p>
          <p className="mt-1 text-xs text-text-tertiary">{STRINGS.review.subtitle}</p>
        </div>

        {!hasSnapshot ? (
          <p className="rounded-lg bg-surface-background px-4 py-6 text-center text-sm text-text-secondary">
            {STRINGS.review.empty}
          </p>
        ) : (
          <>
            {/* 계획 실행률 바 */}
            <div className="flex flex-col gap-2 rounded-lg bg-surface-card px-4 py-3.5 shadow-sm">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-text-secondary">
                  {STRINGS.review.rateLabel(review.rate)}
                </span>
                <span className="text-2xl font-bold tabular-nums text-accent-primary">
                  {review.rate}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-background">
                <div
                  role="progressbar"
                  aria-valuenow={review.rate}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-full rounded-full bg-accent-primary transition-[width] duration-(--duration-base)"
                  style={{ width: `${review.rate}%` }}
                />
              </div>
            </div>

            {/* 계획 vs 완료 요약 2열 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface-card px-4 py-3 shadow-sm">
                <div className="text-xs text-text-tertiary">{STRINGS.review.planned}</div>
                <div className="mt-1 text-base font-semibold text-text-primary tabular-nums">
                  {STRINGS.review.countHours(review.plannedCount, hoursLabel(review.plannedMin))}
                </div>
              </div>
              <div className="rounded-lg bg-surface-card px-4 py-3 shadow-sm">
                <div className="text-xs text-text-tertiary">{STRINGS.review.done}</div>
                <div className="mt-1 text-base font-semibold text-accent-success tabular-nums">
                  {STRINGS.review.countHours(review.doneCount, hoursLabel(review.doneMin))}
                </div>
              </div>
            </div>

            {/* 계획에 없던 추가 일정 */}
            <div className="rounded-lg bg-surface-card px-4 py-3 text-sm text-text-secondary shadow-sm">
              {STRINGS.review.added(review.addedCount)}
            </div>

            {/* 밀린 계획 목록 */}
            <section className="flex flex-col gap-2">
              <h3 className="px-1 text-sm font-semibold text-text-primary">
                {STRINGS.review.missedTitle}
              </h3>
              {review.missed.length === 0 ? (
                <p className="rounded-lg bg-surface-card px-4 py-3 text-sm text-text-tertiary shadow-sm">
                  {STRINGS.review.missedEmpty}
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {review.missed.map((it) => (
                    <li
                      key={it.id}
                      className="flex items-center justify-between gap-3 rounded-lg bg-surface-card px-4 py-3 shadow-sm"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                        {it.title}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-text-tertiary">
                        {formatMinutes(it.startMin)} – {formatMinutes(it.endMin)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
