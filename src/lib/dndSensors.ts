import { MouseSensor as DndMouseSensor, TouchSensor as DndTouchSensor } from '@dnd-kit/core';
import type { MouseSensorOptions, TouchSensorOptions } from '@dnd-kit/core';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';

// data-no-dnd 인식 이동 센서 — DESIGN.md §4.3
// dnd-kit은 블록 "이동" 전용(§1). 카드 내부의 체크박스·리사이즈 핸들처럼
// [data-no-dnd] 조상을 가진 타깃에서는 센서 활성화 자체를 거부한다.
// (핸들의 pointerdown stopPropagation은 커스텀 제스처(드래그 생성) 차단용이고,
//  dnd 센서는 mousedown/touchstart를 듣기 때문에 이 활성화 거부가 규범 차단 경로 — §4.4.)
//
// 타이밍(§4.3·§4.5 매트릭스): 이동 = 마우스 4px / 터치 300ms 홀드·8px 허용 오차.
// 빈 면 생성(400ms·10px, §4.2)보다 의도적으로 짧고, 300ms 전 8px 초과 스와이프는
// 활성화가 취소되어 네이티브 스크롤(카드 touch-action: pan-y)로 남는다.

export const MOVE_MOUSE_DISTANCE_PX = 4; // §4.3 — 4px 미만은 클릭(에디터 오픈)
export const MOVE_TOUCH_DELAY_MS = 300; // §4.3 — 300ms 홀드로 이동 시작(터치 선택 겸용 §4.4)
export const MOVE_TOUCH_TOLERANCE_PX = 8; // §4.3 — 홀드 성립 전 8px 초과 이동은 스크롤

function hasNoDndAncestor(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[data-no-dnd]') !== null;
}

export class MouseSensor extends DndMouseSensor {
  static activators = DndMouseSensor.activators.map(({ eventName, handler }) => ({
    eventName,
    handler: (event: ReactMouseEvent, options: MouseSensorOptions): boolean =>
      !hasNoDndAncestor(event.target) && handler(event, options),
  }));
}

export class TouchSensor extends DndTouchSensor {
  static activators = DndTouchSensor.activators.map(({ eventName, handler }) => ({
    eventName,
    handler: (event: ReactTouchEvent, options: TouchSensorOptions): boolean =>
      !hasNoDndAncestor(event.target) && handler(event, options),
  }));
}
