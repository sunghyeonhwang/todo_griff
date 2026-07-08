# DayBlocks 구현 진행 상태

상태: ⬜ 대기 / 🔨 진행 중 / ✅ 완료 / ⚠ 이슈

| Stage | 목표 | 상태 | 비고 |
|---|---|---|---|
| 1 | 스캐폴드 + 토큰 파이프라인 + 앱 셸 | ✅ 완료 | Vite 8/TS 6.0/Tailwind v4, tokens.css·ts 사본(hour-height 96px 동기) + 다크 블록 8줄 + data-color 브리지 8줄, typecheck/build 클린 |
| 2 | 정적 타임라인 + 날짜 내비 + 나우라인 | ✅ 완료 | DateHeader/Timeline(스크롤러 소유)/TimelineGrid(25라벨, memo)/NowLine(오늘만) + useNow(30초 틱+visibilitychange) + uiStore(§3.2 전체). 스크롤-투-나우: 마운트 instant·"오늘" smooth(TimelineHandle 배선). typecheck/build 클린 |
| 3 | 데이터 레이어 + 에디터 CRUD | ✅ 완료 | blocksStore(persist v1 'dayblocks:data'+partialize+migrate/merge sanitize, 액션 8개 불변식 강제)+safeStorage(백업·쿼터 토스트), BottomSheet(포커스트랩·Escape·백드롭·그래버 80px·visualViewport), BlockEditor(§5 필드 7종·명시적 저장·탭-어게인 삭제), EmojiGrid/ColorSwatchRow, TimeBlockCard(정적+탭→에디터), '+' 드래프트 배선, storage.persist(). 브라우저 스모크: 생성/수정/삭제/리로드 유지/날짜 분리/빈 제목→'새 일정'/end≤start 비활성+힌트 통과. typecheck/build 클린 |
| 4 | 드래그 생성 | ✅ 완료 | useDragCreate(§4.2 전체: 마우스 6px/터치 400ms·10px 무장, 무장 시 non-passive touchmove 등록·종료 해제, 15분 스냅·위로 드래그·최소 15분, rect 1회 캐시+라이브 scrollTop+rAF 배칭, pointercancel/회전 폐기, 릴리즈→openCreate 스토어 무변경) + DragCreateGhost(점선 --blk-border·60% 채움·라이브 HH:mm 라벨, 드래그 중 훅 프리뷰 → create 에디터 중 editor.draft) + useEdgeAutoScroll(48px/12px/frame, Stage 5 재사용) + Timeline 빈 면 배선(pan-y·select-none·callout·contextmenu 하드닝) + 카드 pointerdown stopPropagation. 플레인 탭→60분 드래프트(선택 시 해제만 소비). typecheck/build 클린 |
| 5 | 이동(dnd-kit) + 리사이즈(핸들) | ✅ 완료 | dndSensors(data-no-dnd 인식 Mouse 4px/Touch 300ms·8px 서브클래스), Timeline DndContext(캔버스 내부, 세로+24px 스냅+부모 제한 모디파이어, autoScroll y 0.15/가속 10, onDragEnd 클램프 수식→moveBlock 1회, 터치 onDragStart=선택 겸용), TimeBlockCard useDraggable(in-place transform scale 1.02+shadow-lg+z-dragging, 이동 중 시간 배지=커밋값, wasDraggedRef 클릭 가드, hover/선택 게이트 핸들), ResizeHandle(24px 히트·안팎 12px·32×4 그립 --blk-solid·touch-none·data-no-dnd), useResizeBlock(§4.4: 15분 엣지 스냅·반대편 고정·반전 없음·resizeBlock 1회·useEdgeAutoScroll 재사용·pointercancel 폐기). 브라우저 스모크: 이동 배지=커밋 일치·상하 경계 클램프·길이 보존·리사이즈 15분 플로어·pointercancel 무변경·탭→에디터·리로드 유지 통과. typecheck/build 클린 |
| 6 | 완료 + 겹침 + 알림 + 폴리시 | ✅ 완료 | 체크박스 배선(toggleComplete 즉시 커밋·44×44 히트·data-no-dnd)+완료 비주얼(§4.9 40% 페이드·취소선·그림자 제거·--blk-solid 체크, --duration-fast), lanes.ts(클러스터+그리디 lane+excludeId 순수 함수, lane 간격 2px §4.6 추가)+Timeline useMemo 적용(드래그 중 제외→풀폭 90%), alarms.ts(§7 전체: 30초 단일 폴링·hydration 후 시작·visibilitychange 즉시 틱·10분 발화창·firedKey 영속 dedupe·SW showNotification+dev 폴백·토스트 병행·requestNotificationPermission)+main.tsx 배선, Toast(z-toast·4초 자동 소멸), 에디터 권한 요청 alarms 경유, 빈 날 힌트(§6.5), 카드 keydown target 가드. 브라우저 스모크: 체크 토글+리로드 영속·2/3/6-lane 분할·맞닿음 비분할·알림 5건 발화+dedupe(재발화 없음)·빈 날 힌트·다크/라이트 토큰 캐스케이드·320px 가로 스크롤 0 통과. typecheck/build 클린 |
| 7 | PWA + 최종 QA | ✅ 완료 | VitePWA(§8: autoUpdate·standalone manifest(name/desc는 strings.ts import)·workbox globPatterns+navigateFallback·devOptions false), 아이콘 5종(favicon.svg 소스→qlmanage 래스터화→sips 검증: pwa-192/512, maskable-512 중앙 80% 세이프존, apple-touch 180 full-bleed), index.html 메타(favicon+apple-touch-icon 링크). build→dist에 sw.js·manifest.webmanifest·아이콘 확인, preview+curl로 manifest(application/manifest+json)/sw/아이콘 전부 200 확인 후 서버 종료. typecheck/build 클린. Lighthouse는 브라우저 QA에서 별도 수행 |
| 8 | Vercel 배포 | ⬜ 대기 | 사용자 지시 대기 — "배포 직전"이 현재 목표 지점 |

## 통합 브라우저 QA (2026-07-08, 실제 Chrome)

전 스테이지 수용 기준을 실제 클릭·드래그·리로드로 재검증. **세션 전체 콘솔 에러 0건.**

통과: 타임라인 지오메트리(라벨 25개·캔버스 2360px·초기 스크롤 30% 공식 정확 일치) / 날짜 내비(‹›·오늘 smooth·날짜 분리) / 빈 날 힌트 / 생성 3경로('+'·드래그·플레인 탭 — 에디터 우선, 저장 전 스토어 무변경, 취소 잔여물 0) / 블록 이동(15분 스냅·길이 보존) / 리사이즈(상·하, 반대편 고정) / 탭-어게인 삭제 / 완료 토글+비주얼 / 겹침 lane(균등 폭·2px 간격·맞닿은 경계 비분할) / 하드 리로드 영속 / 라이트·다크 토큰 색 / 320px 무오버플로(iframe 검증) / 알림 엔드투엔드(발화창·토스트 "💼 팀 미팅 — 12:45 시작"·firedAlarms 듀프 키 영속) / 프로덕션 빌드 SW 등록·활성·페이지 제어.

QA 중 발견·수정 2건:
1. **리사이즈 릴리즈가 에디터를 여는 버그** — pointerup 후 호환 click이 핸들→카드로 버블. ResizeHandle에 click stopPropagation 추가.
2. **BottomSheet 오픈이 rAF 단독 의존** — 가려진 창(rAF 스로틀)에서 시트가 off-screen에 머무름. 50ms 타임아웃 폴백 추가(멱등).

## Structured 정체성 리디자인 (2026-07-08, 사용자 피드백 + 실제 앱 스크린샷 5장 기준)

사용자 지적("인터페이스가 많이 다른데") 반영 — 그리드 타임라인(요구사항 #1)은 유지하고 비주얼 정체성 이식:
- **주간 날짜 스트립**(DateHeader 2행: 요일 글자 + 날짜 원, 선택 accent 채움, 월요일 시작, 탭 이동)
- **블록 카드**: 좌측 액센트 바 제거 → **원형 이모지 배지**(흰 원 + 색 링) + "시간범위 · 소요시간" 캡션
- **플로팅 + FAB**(AddFab, 우하단 56px) — 헤더 '+' 제거
- **에디터 재구성**: 컬러 헤더 밴드(X·대형 배지·시간 요약·밑줄 제목·완료 원) + 날짜 행 카드 +
  시간 섹션 + **소요시간 pill 선택기**(15분~2시간) + 알림/메모 카드 + 하단 대형 저장 pill
- 브라우저 검증: 주간 스트립 탭/오늘, FAB 드래프트, pill→시간 동기화→저장, 라이트·다크, 콘솔 0건
- 액센트는 스크린샷의 코랄이 아닌 design_token/ 파랑 유지(토큰이 색상 소스 오브 트루스 — 정체성은 구조로 이식)
