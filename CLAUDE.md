# DayBlocks — Structured 스타일 데일리 플래너 (웹)

하루를 세로 타임라인(00:00–24:00)으로 보여주는 모바일 우선 PWA. 백엔드 없음(localStorage), Vercel 정적 배포, 추후 서버 연동 전제.

## 규범 문서

- **`DESIGN.md`가 유일한 규범 스펙이다.** 구현과 문서가 충돌하면 문서가 이긴다. 다르게 구현해야 하면 문서를 먼저 고치고 근거를 남긴다.
- `PROGRESS.md` — 스테이지(1–8) 진행 상태. 스테이지 완료 시 갱신.
- `design_token/` — 시각 토큰 소스(사용자 제공). `src/styles/tokens.css`·`src/lib/tokens.ts`는 여기서 파생.

## 명령어

- `npm run dev` / `npm run build` / `npm run preview` / `npm run typecheck`
- 스테이지 구현: `/implement-stage <n>` · 회귀 검증: `/verify-stage <n>` 또는 `--all`

## 핵심 규칙 (위반 = 리뷰 반려)

1. 매직넘버 금지 — 지오메트리는 `src/lib/time.ts` 상수, 색은 `src/styles/tokens.css` 변수만.
2. 데이터 변이는 `store/blocksStore.ts` 액션 8개로만. 컴포넌트/훅의 localStorage 직접 접근 금지(서버 연동 대비 경계 — DESIGN.md §13).
3. dnd-kit은 블록 이동 전용. 생성·리사이즈는 커스텀 Pointer Events. DragOverlay 금지.
4. 스토어 쓰기는 제스처당 1회(pointer-up). 드래그 프리뷰는 훅 로컬 상태로만.
5. 한국어 UI 카피는 `src/lib/strings.ts`에만.
6. 일중 시간 계산에 `differenceInMinutes`/`startOfDay` 금지, 나우 분은 `nowMinutes()`(네이티브). `100vh`/`h-screen` 금지(`dvh`).
7. 알림 발화는 SW `showNotification` 경로(`new Notification`은 Chrome Android에서 예외) + 인앱 토스트 병행.

## Git

- 브랜치 `main`, origin = `https://github.com/sunghyeonhwang/todo_griff` (푸시는 gh 인증 후).
- 커밋 메시지: 한국어, `Stage <n>: <요약>` 형식. 마지막 줄 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
