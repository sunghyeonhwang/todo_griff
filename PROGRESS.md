# DayBlocks 구현 진행 상태

상태: ⬜ 대기 / 🔨 진행 중 / ✅ 완료 / ⚠ 이슈

| Stage | 목표 | 상태 | 비고 |
|---|---|---|---|
| 1 | 스캐폴드 + 토큰 파이프라인 + 앱 셸 | ✅ 완료 | Vite 8/TS 6.0/Tailwind v4, tokens.css·ts 사본(hour-height 96px 동기) + 다크 블록 8줄 + data-color 브리지 8줄, typecheck/build 클린 |
| 2 | 정적 타임라인 + 날짜 내비 + 나우라인 | ✅ 완료 | DateHeader/Timeline(스크롤러 소유)/TimelineGrid(25라벨, memo)/NowLine(오늘만) + useNow(30초 틱+visibilitychange) + uiStore(§3.2 전체). 스크롤-투-나우: 마운트 instant·"오늘" smooth(TimelineHandle 배선). typecheck/build 클린 |
| 3 | 데이터 레이어 + 에디터 CRUD | ✅ 완료 | blocksStore(persist v1 'dayblocks:data'+partialize+migrate/merge sanitize, 액션 8개 불변식 강제)+safeStorage(백업·쿼터 토스트), BottomSheet(포커스트랩·Escape·백드롭·그래버 80px·visualViewport), BlockEditor(§5 필드 7종·명시적 저장·탭-어게인 삭제), EmojiGrid/ColorSwatchRow, TimeBlockCard(정적+탭→에디터), '+' 드래프트 배선, storage.persist(). 브라우저 스모크: 생성/수정/삭제/리로드 유지/날짜 분리/빈 제목→'새 일정'/end≤start 비활성+힌트 통과. typecheck/build 클린 |
| 4 | 드래그 생성 | ✅ 완료 | useDragCreate(§4.2 전체: 마우스 6px/터치 400ms·10px 무장, 무장 시 non-passive touchmove 등록·종료 해제, 15분 스냅·위로 드래그·최소 15분, rect 1회 캐시+라이브 scrollTop+rAF 배칭, pointercancel/회전 폐기, 릴리즈→openCreate 스토어 무변경) + DragCreateGhost(점선 --blk-border·60% 채움·라이브 HH:mm 라벨, 드래그 중 훅 프리뷰 → create 에디터 중 editor.draft) + useEdgeAutoScroll(48px/12px/frame, Stage 5 재사용) + Timeline 빈 면 배선(pan-y·select-none·callout·contextmenu 하드닝) + 카드 pointerdown stopPropagation. 플레인 탭→60분 드래프트(선택 시 해제만 소비). typecheck/build 클린 |
| 5 | 이동(dnd-kit) + 리사이즈(핸들) | ✅ 완료 | dndSensors(data-no-dnd 인식 Mouse 4px/Touch 300ms·8px 서브클래스), Timeline DndContext(캔버스 내부, 세로+24px 스냅+부모 제한 모디파이어, autoScroll y 0.15/가속 10, onDragEnd 클램프 수식→moveBlock 1회, 터치 onDragStart=선택 겸용), TimeBlockCard useDraggable(in-place transform scale 1.02+shadow-lg+z-dragging, 이동 중 시간 배지=커밋값, wasDraggedRef 클릭 가드, hover/선택 게이트 핸들), ResizeHandle(24px 히트·안팎 12px·32×4 그립 --blk-solid·touch-none·data-no-dnd), useResizeBlock(§4.4: 15분 엣지 스냅·반대편 고정·반전 없음·resizeBlock 1회·useEdgeAutoScroll 재사용·pointercancel 폐기). 브라우저 스모크: 이동 배지=커밋 일치·상하 경계 클램프·길이 보존·리사이즈 15분 플로어·pointercancel 무변경·탭→에디터·리로드 유지 통과. typecheck/build 클린 |
| 6 | 완료 + 겹침 + 알림 + 폴리시 | ⬜ 대기 | |
| 7 | PWA + 최종 QA | ⬜ 대기 | |
| 8 | Vercel 배포 | ⬜ 대기 | GitHub 인증(gh auth login) 후 진행 |
