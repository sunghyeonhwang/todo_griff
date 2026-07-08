import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import BottomSheet from './BottomSheet';
import ColorSwatchRow from './ColorSwatchRow';
import EmojiGrid from './EmojiGrid';
import { requestNotificationPermission } from '../lib/alarms';
import { DEFAULT_EMOJI } from '../lib/emojis';
import { STRINGS } from '../lib/strings';
import { DAY_MINUTES, MIN_DURATION, STORE_SNAP, formatMinutes } from '../lib/time';
import { ALARM_OFFSETS, DEFAULT_COLOR, useBlocksStore } from '../store/blocksStore';
import { useUiStore } from '../store/uiStore';
import type { AlarmOffset, BlockColor, EditorState } from '../types';

// 에디터 바텀시트 — DESIGN.md §5
// - 호출 3곳(카드 탭 / 드래그 생성 릴리즈 / 헤더 "+")이 uiStore.editor만 세팅, 인스턴스는 App에 1개.
// - 타이핑 드래프트는 에디터 로컬 state — 스토어는 "열려 있음 + 대상"만 안다(타임라인 리렌더 차단).
// - 저장 시맨틱: 명시적 저장 — 스토어 변이는 저장 버튼의 add/update 정확히 1회, 취소는 자명하게 무변경.
// - 빈 제목은 스토어가 '새 일정'으로 대체(§2) — 제목 때문에 저장이 비활성화되는 일 없음.
//   저장 비활성 조건은 end ≤ start 하나뿐(인라인 힌트 병행).
// - 알림 토글: 최초 켜기의 사용자 제스처 안에서만 권한 요청(lib/alarms 경유 §9) —
//   발화는 30초 폴링 스케줄러(§7). 거부/미지원이어도 인앱 토스트로 발화(기능 유지).

const DELETE_CONFIRM_MS = 3000;              // 탭-어게인 확인 유지 시간(§5 — "3초간")
const DEFAULT_ALARM_OFFSET: AlarmOffset = 10; // 최초 켜기 기본 오프셋(§5 미규정 — 10분 전 채택)

type OpenEditor = Exclude<EditorState, { mode: 'closed' }>;

interface FormState {
  title: string;
  emoji: string;
  color: BlockColor;
  startMin: number;
  endMin: number;
  alarmOn: boolean;
  alarmOffset: AlarmOffset; // 꺼도 세션 동안 오프셋 유지(§2)
  note: string;
}

// ---------- time input 값 ↔ 분 ----------
// endMin=1440(24:00)은 <input type="time">이 표현 불가 → 23:59로 표시하고,
// 사용자가 23:59를 고르면 저장 시 5분 스냅(스토어)이 1439→1440으로 복원(§5 필드 4).
function minutesToInputValue(min: number): string {
  return min >= DAY_MINUTES ? formatMinutes(DAY_MINUTES - 1) : formatMinutes(min);
}

function inputValueToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

// iOS Safari 비-standalone: Notification 자체가 없음(§7) → 설치 힌트 노출 대상(§5)
function isIosSafariNonStandalone(): boolean {
  const ua = navigator.userAgent;
  const isIos =
    /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return !standalone;
}

// 힌트 닫기는 앱 세션 동안 유지(모듈 스코프 — 영속 대상 아님)
let installHintDismissedSession = false;

export default function BlockEditor() {
  const editor = useUiStore((s) => s.editor);
  const closeEditor = useUiStore((s) => s.closeEditor);

  // 닫힘 애니메이션(320ms) 동안 마지막 열림 상태로 폼을 유지 — 내용 선(先)소멸 플래시 방지.
  // 열림 전이마다 seq 증가 → key 리마운트로 폼 state가 항상 신선하다.
  const lastOpenRef = useRef<OpenEditor | null>(null);
  const sessionSeqRef = useRef(0);
  if (editor.mode !== 'closed' && editor !== lastOpenRef.current) {
    lastOpenRef.current = editor;
    sessionSeqRef.current += 1;
  }
  const open = editor.mode !== 'closed';
  const view = open ? (editor as OpenEditor) : lastOpenRef.current;

  return (
    <BottomSheet
      open={open}
      onClose={closeEditor}
      label={view?.mode === 'edit' ? STRINGS.editor.editTitle : STRINGS.editor.createTitle}
    >
      {view && <EditorForm key={sessionSeqRef.current} editor={view} />}
    </BottomSheet>
  );
}

// ---------- 폼 ----------

function initialForm(editor: OpenEditor): FormState {
  if (editor.mode === 'edit') {
    const b = useBlocksStore.getState().blocks[editor.blockId];
    if (b) {
      return {
        title: b.title,
        emoji: b.emoji,
        color: b.color,
        startMin: b.startMin,
        endMin: b.endMin,
        alarmOn: b.alarm !== null,
        alarmOffset: b.alarm ?? DEFAULT_ALARM_OFFSET,
        note: b.note,
      };
    }
  }
  // create 드래프트 (edit 대상이 사라진 극단 케이스는 빈 기본값으로 강등)
  const draft =
    editor.mode === 'create' ? editor.draft : { startMin: 0, endMin: MIN_DURATION };
  return {
    title: '',
    emoji: DEFAULT_EMOJI,
    color: DEFAULT_COLOR,
    startMin: draft.startMin,
    endMin: draft.endMin,
    alarmOn: false,
    alarmOffset: DEFAULT_ALARM_OFFSET,
    note: '',
  };
}

function EditorForm({ editor }: { editor: OpenEditor }) {
  const { closeEditor, select, notifPermission, setNotifPermission } = useUiStore(
    useShallow((s) => ({
      closeEditor: s.closeEditor,
      select: s.select,
      notifPermission: s.notifPermission,
      setNotifPermission: s.setNotifPermission,
    })),
  );
  const { addBlock, updateBlock, deleteBlock } = useBlocksStore(
    useShallow((s) => ({
      addBlock: s.addBlock,
      updateBlock: s.updateBlock,
      deleteBlock: s.deleteBlock,
    })),
  );

  const isEdit = editor.mode === 'edit';
  const [form, setForm] = useState<FormState>(() => initialForm(editor));
  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [showIosHint] = useState(
    () => isIosSafariNonStandalone() && !installHintDismissedSession,
  );
  const [iosHintDismissed, setIosHintDismissed] = useState(false);

  const timeValid = form.endMin > form.startMin; // end ≤ start → 저장 비활성 + 힌트(§5)

  // ----- 저장 / 취소 -----
  const handleSave = () => {
    if (!timeValid) return;
    const fields = {
      title: form.title,
      emoji: form.emoji,
      color: form.color,
      startMin: form.startMin,
      endMin: form.endMin,
      alarm: form.alarmOn ? form.alarmOffset : null,
      note: form.note,
    };
    if (editor.mode === 'create') addBlock({ dateKey: editor.draft.dateKey, ...fields });
    else updateBlock(editor.blockId, fields);
    closeEditor();
  };

  // ----- 삭제: 탭-어게인 확인(§5 — window.confirm 금지) -----
  const deleteTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (deleteTimerRef.current !== null) window.clearTimeout(deleteTimerRef.current);
    },
    [],
  );
  const handleDelete = () => {
    if (editor.mode !== 'edit') return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      deleteTimerRef.current = window.setTimeout(() => setDeleteArmed(false), DELETE_CONFIRM_MS);
      return;
    }
    if (deleteTimerRef.current !== null) window.clearTimeout(deleteTimerRef.current);
    deleteBlock(editor.blockId);
    select(null);
    closeEditor();
  };

  // ----- 알림 토글: 최초 켜기 = 사용자 제스처 안에서만 권한 요청(§5·§7, lib/alarms 경유 §9) -----
  const handleAlarmToggle = () => {
    const next = !form.alarmOn;
    patch({ alarmOn: next });
    if (next && notifPermission === 'default') {
      void requestNotificationPermission().then(setNotifPermission);
    }
  };

  const dismissIosHint = () => {
    installHintDismissedSession = true;
    setIosHintDismissed(true);
  };

  return (
    <div className="flex flex-col gap-4 pb-2">
      {/* 1. 헤더 행: 취소 · 타이틀 · 저장 */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={closeEditor}
          className="h-9 shrink-0 rounded-full px-2 text-base text-text-secondary active:bg-surface-background"
        >
          {STRINGS.editor.cancel}
        </button>
        <h2 className="min-w-0 truncate text-base font-semibold text-text-primary">
          {isEdit ? STRINGS.editor.editTitle : STRINGS.editor.createTitle}
        </h2>
        <button
          type="button"
          onClick={handleSave}
          disabled={!timeValid}
          className="h-9 shrink-0 rounded-full px-2 text-base font-semibold text-accent-primary disabled:opacity-40 active:bg-surface-background"
        >
          {STRINGS.editor.save}
        </button>
      </div>

      {/* 2. 제목 — create 모드만 autoFocus(§5) */}
      <input
        type="text"
        value={form.title}
        onChange={(e) => patch({ title: e.target.value })}
        placeholder={STRINGS.editor.titlePlaceholder}
        autoFocus={editor.mode === 'create'}
        className="w-full rounded-md bg-surface-background px-3 py-2.5 text-md text-text-primary outline-none placeholder:text-text-tertiary focus:ring-2 focus:ring-accent-primary"
      />

      {/* 3. 이모지 버튼(44×44) → 인라인 그리드 + 색상 스와치 */}
      <div data-color={form.color}>
        <button
          type="button"
          aria-label={STRINGS.editor.emojiButtonLabel}
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((v) => !v)}
          className="flex size-11 items-center justify-center rounded-md bg-(--blk-bg) text-lg"
        >
          {form.emoji}
        </button>
        {pickerOpen && (
          <div className="mt-2 flex flex-wrap items-start gap-4 rounded-md bg-surface-background p-3">
            <EmojiGrid value={form.emoji} onSelect={(emoji) => patch({ emoji })} />
            <ColorSwatchRow value={form.color} onSelect={(color) => patch({ color })} />
          </div>
        )}
      </div>

      {/* 4. 시간 범위 — 네이티브 time input ×2, step 5분(iOS 휠 무시는 저장 시 스냅 흡수 §5) */}
      <div className="flex items-start gap-3">
        <label className="flex flex-1 flex-col gap-1 text-xs text-text-secondary">
          {STRINGS.editor.startLabel}
          <input
            type="time"
            step={STORE_SNAP * 60}
            value={minutesToInputValue(form.startMin)}
            onChange={(e) => {
              const m = inputValueToMinutes(e.target.value);
              if (m !== null) patch({ startMin: m });
            }}
            className="rounded-md bg-surface-background px-3 py-2 text-base text-text-primary tabular-nums outline-none focus:ring-2 focus:ring-accent-primary"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs text-text-secondary">
          {STRINGS.editor.endLabel}
          <input
            type="time"
            step={STORE_SNAP * 60}
            value={minutesToInputValue(form.endMin)}
            onChange={(e) => {
              const m = inputValueToMinutes(e.target.value);
              if (m !== null) patch({ endMin: m });
            }}
            className="rounded-md bg-surface-background px-3 py-2 text-base text-text-primary tabular-nums outline-none focus:ring-2 focus:ring-accent-primary"
          />
        </label>
      </div>
      {!timeValid && (
        <p role="alert" className="-mt-2 text-xs text-accent-danger">
          {STRINGS.editor.timeOrderHint}
        </p>
      )}

      {/* 5. 알림 — 토글(UI만, 발화는 Stage 6) + 켜짐 시 오프셋 select + 정직한 한계 안내 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base text-text-primary">{STRINGS.editor.alarmLabel}</span>
          <div className="flex items-center gap-2">
            {form.alarmOn && (
              <select
                aria-label={STRINGS.editor.alarmLabel}
                value={form.alarmOffset}
                onChange={(e) => patch({ alarmOffset: Number(e.target.value) as AlarmOffset })}
                className="rounded-md bg-surface-background px-2 py-1.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent-primary"
              >
                {ALARM_OFFSETS.map((offset) => (
                  <option key={offset} value={offset}>
                    {STRINGS.editor.alarmOffsets[offset]}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={form.alarmOn}
              aria-label={STRINGS.editor.alarmLabel}
              onClick={handleAlarmToggle}
              className={`h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors duration-(--duration-fast) ${
                form.alarmOn ? 'bg-accent-primary' : 'bg-surface-timeline-line'
              }`}
            >
              <span
                className={`block size-6 rounded-full bg-surface-card shadow-sm transition-transform duration-(--duration-fast) ${
                  form.alarmOn ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        </div>
        <p className="text-xs text-text-tertiary">{STRINGS.editor.alarmCaveat}</p>
        {showIosHint && !iosHintDismissed && (
          <div className="flex items-start gap-2 rounded-md bg-surface-background p-2.5">
            <p className="min-w-0 flex-1 text-xs text-text-secondary">
              {STRINGS.editor.installHint}
            </p>
            <button
              type="button"
              aria-label={STRINGS.editor.dismissHint}
              onClick={dismissIosHint}
              className="shrink-0 px-1 text-xs text-text-tertiary"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 6. 메모 */}
      <textarea
        rows={3}
        value={form.note}
        onChange={(e) => patch({ note: e.target.value })}
        placeholder={STRINGS.editor.notePlaceholder}
        className="w-full resize-none rounded-md bg-surface-background px-3 py-2.5 text-base text-text-primary outline-none placeholder:text-text-tertiary focus:ring-2 focus:ring-accent-primary"
      />

      {/* 7. 삭제 (edit 모드만) — 하단 분리, 탭-어게인 확인 */}
      {isEdit && (
        <button
          type="button"
          onClick={handleDelete}
          className={`mt-2 w-full rounded-md py-3 text-base font-medium text-accent-danger transition-colors duration-(--duration-fast) ${
            deleteArmed ? 'bg-surface-background' : 'active:bg-surface-background'
          }`}
        >
          {deleteArmed ? STRINGS.editor.deleteConfirm : STRINGS.editor.delete}
        </button>
      )}
    </div>
  );
}
