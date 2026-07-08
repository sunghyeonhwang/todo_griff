import { create } from 'zustand';
import type { EditorState } from '../types';
import { shiftDateKey, toDateKey } from '../lib/time';

// 휘발 UI 상태 — DESIGN.md §3.2 (persist 없음)
// 드래그/리사이즈/생성 프리뷰는 여기 두지 않는다 — 훅 로컬 상태로만(§3.2).
// 스토어는 제스처의 시작(에디터 오픈·선택)과 커밋만 안다.

interface UiState {
  activeDateKey: string;               // 초기값 오늘
  editor: EditorState;
  selectedBlockId: string | null;      // 터치에서 리사이즈 핸들 노출 게이트
  notifPermission: NotificationPermission | 'unsupported';
  toast: { seq: number; message: string } | null;
}

interface UiActions {
  goToDate(key: string): void;
  goRelative(delta: 1 | -1): void;
  goToToday(): void;
  openCreate(draft: { dateKey: string; startMin: number; endMin: number }): void;
  openEdit(blockId: string): void;
  closeEditor(): void;
  select(id: string | null): void;
  setNotifPermission(p: NotificationPermission | 'unsupported'): void;
  showToast(message: string): void;
}

function initialNotifPermission(): NotificationPermission | 'unsupported' {
  // iOS Safari 비-standalone은 Notification 자체가 없음(§7) → 'unsupported'
  return typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission
    : 'unsupported';
}

export const useUiStore = create<UiState & UiActions>()((set) => ({
  activeDateKey: toDateKey(new Date()),
  editor: { mode: 'closed' },
  selectedBlockId: null,
  notifPermission: initialNotifPermission(),
  toast: null,

  goToDate: (key) => set({ activeDateKey: key }),
  goRelative: (delta) =>
    set((s) => ({ activeDateKey: shiftDateKey(s.activeDateKey, delta) })),
  // 날짜 변경만 담당 — "오늘" 버튼의 smooth 스크롤은 App이 Timeline 핸들로 배선(§4.7)
  goToToday: () => set({ activeDateKey: toDateKey(new Date()) }),

  openCreate: (draft) => set({ editor: { mode: 'create', draft } }),
  openEdit: (blockId) => set({ editor: { mode: 'edit', blockId } }),
  closeEditor: () => set({ editor: { mode: 'closed' } }),

  select: (id) => set({ selectedBlockId: id }),
  setNotifPermission: (p) => set({ notifPermission: p }),
  showToast: (message) =>
    set((s) => ({ toast: { seq: (s.toast?.seq ?? 0) + 1, message } })),
}));
