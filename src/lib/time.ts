// 타임라인 지오메트리 단일 소스 — DESIGN.md §4.1
// 컴포넌트/훅의 인라인 픽셀 계산 금지: 모든 분↔px 변환은 이 모듈만 경유한다.
// 금지: 일중(intra-day) 위치 계산에 differenceInMinutes/startOfDay (DST 날 ±60분 오차),
//       라벨 포맷에 setHours(d, 24) (다음 날로 롤오버).

import { addDays, format, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import { LAYOUT } from './tokens';

// ---------- 상수 (지오메트리는 tokens.ts LAYOUT에서 파생 — 이중 정의 금지) ----------

export const HOUR_HEIGHT = LAYOUT.hourHeight;        // 96 — 토큰 64에서 의도적 상향(§4.1)
export const PX_PER_MIN = HOUR_HEIGHT / 60;          // 1.6 — 5분=8px, 15분=24px 전부 정수
export const DAY_HEIGHT = 24 * HOUR_HEIGHT;          // 2304px
export const TOP_PAD = 16;                           // 캔버스 상단 여백(px) + safe-area
export const BOTTOM_PAD = 40;                        // 캔버스 하단 여백(px) + safe-area
export const RULER_WIDTH = LAYOUT.timeLabelWidth;    // 60 — 토큰 --time-label-width
export const GESTURE_SNAP = LAYOUT.snapMinutes;      // 15 — 생성·이동·리사이즈 스냅(분)
export const STORE_SNAP = 5;                         // 저장 불변식 단위(분)
export const MIN_DURATION = 15;                      // 최소 블록 길이(분) = 24px = --block-min-height
export const SCROLL_ANCHOR = 0.3;                    // 나우라인 스크롤 목표 = 뷰포트 상단 30%
export const DAY_MINUTES = 24 * 60;                  // 1440 — 일 경계 클램프 상한(분, §4.10)
export const DEFAULT_DURATION = 60;                  // '+'·플레인 탭 드래프트 기본 길이(분, §5·§4.2)
export const CAPTION_MIN_HEIGHT = 40;                // 시간 캡션 표시 최소 카드 높이(px) = 25분(§4.8)
export const CARD_INSET_RIGHT = 8;                   // 카드 우측 인셋(px) — 거터 ~ 우측 8px(§4.8)
export const LANE_GAP = 2;                           // 겹침 lane 사이 시각 간격(px, §4.6)
export const EMPTY_HINT_START_MIN = 9 * 60;          // 빈 날 힌트 밴드 시작 09:00(분, §6.5)
export const EMPTY_HINT_END_MIN = 11 * 60;           // 빈 날 힌트 밴드 끝 11:00(분, §6.5)

// ---------- 분 ↔ 픽셀 ----------

/** 자정 기준 분 → 캔버스(00:00 원점) y 픽셀 */
export function minutesToY(min: number): number {
  return min * PX_PER_MIN;
}

/** 캔버스 y 픽셀 → 자정 기준 분 (스냅 없음 — 호출자가 snapMin 적용) */
export function yToMinutes(y: number): number {
  return y / PX_PER_MIN;
}

/** step(분) 배수로 반올림 스냅 */
export function snapMin(min: number, step: number): number {
  return Math.round(min / step) * step;
}

/** [lo, hi] 클램프 — 스토어 불변식·제스처 경계 공용(§3.1, §4.10) */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * 뷰포트 clientY → 캔버스 콘텐츠 y (00:00 원점, TOP_PAD 보정 포함).
 * rect는 스크롤 컨테이너의 getBoundingClientRect() — pointerdown 시 1회 캐시,
 * scrollTop은 move마다 라이브로 읽어 넘길 것(§4.1 공통 규칙).
 */
export function clientYToContentY(clientY: number, rect: DOMRect, scrollTop: number): number {
  return clientY - rect.top + scrollTop - TOP_PAD;
}

// ---------- 현재 시각 / 라벨 ----------

/** 자정 기준 현재 분 — 나우라인·알림·스크롤 전부 이것만 사용 (네이티브, DST 안전) */
export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

/** 분 → 'HH:mm' 순수 산술 포맷. m=1440 → '24:00' */
export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ---------- 날짜 키 (date-fns는 이 래퍼로만 사용 — 컴포넌트 직접 호출 금지 §9) ----------

const DATE_KEY_FORMAT = 'yyyy-MM-dd';

/** Date → 'yyyy-MM-dd' (로컬 기준) */
export function toDateKey(date: Date): string {
  return format(date, DATE_KEY_FORMAT);
}

/** 'yyyy-MM-dd' → 로컬 자정 Date */
export function fromDateKey(key: string): Date {
  return parse(key, DATE_KEY_FORMAT, new Date());
}

/** dateKey를 days만큼 이동 (±1 날짜 내비게이션) */
export function shiftDateKey(key: string, days: number): string {
  return toDateKey(addDays(fromDateKey(key), days));
}

/** '오늘 여부'는 문자열 비교로만 판단(§9) */
export function isTodayKey(key: string): boolean {
  return key === toDateKey(new Date());
}

/** 헤더 날짜 라벨 — 예: '7월 8일 수요일' (ko 로케일) */
export function formatHeaderDate(key: string): string {
  return format(fromDateKey(key), 'M월 d일 EEEE', { locale: ko });
}
