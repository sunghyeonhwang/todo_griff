import { useEffect, useRef, useState } from 'react';
import BottomSheet from './BottomSheet';
import { STRINGS } from '../lib/strings';
import { useOkrStore } from '../store/okrStore';

// OKR 편집 시트 — DESIGN.md §15. BottomSheet 재사용(§5 크롬 공유).
// 케이스 4개(목표 생성/편집 · KR 생성/편집)를 하나의 시트로 처리한다.
// 저장 시맨틱은 §5와 동일: 명시적 저장 — 스토어 변이는 저장 버튼에서 정확히 1회.
// 삭제는 탭-어게인 확인(§5 — window.confirm 금지). 진입점이 OkrScreen 하나뿐이라
// 에디터 상태는 uiStore가 아니라 화면 로컬 state로 둔다(§3.2 취지).

export type OkrEditorState =
  | null
  | { kind: 'obj-create'; quarter: string }
  | { kind: 'obj-edit'; id: string }
  | { kind: 'kr-create'; objectiveId: string }
  | { kind: 'kr-edit'; id: string };

const DELETE_CONFIRM_MS = 3000; // §5 탭-어게인 유지 시간

const inputClass =
  'w-full rounded-md bg-surface-background px-3 py-2.5 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:ring-2 focus:ring-accent-primary';
const labelClass = 'flex flex-col gap-1.5 text-sm font-medium text-text-secondary';

export default function OkrEditor({
  state,
  onClose,
}: {
  state: OkrEditorState;
  onClose: () => void;
}) {
  // 닫힘 애니메이션 동안 마지막 열림 상태 유지(BlockEditor와 동일 패턴 §5).
  const lastRef = useRef<Exclude<OkrEditorState, null>>(null);
  if (state) lastRef.current = state;
  const view = state ?? lastRef.current;

  const label =
    view?.kind === 'obj-edit'
      ? STRINGS.okr.editObjective
      : view?.kind === 'kr-edit'
        ? STRINGS.okr.editKr
        : view?.kind === 'kr-create'
          ? STRINGS.okr.addKeyResult
          : STRINGS.okr.addObjective;

  return (
    <BottomSheet open={state !== null} onClose={onClose} label={label}>
      {view && (
        <EditorForm key={JSON.stringify(view)} view={view} onClose={onClose} />
      )}
    </BottomSheet>
  );
}

function EditorForm({
  view,
  onClose,
}: {
  view: Exclude<OkrEditorState, null>;
  onClose: () => void;
}) {
  const store = useOkrStore.getState(); // 폼은 열림 시점 값으로 리마운트(key) — getState로 충분
  const isObj = view.kind === 'obj-create' || view.kind === 'obj-edit';
  const existingObj = view.kind === 'obj-edit' ? store.objectives[view.id] : undefined;
  const existingKr = view.kind === 'kr-edit' ? store.keyResults[view.id] : undefined;

  const [title, setTitle] = useState(existingObj?.title ?? existingKr?.title ?? '');
  const [target, setTarget] = useState(existingKr ? String(existingKr.target) : '');
  const [current, setCurrent] = useState(existingKr ? String(existingKr.current) : '0');
  const [unit, setUnit] = useState(existingKr?.unit ?? '');
  const [deleteArmed, setDeleteArmed] = useState(false);

  const targetNum = Number(target);
  const targetValid = isObj || (Number.isFinite(targetNum) && targetNum > 0);

  const save = () => {
    if (!targetValid) return;
    const okr = useOkrStore.getState();
    if (view.kind === 'obj-create') okr.addObjective(view.quarter, title);
    else if (view.kind === 'obj-edit') okr.updateObjective(view.id, { title });
    else if (view.kind === 'kr-create') {
      okr.addKeyResult({
        objectiveId: view.objectiveId,
        title,
        target: targetNum,
        current: Number(current),
        unit,
      });
    } else {
      okr.updateKeyResult(view.id, { title, target: targetNum, current: Number(current), unit });
    }
    onClose();
  };

  // 삭제: 탭-어게인 확인(§5)
  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );
  const canDelete = view.kind === 'obj-edit' || view.kind === 'kr-edit';
  const handleDelete = () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      timerRef.current = window.setTimeout(() => setDeleteArmed(false), DELETE_CONFIRM_MS);
      return;
    }
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const okr = useOkrStore.getState();
    if (view.kind === 'obj-edit') okr.deleteObjective(view.id);
    else if (view.kind === 'kr-edit') okr.deleteKeyResult(view.id);
    onClose();
  };

  return (
    <div className="flex flex-col gap-4 pt-1 pb-2">
      <label className={labelClass}>
        {isObj ? STRINGS.okr.objectiveTitleLabel : STRINGS.okr.krTitleLabel}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={isObj ? STRINGS.okr.objectiveTitlePlaceholder : STRINGS.okr.krTitlePlaceholder}
          autoFocus={view.kind === 'obj-create' || view.kind === 'kr-create'}
          className={inputClass}
        />
      </label>

      {!isObj && (
        <>
          <div className="flex gap-3">
            <label className={`${labelClass} flex-1`}>
              {STRINGS.okr.krTargetLabel}
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={`${labelClass} flex-1`}>
              {STRINGS.okr.krCurrentLabel}
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className={`${labelClass} w-24`}>
              {STRINGS.okr.krUnitLabel}
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder={STRINGS.okr.krUnitPlaceholder}
                className={inputClass}
              />
            </label>
          </div>
          {!targetValid && target !== '' && (
            <p role="alert" className="text-xs text-accent-danger">
              {STRINGS.okr.krTargetHint}
            </p>
          )}
        </>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          className={`w-full rounded-lg py-2.5 text-sm font-medium text-accent-danger transition-colors duration-(--duration-fast) ${
            deleteArmed ? 'bg-surface-background' : 'active:bg-surface-background'
          }`}
        >
          {deleteArmed ? STRINGS.okr.deleteConfirm : STRINGS.okr.delete}
        </button>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!targetValid}
        className="w-full rounded-full bg-accent-primary py-3 text-base font-semibold text-text-on-solid shadow-sm transition-opacity duration-(--duration-fast) disabled:opacity-40 active:opacity-85"
      >
        {STRINGS.okr.save}
      </button>
    </div>
  );
}
