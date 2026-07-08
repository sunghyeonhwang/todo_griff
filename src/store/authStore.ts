import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createSafeStorage } from '../lib/safeStorage';
import { STRINGS } from '../lib/strings';
import { QueApiError, login as queLogin, type QueUser } from '../lib/queApi';
import { useUiStore } from './uiStore';

// Que 인증 스토어 — DESIGN.md §14.3·§14.8
//
// DayBlocks에 "Que 계정 연결" 개념을 더한다. email/password로 Que PAT를 받아
// safeStorage 어댑터(§13.1 규칙2 — 원시 localStorage 금지)로 영속한다.
// status==='anon' && !dismissed 이면 App이 셸 대신 LoginScreen을 노출(§14.8),
// 토큰이 없어도(미연결) 앱은 순수 로컬 플래너로 계속 동작한다.

export type AuthStatus = 'anon' | 'authed';

interface PersistedAuth {
  token: string | null;
  user: QueUser | null;
  status: AuthStatus;
  dismissed: boolean; // "나중에" — 미연결이어도 로컬 플래너를 쓰겠다고 선택
}

interface AuthState extends PersistedAuth {
  pending: boolean; // 로그인 요청 진행 중(휘발)
  error: string | null; // 로그인 실패 메시지(휘발)
}

interface AuthActions {
  /** email/password → PAT. 성공 true. 실패 시 error 세팅 후 false(예외 안 던짐). */
  login(email: string, password: string): Promise<boolean>;
  /** 사용자 로그아웃 — 로컬 플래너로 복귀(dismissed=true라 로그인 화면 재노출 안 함). */
  logout(): void;
  /** "나중에" — 로그인 화면을 닫고 로컬 플래너 사용. */
  dismiss(): void;
  /** 로그인 화면 재노출(연결 재시도 진입점). */
  reconnect(): void;
  /** 401(토큰 만료/무효) — anon 전이 + 재로그인 유도. 아웃박스는 보존(§14.7). */
  expire(): void;
  clearError(): void;
}

function isQueUser(v: unknown): v is QueUser {
  if (typeof v !== 'object' || v === null) return false;
  const u = v as Record<string, unknown>;
  return typeof u.id === 'string' && typeof u.name === 'string' && typeof u.role === 'string';
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      status: 'anon',
      dismissed: false,
      pending: false,
      error: null,

      login: async (email, password) => {
        set({ pending: true, error: null });
        try {
          const { token, user } = await queLogin(email.trim(), password);
          set({ token, user, status: 'authed', dismissed: false, pending: false, error: null });
          useUiStore.getState().showToast(STRINGS.que.toast.connected(user.name));
          return true;
        } catch (e) {
          const message = e instanceof QueApiError ? e.message : STRINGS.que.login.genericError;
          set({ pending: false, error: message });
          return false;
        }
      },

      logout: () => {
        set({ token: null, user: null, status: 'anon', dismissed: true, error: null });
        useUiStore.getState().showToast(STRINGS.que.toast.disconnected);
      },

      dismiss: () => set({ dismissed: true }),
      reconnect: () => set({ status: 'anon', dismissed: false, error: null }),

      expire: () => {
        set({ token: null, user: null, status: 'anon', dismissed: false, error: null });
        useUiStore.getState().showToast(STRINGS.que.toast.sessionExpired);
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'dayblocks:auth',
      storage: createSafeStorage<PersistedAuth>(),
      partialize: (s) => ({ token: s.token, user: s.user, status: s.status, dismissed: s.dismissed }),
      // 매 하이드레이션마다 위생 처리 — status는 token/user 존재로 재도출(불일치 방지).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedAuth>;
        const token = typeof p.token === 'string' && p.token !== '' ? p.token : null;
        const user = isQueUser(p.user) ? p.user : null;
        const status: AuthStatus = token && user ? 'authed' : 'anon';
        return { ...current, token, user, status, dismissed: p.dismissed === true };
      },
    },
  ),
);
