import { useMemo, useState } from 'react';
import OkrEditor, { type OkrEditorState } from './OkrEditor';
import { STRINGS } from '../lib/strings';
import { quarterKey, quarterLabel, shiftQuarter } from '../lib/time';
import { krProgress, objectiveProgress, useOkrStore } from '../store/okrStore';
import type { KeyResult, Objective } from '../types';

// 목표(OKR) 화면 — DESIGN.md §15. 하단 탭 '목표'가 여는 두 번째 화면.
// 분기 내비(‹ 2026년 3분기 ›) + 목표 카드(진행률 바 + KR 행) + 교육형 빈 상태(첫 사용 가이드).
// 진척 ±는 카드에서 즉시 커밋(bumpKeyResult — §4.9 체크박스와 동급의 명시적-저장 예외),
// 그 외 생성·편집·삭제는 전부 OkrEditor 시트의 저장 버튼 1회 커밋.

export default function OkrScreen() {
  const [quarter, setQuarter] = useState(() => quarterKey(new Date()));
  const [editor, setEditor] = useState<OkrEditorState>(null);
  const objectives = useOkrStore((s) => s.objectives);
  const keyResults = useOkrStore((s) => s.keyResults);

  const quarterObjectives = useMemo(
    () =>
      Object.values(objectives)
        .filter((o) => o.quarter === quarter)
        .sort((a, b) => a.createdAt - b.createdAt),
    [objectives, quarter],
  );
  const krsByObjective = useMemo(() => {
    const map = new Map<string, KeyResult[]>();
    for (const kr of Object.values(keyResults)) {
      const list = map.get(kr.objectiveId) ?? [];
      list.push(kr);
      map.set(kr.objectiveId, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.createdAt - b.createdAt);
    return map;
  }, [keyResults]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 분기 내비 — DateHeader 1행과 같은 문법(‹ 라벨 ›) */}
      <header className="flex shrink-0 items-center gap-1 border-b border-surface-timeline-line bg-surface-card px-2 py-2 pt-[calc(env(safe-area-inset-top)+8px)]">
        <button
          type="button"
          aria-label={STRINGS.okr.prevQuarter}
          onClick={() => setQuarter((q) => shiftQuarter(q, -1))}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-lg text-text-secondary active:bg-surface-background"
        >
          ‹
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-md font-semibold text-text-primary">
          {quarterLabel(quarter)}
        </h1>
        <button
          type="button"
          aria-label={STRINGS.okr.nextQuarter}
          onClick={() => setQuarter((q) => shiftQuarter(q, 1))}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-lg text-text-secondary active:bg-surface-background"
        >
          ›
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-background p-4">
        {quarterObjectives.length === 0 ? (
          <EmptyPrimer />
        ) : (
          <div className="flex flex-col gap-3">
            {quarterObjectives.map((o) => (
              <ObjectiveCard
                key={o.id}
                objective={o}
                krs={krsByObjective.get(o.id) ?? []}
                onEdit={() => setEditor({ kind: 'obj-edit', id: o.id })}
                onAddKr={() => setEditor({ kind: 'kr-create', objectiveId: o.id })}
                onEditKr={(id) => setEditor({ kind: 'kr-edit', id })}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setEditor({ kind: 'obj-create', quarter })}
          className="mt-4 w-full rounded-lg border border-dashed border-surface-timeline-line py-3 text-sm font-medium text-accent-primary active:bg-surface-card"
        >
          + {STRINGS.okr.addObjective}
        </button>
      </div>

      <OkrEditor state={editor} onClose={() => setEditor(null)} />
    </div>
  );
}

/** 교육형 빈 상태 — 첫 사용 가이드(왜→무엇→어떻게→예시, 로드맵 E-F 요건). */
function EmptyPrimer() {
  return (
    <div className="rounded-xl bg-surface-card p-5 shadow-sm">
      <p className="text-base font-semibold text-text-primary">{STRINGS.okr.emptyTitle}</p>
      <div className="mt-3 flex flex-col gap-2.5 text-sm leading-relaxed text-text-secondary">
        <p>{STRINGS.okr.emptyWhy}</p>
        <p>{STRINGS.okr.emptyWhat}</p>
        <p>{STRINGS.okr.emptyHow}</p>
        <p className="text-text-tertiary">{STRINGS.okr.emptyExample}</p>
      </div>
    </div>
  );
}

function ObjectiveCard({
  objective,
  krs,
  onEdit,
  onAddKr,
  onEditKr,
}: {
  objective: Objective;
  krs: KeyResult[];
  onEdit: () => void;
  onAddKr: () => void;
  onEditKr: (id: string) => void;
}) {
  const bump = useOkrStore((s) => s.bumpKeyResult);
  const pct = Math.round(objectiveProgress(krs) * 100);

  return (
    <section className="rounded-xl bg-surface-card p-4 shadow-sm">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${objective.title} — ${STRINGS.okr.editObjective}`}
        className="flex w-full items-center gap-2 text-left"
      >
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-text-primary">
          {objective.title}
        </h2>
        <span className="shrink-0 text-sm font-semibold text-accent-primary tabular-nums">
          {pct}%
        </span>
      </button>
      {/* 진행률 바 — KR 진행률 평균(§15) */}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={STRINGS.okr.progressLabel(pct)}
        className="mt-2 h-2 overflow-hidden rounded-full bg-surface-background"
      >
        <div
          className="h-full rounded-full bg-accent-primary transition-[width] duration-(--duration-fast)"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex flex-col">
        {krs.map((kr) => (
          <KrRow key={kr.id} kr={kr} onEdit={() => onEditKr(kr.id)} onBump={(d) => bump(kr.id, d)} />
        ))}
      </div>

      <button
        type="button"
        onClick={onAddKr}
        className="mt-1 w-full rounded-md py-2 text-sm font-medium text-accent-primary active:bg-surface-background"
      >
        + {STRINGS.okr.addKeyResult}
      </button>
    </section>
  );
}

function KrRow({
  kr,
  onEdit,
  onBump,
}: {
  kr: KeyResult;
  onEdit: () => void;
  onBump: (delta: 1 | -1) => void;
}) {
  const pct = Math.round(krProgress(kr) * 100);
  return (
    <div className="flex min-h-11 items-center gap-2 border-b border-surface-background py-1.5 last:border-b-0">
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm text-text-primary">{kr.title}</span>
        <span className="text-xs text-text-tertiary tabular-nums">
          {kr.current} / {kr.target}
          {kr.unit && ` ${kr.unit}`} · {pct}%
        </span>
      </button>
      <button
        type="button"
        aria-label={`${kr.title} ${STRINGS.okr.decrement}`}
        onClick={() => onBump(-1)}
        disabled={kr.current <= 0}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-background text-lg text-text-secondary active:opacity-70 disabled:opacity-30"
      >
        −
      </button>
      <button
        type="button"
        aria-label={`${kr.title} ${STRINGS.okr.increment}`}
        onClick={() => onBump(1)}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-primary/10 text-lg text-accent-primary active:opacity-70"
      >
        +
      </button>
    </div>
  );
}
