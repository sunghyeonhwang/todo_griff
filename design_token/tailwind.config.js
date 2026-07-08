/** @type {import('tailwindcss').Config} */
// Structured Planner — Tailwind Design Tokens v1.0.0
// darkMode: 'class' 로 [data-theme]가 아닌 .dark 클래스를 쓰려면
// html에 class="dark"를 토글하세요. (혹은 selector 전략 사용)

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        block: {
          blue:   { bg: '#E8F0FE', fg: '#1A73E8', solid: '#4285F4', border: '#C6DAFC' },
          green:  { bg: '#E6F4EA', fg: '#1E8E3E', solid: '#34A853', border: '#C4E7CE' },
          orange: { bg: '#FEF0E3', fg: '#E8710A', solid: '#FA903E', border: '#FBDDC3' },
          red:    { bg: '#FCE8E6', fg: '#D93025', solid: '#EA4335', border: '#F7C6C2' },
          purple: { bg: '#F3E8FD', fg: '#8430CE', solid: '#A250E8', border: '#E3CBF9' },
          pink:   { bg: '#FCE4EC', fg: '#D01884', solid: '#EC4899', border: '#F8C6DD' },
          teal:   { bg: '#E0F7F5', fg: '#00897B', solid: '#14B8A6', border: '#B8ECE6' },
          gray:   { bg: '#F1F3F4', fg: '#5F6368', solid: '#9AA0A6', border: '#DADCE0' },
        },
        // 테마 반응형 토큰 (CSS 변수 참조 → 다크모드 자동 전환)
        surface: {
          DEFAULT:  'var(--surface-background)',
          card:     'var(--surface-card)',
          elevated: 'var(--surface-card-elevated)',
          line:     'var(--surface-timeline-line)',
          label:    'var(--surface-timeline-label)',
          now:      'var(--surface-now-indicator)',
        },
        content: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
          onSolid:   'var(--text-on-solid)',
        },
        accent: {
          primary: '#4285F4',
          success: '#34A853',
          warning: '#FA903E',
          danger:  '#EA4335',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Pretendard', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'Roboto Mono', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xs:  ['11px', { lineHeight: '1.4' }],
        sm:  ['13px', { lineHeight: '1.4' }],
        base:['15px', { lineHeight: '1.4' }],
        md:  ['17px', { lineHeight: '1.4' }],
        lg:  ['20px', { lineHeight: '1.2' }],
        xl:  ['24px', { lineHeight: '1.2' }],
        '2xl':['28px', { lineHeight: '1.2' }],
        '3xl':['34px', { lineHeight: '1.2' }],
      },
      fontWeight: {
        regular: '400', medium: '500', semibold: '600', bold: '700',
      },
      letterSpacing: {
        tight: '-0.02em', normal: '0', wide: '0.02em',
      },
      spacing: {
        1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px',
        6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px',
        // 레이아웃 전용
        'time-label': '60px',
        'hour': '64px',
      },
      borderRadius: {
        sm: '8px', md: '12px', lg: '16px', xl: '20px', '2xl': '28px', full: '9999px',
      },
      boxShadow: {
        sm:    'var(--shadow-sm)',
        md:    'var(--shadow-md)',
        lg:    'var(--shadow-lg)',
        block: 'var(--shadow-block)',
      },
      maxWidth: {
        app: '480px',
      },
      transitionTimingFunction: {
        standard:  'cubic-bezier(0.4, 0.0, 0.2, 1)',
        decelerate:'cubic-bezier(0.0, 0.0, 0.2, 1)',
        accelerate:'cubic-bezier(0.4, 0.0, 1, 1)',
        spring:    'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        fast: '120ms', base: '200ms', slow: '320ms',
      },
      zIndex: {
        base: '0', block: '10', now: '20', dragging: '30',
        header: '40', modal: '50', toast: '60',
      },
    },
  },
  plugins: [],
};
