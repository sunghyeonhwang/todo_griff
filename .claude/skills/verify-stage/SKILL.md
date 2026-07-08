---
name: verify-stage
description: 코드 변경 없이 스테이지 n의 수용 체크리스트를 재실행하는 회귀 게이트. 사용법 - /verify-stage <n> 또는 /verify-stage --all (1..현재 누적)
---

1. 대상 결정: 인자가 숫자 n이면 스테이지 n만, `--all`이면 PROGRESS.md 기준 완료된 모든 스테이지(1..현재)를 누적 검증.
2. **ui-verifier** 에이전트를 디스패치한다. 어떤 코드도 수정하지 않는다(이 스킬은 판정만).
3. 대상 스테이지와 무관하게 항상 포함할 스팟 체크: 다크모드 전환(`data-theme='dark'` 주입) 화면 점검 1회, 320px 폭 가로 오버플로 점검 1회, 콘솔 에러 0건 확인.
4. 출력: 항목별 PASS/FAIL 표만. 수리는 이 스킬의 범위가 아니다 — FAIL이 있으면 `/implement-stage <n>`으로 수리를 안내한다.
