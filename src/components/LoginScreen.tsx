import { useState } from 'react';
import type { FormEvent } from 'react';
import { STRINGS } from '../lib/strings';
import { useAuthStore } from '../store/authStore';

// Que 로그인 화면 — DESIGN.md §14.8
// - status==='anon' && !dismissed 일 때 App이 셸 대신 이 화면을 노출.
// - "나중에"(dismiss) 경로로 미연결 상태에서도 순수 로컬 플래너를 계속 쓸 수 있다.
// - h-dvh(100vh/h-screen 금지 §6), max-w-app 중앙 컬럼, 토큰 색만 사용.
// - 카피는 STRINGS.que.login(규칙5). 입력은 최소 44px 터치 대상(§화면 원칙).
export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const dismiss = useAuthStore((s) => s.dismiss);
  const clearError = useAuthStore((s) => s.clearError);
  const pending = useAuthStore((s) => s.pending);
  const error = useAuthStore((s) => s.error);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canSubmit = email.trim() !== '' && password !== '' && !pending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    void login(email, password);
  };

  const inputClass =
    'h-11 w-full rounded-md border border-surface-timeline-line bg-surface-background px-3 text-base text-text-primary outline-none focus-visible:border-accent-primary focus-visible:ring-2 focus-visible:ring-accent-primary';

  return (
    <div className="flex h-dvh flex-col items-center justify-center bg-surface-background px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-app rounded-xl border border-surface-timeline-line bg-surface-card p-6 shadow-lg"
      >
        <h1 className="text-lg font-semibold text-text-primary">{STRINGS.que.login.title}</h1>
        <p className="mt-1 text-sm text-text-secondary">{STRINGS.que.login.subtitle}</p>

        <label className="mt-5 block text-sm font-medium text-text-secondary">
          {STRINGS.que.login.emailLabel}
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={STRINGS.que.login.emailPlaceholder}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) clearError();
            }}
            className={`mt-1 ${inputClass}`}
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-text-secondary">
          {STRINGS.que.login.passwordLabel}
          <input
            type="password"
            autoComplete="current-password"
            placeholder={STRINGS.que.login.passwordPlaceholder}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) clearError();
            }}
            className={`mt-1 ${inputClass}`}
          />
        </label>

        {error && <p className="mt-3 text-sm text-accent-danger">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-6 h-12 w-full rounded-full bg-accent-primary text-base font-semibold text-text-on-solid transition-opacity duration-(--duration-fast) disabled:opacity-40"
        >
          {pending ? STRINGS.que.login.submitting : STRINGS.que.login.submit}
        </button>

        <button
          type="button"
          onClick={dismiss}
          className="mt-2 h-11 w-full rounded-full text-sm font-medium text-text-secondary active:bg-surface-background"
        >
          {STRINGS.que.login.later}
        </button>
      </form>
    </div>
  );
}
