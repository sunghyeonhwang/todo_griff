import { useState } from 'react';
import { STRINGS } from '../lib/strings';
import { getTheme, toggleTheme, type Theme } from '../lib/theme';

// 테마 토글 버튼 — DESIGN.md §6.3·§6.5
// 헤더 우측(‹날짜› … 오늘 옆)에서 라이트 ↔ 다크 수동 전환. 라이트일 땐 달(→다크), 다크일 땐
// 해(→라이트) 아이콘. 클릭 = lib/theme.toggleTheme(localStorage.theme 저장 + data-theme 반영).
// 초기값은 마운트 시 data-theme에서 지연 읽기 — 깜빡임 없음(첫 페인트는 index.html이 이미 스탬프).
export default function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      aria-label={isDark ? STRINGS.header.themeToLight : STRINGS.header.themeToDark}
      onClick={() => setThemeState(toggleTheme())}
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary active:bg-surface-background"
    >
      {isDark ? (
        // 해 — 탭하면 라이트로
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // 달 — 탭하면 다크로
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
