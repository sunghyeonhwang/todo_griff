// Que REST API 단일 통과점 — DESIGN.md §14.2·§14.4·§14.5·§14.8
//
// 이 모듈이 앱에서 fetch를 하는 유일한 곳이다(§14 원칙). blocksStore는 이를 import하지
// 않는다 — 네트워크 부수효과는 여기에만, 블록 변이는 store 8액션에만(§14.6).
// 공통 헤더: Authorization: Bearer <token> + X-Que-Via: mobile(§14.2 화이트리스트 →
// Que ChangeLog via=mobile). 토큰은 authStore.getState().token에서 읽는다(§14.8).
// 시간 표현 경계 변환(절대 ISO ↔ 벽시계 dateKey+분)도 이 경계에서만 오간다(§14.5).

import { useAuthStore } from '../store/authStore';
import { DEFAULT_ICON_ID } from './icons';
import { STRINGS } from './strings';
import { DAY_MINUTES, DEFAULT_DURATION, clamp, fromDateKey, toDateKey } from './time';
import type { NewBlockInput } from '../store/blocksStore';
import type { BlockColor } from '../types';

/** Que API 베이스 — §14.8 상수. (프로덕션 배포 base) */
export const QUE_BASE = 'https://que.griff.co.kr';
/** X-Que-Via 값 — §14.2 화이트리스트(mobile). */
const QUE_VIA = 'mobile';

// ---------- Que 도메인 타입(필요분만 — @que/core taskSchema에서 발췌 §14.2) ----------

export type QueTaskStatus =
  | 'scheduled'
  | 'in_progress'
  | 'done'
  | 'needs_reschedule'
  | 'on_hold'
  | 'issue'
  | 'cancelled'
  | 'merged';

export interface QueUser {
  id: string;
  name: string;
  role: string;
}

/** /api/tasks 응답 항목 — Task + 파생 필드(projectLabel/clientId/clientName §14.2). */
export interface QueTask {
  id: string;
  title: string;
  ownerId: string;
  assigneeId: string;
  projectId?: string;
  startAt?: string; // ISO8601+offset (절대 순간, §14.5)
  endAt?: string;
  status: QueTaskStatus;
  description?: string;
  lastChangedAt?: string; // LWW 비교 기준(§14.7)
  projectLabel?: string; // 파생 — 인박스/블록 부제(§14.2, projectName은 Task에 없음)
  clientId?: string;
  clientName?: string;
  [key: string]: unknown; // taskSchema의 그 외 필드는 무시(전방 호환)
}

// ---------- 에러 ----------

/** Que API 에러. retryable=재시도 가치(오프라인·5xx·429), 그 외(4xx)는 사용자 개입(§14.7). */
export class QueApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly offline: boolean;

  constructor(status: number, message: string, code?: string, offline = false) {
    super(message);
    this.name = 'QueApiError';
    this.status = status;
    this.code = code;
    this.offline = offline;
  }

  get retryable(): boolean {
    return this.offline || this.status === 0 || this.status >= 500 || this.status === 429;
  }
}

// ---------- fetch 래퍼 ----------

interface RequestOptions {
  auth: boolean;
}

async function request<T>(path: string, init: RequestInit | undefined, opts: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { 'X-Que-Via': QUE_VIA };
  if (init?.body != null) headers['Content-Type'] = 'application/json';
  if (opts.auth) {
    const token = useAuthStore.getState().token;
    if (!token) throw new QueApiError(401, STRINGS.que.error.notConnected, 'NO_TOKEN');
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${QUE_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    });
  } catch {
    // 네트워크 도달 실패 = 오프라인(§14.1 로컬 우선 — 실패해도 로컬은 정상 동작)
    throw new QueApiError(0, STRINGS.que.error.offline, undefined, true);
  }

  if (!res.ok) {
    let code: string | undefined;
    let message: string = STRINGS.que.error.generic;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string } };
      if (body?.error) {
        code = body.error.code;
        if (body.error.message) message = body.error.message; // 서버가 준 한국어 메시지 우선(§14.2)
      }
    } catch {
      // 비 JSON 응답 — 일반 메시지 유지
    }
    throw new QueApiError(res.status, message, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------- 엔드포인트(§14.2) ----------

/** 로그인 — 유일한 공개 표면(PAT 불필요). 실패는 QueApiError(401/403/400, 서버 일반 메시지). */
export async function login(email: string, password: string): Promise<{ token: string; user: QueUser }> {
  return request<{ token: string; user: QueUser }>(
    '/api/auth/mobile',
    { method: 'POST', body: JSON.stringify({ email, password }) },
    { auth: false },
  );
}

/** 내 작업 전체 — 인박스 + 모든 날짜의 정본 풀 소스(§14.2, my-day는 무시간 태스크를 뺌). */
export async function getMyTasks(assigneeId: string): Promise<QueTask[]> {
  const data = await request<{ tasks?: QueTask[] }>(
    `/api/tasks?assignee=${encodeURIComponent(assigneeId)}`,
    undefined,
    { auth: true },
  );
  return Array.isArray(data.tasks) ? data.tasks : [];
}

/** 상태 변경 — 완료 토글 라이트백(§14.4). issue/on_hold(사유 필수)는 만들지 않는다. */
export async function setTaskStatus(taskId: string, to: QueTaskStatus): Promise<QueTask> {
  const data = await request<{ task: QueTask }>(
    `/api/tasks/${encodeURIComponent(taskId)}/status`,
    { method: 'POST', body: JSON.stringify({ to }) },
    { auth: true },
  );
  return data.task;
}

/** 일정 이동 — 재일정 라이트백(§14.4). startAt/endAt은 offset 포함 ISO(§14.5). */
export async function moveTask(taskId: string, startAt: string, endAt: string): Promise<QueTask> {
  const data = await request<{ task: QueTask }>(
    `/api/tasks/${encodeURIComponent(taskId)}/move`,
    { method: 'POST', body: JSON.stringify({ startAt, endAt }) },
    { auth: true },
  );
  return data.task;
}

// ---------- 순수 매핑(§14.4·§14.5) — 시간 표현 경계 변환은 여기서만 ----------

/** status → 블록 색(옵션 시각 매핑 §14.4). amber는 팔레트에 없어 orange(주의/대기)로 매핑. */
export function statusToColor(status: QueTaskStatus): BlockColor {
  switch (status) {
    case 'issue':
      return 'red';
    case 'on_hold':
      return 'orange';
    case 'done':
      return 'green';
    default:
      return 'blue';
  }
}

/** ISO(절대 순간) → 기기 로컬 벽시계(dateKey + 자정 기준 분). 네이티브 게터만(§14.5·§4.1). */
function wallClock(iso: string): { dateKey: string; min: number } {
  const d = new Date(iso);
  return { dateKey: toDateKey(d), min: d.getHours() * 60 + d.getMinutes() };
}

/** (dateKey, 분) → offset 포함 ISO. 로컬 벽시계를 절대 순간으로 직렬화(§14.5). */
function minutesToIso(dateKey: string, min: number): string {
  const d = fromDateKey(dateKey); // 로컬 자정
  d.setHours(0, 0, 0, 0);
  d.setMinutes(min); // 자정 + 분 (1440 → 다음 날 00:00, JS 정규화)
  return d.toISOString(); // Z(=+00:00) — 절대 순간
}

export interface QueTaskMapping {
  input: NewBlockInput; // addBlock(생성) 경로
  completed: boolean; // done → true. addBlock은 completed를 못 받으므로 생성 후 updateBlock으로 반영
  lastChangedAt?: string; // LWW 비교(§14.7)
}

/** 시간 있는 Que Task → 연동 블록 매핑. startAt 없으면 null(=인박스). §14.4·§14.5 */
export function mapTimedTask(task: QueTask): QueTaskMapping | null {
  if (!task.startAt) return null;
  const start = wallClock(task.startAt);
  const startMin = clamp(start.min, 0, DAY_MINUTES - 1);

  let endMin: number;
  if (task.endAt) {
    const end = wallClock(task.endAt);
    // 다일 태스크 → 시작일에만 렌더 + endMin 1440 클램프(§14.5)
    endMin = end.dateKey === start.dateKey ? end.min : DAY_MINUTES;
    if (endMin <= startMin) endMin = Math.min(startMin + DEFAULT_DURATION, DAY_MINUTES);
  } else {
    endMin = Math.min(startMin + DEFAULT_DURATION, DAY_MINUTES);
  }

  return {
    input: {
      dateKey: start.dateKey,
      startMin,
      endMin,
      title: task.title,
      note: typeof task.description === 'string' ? task.description : '',
      color: statusToColor(task.status),
      icon: DEFAULT_ICON_ID,
      queTaskId: task.id,
      syncState: 'synced',
    },
    completed: task.status === 'done',
    lastChangedAt: task.lastChangedAt,
  };
}

/** 인박스(무시간) Task를 활성 날짜/시각에 배치할 연동 블록 입력. §14.6 */
export function inboxTaskToBlockInput(task: QueTask, dateKey: string, startMin: number): NewBlockInput {
  return {
    dateKey,
    startMin,
    endMin: Math.min(startMin + DEFAULT_DURATION, DAY_MINUTES),
    title: task.title,
    note: typeof task.description === 'string' ? task.description : '',
    color: statusToColor(task.status),
    icon: DEFAULT_ICON_ID,
    queTaskId: task.id,
    syncState: 'pending', // 최초 일정 부여 → move 라이트백 대기(§14.6)
  };
}

/** 연동 블록(dateKey + 분) → Que move 입력(offset 포함 ISO). §14.5 */
export function blockToScheduleRange(
  dateKey: string,
  startMin: number,
  endMin: number,
): { startAt: string; endAt: string } {
  return { startAt: minutesToIso(dateKey, startMin), endAt: minutesToIso(dateKey, endMin) };
}
