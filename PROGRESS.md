# DayBlocks 구현 진행 상태

상태: ⬜ 대기 / 🔨 진행 중 / ✅ 완료 / ⚠ 이슈

| Stage | 목표 | 상태 | 비고 |
|---|---|---|---|
| 1 | 스캐폴드 + 토큰 파이프라인 + 앱 셸 | ✅ 완료 | Vite 8/TS 6.0/Tailwind v4, tokens.css·ts 사본(hour-height 96px 동기) + 다크 블록 8줄 + data-color 브리지 8줄, typecheck/build 클린 |
| 2 | 정적 타임라인 + 날짜 내비 + 나우라인 | ✅ 완료 | DateHeader/Timeline(스크롤러 소유)/TimelineGrid(25라벨, memo)/NowLine(오늘만) + useNow(30초 틱+visibilitychange) + uiStore(§3.2 전체). 스크롤-투-나우: 마운트 instant·"오늘" smooth(TimelineHandle 배선). typecheck/build 클린 |
| 3 | 데이터 레이어 + 에디터 CRUD | ✅ 완료 | blocksStore(persist v1 'dayblocks:data'+partialize+migrate/merge sanitize, 액션 8개 불변식 강제)+safeStorage(백업·쿼터 토스트), BottomSheet(포커스트랩·Escape·백드롭·그래버 80px·visualViewport), BlockEditor(§5 필드 7종·명시적 저장·탭-어게인 삭제), EmojiGrid/ColorSwatchRow, TimeBlockCard(정적+탭→에디터), '+' 드래프트 배선, storage.persist(). 브라우저 스모크: 생성/수정/삭제/리로드 유지/날짜 분리/빈 제목→'새 일정'/end≤start 비활성+힌트 통과. typecheck/build 클린 |
| 4 | 드래그 생성 | ✅ 완료 | useDragCreate(§4.2 전체: 마우스 6px/터치 400ms·10px 무장, 무장 시 non-passive touchmove 등록·종료 해제, 15분 스냅·위로 드래그·최소 15분, rect 1회 캐시+라이브 scrollTop+rAF 배칭, pointercancel/회전 폐기, 릴리즈→openCreate 스토어 무변경) + DragCreateGhost(점선 --blk-border·60% 채움·라이브 HH:mm 라벨, 드래그 중 훅 프리뷰 → create 에디터 중 editor.draft) + useEdgeAutoScroll(48px/12px/frame, Stage 5 재사용) + Timeline 빈 면 배선(pan-y·select-none·callout·contextmenu 하드닝) + 카드 pointerdown stopPropagation. 플레인 탭→60분 드래프트(선택 시 해제만 소비). typecheck/build 클린 |
| 5 | 이동(dnd-kit) + 리사이즈(핸들) | ⬜ 대기 | |
| 6 | 완료 + 겹침 + 알림 + 폴리시 | ⬜ 대기 | |
| 7 | PWA + 최종 QA | ⬜ 대기 | |
| 8 | Vercel 배포 | ⬜ 대기 | GitHub 인증(gh auth login) 후 진행 |
