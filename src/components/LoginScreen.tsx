import { useState } from 'react';
import type { FormEvent } from 'react';
import { STRINGS } from '../lib/strings';
import { useAuthStore } from '../store/authStore';
import { useUiStore } from '../store/uiStore';
import griffLogo from '../brand/griff-logo.svg';
import googleIcon from '../brand/google.svg';

// Que 로그인 화면 — DESIGN.md §14.8
// - status==='anon' && !dismissed 일 때 App이 셸 대신 이 화면을 노출.
// - "나중에"(dismiss) 경로로 미연결 상태에서도 순수 로컬 플래너를 계속 쓸 수 있다.
// - 디자인: Figma QUE_All_Pages/login(45:199) 기준 — 다크 브랜드 스크린(GRIFF 로고 + QUE 연결 +
//   Google 버튼 + or 구분 + Email/Password + 로그인). 앱 라이트/다크 테마와 무관하게 항상 다크(브랜드
//   게이트). 브랜드 색은 Figma 값 직접 사용(#1a1c1e/#4285f4 등) — 토큰 예외로 문서화(§14.8).
// - **Google 로그인은 미구현**: 버튼만 노출하고 누르면 "준비 중" 토스트(구글 auth는 후속).
export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const dismiss = useAuthStore((s) => s.dismiss);
  const clearError = useAuthStore((s) => s.clearError);
  const pending = useAuthStore((s) => s.pending);
  const error = useAuthStore((s) => s.error);
  const showToast = useUiStore((s) => s.showToast);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = email.trim() !== '' && password !== '' && !pending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void login(email, password);
  };

  const inputClass =
    'h-12 w-full rounded-lg border border-[#d0d5dd] bg-transparent px-4 text-base text-white outline-none placeholder:text-[#949494] focus-visible:border-[#4285f4] focus-visible:ring-2 focus-visible:ring-[#4285f4]/50';

  return (
    <div className="flex h-dvh flex-col items-center bg-[#1a1c1e] px-6">
      <img src={griffLogo} alt="GRIFF" className="mt-[88px] h-[26px] w-auto" />

      <form onSubmit={submit} className="mt-16 flex w-full max-w-app flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-3xl font-bold text-white">{STRINGS.que.login.title}</h1>
          <p className="text-sm font-medium text-white">{STRINGS.que.login.subtitle}</p>
        </div>

        {/* Google 로그인 — 미구현(버튼만). 누르면 "준비 중" 안내(§14.8). */}
        <button
          type="button"
          onClick={() => showToast(STRINGS.que.login.googleSoon)}
          className="flex h-12 w-full items-center justify-center gap-3 rounded-md bg-white px-5 text-[15px] font-medium text-[#949494] active:opacity-90"
        >
          <img src={googleIcon} alt="" className="size-6" />
          {STRINGS.que.login.google}
        </button>

        {/* or 구분선 */}
        <div className="flex items-center gap-4">
          <span className="h-px flex-1 bg-white/25" />
          <span className="text-base font-medium text-white">{STRINGS.que.login.or}</span>
          <span className="h-px flex-1 bg-white/25" />
        </div>

        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-label={STRINGS.que.login.emailPlaceholder}
          placeholder={STRINGS.que.login.emailPlaceholder}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) clearError();
          }}
          className={inputClass}
        />
        <input
          type="password"
          autoComplete="current-password"
          aria-label={STRINGS.que.login.passwordPlaceholder}
          placeholder={STRINGS.que.login.passwordPlaceholder}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) clearError();
          }}
          className={inputClass}
        />

        {error && <p className="-mt-2 text-sm text-[#f87171]">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full rounded-lg bg-[#4285f4] text-base font-semibold text-white transition-opacity duration-(--duration-fast) disabled:opacity-40 active:opacity-90"
        >
          {pending ? STRINGS.que.login.submitting : STRINGS.que.login.submit}
        </button>

        <button
          type="button"
          onClick={dismiss}
          className="h-11 w-full rounded-full text-sm font-medium text-white/60 active:bg-white/5"
        >
          {STRINGS.que.login.later}
        </button>
      </form>
    </div>
  );
}
