// 큐레이션 블록 아이콘 8개 — DESIGN.md §5 필드 3, §9
// 외부 아이콘 팩 금지(이모지 라이브러리 금지 원칙 계승 — 번들·PWA 프리캐시 비대화 방지):
// 이 8개 SVG(src/icons/*.svg)만 번들한다. Vite가 각 import를 해시된 에셋 URL(또는 4KB 미만은
// data URI)로 바꾸고 PWA globPatterns(svg 포함)가 프리캐시한다. IconGrid가 4×2로 렌더.
// 기본값은 'star'(§2 TimeBlock.icon — 사용자 결정 2026-07-08).

import calendar from '../icons/calendar.svg';
import camera from '../icons/camera.svg';
import compass from '../icons/compass.svg';
import design from '../icons/design.svg';
import dialog from '../icons/dialog.svg';
import notification from '../icons/notification.svg';
import paperplane from '../icons/paperplane.svg';
import star from '../icons/star.svg';
import { STRINGS } from './strings';

export interface BlockIcon {
  /** 안정 키 — TimeBlock.icon에 저장(§2). 파일명이 바뀌어도 이 id는 유지한다. */
  id: string;
  /** 한글 라벨 — STRINGS.icons 단일 소스(피커 aria-label). */
  label: string;
  /** Vite 에셋 URL(해시·PWA 프리캐시) — <img src>로 렌더. */
  src: string;
}

// 배열 순서 = 피커 그리드(4×2) 순서. 첫 칸이 기본값(star).
export const CURATED_ICONS: readonly BlockIcon[] = [
  { id: 'star', label: STRINGS.icons.star, src: star },
  { id: 'calendar', label: STRINGS.icons.calendar, src: calendar },
  { id: 'dialog', label: STRINGS.icons.dialog, src: dialog },
  { id: 'notification', label: STRINGS.icons.notification, src: notification },
  { id: 'paperplane', label: STRINGS.icons.paperplane, src: paperplane },
  { id: 'camera', label: STRINGS.icons.camera, src: camera },
  { id: 'design', label: STRINGS.icons.design, src: design },
  { id: 'compass', label: STRINGS.icons.compass, src: compass },
];

/** §2 TimeBlock.icon 기본. addBlock·sanitize·에디터 create가 공유하는 단일 기본값. */
export const DEFAULT_ICON_ID = 'star';

const ICON_BY_ID: Record<string, BlockIcon> = Object.fromEntries(
  CURATED_ICONS.map((i) => [i.id, i]),
);

/** id → 아이콘 디스크립터. 미지 값(구 이모지 문자·삭제된 id)은 기본 아이콘으로 폴백 —
 *  렌더 경로가 항상 유효한 src를 얻는다(§3.1 필드 단위 이상 보정과 같은 태도). */
export function resolveIcon(id: string | undefined): BlockIcon {
  return (id !== undefined && ICON_BY_ID[id]) || ICON_BY_ID[DEFAULT_ICON_ID];
}

/** 저장 검증용 — 알려진 아이콘 id인가. sanitizeBlock·기본화가 사용한다(§3.1). */
export function isIconId(v: unknown): v is string {
  return typeof v === 'string' && v in ICON_BY_ID;
}
