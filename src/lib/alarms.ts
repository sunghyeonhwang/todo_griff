import { STRINGS } from './strings';
import { formatMinutes, nowMinutes, toDateKey } from './time';
import { useBlocksStore } from '../store/blocksStore';
import { useUiStore } from '../store/uiStore';
import type { TimeBlock } from '../types';

// 알림 스케줄러 — DESIGN.md §7 (앱이 열려 있는 동안만 동작 — UI에 정직하게 표기 §5)
//
// - 블록별 setTimeout 금지(백그라운드 스로틀·슬립 드리프트) — 단일 30초 setInterval 폴링
//   + persist.onFinishHydration 직후·visibilitychange → visible 시 즉시 틱.
// - 상태는 매 틱 getState()로 라이브 조회 — 타이머 북키핑 없음, 데이터 변경 시
//   재스케줄링 자체가 불필요(시간/오프셋 수정은 firedKey가 바뀌어 자동 재무장).
// - 발화 조건: dateKey === 오늘 && alarm !== null && !completed 이고
//   fireAt = startMin - offset에 대해 fireAt ≤ now ≤ fireAt + 10분(늦은 발화 허용창)
//   — 그 이상 지난 건 조용히 드롭(몇 시간 뒤 발화 금지).
// - 중복 방지: firedKey = id|dateKey|fireAtMin을 영속 firedAlarms에 기록(§3.1)
//   — 새로고침에도 재발화 없음. 발화 직전에 마크(중복 틱 경합 차단).
// - 발화 경로: SW 등록 시 reg.showNotification(프로덕션은 vite-plugin-pwa가 보장 — §8),
//   SW 없는 dev는 try/catch로 new Notification 폴백(Chrome for Android는 생성자가
//   TypeError — 조용히 무시). 어느 경로든 인앱 토스트는 항상 병행.
// - 권한: 로드 시 요청 금지 — 에디터의 알림 최초 켜기(사용자 제스처) 안에서만(§5-5).

const ALARM_TICK_MS = 30_000;            // §7 — 단일 30초 폴링(useNow와 동일 주기)
const ALARM_LATE_WINDOW_MIN = 10;        // §7 — 늦은 발화 허용창(분)
const NOTIFICATION_ICON = '/pwa-192.png'; // §7 — Stage 7 아이콘(생성 전엔 브라우저 기본)

/** 발화 dedupe 키(§7) — pruneFiredAlarms가 `|`로 dateKey를 파싱한다(§3.1) */
function firedKey(block: TimeBlock, fireAtMin: number): string {
  return `${block.id}|${block.dateKey}|${fireAtMin}`;
}

/**
 * 알림 권한 요청 — 에디터의 알림 최초 켜기 등 사용자 제스처 안에서만 호출(§5·§7).
 * iOS Safari 비-standalone은 Notification 자체가 없음 → 'unsupported'.
 */
export async function requestNotificationPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

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

/** 1회 발화 — 인앱 토스트 항상 + (권한 시) OS 알림 병행(§7) */
function fire(block: TimeBlock, key: string): void {
  const title = `${block.emoji} ${block.title}`;
  const body = STRINGS.alarm.startsAt(formatMinutes(block.startMin));
  useUiStore.getState().showToast(`${title} — ${body}`);
  void showSystemNotification(title, body, key);
}

/** 폴링 틱 — 매 틱 라이브 getState(), 발화창 검사 + 영속 dedupe(§7) */
function tick(): void {
  const { blocks, firedAlarms, markAlarmFired } = useBlocksStore.getState();
  const todayKey = toDateKey(new Date());
  const now = nowMinutes();
  for (const block of Object.values(blocks)) {
    if (block.dateKey !== todayKey || block.alarm === null || block.completed) continue;
    const fireAt = block.startMin - block.alarm;
    if (now < fireAt || now > fireAt + ALARM_LATE_WINDOW_MIN) continue;
    const key = firedKey(block, fireAt);
    if (firedAlarms[key]) continue;
    markAlarmFired(key); // 발화 직전 마크 — 중복 방지가 발화보다 먼저(§7)
    fire(block, key);
  }
}

let started = false;

/**
 * 스케줄러 시작 — main.tsx에서 1회 배선(§9). hydration 완료를 내부에서 보장:
 * 이미 완료면 즉시, 아니면 onFinishHydration 직후 시작(§7). 멱등(중복 호출 무해).
 */
export function startAlarmScheduler(): void {
  if (started) return;
  started = true;

  const begin = () => {
    useBlocksStore.getState().pruneFiredAlarms(toDateKey(new Date())); // 앱 시작 시 1회(§3.1)
    tick(); // hydration 직후 즉시 틱(§7)
    window.setInterval(tick, ALARM_TICK_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tick(); // 백그라운드 스로틀 보정(§7)
    });
  };

  const { persist } = useBlocksStore;
  if (persist.hasHydrated()) begin();
  else persist.onFinishHydration(begin);
}
