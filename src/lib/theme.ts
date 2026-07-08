// 테마 토글 — DESIGN.md §6.3
// 다크모드 단일 신호 = `html[data-theme]`. index.html 인라인 스크립트가 첫 페인트 전 스탬프하고
// (localStorage.theme ?? OS prefers-color-scheme), 여기서는 사용자의 명시 선택을 처리한다:
// localStorage.theme에 저장 + data-theme를 즉시 반영(리로드 없이). localStorage.theme이 세팅되면
// index.html 로직상 OS 추종은 해제된다(수동 선택 우선).

export type Theme = 'light' | 'dark';

/** 현재 적용된 테마 — data-theme 단일 신호에서 읽는다. */
export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** 사용자 명시 선택 저장 + 즉시 반영. */
export function setTheme(theme: Theme): void {
  localStorage.theme = theme;
  document.documentElement.dataset.theme = theme;
}

/** 라이트 ↔ 다크 토글. 적용된 새 테마를 반환. */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}
