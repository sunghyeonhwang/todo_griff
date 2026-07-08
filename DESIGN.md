# DayBlocks — Structured 스타일 데일리 플래너 웹앱 설계서

> 상태: **v1.1** — 설계 에이전트 3명 통합 + 검증 에이전트 2명 지적 41건 반영 + **사용자 제공 디자인 토큰(`design_token/`) 통합 + 서버 연동 대비 설계 추가.**
> 이 문서가 유일한 규범(normative) 스펙이다. 구현 중 이 문서와 다른 판단이 필요하면 문서를 먼저 고친다.
> 시각 토큰의 소스 오브 트루스는 `design_token/tokens.css` / `tokens.ts` (§6). 앱 이름 "DayBlocks"는 가칭.

---

## 1. 개요

하루를 세로 타임라인(00:00–24:00)으로 시각화하는 모바일 우선 데일리 플래너.
v1은 백엔드 없는 정적 SPA(localStorage + PWA + Vercel), **단, 추후 웹서버 연동을 전제로 데이터 계층을 설계**(§13).

| 항목 | 결정 |
|---|---|
| 스택 | Vite 8 + React 19 + TypeScript 6.0, Tailwind CSS **v4**(CSS-first), Zustand 5, date-fns 4, @dnd-kit/core 6 + modifiers, vite-plugin-pwa (Stage 1 시점 최신 안정판 — 설계 초안의 Vite 7/TS 5.9에서 상향) |
| 디자인 토큰 | `design_token/` (사용자 제공: 8색 블록 팔레트, surface/text/타이포/radius/shadow/motion/z-index). 예외 1건: 시간당 픽셀만 64→**96px** 조정(§4.1 근거) |
| 시간 표현 | `dateKey('yyyy-MM-dd')` + 자정 기준 분(minute) 정수. **ISO datetime 미사용** (타임존/DST 안전, 픽셀 계산 직결) |
| 타임라인 스케일 | `HOUR_HEIGHT = 96px` (`PX_PER_MIN = 1.6`) → 하루 캔버스 2304px. 5분=8px, 15분=24px 전부 정수 |
| 스냅 2단계 | **저장 불변식 5분 배수** (에디터 입력 표현 가능) / **제스처(생성·이동·리사이즈) 15분** (토큰 `snapMinutes` 일치) |
| 최소 블록 길이 | 15분 = 24px (토큰 `blockMinHeight`와 정확히 일치) |
| 자정 넘김 | 금지 — 모든 조작에서 `[0, 1440]`으로 클램프 (Structured 동일) |
| dnd-kit 역할 | **블록 이동(MOVE) 전용.** 드래그 생성·리사이즈는 커스텀 Pointer Events (dnd-kit에 해당 프리미티브 없음). DragOverlay 미사용 — 카드 자체를 in-place transform |
| 생성 시맨틱 | **에디터 우선 + 명시적 저장**: 드래그/탭/'+' 모두 create 모드 에디터를 열 뿐, 스토어 쓰기는 저장 버튼의 `addBlock` 1회 |
| 블록 겹침 | 허용. 겹치면 lane 알고리즘으로 좌우 분할 렌더 (밀어내기 없음) |
| 다크모드 | 단일 신호 = `<html data-theme>`. `tokens.css`가 이미 data-theme + media 폴백 구현. v1은 시스템 따름 |
| 알림 | 시작 전 오프셋(0/5/10/15/30/60분). **앱이 열려 있는 동안만 동작** — UI에 정직하게 표기. 발화는 SW `showNotification` 경로 |
| UI 언어 | 한국어 단일 (date-fns `ko`), 카피는 `lib/strings.ts` 단일 모듈 |
| 배포 | Vercel — 정적 SPA 무설정 배포. GitHub `sunghyeonhwang/todo_griff`(origin 연결 완료). 추후 `/api` serverless 확장 여지(§13) |

---

## 2. 데이터 모델 (`src/types.ts`)

```ts
/** design_token/tokens.ts의 BLOCK_COLORS 키와 1:1 */
export type BlockColor =
  | 'blue' | 'green' | 'orange' | 'red'
  | 'purple' | 'pink' | 'teal' | 'gray';

/** 시작 전 알림 오프셋(분). 0 = 시작 시각에 알림 */
export type AlarmOffset = 0 | 5 | 10 | 15 | 30 | 60;

export interface TimeBlock {
  id: string;              // crypto.randomUUID() — 서버 동기화에도 안전한 전역 유일 키
  dateKey: string;         // 'yyyy-MM-dd' (로컬 날짜, 타임존 비의존)
  startMin: number;        // 0..1425, 5분 배수 (스토어 액션이 강제)
  endMin: number;          // startMin+15 .. 1440, 5분 배수
  title: string;           // 저장 시 빈 값/공백이면 '새 일정'으로 대체 (저장 비활성화 없음)
  icon: string;            // 큐레이션 아이콘 8개 중 1개(id, lib/icons.ts), 기본 'star'
  color: BlockColor;       // 기본 'blue'
  alarm: AlarmOffset | null; // null = 알림 없음 (끄면 오프셋은 에디터 로컬에만 세션 유지)
  note: string;
  completed: boolean;
  createdAt: number;       // epoch ms (감사용 절대 시각)
  updatedAt: number;       // 커밋된 변경마다 갱신 — 향후 서버 LWW 충돌 해결 기준(§13)
}

export type EditorState =
  | { mode: 'closed' }
  | { mode: 'create'; draft: { dateKey: string; startMin: number; endMin: number } }
  | { mode: 'edit'; blockId: string };
```

**시간 표현 근거** — 렌더링(`y = min × 1.6px`)과 드래그 수학(스냅·클램프)이 순수 산술이 되고,
타임존 변경/DST에도 "09:00은 어디서나 09:00"인 벽시계 시맨틱 유지(Structured 동일). JSON 직렬화가 자명해
서버 전송 포맷으로도 그대로 사용 가능. `Date` 객체는 날짜 키 생성·헤더 포맷·날짜 이동 경계에서만 사용.

---

## 3. 상태 관리 (Zustand, 스토어 2개 분리)

**분리 이유**: persist 미들웨어가 드래그 프레임마다 localStorage에 쓰는 사고 방지 + 마이그레이션·향후 동기화 대상 명확화.

### 3.1 `store/blocksStore.ts` — 영속 데이터 (persist 적용)

```ts
interface BlocksState {
  blocks: Record<string, TimeBlock>;   // id로 정규화된 flat map (날짜별 인덱스 구조는 명시적 기각 — 이중 자료구조 동기화 버그 farm)
  firedAlarms: Record<string, true>;   // 발화된 알림 키 집합 (§7)
}
interface BlocksActions {
  addBlock(input: NewBlockInput): TimeBlock;  // 기본값 채움 + 스냅/클램프 + id/타임스탬프
  updateBlock(id: string, patch: BlockPatch): void;
  deleteBlock(id: string): void;
  toggleComplete(id: string): void;
  moveBlock(id: string, newStartMin: number): void;        // 길이 보존, [0, 1440-길이] 클램프
  resizeBlock(id: string, edge: 'top' | 'bottom', edgeMin: number): void; // 반대편 고정, 최소 15분
  markAlarmFired(key: string): void;
  pruneFiredAlarms(todayKey: string): void;   // 지난 날짜 키 정리 (앱 시작 시 1회)
}
```

- 모든 기하 불변식(5분 배수, 최소 15분, 일 경계 클램프)은 **스토어 액션이 강제** — 호출자가 아님. 제스처는 15분 스냅된 값을 넘기지만 스토어는 5분만 검증.
- **이 액션들이 앱의 유일한 데이터 변이 초크포인트다** — 컴포넌트·훅의 직접 상태 조작 및 localStorage 직접 접근 금지. 이 규칙이 §13 서버 연동의 전제.
- 제스처 프리뷰는 훅 로컬 상태(§3.2) → `moveBlock`/`resizeBlock`은 **제스처당 1회**(pointer-up)만 호출. localStorage 쓰기도 제스처당 1회.
- persist 설정: key `dayblocks:data`, `version: 2`, `partialize`로 `{ blocks, firedAlarms }`만 저장,
  `migrate()`는 버전 switch 폴스루 + 매 로드마다 `sanitizeBlocks()`(구조 가드 실패 항목 드롭, 알 수 없는 color→'blue').
  v1→v2: `emoji`(이모지 문자) → `icon`(아이콘 id) 리네임 — sanitizeBlock가 매 로드마다 구 emoji를 흡수·제거하고 icon을 기본 'star'로 보정한다.
  타입 주석은 `create<T>()(persist(...))` 추론에 맡김(명시 주석은 persist 뮤테이터 타이핑을 지워 `persist.onFinishHydration` 등이 타입에서 사라짐).
- **손상 대응**: 커스텀 `safeStorage`(`PersistStorage` 인터페이스 구현) — JSON 파싱 실패 시 원본을 `dayblocks:data.corrupt.<ts>`로 백업 후 빈 상태 부팅(토스트 안내). QuotaExceeded 시 쓰기 스킵 + 토스트. 데이터를 조용히 파괴하지 않음.
- 용량 현실 체크: 블록 1개 ≈ 300B → 하루 10개 × 365일 ≈ 1.1MB/년. Safari 최악 기준(~2.5MB 보장)에서도 2년+ 여유.
- 시작 시 `navigator.storage.persist()` 호출(지원 브라우저에서 축출 방지).

### 3.2 `store/uiStore.ts` — 휘발 상태 (persist 없음)

```ts
interface UiState {
  activeDateKey: string;               // 초기값 오늘
  editor: EditorState;
  selectedBlockId: string | null;      // 터치에서 리사이즈 핸들 노출 게이트
  notifPermission: NotificationPermission | 'unsupported';
  toast: { seq: number; message: string } | null;
  // actions: goToDate / goRelative(±1) / goToToday / openCreate / openEdit / closeEditor
  //          select / setNotifPermission / showToast
}
```

**드래그/리사이즈/생성 프리뷰는 스토어에 두지 않는다** — `useCreateDrag`/`useResizeBlock` 훅 로컬 상태(+ dnd-kit 이동은 delta 기반 transform)로만 존재. 60fps 스토어 디스패치와 구독자 churn을 원천 제거. 스토어는 제스처의 시작과 커밋만 안다.

### 3.3 리렌더 규율

- 각 카드: `useBlocksStore(s => s.blocks[id])` — 엔티티 참조 동일성으로 무관한 변경에 리렌더 없음.
- 날짜별 목록: 셀렉터에서 filter 금지(매번 새 배열 → 리렌더 폭풍). 안정된 `blocks` 맵 선택 후 `useMemo`로 파생.
- 멀티 필드 UI 구독은 `useShallow`.
- 제스처 프리뷰는 스토어 미경유(§3.2)이므로 구독 문제 자체가 없음.

---

## 4. 타임라인 지오메트리 & 인터랙션

### 4.1 지오메트리 (`lib/time.ts` 단일 소스 — 컴포넌트 인라인 픽셀 계산 금지)

```ts
export const HOUR_HEIGHT = 96;        // ⚠ 토큰(64px)에서 의도적 상향 — 근거 아래
export const PX_PER_MIN = 1.6;        // 5분 = 8px, 15분 = 24px (전부 정수)
export const DAY_HEIGHT = 2304;       // px
export const TOP_PAD = 16; export const BOTTOM_PAD = 40; // + safe-area
export const RULER_WIDTH = 60;        // 토큰 --time-label-width
export const GESTURE_SNAP = 15;       // 토큰 --snap-minutes 일치
export const STORE_SNAP = 5;          // 저장 단위(분)
export const MIN_DURATION = 15;       // = 24px = 토큰 --block-min-height 일치
export const SCROLL_ANCHOR = 0.3;     // 나우라인 목표 = 뷰포트 상단 30%

minutesToY(min) / yToMinutes(y) / snapMin(min, step) / clientYToContentY(clientY, rect, scrollTop)
nowMinutes()  // 네이티브 getHours()*60+getMinutes() — 나우라인·알림·스크롤 전부 이것만 사용
formatMinutes(m)  // 순수 산술 'HH:mm', m=1440 → '24:00'
```

**토큰 64px/시를 96px/시로 조정한 근거** (토큰 중 유일한 예외):
토큰의 `pxPerMinute: 1.0667`은 비정수라 5분 스냅이 5.33px가 되어 서브픽셀 드리프트를 만들고,
15분 최소 블록이 16px로 제목 렌더 불가 — 같은 토큰 파일의 `blockMinHeight: 24px`와도 모순.
96px/시는 5분=8px 정수이고, 15분 블록 = 24px로 **토큰 blockMinHeight와 정확히 일치**한다.
(더 촘촘한 밀도를 원하면 `HOUR_HEIGHT` 상수 1곳 변경이지만, 최소 블록 렌더 규칙 재조정 필요.)

- **금지 규칙**: 일중(intra-day) 위치 계산에 `differenceInMinutes`/`startOfDay` 사용 금지(DST 날 ±60분 오차). `setHours(d, 24)`는 다음 날로 롤오버되므로 라벨 포맷에 사용 금지.
- 모든 제스처 공통 규칙: 컨테이너 `getBoundingClientRect()`는 **pointerdown 시 1회 캐시**, `scrollTop`은 move마다 라이브로 읽음(오토스크롤 중 좌표 어긋남 방지). move 핸들러에서 rect 재계산 금지, rAF 배칭.
- 시간 라벨 **25개(00:00–24:00)**, 전부 `formatMinutes(h*60)`으로 생성. 색 `var(--surface-timeline-label)`, 그리드 헤어라인 `var(--surface-timeline-line)`, 부(副) 눈금 없음. 라벨은 그리드라인에 수직 중앙 정렬(`translateY(-50%)`), `--fs-xs`(11px) tabular-nums.

### 4.2 빈 영역 드래그 → 생성 (`hooks/useDragCreate.ts`, 커스텀 Pointer Events)

- **마우스**: 누른 뒤 6px 이동 시 드래프트 시작. 미만이면 탭.
- **터치**: 빈 영역은 기본 스크롤 면이므로 **롱프레스 400ms**(이동 <10px)로 무장(arm) 후 드래그 — 이동(300ms)보다 의도적으로 길게(스크롤하려다 실수로 생성되는 게 더 나쁨). 무장 시점부터 non-passive `touchmove` `preventDefault()` 등록(제스처 끝나면 해제; 진행 중 제스처에 `touch-action` 변경은 iOS에서 무효). 400ms 전 10px 초과 이동 → 취소, 네이티브 스크롤 진행.
- 드래프트: 앵커·현재 지점 모두 15분 스냅, 위로 드래그 허용(`[min(a,c), max(a,c)]`), 최소 15분. 점선 테두리(`--blk-border`) + 60% 채움 + 라이브 "09:15 – 10:30" 라벨.
- **놓으면: `openCreate(draft)` — 스토어 쓰기 없음.** create 모드 에디터가 열리고, 고스트는 `editor.draft`에서 계속 렌더되어 위치를 보여줌. **저장 시에만 `addBlock` 1회**, 취소 시 잔여물 제로.
- **빈 영역 플레인 탭**: 탭 지점 15분 스냅 + 60분 길이 드래프트로 create 모드 에디터 오픈. 단, 블록이 선택된 상태(`selectedBlockId`)라면 첫 탭은 **선택 해제만** 하고 소비됨(에디터 안 열림).
- `pointercancel` → 드래프트 조용히 폐기.

### 4.3 블록 이동 (dnd-kit)

- `DndContext`는 캔버스 내부 마운트. 드롭 타깃/충돌 감지 미사용 — 위치는 `delta.y`의 순수 함수. **DragOverlay 미사용**: 카드 자체를 transform (`scale-[1.02]`, `shadow-lg`, `z-dragging(30)`).
- 센서(`lib/dndSensors.ts`에서 1회 서브클래스, `[data-no-dnd]` 요소는 활성화 제외 — 체크박스·리사이즈 핸들):
  - `MouseSensor { distance: 4 }` — 4px 미만은 클릭(에디터 오픈)
  - `TouchSensor { delay: 300, tolerance: 8 }` — 300ms 홀드로 이동 시작, 그 전 8px 초과 스와이프는 스크롤
- 모디파이어: `restrictToVerticalAxis` + `createSnapModifier(GESTURE_SNAP * PX_PER_MIN /* 24px */)` + `restrictToParentElement`. 최종 권위는 `onDragEnd`의 클램프 수식(모디파이어는 시각 보조).
- `onDragEnd`: `newStart = clamp(start + round(delta.y/PX_PER_MIN/15)*15, 0, 1440-길이)` → `moveBlock` 1회 호출. 이동 중 카드 옆 시간 배지("08:30 – 09:45") 표시.
- autoScroll: dnd-kit 내장, `{ threshold: { x: 0, y: 0.15 }, acceleration: 10 }` (세로 전용).

### 4.4 리사이즈 (커스텀 Pointer Events, `hooks/useResizeBlock.ts`)

- 핸들 노출: 데스크톱은 hover, 터치는 **블록 선택 시**(300ms 롱프레스가 선택 겸용 — 이동 없이 떼도 선택됨, 빈 곳 탭까지 유지). 구글 캘린더 모바일 패턴: 탭=편집, 롱프레스=직접 조작.
- 히트 영역: 카드 폭 × 24px(카드 안팎 12px씩), 시각 어포던스는 32×4px 필(`--blk-solid`). `touch-action: none` + `data-no-dnd`.
- `setPointerCapture` + `stopPropagation`으로 부모 dnd-kit 센서 차단. 위 핸들: `newStart = clamp(edge, 0, end-15)`, 아래 핸들: `newEnd = clamp(edge, start+15, 1440)`. 반대편 넘어가면 최소 길이에서 클램프(반전·이동 전환 없음).
- 리사이즈·생성용 엣지 오토스크롤: `hooks/useEdgeAutoScroll.ts` — 컨테이너 상하 48px 이내에서 rAF 루프, 근접 비례 최대 12px/frame.

### 4.5 터치 스크롤 vs 드래그 판별 (iOS Safari 핵심 난제)

원칙: **스크롤이 기본, 모든 드래그는 롱프레스로 명시적 무장 후에만 `preventDefault`.**

| 레이어 | `touch-action` | 비고 |
|---|---|---|
| 스크롤 컨테이너 | `pan-y` | + `overscroll-behavior-y: contain` (풀투리프레시 차단) |
| 빈 타임라인 면 | `pan-y` | 생성은 400ms 롱프레스로 무장 |
| 블록 카드 | `pan-y` (CSS로 명시) | dnd-kit TouchSensor(300ms)가 활성화 후 자체 preventDefault |
| 리사이즈 핸들 | `none` | 선택 시에만 존재하는 작은 타깃이라 허용 |
| 나우라인/그리드/라벨 | — | `pointer-events: none` |

추가 하드닝: 카드·면에 `user-select: none`, `-webkit-touch-callout: none`, `contextmenu` preventDefault.
`pointercancel`(iOS 시스템 제스처·전화 수신)은 항상 깨끗한 중단 처리(드래프트 폐기, 스토어 무변경).
휴지 상태에서 스크롤 컨테이너에 non-passive 리스너 0개 유지(스크롤 성능).

**타이밍 요약**: 블록 이동 300ms/8px (dnd-kit) · 빈 영역 생성 400ms/10px (커스텀) · 리사이즈 즉시(핸들 자체가 의도 표명).

### 4.6 겹침 레이아웃 (`lib/lanes.ts`, 순수 함수)

- `startMin` 오름차순, 동률 시 긴 블록 우선 정렬 → **클러스터**(전이적 겹침 구간) 분할 → 클러스터 내 그리디 최소 lane 배정. 클러스터 내 모든 블록이 `laneCount` 공유(균등 폭). 경계가 맞닿은 것(`end === start`)은 겹침 아님.
- lane 사이 시각 간격 2px(`LANE_GAP`, `lib/time.ts`) — 같은 색 블록이 한 덩어리로 보이는 것 방지. 첫 lane은 간격 없음(거터 인셋 유지).
- z-order: 토큰 맵 기준 — 블록 `z-block(10)` + lane별 +1, 선택 블록 `z-[15]`, 드래그 중 `z-dragging(30)`, 나우라인 `z-now(20)`.
- 시그니처에 `excludeId` 파라미터: 이동 드래그 중인 블록은 lane 계산에서 제외하고 풀폭 90% 불투명도로 위에 렌더 — 드래그 중 이웃 블록 리플로 방지, 드롭 시 1회 재계산.
- `useMemo`(컴포넌트 레벨)로 파생 — 스토어에 두지 않음(하루 ≤50개, O(n log n) ≈ 0.01ms).

### 4.7 나우 인디케이터 (`components/NowLine.tsx`)

- `activeDateKey === 오늘`일 때만 렌더. 2px 라인(토큰 `--now-indicator-width`), 색 `var(--surface-now-indicator)`(라이트 #EA4335 / 다크 #FF6B5E — 토큰), 좌측 8px 도트 + 거터에 작은 "HH:mm" 칩, `pointer-events: none`, `z-now(20)`.
- 위치는 `minutesToY(nowMinutes())` — 30초 인터벌 + `visibilitychange → visible` 시 즉시 갱신(백그라운드 탭 타이머 스로틀 보정).
- 오토스크롤 규칙(단일 규범): **최초 마운트(오늘)** = instant, 나우라인이 뷰포트 상단 30%(`SCROLL_ANCHOR`) / **"오늘" 버튼** = 날짜를 오늘로 + 같은 목표로 smooth 스크롤, **이미 오늘이어도 스크롤 실행** / **그 외 절대 자동 스크롤 없음**(인터벌 틱·visibilitychange 포함 — 사용자 스크롤 위치는 불가침).

### 4.8 블록 카드 아나토미 (`TimeBlockCard.tsx`) — Structured 정체성(사용자 제공 스크린샷 기준)

- 카드: `rounded-md`(토큰 12px), 배경 `var(--blk-bg)`, 그림자 `var(--shadow-block)`, 좌우 인셋: 거터(60px) 오른쪽 ~ 우측 8px. (액센트 바 없음 — 색 정체성은 배지 링 + 카드 틴트)
- 내용: **원형 아이콘 배지**(`bg-surface-card` 원 + `ring-2 var(--blk-solid)`, 28px/콤팩트 20px, 안에 아이콘 `<img>` 24px/콤팩트 16px) + 제목·캡션 스택 + 우측 체크박스.
- 제목: 한 줄 말줄임(`--fs-sm` 13px, `--fw-semibold`, `var(--blk-fg)`).
- 시간 캡션 "HH:mm – HH:mm · 소요시간"(예: "12:45 – 14:30 · 1시간 45분", `--fs-xs`, 70% 불투명도)은 **블록 높이 ≥ 40px(25분 이상)일 때만** — 15분 블록(24px)은 배지+제목 한 줄만.
- 접근성: 카드는 포커스 가능한 버튼(Enter/Space → 에디터), 체크박스에 `aria-label`. 키보드 사용자의 시간 조정 경로는 에디터의 네이티브 time input(dnd-kit KeyboardSensor는 의도적 미사용 — 문서화된 결정).

### 4.9 탭/체크박스/완료 상태

- 카드 탭 → 에디터 시트. dnd-kit 활성화 제약이 드래그 후 클릭을 자연 억제 + `wasDraggedRef` 이중 가드. 시트 열림/애니메이션 중 탭은 무시(멱등).
- 체크박스: 우측 24px 원형(히트 영역 44×44px, Apple HIG), `data-no-dnd` + `stopPropagation`. 에디터 안 열림, 즉시 커밋(명시적 저장 원칙의 유일한 예외).
- 완료 시(`--duration-fast` 120ms 전환): 블록 채움 40% 불투명도, 제목 취소선 + `var(--text-tertiary)`, 아이콘 배지 50%, 그림자 제거, 체크박스는 `var(--blk-solid)` 채움 + 흰 체크(`--text-on-solid`). 완료 블록도 드래그·리사이즈·편집 가능.

### 4.10 엣지 케이스 규범 목록

1. 세 제스처 모두 `[0,1440]` 클램프, 이동은 길이 보존, 자정 넘김 없음
2. 리사이즈가 반대편 넘어가면 최소 15분에서 클램프 — 반전/이동 전환 금지
3. 연타: 에디터 오픈은 멱등, 체크 토글은 불리언 플립이라 안전
4. 회전/리사이즈 이벤트 → 진행 중 제스처 중단·복원(다음 제스처는 새 rect 캐시)
5. `pointercancel` → 중단과 동일 처리, 스토어 무변경
6. 멀티터치: 단일 `pointerId`만 추적, 추가 포인터 무시 (핀치줌 v1 범위 외)
7. 제스처 중 스크롤: y 수학이 라이브 `scrollTop`을 읽으므로 desync 없음
8. DST 날: 1440분 균일 렌더(벽시계 시맨틱 수용 — 한국은 DST 없음), 날짜 이동은 date-fns 로컬 함수라 정확
9. 터치 제로 이동 롱프레스: delta 0으로 끝나 스토어 무변경, 대신 블록 선택 → 리사이즈 핸들 노출(의도된 터치 리사이즈 진입점)
10. 선택 상태에서 빈 영역 첫 탭 = 선택 해제만(생성 에디터 안 열림, 이벤트 소비). 다른 블록 탭 = 기존 규칙대로 에디터

---

## 5. 에디터 바텀시트 (`BottomSheet.tsx` + `BlockEditor.tsx`)

- 시트: viewport 하단 고정, `max-w-app`(480px), 상단 라운드 `--radius-xl`(20px), 백드롭 `var(--surface-overlay)`, 슬라이드업 `--duration-slow`(320ms) `--ease-decelerate`(CSS transition, 애니메이션 라이브러리 없음), 36×5px 그래버, max-height `85dvh` 내부 스크롤. `role="dialog" aria-modal`, 포커스 트랩, Escape/백드롭 탭/그래버 80px 하향 드래그로 닫힘. `z-modal(50)`.
- **iOS 키보드 대응**: `dvh`는 온스크린 키보드를 추적하지 않음 → 시트 열림 동안 `visualViewport` resize/scroll 리스너로 시트를 오프셋(`window.innerHeight - visualViewport.height - visualViewport.offsetTop`).
- 호출: `uiStore.editor` — 카드 탭 / 드래그 생성 릴리즈 / **플로팅 + 버튼(AddFab)** 3곳. App 루트에 인스턴스 1개. **타이핑 드래프트는 에디터 로컬 state** — 스토어는 "열려 있음 + 대상"만 앎(타임라인 리렌더 차단).
- **FAB "+" 드래프트 정의**: `start = min(다음 정시, 1380 /* 23:00 */)`, `end = min(start+60, 1440)` → create 모드.
- **레이아웃(Structured 아나토미 — 사용자 제공 스크린샷 기준)**:
  1. **컬러 헤더 밴드**(`var(--blk-solid)` 풀블리드): 좌상단 X 닫기 원 · 대형 원형 아이콘 배지(80px, `ring-4 surface-card`, 안에 아이콘 `<img>` 64px, 탭 = 피커 카드 토글) · 시간 요약 "10:00 ~ 10:15 (15분)"(라이브 갱신) · **밑줄 제목 input**(투명 bg, `text-on-solid`, `--fs-lg`; create 모드만 autoFocus — iOS는 열기 제스처 핸들러에서 동기 설정해야 키보드 뜸) · (edit) 우측 완료 원(폼 로컬 토글, 저장 시 반영). **빈 제목 저장 시 '새 일정' 자동 대체 — 제목 때문에 저장이 비활성화되는 일 없음**
  2. **본문**(`surface-background` 위 흰 카드 섹션 순서): **날짜 행 카드**(📅 "2026년 7월 8일 (수)" + 오늘 라벨, 표시 전용) → (피커 카드: 4×2 아이콘 그리드 + 색상 스와치 8개 — **외부 아이콘 팩 금지**(이모지 라이브러리 금지 원칙 계승 — 번들·PWA 프리캐시 비대화 방지), 큐레이션 SVG 8개(`src/icons/*.svg`, id): star 중요 · calendar 일정 · dialog 대화 · notification 알림 · paperplane 발송 · camera 사진 · design 디자인 · compass 탐색. 각 셀 44px 터치 타깃, 아이콘 `<img>` 28px) → **"시간" 섹션**(네이티브 `<input type="time" step={300}>` × 2 — iOS 휠 step 무시는 저장 시 5분 스냅 흡수, `end ≤ start`면 저장 비활성 + 인라인 힌트) → **"소요시간" pill 선택기**(15분/30분/45분/1시간/1시간 30분/2시간, 탭 = `endMin = min(start+d, 1440)`, 현재 길이와 일치하는 pill 자동 활성) → **알림 카드**(토글 + 오프셋 select — 최초 켜기의 사용자 제스처 안에서만 권한 요청, "알림은 앱이 열려 있는 동안에만 동작합니다" + iOS Safari 비-standalone 설치 힌트) → 메모 카드(3줄) → 삭제(edit 모드만 — **탭-어게인 확인**(첫 탭 → 3초간 "한 번 더 탭하면 삭제"), `window.confirm` 금지)
  3. **하단 대형 저장 pill**(`accent-primary` 풀폭 라운드 — Structured '계속' 위치, `end ≤ start`면 40% 비활성)
- **저장 시맨틱: 명시적 저장.** 스토어 변이가 정확히 1회(add/update), 검증 초크포인트 1곳, 취소가 자명하게 올바름. 유일한 예외는 카드 위 체크박스(§4.9).

---

## 6. 스타일 시스템 — 소스 오브 트루스: `design_token/`

### 6.1 토큰 파이프라인

- `design_token/tokens.css` → `src/styles/tokens.css`로 복사(그대로 사용, 단 `--hour-height`/`--px-per-minute`는 §4.1 결정에 맞춰 **96px / 1.6**으로 수정 — CSS 변수와 `lib/time.ts` 상수가 서로 다른 스케일을 가리키는 함정 방지, §1의 "시간당 픽셀 예외 1건"이 CSS 사본에도 동일 적용). 라이트 기본 + `[data-theme="dark"]` + media 폴백(`:root:not([data-theme="light"])`)이 이미 구현되어 있음.
- `design_token/tokens.ts` → `src/lib/tokens.ts`로 복사. 단 `LAYOUT.hourHeight`는 §4.1 결정(96)으로 수정하고 `lib/time.ts`가 이 값을 import(이중 정의 금지).
- `design_token/tailwind.config.js`는 **v3용 참조 자료로만 사용** — 실제 설정은 Tailwind v4 CSS-first: `src/index.css`의 `@theme`에서 토큰 CSS 변수를 참조해 동등 매핑(`--color-surface-card: var(--surface-card)` 식). `darkMode: 'class'` 전략은 쓰지 않고 §6.3의 data-theme 방식.
- `design_token/preview.html`·zip은 참고용 보존.

### 6.2 블록 팔레트 — 8색 × 4변수 (bg / fg / solid / border)

blue · green · orange · red · purple · pink · teal · gray

- 카드에 `data-color={block.color}` → 브리지 CSS가 제네릭 변수로 매핑:
  `[data-color='blue'] { --blk-bg: var(--block-blue-bg); --blk-fg: var(--block-blue-fg); --blk-solid: var(--block-blue-solid); --blk-border: var(--block-blue-border); }` × 8줄 (`src/styles/tokens.css` 하단에 추가).
- 용도: `--blk-bg` 카드 채움 / `--blk-fg` 제목·캡션 틴트(아이콘 배지는 풀컬러 SVG라 틴트 대상 아님) / `--blk-solid` 좌측 액센트 바·체크박스·리사이즈 그립·스와치·아이콘 배지 링 / `--blk-border` 드래프트 고스트 점선·(옵션) 카드 헤어라인.
- **알려진 갭(토큰에 없음)**: 블록 색의 다크모드 변형 — 라이트 파스텔 bg(#E8F0FE 등)는 다크 카드(#1C1F24) 위에서 과도하게 밝음. Stage 1에서 `[data-theme='dark']` 블록 오버라이드 8줄 추가(bg ≈ L18–22% 딥 뮤트, fg ≈ L75–80%), 4변수 계약은 유지. 헥스는 구현 시 튜닝 1회.

### 6.3 다크모드 — 단일 신호: `html[data-theme]`

- `index.html` 인라인 스크립트(3줄): `document.documentElement.dataset.theme = localStorage.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')` + `localStorage.theme`이 없을 때만 matchMedia `change` 리스너로 라이브 반영.
- Tailwind: `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));` — `dark:` 유틸리티가 전부 이 속성 기준.
- tokens.css의 media 폴백은 JS 실행 전 첫 페인트 플래시 방지용으로 그대로 두되, 스크립트가 항상 data-theme를 스탬프하므로 실질 신호는 하나.
- v1은 시스템 따름(스크립트가 `localStorage.theme`을 쓰지 않으므로). 추후 인앱 토글 = `localStorage.theme` 쓰고 dataset 갱신하는 원라이너.

### 6.4 타이포·모션·z-index (토큰 채택)

- 폰트: 토큰 `--font-sans` = **Freesentation**(프리젠테이션) 우선 + 시스템 폴백 스택. Freesentation은 로컬 번들(`public/fonts/Freesentation-{4Regular,5Medium,6SemiBold,7Bold}.woff2`, noonnu 서브셋 굵기당 ~250KB)을 `@font-face`(index.css, `font-display: swap`)로 로드 — **외부 CDN 금지(오프라인 PWA)**, woff2는 PWA 프리캐시(vite.config globPatterns)에 포함. 미로드/폴백 시 시스템 폰트로 강등. 크기: 캡션 `--fs-xs`(11) / 본문·카드 제목 `--fs-sm`(13)~`--fs-base`(15) / 에디터 제목 `--fs-md`(17).
- 모션: 완료 토글·hover `--duration-fast`(120ms) / 일반 전환 `--duration-base`(200ms) / 시트 `--duration-slow`(320ms) + `--ease-decelerate`. 스프링 이징은 선택 강조 등 미세 용도.
- z-index: 토큰 맵 고정 — base 0 / block 10 (+lane, 선택 15) / now 20 / dragging 30 / header 40 / modal 50 / toast 60.

### 6.5 앱 셸 & 레이아웃

- 페이지 배경 `var(--surface-background)`, 컬럼·카드 `var(--surface-card)`. 루트 `h-dvh`(100vh·h-screen 금지 — iOS 툴바 문제), `max-w-app mx-auto` 컬럼. 데스크톱: "폰 프레임"(측면 헤어라인 + `--shadow-lg`), 모바일: 엣지-투-엣지.
- 헤더는 스크롤러 **밖의** `shrink-0` 형제(sticky + backdrop-blur의 iOS 모멘텀 지터 회피), `pt-[env(safe-area-inset-top)]`, `z-header(40)`. **2행 구성(Structured 정체성)**: 1행 = ‹ › 화살표 + ko 날짜 라벨 + "오늘" / 2행 = **주간 스트립**(월요일 시작 7칸: 요일 글자 + 날짜 원, 선택일 = accent 채움 + 흰 글자, 오늘(비선택) = accent 글자, 탭 = goToDate — activeDateKey가 속한 주를 파생 렌더라 주 경계 이동 시 자동 리센터).
- **플로팅 + 버튼(AddFab)**: 컬럼(relative) 우하단 고정 56px 원형, `accent-primary` 채움 + 흰 +, safe-area 보정, `z-header(40)`(시트 백드롭 50이 덮음). 일정 추가 진입점 — 헤더에는 + 없음.
- 스크롤러: `flex-1 min-h-0 overflow-y-auto overscroll-contain`.
- `viewport-fit=cover` + 바텀시트 `pb-[calc(env(safe-area-inset-bottom)+8px)]` — 없으면 PWA 스탠드얼론에서 노치 아래 깔림.
- **빈 날 상태**: 09:00–11:00 밴드에 절대 배치된 은은한 힌트("계획이 없어요 ✨", `var(--text-tertiary)`, `pointer-events: none`), 생성 드래프트 활성 중엔 숨김.

---

## 7. 알림 스케줄러 (`lib/alarms.ts`)

**웹 플랫폼 현실(정직하게)**: 푸시 서버 없이는 백그라운드 알림 불가. 알림은 페이지 살아있을 때만. iOS Safari는 **설치된 PWA(iOS 16.4+) 안에서만** Notification API 존재, 일반 탭에선 없음. → OS 배너 가능하면 배너, 아니면 인앱 토스트. UI에 한계 명시(§5). (서버 도입 시 Web Push로 승격 — §13)

- 구현: 블록별 setTimeout 금지(백그라운드 스로틀·슬립 드리프트). **단일 30초 `setInterval` 폴링** + `persist.onFinishHydration` 직후·`visibilitychange → visible` 시 즉시 틱. 상태는 매 틱 `getState()`로 라이브 조회 — 타이머 북키핑 없음, 데이터 변경 시 재스케줄링 자체가 불필요.
- 발화 조건: `dateKey === 오늘 && alarm !== null && !completed`이고 `fireAt = startMin - offset`에 대해 `fireAt ≤ nowMinutes() ≤ fireAt + 10분`(늦은 발화 허용창 — 그 이상 지난 건 조용히 드롭, 몇 시간 뒤 발화 금지).
- 중복 방지: `firedKey = id|dateKey|fireAtMin`을 **영속** `firedAlarms`에 기록 — 새로고침해도 재발화 없음. 시간/오프셋 수정 시 키가 바뀌어 자동 재무장.
- **발화 경로 (중요)**: `new Notification()` 생성자는 **Chrome for Android에서 TypeError**를 던짐. 규범 경로: SW가 등록돼 있으면(프로덕션은 vite-plugin-pwa가 보장) `navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body, tag: firedKey, icon: '/pwa-192.png' }))`. SW 없는 환경(dev)은 try/catch로 `new Notification` 폴백. **어느 경로든 인앱 토스트는 항상 병행**.
- 권한: 로드 시 요청 금지. 에디터에서 알림 최초 켜는 사용자 제스처 안에서만 요청.

---

## 8. PWA (`vite-plugin-pwa`)

```ts
VitePWA({
  registerType: 'autoUpdate',
  manifest: { name/short_name, display: 'standalone', orientation: 'portrait',
    start_url: '/', scope: '/', theme_color: '#F7F8FA', background_color: '#F7F8FA',
    icons: [192, 512, 512-maskable] },
  workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico}'], navigateFallback: '/index.html' },
  devOptions: { enabled: false },  // Stage 7 수동 SW 테스트 때만 true
})
```

- 다크 브라우저 크롬: manifest theme_color는 단일값 한계 → `index.html`에 `<meta name="theme-color" media="(prefers-color-scheme: …)">` 2개(#F7F8FA / #0F1114 — surface 토큰).
- **아이콘 생성 필요**: 512 원본(라운드 스퀘어 + 글리프, 액센트 #4285F4 계열) → 192 다운스케일 + maskable(중앙 80% 세이프존) + `apple-touch-icon.png` 180(iOS는 manifest 아이콘 무시).
- 오프라인: 데이터가 localStorage라 **최초 1회 로드 후 100% 오프라인 동작.** 온라인이 필요한 유일한 순간 = 새 빌드 수신.
- **iOS 저장소 파티션 주의**: Safari 탭과 홈 화면 설치본은 localStorage가 **분리**됨 — 설치 전 입력한 데이터는 설치본으로 이전되지 않음. §5의 설치 힌트 문구에 이 사실 한 줄 포함. (JSON 내보내기/가져오기는 v1.1 백로그 — §13의 마이그레이션 경로이기도 함)

---

## 9. 폴더 구조 (27개 소스 파일, 배럴 파일·utils 잡동사니 없음)

```
src/
├── main.tsx                  # createRoot + index.css + storage.persist() + 알림 스케줄러 시작(hydration 후)
├── App.tsx                   # 셸: 컬럼 레이아웃, DateHeader + Timeline + BlockEditor + Toast
├── index.css                 # Tailwind v4 진입: @theme(토큰 변수 참조), @custom-variant dark, tokens.css import
├── styles/tokens.css         # design_token/tokens.css 사본 + data-color 브리지 8줄 + 다크 블록 오버라이드 8줄
├── types.ts                  # TimeBlock, BlockColor, AlarmOffset, EditorState
├── icons/                    # 큐레이션 블록 아이콘 SVG 8개 (Vite 에셋 — lib/icons.ts가 임포트)
├── brand/                    # 로그인 브랜드 에셋 (griff-logo.svg·google.svg — Figma 45:199)
├── components/
│   ├── DateHeader.tsx        # ‹ › 화살표, 날짜 라벨(ko), "오늘" + 주간 스트립(§6.5)
│   ├── AddFab.tsx            # 플로팅 + 버튼(§6.5) — 다음 정시 드래프트로 openCreate
│   ├── Timeline.tsx          # 스크롤 컨테이너 소유 + DndContext + 캔버스 조립 + 스크롤-투-나우
│   ├── TimelineGrid.tsx      # 정적 시간 눈금/라벨 25개 (React.memo, 1회 렌더)
│   ├── NowLine.tsx           # 현재 시각 라인 + 도트 + 시각 칩 (surface-now-indicator)
│   ├── TimeBlockCard.tsx     # 카드 아나토미(§4.8) + useDraggable + 체크박스 + 핸들 장착
│   ├── ResizeHandle.tsx      # 24px 히트영역 + 그립, edge: 'top'|'bottom'
│   ├── DragCreateGhost.tsx   # 드래그 중 + create 에디터 열림 중 점선 프리뷰 (editor.draft 렌더)
│   ├── BottomSheet.tsx       # 범용 시트 크롬 (백드롭·슬라이드·포커스트랩·visualViewport 대응)
│   ├── BlockEditor.tsx       # 에디터 폼 전체 + 저장/취소/삭제 로직
│   ├── IconGrid.tsx          # 4×2 큐레이션 아이콘 그리드(8개 SVG, <img>)
│   ├── ColorSwatchRow.tsx    # 8색 스와치 (4×2)
│   └── Toast.tsx             # 인앱 알림 배너 (자동 소멸, z-toast)
├── hooks/
│   ├── useNow.ts             # {nowMin, todayKey} 30초 틱 + visibilitychange
│   ├── useDragCreate.ts      # 빈 캔버스 드래그 생성 (프리뷰는 훅 로컬 상태)
│   ├── useResizeBlock.ts     # 핸들 리사이즈 (프리뷰는 훅 로컬 상태)
│   └── useEdgeAutoScroll.ts  # 생성·리사이즈용 엣지 오토스크롤
├── store/
│   ├── blocksStore.ts        # persist(v2, dayblocks:data) + 도메인 액션 + firedAlarms — 유일한 변이 초크포인트
│   └── uiStore.ts            # 날짜·에디터·선택·알림권한·토스트 (드래그 프리뷰 없음)
└── lib/
    ├── time.ts               # 지오메트리 상수(tokens.ts 참조)·변환·스냅·nowMinutes·formatMinutes + date-fns 래퍼
    ├── tokens.ts             # design_token/tokens.ts 사본 (BLOCK_COLORS/LAYOUT/MOTION/Z_INDEX; hourHeight=96 수정)
    ├── lanes.ts              # 겹침 클러스터 + lane 배정 + excludeId (순수, 테스트 가능)
    ├── icons.ts              # CURATED_ICONS 8개(id·라벨·src, src/icons/*.svg 임포트) + resolveIcon/isIconId
    ├── strings.ts            # 한국어 UI 카피 전체 (하드코딩 분산 금지)
    ├── alarms.ts             # 30초 폴링 스케줄러 + 권한 요청 + SW showNotification 경로
    ├── safeStorage.ts        # 파싱 실패 백업·쿼터 처리 PersistStorage (§13 어댑터 교체 지점)
    └── dndSensors.ts         # data-no-dnd 인식 Mouse/Touch 센서
```

**date-fns 사용 지도** (전부 `lib/time.ts` 경유, 컴포넌트 직접 호출 금지): `format`(dateKey·헤더 "7월 8일 수요일", `ko` 로케일), `parse`, `addDays`. "오늘 여부"는 `key === toDateKey(new Date())` 문자열 비교. 분→"HH:mm"·나우 분은 순수 산술/네이티브(§4.1).

**의존성에서 의도적으로 뺀 것**: 라우터(단일 뷰), @dnd-kit/sortable, immer(상태 1뎁스), clsx, uuid(네이티브), 이모지·아이콘 라이브러리(번들 SVG 8개로 대체), 애니메이션 라이브러리, **fetch/API 레이어(§13 — v1에 선반영 금지)**.

---

## 10. 단계별 구현 계획 (8 스테이지, 매 스테이지 브라우저 검증)

각 스테이지는 `npm run typecheck` 클린 + 브라우저 확인 체크리스트로 종료. 이후 스테이지 의존 없음.

| # | 목표 | 핵심 산출 | 수용 기준(요약) |
|---|---|---|---|
| 1 | 스캐폴드 + 토큰 파이프라인 + 앱 셸 | Vite/TS/Tailwind v4 설정, tokens.css/ts 임포트 + 다크 블록 오버라이드, 셸 레이아웃 | dev 서버 무에러, 480px 컬럼/엣지투엣지, OS 다크 전환 즉시 반영(블록색 포함), 320px 가로 스크롤 없음 |
| 2 | 정적 타임라인 + 날짜 내비 + 나우라인 | DateHeader, Timeline(Grid), NowLine, useNow, uiStore(날짜) | 25개 라벨(00:00–24:00)+눈금, ‹›/오늘 동작, 나우라인 정확한 높이·1분 내 이동, 비오늘 날짜엔 없음, 초기 로드 시 now 30% 지점 |
| 3 | 데이터 레이어 + 에디터 CRUD | blocksStore(persist+safeStorage), BottomSheet, BlockEditor, IconGrid, ColorSwatchRow ("+"로 생성) | 전 필드 편집, 저장→정확한 위치/높이 카드, 탭→수정, 탭-어게인 삭제, **하드 리로드 후 전부 유지**, 날짜별 분리, 빈 제목 → '새 일정' |
| 4 | 드래그 생성 | useDragCreate, DragCreateGhost | 마우스 드래그 고스트+라이브 시간(15분 스냅), 위로 드래그, 릴리즈→**create 에디터(저장 전 스토어 무변경, 취소 시 잔여물 없음)**, 빈 곳 탭→60분 드래프트 에디터, 터치 400ms 홀드·스와이프는 스크롤 유지 |
| 5 | 이동(dnd-kit) + 리사이즈(핸들) | dndSensors, DndContext 배선, ResizeHandle, useResizeBlock, useEdgeAutoScroll | 300ms 홀드 후 세로 이동·**15분 스냅**·길이 보존, 경계 클램프, 엣지 오토스크롤, 핸들 리사이즈 15분 플로어, 빠른 스와이프=스크롤, 터치 롱프레스=선택→핸들 노출, 리로드 후 유지 |
| 6 | 완료 + 겹침 + 알림 + 폴리시 | 체크박스·완료 비주얼, lanes.ts, alarms.ts(SW 경로), Toast, 빈 날 힌트, 다크·간격 스윕 | 체크 즉시 토글(40% 페이드+취소선), 겹침 좌우 분할, 알림 발화+토스트 병행(데스크톱 Chrome), 다크모드 전면 점검, 320px 통과 |
| 7 | PWA + 최종 QA | VitePWA 설정, 아이콘 4종 생성, 메타 최종화 | build+preview, Lighthouse 설치성 통과, 오프라인 리로드 후 CRUD 동작, iOS 홈화면 아이콘·세이프에어리어, 스테이지 2–6 회귀 |
| 8 | **Vercel 배포** | GitHub `sunghyeonhwang/todo_griff`(origin 연결 완료)에 push, Vercel 프로젝트 연결 | 프로덕션 URL에서 HTTPS·PWA 설치·오프라인 재확인, 이후 push = 자동 배포 |

---

## 11. 구현용 에이전트/스킬 세팅 계획 (승인 후 생성)

### `.claude/agents/` — 3개

| 에이전트 | 역할 | 핵심 지침 |
|---|---|---|
| `implementer` | 지정된 스테이지 1개만 구현 | DESIGN.md 선독, 해당 스테이지 파일만, 설계된 파일/타입명·의존성 변경 금지, 지오메트리·색은 토큰/`lib/time.ts` 상수만(매직넘버 금지), typecheck+build 클린으로 종료 |
| `gesture-engineer` | 스테이지 4–5 전담 (포인터·dnd-kit 전문) | setPointerCapture + pointercancel 필수 처리, 리사이즈 pointerdown stopPropagation, 모든 좌표 변환은 time.ts 경유, 코딩 전 터치 매트릭스(스크롤/생성/이동/리사이즈/탭) 승자 명시, 새 드래그 라이브러리 도입 금지 |
| `ui-verifier` | 스테이지 수용 체크리스트를 실제 브라우저로 검증, 코드 수정 없음 | dev/preview 서버 기동, claude-in-chrome으로 전 체크박스 클릭·드래그·스크롤 실행(390×844 모바일 에뮬레이션 포함), 각 단계 후 콘솔 에러 확인, 리로드 영속성 확인, pass/fail 표 반환, 저장소 읽기 전용 |

### `.claude/skills/` — 2개

| 스킬 | 용도 |
|---|---|
| `/implement-stage <n>` | 스테이지 사이클 오케스트레이션: 설계 재확인 → implementer(4–5는 gesture-engineer) 디스패치 → ui-verifier 검증 → 실패 시 수리 루프 최대 2회 → 체크리스트 결과 출력 후 사용자 확인 요청 |
| `/verify-stage <n>` | 회귀 게이트: 코드 변경 없이 스테이지 n(또는 `--all`로 1..n 누적) 체크리스트 재실행 + 다크모드·320px 스팟 체크, pass/fail 표만 출력 |

추가로 `CLAUDE.md`(프로젝트 규약: 설계 문서 위치, 스테이지 진행 상태, 명령어)와 `PROGRESS.md`(스테이지별 완료 체크) 생성.

---

## 12. 가정 및 열린 결정 (확인 필요 시 알려주세요)

1. **앱 이름** — "DayBlocks"는 가칭 (저장소명은 todo_griff)
2. **HOUR_HEIGHT 96px** — 토큰 64px에서 상향(§4.1 근거). 64px 밀도를 원하면 상수 1곳 + 최소 블록 렌더 규칙 조정
3. **다크 블록 색상** — 토큰에 없어 Stage 1에서 8줄 추가(§6.2), 헥스 튜닝 1회
4. UI 언어 한국어 단일 (`lib/strings.ts`)
5. 반복 일정(recurring)은 v1 범위 외
6. 블록 자정 넘김 금지·핀치줌 없음 — Structured 패리티
7. iOS: Safari 탭 ↔ 설치 PWA 저장소 분리(§8) — JSON 내보내기/가져오기는 v1.1 백로그
8. 키보드 접근성은 "카드 포커스 → Enter로 에디터" 경로 제공, 드래그의 키보드 등가물은 미제공(문서화된 결정)

---

## 13. 서버 연동 대비 설계 (v1은 정적, 그러나 이 규칙들로 이행 비용 최소화)

**원칙: v1에 서버 코드를 선반영하지 않는다(YAGNI). 대신 서버가 와도 바뀌지 않을 경계를 지금 굳힌다.**

### 13.1 지금 굳히는 경계 (v1에서 강제되는 규칙)

1. **변이 초크포인트 단일화** — 모든 데이터 변경은 `blocksStore`의 8개 액션으로만(§3.1). 컴포넌트·훅은 localStorage를 직접 만지지 않는다. → 서버 도입 = 이 액션들 뒤에 동기화 레이어를 끼우는 일이 됨. UI 코드 무변경.
2. **저장소 어댑터 인터페이스 유지** — 영속화는 zustand `PersistStorage` 인터페이스를 구현한 `safeStorage` 하나를 통과(§3.1). → 원격 저장/하이브리드 캐시는 같은 인터페이스의 어댑터 교체·합성으로 처리.
3. **동기화 가능한 데이터 모델** — 이미 충족: 전역 유일 `id`(UUID), 모든 커밋 변이에 `updatedAt` 갱신(LWW 충돌 해결 기준), 순수 JSON 직렬화 가능(함수·Date 객체 없음), `dateKey`+분 표현은 서버·클라이언트 어디서 해석해도 동일.
4. **스키마 버전 관리** — persist `version` + `migrate()`(§3.1)가 이미 서버 스키마 마이그레이션의 로컬 반쪽. 서버 API도 같은 버전 번호를 공유하게 설계.

### 13.2 서버 도입 시나리오 (참고 — v1 구현 없음)

- **호스팅 경로**: Vercel 유지 시 `/api/*` serverless functions가 자연 확장점. SPA에 라우터가 없어 rewrite 충돌 없음(추가 시에도 `/api` 제외 규칙 한 줄).
- **동기화 전략(권장)**: 로컬 우선(localStorage = 캐시 겸 오프라인 소스) + 변이 아웃박스 큐(액션 래핑 미들웨어) + 재연결 시 플러시 + `updatedAt` LWW. 신설 파일은 `lib/api.ts`(fetch 래퍼)와 `store/syncMiddleware.ts` 2개로 국소화.
- **삭제 동기화**: v1은 하드 삭제. 서버 도입 마이그레이션에서 tombstone(`deletedAt`) 도입 — `sanitizeBlocks`가 이미 미지 필드를 보존하므로 하위 호환 안전.
- **알림 승격**: 서버 + Web Push(VAPID)로 백그라운드 알림 가능해짐 — `lib/alarms.ts`의 발화 경로가 이미 SW `showNotification`이라 푸시 핸들러와 코드 공유.
- **인증**: 필요 시점에 결정. 데이터 모델에 userId를 지금 넣지 않는다(로컬 데이터는 암묵적 단일 사용자 — 서버 마이그레이션 시 계정 귀속).
- **데이터 이전**: JSON 내보내기/가져오기(v1.1 백로그)가 "로컬 → 서버 최초 업로드"의 수동 경로도 겸함.

---

## 14. Que Task 연동 (외부 작업 소스 동기화)

> 상태: **설계 확정(사용자 승인 2026-07-08).** §13이 예고한 "서버 도입 시나리오"의 첫 구현체다.
> §13은 "v1에 서버 코드를 선반영하지 않는다(YAGNI)"였으나, Que(사내 팀 작업관리 도구, base=`https://que.griff.co.kr`)가
> 프로덕션 REST API를 배포하면서 이 절이 그 경계를 실제 어댑터로 채운다. **§13의 규칙(변이 초크포인트·저장소 어댑터·LWW·아웃박스)을 그대로 승격**하며, §9의 "fetch/API 레이어 store 선반영 금지"는 여기서 해제된다 — 단, fetch는 신설 `lib/queApi.ts` 한 곳에만 두고 `blocksStore`는 이를 import하지 않는다.

### 14.0 확정 결정 4개

1. **하이브리드 표현.** 시간(`startAt`/`endAt`)이 있는 Que 태스크는 **타임라인 연동 블록**으로 렌더한다. 시간이 없는 태스크는 타임라인에 놓을 수 없으므로 상단 **"Que 할 일" 인박스**에 모으고, 사용자가 인박스 항목을 타임라인으로 드래그해 배치하면 그 순간 시각이 정해져 **연동 블록이 생성**된다(그리고 Que로 일정이 write-back 된다).
2. **write-back = 완료 + 재일정 2종.** 연동 블록의 완료 토글 → Que 태스크 상태 `done`. 연동 블록의 시간 변경(이동·리사이즈·인박스→타임라인 배치) → Que 태스크 일정 변경(`move`). 그 외(제목·메모·색·아이콘·알림)는 **로컬 전용**이며 Que로 보내지 않는다(Que 모델에 대응 필드가 없음).
3. **인증 신설.** DayBlocks는 원래 백엔드 없는 단일 사용자 로컬 앱이다. 여기에 **"Que 계정 연결"** 개념을 더한다 — 로그인 화면에서 email/password로 Que PAT(토큰)를 받아 **safeStorage 어댑터**(§13.1 규칙2)를 통해 영속한다. 토큰이 없으면 앱은 순수 로컬 플래너로 동작하고, 연결하면 Que 태스크가 얹힌다.
4. **모델 확장.** `TimeBlock`에 `queTaskId?`·`syncState?`를 더한다(§14.3). `sanitizeBlocks`가 미지 필드를 **보존**하도록 설계돼 있어(§13.2) 하위호환이 안전하다. 연동 블록(`queTaskId` 있음)은 로컬 전용 블록(`queTaskId` 없음)과 필드 유무만으로 구분한다.

### 14.1 데이터 흐름

```
[로그인]  POST /api/auth/mobile {email,password}
          → { token, user:{id,name,role} }   (토큰 → authStore → safeStorage 'dayblocks:auth')
             ↓ 이후 모든 호출: Authorization: Bearer <token> + X-Que-Via: mobile

[풀(pull)] GET /api/tasks?assignee=<user.id>            ← 전체 동기화 소스(인박스 + 모든 날짜)
          → { tasks: (Task & {projectLabel?,clientId?,clientName?})[] }
             ├─ startAt·endAt 있음 → 연동 블록 (해당 날짜의 dateKey + 분)   → 타임라인
             └─ 시간 없음(둘 다 없음) → "Que 할 일" 인박스                    → 상단 인박스
          (참고) GET /api/my-day 는 "오늘 요약" 전용이며 **무시간 태스크를 뺀다** → 인박스 소스로 못 씀(§14.2 주의)

[라이트백] 연동 블록 완료 토글  → POST /api/tasks/<queTaskId>/status {to:"done"}      → { task }
          연동 블록 시간 변경  → POST /api/tasks/<queTaskId>/move   {startAt,endAt}  → { task }
          인박스→타임라인 배치 → addBlock(queTaskId, syncState:'pending') + 즉시 move (태스크에 최초 일정 부여)

[실패/오프라인] 로컬 우선 커밋(UI 즉시 반영) → 아웃박스 적재 → 재연결·앱시작 시 플러시.
               성공 syncState='synced' / 재시도성 실패(5xx·네트워크) 'pending' / 비재시도(403·404) 'error'.
```

**핵심 원칙(로컬 우선):** localStorage가 진실의 소스이고 Que는 미러다. 모든 UI 조작은 store 액션으로 즉시 로컬에 커밋되고, Que 반영은 뒤따른다. 네트워크가 없어도 앱은 완전히 동작한다(§8 오프라인 계약 유지).

### 14.2 Que API 계약(실측) — `apps/web/src/app/api/` 확인 결과

모든 인증 호출 공통 헤더: `Authorization: Bearer <token>`, `X-Que-Via: mobile`(Que `auth.ts`가 `mobile`을 화이트리스트에 포함 → ChangeLog `via=mobile` 기록), 본문 있으면 `Content-Type: application/json`. **CORS 기확보**: Que가 `https://todo.griff.co.kr`·`http://localhost:5173`·`:3000`을 화이트리스트에 등록, 허용 헤더 `Authorization, Content-Type, X-Que-Via`, 메서드 `GET/POST/PATCH/DELETE/OPTIONS`(프리플라이트 커버), credentials 없음(Bearer 방식). 커스텀 헤더(`X-Que-Via`)로 프리플라이트가 발생하지만 서버가 처리한다.

| 용도 | 메서드·경로 | 요청 | 성공 응답 |
|---|---|---|---|
| 로그인 | `POST /api/auth/mobile` | `{email,password}` | `200 {token, user:{id,name,role}}` |
| 내 작업 전체 | `GET /api/tasks?assignee=<userId>` | — | `{tasks: (Task & {projectLabel?,clientId?,clientName?})[]}` |
| 오늘 요약(참고) | `GET /api/my-day` | — | `TodayData`(아래 주의) |
| 상태 변경 | `POST /api/tasks/<taskId>/status` | `{to: TaskStatus, detail?, mergedIntoTaskId?}` | `{task: Task}` |
| 일정 이동 | `POST /api/tasks/<taskId>/move` | `{startAt, endAt}`(ISO8601+offset) | `{task: Task}` |

- **로그인 실패:** `401 {error:{message}}`(계정 존재 여부 비노출 일반 메시지) / `403 {error:{message:"웹에서 비밀번호를 먼저 변경하세요."}}`(임시비번) / `400`(형식 오류, 동일 일반 메시지). 로그인은 유일한 공개(PAT 불필요) 표면.
- **API 에러 형태(로그인 외):** `{error:{code, message}}`. 상태 매핑(Que `respond.ts`): `401 UNAUTHORIZED`(토큰 무효/만료) · `403 NOT_AUTHORIZED|EVENT_NOT_MOVABLE` · `404 NOT_FOUND` · `409`(중복/이미처리) · `422 INVALID_INPUT|INVALID_SCHEDULE|STATUS_DETAIL_REQUIRED` · `413 PAYLOAD_TOO_LARGE`(>100KB).
- **⚠ 주의 — my-day는 인박스에 못 씀:** `GET /api/my-day`는 `getTodayData`를 반환하는데, 그 `myTasks`는 `overlapsToday(startAt,endAt)`로 거르며 이 함수는 **`startAt`·`endAt`가 둘 다 없으면 `false`**를 낸다. 즉 **무시간 태스크가 빠지고**, 게다가 "오늘"만 담는다. 따라서 인박스(무시간)와 다른 날짜 타임라인을 함께 채우려면 **`GET /api/tasks?assignee=<userId>`가 정본 풀 소스**다. `my-day`는 필요 시 "오늘" 빠른 요약 용도로만 보조 사용한다.
- **Task 필드(Que `domain.ts` `taskSchema`):** `id, title, ownerId, assigneeId, projectId?, startAt?, endAt?, status, priority, description?, estimatedHours?, source, visibility, mergedIntoTaskId?, recurringTemplateId?, lastChangedBy?, lastChangedAt?`.
  - `startAt/endAt`: **ISO8601 datetime(offset 포함)** — 절대 순간(타임존 인지). DayBlocks의 벽시계(dateKey+분)와 표현이 다르다 → §14.4에서 경계 변환.
  - `status`(8종): `scheduled|in_progress|done|needs_reschedule|on_hold|issue|cancelled|merged`. `cancelled`·`merged`는 능동 화면에서 숨김(연동 대상 아님).
  - **`projectName`은 Task에 없다.** 프로젝트 표시는 `projectId`(원시) + `/api/tasks`가 곁들이는 파생 `projectLabel`(거래처·프로젝트 합성 라벨)·`clientName`을 쓴다. 인박스 항목의 부제로 `projectLabel`을 노출한다.

### 14.3 `TimeBlock` 모델 확장 (§2 갱신)

```ts
export type QueSyncState = 'synced' | 'pending' | 'error';

export interface TimeBlock {
  // …기존 필드 그대로…
  queTaskId?: string;       // 링크한 Que Task.id. 없으면 로컬 전용 블록. ⚠ TimeBlock.id에 Que id를 넣지 않는다.
  syncState?: QueSyncState; // 연동 블록의 라이트백 상태. 로컬 전용 블록은 undefined.
}
```

- **왜 `id`가 아니라 별도 `queTaskId`인가:** `TimeBlock.id`는 로컬 영속 키이자 lane/dnd 키이고 `sanitizeBlocks`의 맵 키다(§3.1). Que id로 덮으면 로컬/연동 블록 경계가 무너지고 재하이드레이션 키가 흔들린다. 링크는 **비파괴 참조**여야 한다 — `id`는 로컬 `crypto.randomUUID()` 유지, `queTaskId`가 원격을 가리킨다.
- **하위호환 근거(§13.2 sanitize 보존):** `sanitizeBlock`은 `{...b}`로 **미지 필드를 먼저 펼친 뒤** 알려진 필드만 덮어쓴다 → `queTaskId`·`syncState`는 명시 가드가 없어도 재로드 후 살아남는다. Stage에서 이 둘에 한해 얇은 타입 가드(`queTaskId`는 string, `syncState`는 열거값)만 추가해 위생을 지킨다(값이 이상하면 링크만 끊고 로컬 블록으로 강등 — 블록 자체는 드롭하지 않음).
- **`NewBlockInput` 확장:** optional `queTaskId?`·`syncState?`를 추가하고 `addBlock`이 블록 리터럴에 복사한다. **새 액션이 아니라 기존 액션의 가법적 확장** — 8개 변이 초크포인트(§3.1)를 유지한다. `BlockPatch`는 `Omit<TimeBlock,'id'|'createdAt'|'updatedAt'>` 기반이라 두 신규 필드 패치를 자동 허용한다(`updateBlock`으로 `syncState` 전이). `moveBlock`·`toggleComplete`은 `{...prev}` 스프레드라 두 필드를 자동 보존한다.

### 14.4 Que 필드 → TimeBlock 매핑 표

| Que Task 필드 | TimeBlock 필드 | 변환 규칙 |
|---|---|---|
| `id` | `queTaskId` | 그대로 링크. `TimeBlock.id`는 로컬 UUID 유지(위 근거). |
| `title` | `title` | 직결. 빈 값이면 store `normalizeTitle`이 '새 일정'으로 대체(§2). |
| `startAt`(ISO+offset) | `dateKey` + `startMin` | `new Date(startAt)`를 **기기 로컬**로 해석 → `toDateKey()` + `getHours()*60+getMinutes()`(벽시계, §14.5). |
| `endAt`(ISO+offset) | `endMin` | 동일 변환. 없으면 `startMin + DEFAULT_DURATION`(60분) 클램프. `startAt`도 없으면 → 인박스(블록 아님). |
| `status`=`done` | `completed` | `done → true`, 그 외 → `false`. (역방향은 §14.6) |
| `status`(전체) | `color`(선택·표시) | 옵션 시각 매핑: `issue→red · on_hold→amber · done→green · 그 외→blue`. 로컬 색 편집이 우선이면 덮지 않음. |
| `description` | `note` | 최초 프리필만(옵션). 이후 로컬 편집은 Que로 안 감. |
| `projectLabel`(파생) / `projectId` | (표시용) | 인박스/블록 부제로 노출. **TimeBlock에 저장하지 않음**(모델 최소 유지). `projectName`은 Que Task에 없음 — `projectLabel` 사용. |
| `assigneeId` | (필터 조건) | `=== user.id`인 태스크만 취함. 저장하지 않음. |
| — | `syncState` | 풀 직후 `'synced'`. 로컬 변이 후 플러시 전 `'pending'`. |
| — | `icon` / `color` / `alarm` | Que에 대응 없음 → 기본값(`'star'`/`blue`(또는 status 파생)/`null`). |

**역매핑(write-back):**
- **완료:** `completed:true → POST /status {to:"done"}`. **완료 해제**는 직전 상태를 보존하지 않으므로 안전 기본값 `{to:"in_progress"}`로 되돌린다(오늘 타임라인에 있으므로 "진행 재개" 의미 — 문서화된 결정). `issue`/`on_hold`로의 전환은 `detail.reason` 필수(core 강제)라 DayBlocks에서는 만들지 않는다.
- **재일정:** `(dateKey, startMin, endMin) 변경 → POST /move {startAt, endAt}`. `startAt = ` 로컬 (dateKey, startMin) 조합을 offset 포함 ISO로 직렬화(§14.5). core `parseScheduleRange`가 `startAt ≤ endAt`을 검증한다.

### 14.5 시간 표현 경계 변환 (핵심 난제)

Que는 **절대 순간(ISO8601+offset, 타임존 인지)**, DayBlocks는 **벽시계(dateKey + 자정 기준 분, 타임존 비의존, §2)**. 두 표현은 `lib/queApi.ts` 경계에서만 오간다:

- **풀(Que→로컬):** `new Date(startAt)` → 기기 로컬 타임존으로 해석 → `toDateKey()`(날짜) + `getHours()*60+getMinutes()`(분). `differenceInMinutes`/`startOfDay` 금지 규칙(§4.1) 준수 — 네이티브 게터만 쓴다.
- **푸시(로컬→Que):** `(dateKey, startMin)` → `fromDateKey(dateKey)`에 `setHours(0,0,0,0)` 후 분 가산 → `toISOString()`(또는 로컬 offset 포함 직렬화). 한국은 DST가 없고 §2가 "09:00은 어디서나 09:00" 벽시계 시맨틱을 이미 채택했으므로 왕복이 안전하다. 기기 타임존이 태스크 생성 시점과 다르면 벽시계값이 어긋날 수 있으나 이는 §2가 수용한 트레이드오프다(문서화).
- **자정 넘김:** DayBlocks는 자정 넘김 금지(§2). Que 태스크가 여러 날에 걸치면 **시작일에만** 렌더하고 `endMin`을 `1440`으로 클램프한다(꼬리 잘림을 부제/툴팁으로 안내). 이런 태스크의 이동 write-back은 사용자가 명시적으로 시간을 바꿀 때만 발생하므로 원본 다일(多日) 범위를 임의로 훼손하지 않는다.

### 14.6 스토어 초크포인트 준수 + 라이트백 트리거

**§13.1 규칙2(모든 데이터 변이는 `blocksStore` 8액션으로만, localStorage 직접 접근 금지)를 깨지 않는다.**

- 블록 데이터는 여전히 store 액션만이 변이한다. `queSync`는 블록 상태를 **읽기만** 하고, `syncState` 전이는 `updateBlock`으로만 쓴다.
- 네트워크 부수효과(fetch)는 `lib/queApi.ts`에만 존재하며 `blocksStore`는 이를 import하지 않는다(store는 순수 + persist만 — §9 원칙 유지).
- **라이트백 트리거:** 연동 블록(`queTaskId` 있음)에 `toggleComplete`/`moveBlock`/`resizeBlock`이 커밋되면, `queSync`가 그 커밋을 zustand `subscribe`로 감지해 **아웃박스**에 `status`/`move` 작업을 적재한다. 적재 즉시 `updateBlock`으로 `syncState='pending'` → 플러시 성공 시 `'synced'`, 실패 시 `'error'`/재시도. 로컬 전용 블록(`queTaskId` 없음)의 변이는 아웃박스를 건드리지 않는다.
- **인박스→타임라인 배치:** 인박스 드롭 핸들러가 `addBlock({queTaskId, syncState:'pending', dateKey, startMin, endMin})` 1회 호출(생성 초크포인트 유지) → `queSync`가 최초 일정 부여로 `move` write-back을 큐잉.

### 14.7 오프라인·실패 처리 (§13.2 아웃박스 구체화)

- **로컬 우선 + 아웃박스 큐:** 변이는 로컬에 즉시 커밋되고, Que 반영 작업은 아웃박스(연동 블록별 최신 의도로 코얼레스 — 같은 블록의 연속 이동은 마지막 것만)에 쌓인다. `online` 이벤트·앱 시작·주기 틱에 플러시.
- **LWW 조정:** 풀 시 Que `task.lastChangedAt`과 로컬 `updatedAt`을 비교 — 원격이 최신이면 `updateBlock`으로 로컬을 갱신(단, 로컬에 미플러시 `pending`이 있으면 로컬 우선 후 재푸시), 로컬이 최신이면 푸시 우선(§13.1 규칙3).
- **에러 등급:** `401`(토큰 만료/무효) → authStore를 `anon`으로 전이 + 로그인 유도, 아웃박스 보존(재로그인 후 플러시). `403 NOT_AUTHORIZED`·`404 NOT_FOUND`(원격에서 삭제/권한상실) → `syncState='error'` + 토스트(재시도 안 함, 사용자 개입). `5xx`·네트워크 실패 → `syncState='pending'` 지수 백오프 재시도.
- 토큰·손상 대응은 §3.1 `safeStorage` 계약을 그대로 따른다(파싱 실패 백업, 쿼터 초과 토스트).

### 14.8 신설 파일 (§9 폴더 구조에 추가)

| 파일 | 역할 |
|---|---|
| `src/lib/queApi.ts` | **fetch 단일 통과점.** `QUE_BASE`(`https://que.griff.co.kr`) 상수, `login/getMyTasks/setTaskStatus/moveTask` 래퍼, 공통 헤더(Bearer+`X-Que-Via: mobile`), 그리고 §14.4·§14.5 순수 매핑 함수(`queTaskToBlockInput`, `blockToScheduleRange`). 토큰은 `authStore.getState().token`에서 읽는다. (§13.2가 예고한 `lib/api.ts`의 구체화) |
| `src/store/authStore.ts` | **persist(safeStorage, key `dayblocks:auth`)** — `{token, user, status:'anon'|'authed'}` + `login(email,password)`/`logout`. 저장은 §13.1 규칙2대로 **safeStorage 어댑터 경유**(원시 localStorage 금지). |
| `src/store/queSync.ts` | 동기화 레이어 — 풀 reconcile(연동 블록 add/update) + 아웃박스 + 라이트백 플러시 + `syncState` 전이. store 액션만으로 블록 변이, 네트워크는 `queApi`만. |
| `src/components/QueInbox.tsx` | 상단 "Que 할 일" 무시간 인박스. 드래그→타임라인 배치 시 연동 블록 생성(§14.6). 헤더: "Que 할 일 (n)" + **새로고침 SVG 아이콘 버튼**(카운트 옆, 동기화 중 회전) + 동기화 칩 + **로그아웃** 버튼. |
| `src/components/LoginScreen.tsx` | email/password → `authStore.login`. `status==='anon'`이면 셸 대신 로그인 노출(미연결 시 순수 로컬 플래너로 계속 사용 가능하도록 "나중에" 경로 포함). **디자인: Figma QUE_All_Pages/login(45:199) 기준 다크 브랜드 스크린**(GRIFF 로고 `src/brand/griff-logo.svg` + "QUE 연결" + Google 버튼 + or + Email/Password + 로그인). 앱 테마와 무관하게 항상 다크 — 브랜드 색(#1a1c1e/#4285f4 등)은 Figma 값 직접 사용(토큰 예외). **Google 로그인은 미구현**: 버튼만 노출하고 누르면 "준비 중" 토스트(구글 auth 후속). |

- **`src/lib/strings.ts`**(규칙5): Que 연동 카피(로그인 라벨·에러·인박스 제목·동기화 상태·토스트)를 `STRINGS.que` 하위에 추가한다. 컴포넌트 하드코딩 금지.
- **`src/types.ts`**(§14.3): `QueSyncState` 타입 + `TimeBlock`에 `queTaskId?`·`syncState?` 추가.
- **의존성:** 새 드래그/HTTP 라이브러리 도입 없음. fetch는 네이티브, 인박스 드래그는 기존 dnd-kit/커스텀 포인터 규율(§4)을 재사용한다.
