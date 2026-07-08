import { STRINGS } from '../lib/strings';
import { useAuthStore } from '../store/authStore';
import { useQueSyncStore } from '../store/queSync';

// Que 할 일 인박스 — DESIGN.md §14.0·§14.6
// - 상단 무시간 태스크 목록(가로 스크롤 칩). 칩 탭 = 활성 날짜/다음 정시에 배치 → 연동 블록 생성.
// - authed면 동기화 상태 칩 + 새로고침 + 연결 해제. 미연결(anon+dismissed)이면 "Que 계정 연결" 바만.
// - 헤더 밖 shrink-0 형제(App에서 DateHeader와 Timeline 사이). 카피는 STRINGS.que(규칙5).

function SyncChip({ syncing, pending }: { syncing: boolean; pending: number }) {
  const label = syncing ? STRINGS.que.sync.syncing : pending > 0 ? STRINGS.que.sync.pending(pending) : STRINGS.que.sync.synced;
  const tone = syncing || pending > 0 ? 'text-accent-warning' : 'text-text-tertiary';
  return <span className={`shrink-0 text-xs tabular-nums ${tone}`}>{label}</span>;
}

export default function QueInbox() {
  const status = useAuthStore((s) => s.status);
  const inbox = useQueSyncStore((s) => s.inbox);
  const syncing = useQueSyncStore((s) => s.syncing);
  const outbox = useQueSyncStore((s) => s.outbox);

  // 미연결 — 로컬 플래너로 계속 쓰되 재연결 진입점만 얇게 노출.
  if (status !== 'authed') {
    return (
      <section className="shrink-0 border-b border-surface-timeline-line bg-surface-card px-3 py-2">
        <button
          type="button"
          onClick={() => useAuthStore.getState().reconnect()}
          className="h-9 rounded-full px-3 text-sm font-medium text-accent-primary active:bg-surface-background"
        >
          {STRINGS.que.inbox.connect}
        </button>
      </section>
    );
  }

  const pending = Object.keys(outbox).length;

  return (
    <section className="shrink-0 border-b border-surface-timeline-line bg-surface-card">
      <div className="flex items-center gap-2 px-3 pt-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
          {STRINGS.que.inbox.count(inbox.length)}
        </span>
        <SyncChip syncing={syncing} pending={pending} />
        <button
          type="button"
          onClick={() => useQueSyncStore.getState().refresh()}
          className="h-9 rounded-full px-2 text-xs font-medium text-text-secondary active:bg-surface-background"
        >
          {STRINGS.que.inbox.refresh}
        </button>
        <button
          type="button"
          onClick={() => useAuthStore.getState().logout()}
          className="h-9 rounded-full px-2 text-xs font-medium text-text-secondary active:bg-surface-background"
        >
          {STRINGS.que.inbox.logout}
        </button>
      </div>

      {inbox.length === 0 ? (
        <p className="px-3 pt-1 pb-2 text-xs text-text-tertiary">{STRINGS.que.inbox.empty}</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto px-3 pt-2 pb-2">
          {inbox.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => useQueSyncStore.getState().placeInboxTask(task.id)}
              aria-label={`${task.title} — ${STRINGS.que.inbox.place}`}
              className="flex min-h-11 w-40 shrink-0 flex-col justify-center rounded-md border border-surface-timeline-line bg-surface-background px-3 py-2 text-left active:opacity-80"
            >
              <span className="truncate text-sm font-medium text-text-primary">{task.title}</span>
              <span className="truncate text-xs text-text-tertiary">
                {task.projectLabel ?? STRINGS.que.inbox.noProject}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
