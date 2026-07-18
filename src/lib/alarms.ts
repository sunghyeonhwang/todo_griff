import { notify } from './notify';
import { STRINGS } from './strings';
import { formatMinutes, nowMinutes, toDateKey } from './time';
import { useBlocksStore } from '../store/blocksStore';
import type { TimeBlock } from '../types';

// 알림 스케줄러 — DESIGN.md §7 (앱이 열려 있는 동안만 동작 — UI에 정직하게 표기 §5)
//
// - 블록별 setTimeout 금지(백그라운드 스로틀·슬립 드리프트) — 단일 30초 setInterval 폴링
//   + persist.onFinishHydration 직후·visibilitychange → visible 시 즉시 틱.
// - 상태는 매 틱 getState()로 라이브 조회 — 타이머 북키핑 없음, 데이터 변경 시
//   재스케줄링 자체가 불필요(시간/오프셋 수정은 firedKey가 바뀌어 자동 재무장).
// - 발화 종류 2가지(§7 개정):
//   ⑴ 시작 전 알림: alarm !== null 이고 fireAt = startMin - offset.
//   ⑵ 종료 알림: endAlarm === true 이고 fireAt = endMin(옵트인 — 에디터 '종료 알림' 토글).
//   공통 조건: dateKey === 오늘 && !completed, fireAt ≤ now ≤ fireAt + 10분(늦은 발화 허용창)
//   — 그 이상 지난 건 조용히 드롭(몇 시간 뒤 발화 금지).
// - 중복 방지: 영속 firedAlarms에 firedKey 기록(§3.1) — 새로고침에도 재발화 없음. 발화 직전 마크.
//   시작 키 = id|dateKey|fireAtMin, 종료 키 = id|dateKey|end|fireAtMin(구분자 'end' 삽입으로 충돌 금지).
//   두 키 모두 split('|')[1] === dateKey라 pruneFiredAlarms(§3.1)가 그대로 파싱한다.
// - 발화 경로: lib/notify.ts 어댑터(SW showNotification + 인앱 토스트 병행). 네이티브 전환 시 그 1곳만 교체.
// - 권한: 로드 시 요청 금지 — 에디터의 알림 최초 켜기(사용자 제스처) 안에서만(§5-5).

const ALARM_TICK_MS = 30_000;     // §7 — 단일 30초 폴링(useNow와 동일 주기)
const ALARM_LATE_WINDOW_MIN = 10; // §7 — 늦은 발화 허용창(분)

/** 시작 전 알림 dedupe 키(§7) — pruneFiredAlarms가 `|`로 dateKey를 파싱한다(§3.1) */
function startFiredKey(block: TimeBlock, fireAtMin: number): string {
  return `${block.id}|${block.dateKey}|${fireAtMin}`;
}

/** 종료 알림 dedupe 키(§7 개정) — 'end' 구분자로 시작 키와 충돌 금지. [1]은 여전히 dateKey. */
function endFiredKey(block: TimeBlock, fireAtMin: number): string {
  return `${block.id}|${block.dateKey}|end|${fireAtMin}`;
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

/** fireAt이 발화창 안이고 아직 미발화면 마크 후 notify. 창 밖·중복이면 no-op(§7). */
function maybeFire(
  key: string,
  fireAt: number,
  now: number,
  firedAlarms: Record<string, true>,
  markAlarmFired: (key: string) => void,
  title: string,
  body: string,
): void {
  if (now < fireAt || now > fireAt + ALARM_LATE_WINDOW_MIN) return;
  if (firedAlarms[key]) return;
  markAlarmFired(key); // 발화 직전 마크 — 중복 방지가 발화보다 먼저(§7)
  notify(title, body, key);
}

/** 폴링 틱 — 매 틱 라이브 getState(), 시작·종료 발화창 검사 + 영속 dedupe(§7) */
function tick(): void {
  const { blocks, firedAlarms, markAlarmFired } = useBlocksStore.getState();
  const todayKey = toDateKey(new Date());
  const now = nowMinutes();
  for (const block of Object.values(blocks)) {
    if (block.dateKey !== todayKey || block.completed) continue;
    // 제목만 사용 — 블록 아이콘은 SVG라 알림 문자열에 못 넣는다(OS 알림 아이콘은 앱 아이콘 유지).
    // ⑴ 시작 전 알림
    if (block.alarm !== null) {
      const fireAt = block.startMin - block.alarm;
      maybeFire(
        startFiredKey(block, fireAt), fireAt, now, firedAlarms, markAlarmFired,
        block.title, STRINGS.alarm.startsAt(formatMinutes(block.startMin)),
      );
    }
    // ⑵ 종료 알림(옵트인)
    if (block.endAlarm) {
      const fireAt = block.endMin;
      maybeFire(
        endFiredKey(block, fireAt), fireAt, now, firedAlarms, markAlarmFired,
        block.title, STRINGS.alarm.endsAt(formatMinutes(block.endMin)),
      );
    }
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
