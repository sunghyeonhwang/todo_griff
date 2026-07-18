import { useUiStore } from '../store/uiStore';

// 알림 발화 어댑터 — DESIGN.md §7
//
// 현재의 발화 경로(SW showNotification + 인앱 토스트 병행)를 notify() 하나로 추상화한다.
// 스케줄러(lib/alarms.ts)가 유일한 소비자이며, 발화 방식을 알 필요가 없다.
//
// ⚠ 향후 네이티브 앱(Capacitor 로컬 알림) 전환 시 이 파일 1곳만 교체한다.
//   (2026-07-18 사용자 확정: 네이티브 앱은 추후 트랙으로 Capacitor 우선 검토, 데이터는 Que
//    Supabase 공유, PWA 푸시 서버는 하지 않는다 → 알림은 앱이 열려 있는 동안에만 동작 §7.)
//   교체 지점: notify() 내부의 showSystemNotification 경로를 네이티브 로컬 알림 스케줄로 바꾸면
//   되고, alarms.ts·컴포넌트는 무변경이다.

const NOTIFICATION_ICON = '/pwa-192.png'; // §7 — PWA 아이콘(생성 전엔 브라우저 기본)

/** OS 알림 — 규범 경로 SW showNotification, dev 폴백 new Notification(§7). 실패는 조용히. */
async function showSystemNotification(title: string, body: string, tag: string): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.active) {
        await reg.showNotification(title, { body, tag, icon: NOTIFICATION_ICON });
        return;
      }
    }
  } catch {
    // SW 경로 실패 — 아래 생성자 폴백 시도
  }
  try {
    new Notification(title, { body, tag, icon: NOTIFICATION_ICON });
  } catch {
    // Chrome for Android: 생성자 TypeError(§7) — 인앱 토스트가 이미 병행됨
  }
}

/**
 * 1회 발화 — 인앱 토스트 항상 + (권한 시) OS 알림 병행(§7).
 * @param tag 발화 dedupe/치환 태그(= firedKey). 같은 tag의 OS 알림은 덮어써진다.
 */
export function notify(title: string, body: string, tag: string): void {
  useUiStore.getState().showToast(`${title} — ${body}`);
  void showSystemNotification(title, body, tag);
}
