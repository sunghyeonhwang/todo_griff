import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import BottomSheet from './BottomSheet';
import ColorSwatchRow from './ColorSwatchRow';
import IconGrid from './IconGrid';
import { requestNotificationPermission } from '../lib/alarms';
import { DEFAULT_ICON_ID, resolveIcon } from '../lib/icons';
import { STRINGS } from '../lib/strings';
import { useQueSyncStore } from '../store/queSync';
import {
  DAY_MINUTES,
  MIN_DURATION,
  STORE_SNAP,
  formatFullDate,
  formatMinutes,
  isTodayKey,
} from '../lib/time';
import { ALARM_OFFSETS, DEFAULT_COLOR, useBlocksStore } from '../store/blocksStore';
import { useUiStore } from '../store/uiStore';
import type { AlarmOffset, BlockColor, EditorState } from '../types';

// 에디터 바텀시트 — DESIGN.md §5 (Structured 아나토미)
// 레이아웃(사용자 제공 스크린샷 기준):
//   [컬러 헤더 밴드 --blk-solid] X 닫기 · 대형 원형 아이콘 배지(탭=피커) ·
//     "10:00 ~ 10:15 (15분)" 요약 · 밑줄 제목 입력 · (edit) 완료 원
//   [본문 surface-background] 날짜 행 카드 → (피커 카드) → 시간 카드 →
//     소요시간 pill 선택기 → 알림 카드 → 메모 카드 → 삭제
//   [하단 대형 저장 pill]
// 로직 불변식(기존 유지):
// - 호출 3곳(카드 탭 / 드래그 생성 릴리즈 / FAB)이 uiStore.editor만 세팅, 인스턴스는 App에 1개.
// - 타이핑 드래프트는 에디터 로컬 state — 스토어는 "열려 있음 + 대상"만 안다(타임라인 리렌더 차단).
// - 저장 시맨틱: 명시적 저장 — 스토어 변이는 저장 버튼의 add/update 정확히 1회.
// - 빈 제목은 스토어가 '새 일정'으로 대체(§2). 저장 비활성 조건은 end ≤ start 하나뿐.
// - 알림 토글: 최초 켜기의 사용자 제스처 안에서만 권한 요청(lib/alarms 경유 §9).

const DELETE_CONFIRM_MS = 3000;              // 탭-어게인 확인 유지 시간(§5 — "3초간")
const DEFAULT_ALARM_OFFSET: AlarmOffset = 10; // 최초 켜기 기본 오프셋(§5 미규정 — 10분 전 채택)
/** 소요시간 pill 프리셋(분) — Structured 스크린샷 기준(§5) */
const DURATION_PRESETS = [15, 30, 45, 60, 90, 120] as const;

type OpenEditor = Exclude<EditorState, { mode: 'closed' }>;

interface FormState {
  title: string;
  icon: string;
  color: BlockColor;
  startMin: number;
  endMin: number;
  alarmOn: boolean;
  alarmOffset: AlarmOffset; // 꺼도 세션 동안 오프셋 유지(§2)
  note: string;
  project: string;
  completed: boolean; // 밴드 우측 완료 원(edit 전용) — 저장 시 update에만 반영
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
        icon: b.icon,
        color: b.color,
        startMin: b.startMin,
        endMin: b.endMin,
        alarmOn: b.alarm !== null,
        alarmOffset: b.alarm ?? DEFAULT_ALARM_OFFSET,
        note: b.note,
        project: b.project,
        completed: b.completed,
      };
    }
  }
  // create 드래프트 (edit 대상이 사라진 극단 케이스는 빈 기본값으로 강등)
  const draft =
    editor.mode === 'create' ? editor.draft : { startMin: 0, endMin: MIN_DURATION };
  return {
    title: '',
    icon: DEFAULT_ICON_ID,
    color: DEFAULT_COLOR,
    startMin: draft.startMin,
    endMin: draft.endMin,
    alarmOn: false,
    alarmOffset: DEFAULT_ALARM_OFFSET,
    note: '',
    project: '',
    completed: false,
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

  // Que 프로젝트 자동완성 후보 — 현재 로컬 데이터에서 유도(별도 엔드포인트 없이): 연동 블록의
  // project + 인박스(무시간 태스크)의 projectLabel. 폼은 열 때마다 리마운트(key)라 getState로 충분.
  const queProjects = useMemo(() => {
    const set = new Set<string>();
    const blocks = useBlocksStore.getState().blocks;
    for (const id in blocks) {
      const b = blocks[id];
      if (b.queTaskId && b.project) set.add(b.project); // 연동 블록의 project = Que 파생
    }
    for (const t of useQueSyncStore.getState().inbox) {
      if (t.projectLabel) set.add(t.projectLabel);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
  }, []);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [showIosHint] = useState(
    () => isIosSafariNonStandalone() && !installHintDismissedSession,
  );
  const [iosHintDismissed, setIosHintDismissed] = useState(false);

  const timeValid = form.endMin > form.startMin; // end ≤ start → 저장 비활성 + 힌트(§5)
  // 날짜 행 표시용 — edit는 대상 블록의 dateKey(폼 열림 시점 고정 값이라 getState로 충분)
  const dateKey =
    editor.mode === 'create'
      ? editor.draft.dateKey
      : (useBlocksStore.getState().blocks[editor.blockId]?.dateKey ??
        useUiStore.getState().activeDateKey);

  // ----- 저장 / 취소 -----
  const handleSave = () => {
    if (!timeValid) return;
    const fields = {
      title: form.title,
      icon: form.icon,
      color: form.color,
      startMin: form.startMin,
      endMin: form.endMin,
      alarm: form.alarmOn ? form.alarmOffset : null,
      note: form.note,
      project: form.project,
    };
    if (editor.mode === 'create') addBlock({ dateKey: editor.draft.dateKey, ...fields });
    else updateBlock(editor.blockId, { ...fields, completed: form.completed });
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

  const summary = STRINGS.editor.timeSummary(
    formatMinutes(form.startMin),
    formatMinutes(form.endMin),
    STRINGS.duration(Math.max(form.endMin - form.startMin, 0)),
  );

  return (
    // BottomSheet의 px-4·pb-safe를 -m로 상쇄 — 밴드/본문이 시트 전폭·전고를 차지(§5)
    <div className="-mx-4 -mb-[calc(env(safe-area-inset-bottom)+8px)] flex flex-col">
      {/* ── 컬러 헤더 밴드(--blk-solid): X · 배지 · 시간 요약 + 밑줄 제목 · (edit) 완료 원 ──
          밴드 위 컨트롤(X·완료 원·포커스 밑줄)은 테마 무관 흰 계열(rgba/white)로 고정 —
          surface-card를 쓰면 다크에서 검은 원이 떠 보인다(§5, 2026-07-10 수정). */}
      <div data-color={form.color} className="bg-(--blk-solid) px-4 pt-1 pb-6">
        <button
          type="button"
          aria-label={STRINGS.editor.close}
          onClick={closeEditor}
          className="flex size-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.25)] text-text-on-solid active:scale-95"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            className="size-4"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="mt-2 flex items-center gap-4">
          <button
            type="button"
            aria-label={STRINGS.editor.iconButtonLabel}
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((v) => !v)}
            className="flex size-20 shrink-0 items-center justify-center rounded-full bg-[rgba(255,255,255,0.25)] active:scale-95"
          >
            <img src={resolveIcon(form.icon).src} alt="" className="size-16" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm tabular-nums text-text-on-solid/85">{summary}</div>
            <input
              type="text"
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={STRINGS.editor.titlePlaceholder}
              autoFocus={editor.mode === 'create'}
              className="w-full border-b-2 border-[rgba(255,255,255,0.5)] bg-transparent pb-1 text-xl font-semibold text-text-on-solid outline-none placeholder:text-text-on-solid/60 focus:border-white"
            />
          </div>
          {isEdit && (
            <button
              type="button"
              aria-label={STRINGS.card.completeLabel}
              aria-pressed={form.completed}
              onClick={() => patch({ completed: !form.completed })}
              className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-[rgba(255,255,255,0.7)] transition-colors duration-(--duration-fast) ${
                form.completed ? 'bg-white text-(--blk-solid)' : 'text-transparent'
              }`}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── 본문(surface-background 위 흰 카드 섹션들) ── */}
      <div className="flex flex-col gap-4 bg-surface-background px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        {/* 날짜 행 카드 — 표시 전용(활성 날짜) */}
        <div className="flex items-center gap-2.5 rounded-lg bg-surface-card px-3.5 py-3 shadow-sm">
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="size-5 shrink-0 text-accent-primary"
          >
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
          </svg>
          <span className="min-w-0 flex-1 truncate text-base text-text-primary">
            {formatFullDate(dateKey)}
          </span>
          {isTodayKey(dateKey) && (
            <span className="shrink-0 text-sm text-text-tertiary">{STRINGS.header.today}</span>
          )}
        </div>

        {/* 아이콘·색상 피커 카드 — 밴드 배지 탭으로 토글 */}
        {pickerOpen && (
          <div className="flex flex-wrap items-start gap-4 rounded-lg bg-surface-card p-3.5 shadow-sm">
            <IconGrid value={form.icon} onSelect={(icon) => patch({ icon })} />
            <ColorSwatchRow value={form.color} onSelect={(color) => patch({ color })} />
          </div>
        )}

        {/* 시간 섹션 — 네이티브 time input ×2 (§5 필드 4: iOS 휠 step 무시는 저장 시 스냅 흡수) */}
        <section className="flex flex-col gap-2">
          <h3 className="px-1 text-lg font-bold text-text-primary">
            {STRINGS.editor.timeSection}
          </h3>
          <div className="flex items-start gap-3 rounded-lg bg-surface-card p-3.5 shadow-sm">
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
            <p role="alert" className="px-1 text-xs text-accent-danger">
              {STRINGS.editor.timeOrderHint}
            </p>
          )}
        </section>

        {/* 소요시간 pill 선택기 — 탭 = endMin 재설정(일 경계 클램프) */}
        <section className="flex flex-col gap-2">
          <h3 className="px-1 text-lg font-bold text-text-primary">
            {STRINGS.editor.durationSection}
          </h3>
          <div className="flex gap-1 overflow-x-auto rounded-full bg-surface-card p-1.5 shadow-sm">
            {DURATION_PRESETS.map((d) => {
              const active = timeValid && form.endMin - form.startMin === d;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    patch({ endMin: Math.min(form.startMin + d, DAY_MINUTES) })
                  }
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors duration-(--duration-fast) ${
                    active
                      ? 'bg-accent-primary font-semibold text-text-on-solid'
                      : 'text-text-secondary active:bg-surface-background'
                  }`}
                >
                  {STRINGS.duration(d)}
                </button>
              );
            })}
          </div>
        </section>

        {/* 알림 카드 — 토글 + 켜짐 시 오프셋 select + 정직한 한계 안내(§7) */}
        <div className="flex flex-col gap-2 rounded-lg bg-surface-card p-3.5 shadow-sm">
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

        {/* 프로젝트 입력칸 — Que 프로젝트 자동완성(datalist) + 자유 입력. 연동 블록은 프리필됨(§14.4) */}
        <input
          type="text"
          value={form.project}
          onChange={(e) => patch({ project: e.target.value })}
          placeholder={STRINGS.editor.projectPlaceholder}
          aria-label={STRINGS.editor.projectSection}
          list={queProjects.length > 0 ? 'que-project-list' : undefined}
          className="w-full rounded-lg bg-surface-card px-3.5 py-3 text-base text-text-primary shadow-sm outline-none placeholder:text-text-tertiary focus:ring-2 focus:ring-accent-primary"
        />
        {queProjects.length > 0 && (
          <datalist id="que-project-list">
            {queProjects.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        )}

        {/* 메모 카드 */}
        <textarea
          rows={3}
          value={form.note}
          onChange={(e) => patch({ note: e.target.value })}
          placeholder={STRINGS.editor.notePlaceholder}
          className="w-full resize-none rounded-lg bg-surface-card px-3.5 py-3 text-base text-text-primary shadow-sm outline-none placeholder:text-text-tertiary focus:ring-2 focus:ring-accent-primary"
        />

        {/* 삭제 (edit 모드만) — 탭-어게인 확인 */}
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className={`w-full rounded-lg py-3 text-base font-medium text-accent-danger transition-colors duration-(--duration-fast) ${
              deleteArmed ? 'bg-surface-card shadow-sm' : 'active:bg-surface-card'
            }`}
          >
            {deleteArmed ? STRINGS.editor.deleteConfirm : STRINGS.editor.delete}
          </button>
        )}

        {/* 하단 대형 저장 pill (Structured '계속' 위치) */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!timeValid}
          className="w-full rounded-full bg-accent-primary py-3.5 text-base font-semibold text-text-on-solid shadow-sm transition-opacity duration-(--duration-fast) disabled:opacity-40 active:opacity-85"
        >
          {STRINGS.editor.save}
        </button>
      </div>
    </div>
  );
}
