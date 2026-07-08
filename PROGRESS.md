# DayBlocks 구현 진행 상태

상태: ⬜ 대기 / 🔨 진행 중 / ✅ 완료 / ⚠ 이슈

| Stage | 목표 | 상태 | 비고 |
|---|---|---|---|
| 1 | 스캐폴드 + 토큰 파이프라인 + 앱 셸 | ✅ 완료 | Vite 8/TS 6.0/Tailwind v4, tokens.css·ts 사본(hour-height 96px 동기) + 다크 블록 8줄 + data-color 브리지 8줄, typecheck/build 클린 |
| 2 | 정적 타임라인 + 날짜 내비 + 나우라인 | ✅ 완료 | DateHeader/Timeline(스크롤러 소유)/TimelineGrid(25라벨, memo)/NowLine(오늘만) + useNow(30초 틱+visibilitychange) + uiStore(§3.2 전체). 스크롤-투-나우: 마운트 instant·"오늘" smooth(TimelineHandle 배선). typecheck/build 클린 |
| 3 | 데이터 레이어 + 에디터 CRUD | ⬜ 대기 | |
| 4 | 드래그 생성 | ⬜ 대기 | |
| 5 | 이동(dnd-kit) + 리사이즈(핸들) | ⬜ 대기 | |
| 6 | 완료 + 겹침 + 알림 + 폴리시 | ⬜ 대기 | |
| 7 | PWA + 최종 QA | ⬜ 대기 | |
| 8 | Vercel 배포 | ⬜ 대기 | GitHub 인증(gh auth login) 후 진행 |
