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

## 개선 3건 (2026-07-18, 사용자 확정)

Plan-Do-See 사이클 강화 + 10분 정밀도. typecheck/build 클린. DESIGN.md §4.1·§7 개정 + §16 신설 반영.

### ① 10분 스냅 + 보조 눈금 + 최소 블록 20분 (§4.1 개정)
- `GESTURE_SNAP` 15→10(토큰 `snapMinutes`·`--snap-minutes` 동기, 96px/시에서 10분=16px 정수). STORE_SNAP 5 유지.
- TimelineGrid에 **10분 보조 헤어라인**(시간선 색을 opacity 40%로 파생, 라벨은 정시만) — "부 눈금 없음" 규칙 개정.
- `MIN_DURATION` 15→20(=32px). **창작 최소와 렌더 하한 분리**: `normalizeRange`(mutation)만 20분 강제, 로드용 `sanitizeRange`는 최소 길이 미강제 → **기존 15분 블록 데이터 무손실**. 카드 `min-height = RENDER_MIN_HEIGHT`(24px)로 짧은 레거시 블록 가독 보장. 토큰 `blockMinHeight` 의미가 '최소 길이'→'렌더 하한'으로 개정.
- 생성/이동/리사이즈 모두 GESTURE_SNAP 공유라 자동 10분 일관.
- 변경 파일: `lib/time.ts`, `lib/tokens.ts`, `styles/tokens.css`, `store/blocksStore.ts`, `components/TimelineGrid.tsx`, `components/TimeBlockCard.tsx`(min-height), 제스처 훅 주석.

### ② 종료 알림 + 진행 중 카운트다운 + 알림 어댑터 분리 (§7 개정)
- **`lib/notify.ts` 신설**: 발화 경로(SW showNotification + 인앱 토스트)를 `notify(title,body,tag)`로 추상화. alarms.ts가 유일 소비자. **네이티브 전환 시 이 파일 1곳만 교체** 헤더 주석.
- **종료 알림 옵트인**: `TimeBlock.endAlarm?`(에디터 알림 카드 "종료 알림" 토글). fireAt=endMin, firedKey=`id|dateKey|end|fireAtMin`(시작 키와 충돌 금지, prune 파싱 호환). 10분 발화창·영속 dedup 그대로.
- **진행 중 카운트다운**: TimeBlockCard가 `useNow`(나우라인 30초 틱 인프라) 재사용해 범위 안·미완료면 "남은 N분" 소형 표시. 완료 블록 미표시.
- 변경/신설: `lib/notify.ts`(신설), `lib/alarms.ts`, `types.ts`, `store/blocksStore.ts`, `components/BlockEditor.tsx`, `components/TimeBlockCard.tsx`, `lib/strings.ts`.

### ③ 하루 마감 See 카드 (§16 신설)
- **`store/reviewStore.ts` 신설**: persist(dayblocks:review v1, safeStorage) — `captureSnapshot`(날짜당 1회·불변, 최근 7일 정리). 스냅샷 변이 초크포인트 격리 = **향후 Supabase 전환 교체점**(주석).
- **`hooks/useDaySnapshot.ts` 신설**: 그날 첫 조회(양 스토어 하이드레이션 게이트) + 자정 롤오버에 오늘 계획 `{id,title,start,end}` 캡처.
- **`components/DayReviewSheet.tsx` 신설**: DateHeader 아이콘 버튼(저녁 18시 이후 도트 강조)으로 진입. 계획 실행률 바 + 계획/완료 2열 + 추가 블록 수 + 밀린 계획 목록. 조회 전용, **개인 시간 회고 전용(팀 회고는 Que 분업)**. 스냅샷 없는 날은 교육형 빈 상태.
- 변경: `store/uiStore.ts`(reviewOpen), `components/DateHeader.tsx`, `App.tsx`(hook+sheet 배선), `lib/strings.ts`.

### 네이티브 앱 트랙 결정 (2026-07-18 사용자 확정)
- **추후 네이티브 앱(Capacitor 우선 검토)** — 웹 백그라운드 알림 한계를 로컬 알림으로 해소.
- **데이터는 Que Supabase 공유**(계획 스냅샷·블록 저장 전환 예정) — reviewStore·blocksStore 변이 초크포인트로 교체점 격리.
- **PWA 푸시 서버는 하지 않음** — 알림은 앱이 열려 있는 동안만(§7). 네이티브 전환 시 `lib/notify.ts` 1곳 교체.

## 개인 블록·See 스냅샷 서버 동기화 (2026-07-19, §14.10)

Que API가 개인 저장소(`/api/blocks`·`/api/day-reviews`)를 제공 → §14의 로컬 우선·아웃박스·백오프 규범을 **두 번째 동기 축**으로 확장. `queTaskId` 없는 순수 개인 블록 + See 스냅샷을 서버 미러링(연동 블록은 tasks 라이트백 소관이라 제외 — 이중 저장 금지). typecheck/build 클린(lint 스크립트 없음).

- **신설 `store/personalSync.ts`:** queSync 패턴의 개인 블록 판.
  - **풀**: 부팅·재로그인 최근 14일 블록 GET → **id 단위 LWW**(payload.updatedAt vs 로컬 updatedAt, 아웃박스 잔존 시 로컬 승). 신규는 서버 id 보존 재생성(`addBlock` optional id). `applyingRemote`로 에코 차단. 스냅샷은 최근 7일 GET → 없는 날만 채움(불변).
  - **푸시**: blocksStore 구독 → 개인 블록만 blockId 코얼레스 아웃박스(신규/변경/삭제/연동해제). 30초 플러시·지수 백오프·오프라인 보존. 스냅샷은 reviewStore 구독 → PUT 1회(불변).
  - **Que 연동 블록 제외**: 구독 diff에서 `b.queTaskId` 있으면 skip, payload에서 `queTaskId`/`syncState` 방어 제외, 개인→연동 전환 시 개인 저장소에서 DELETE.
  - **rejected**: 콘솔 경고+op 드롭(비재시도). 8KB 초과 스킵+경고. 401→expire(아웃박스 보존), 4xx 드롭, 5xx·네트워크 백오프.
- **변경**: `lib/queApi.ts`(getBlocks/putBlocks/deleteBlocks/getDayReviews/putDayReviews+타입) · `store/blocksStore.ts`(NewBlockInput.id 가법 확장, addBlock 보존 + pruneFiredAlarms 주석에 종료키 `id|dateKey|end|fireAtMin` 형식 병기) · `store/reviewStore.ts`(applyRemoteSnapshot — capturedAt 보존 채우기 전용) · `main.tsx`(startPersonalSync 배선).
- **DESIGN.md §14.10 신설.**
