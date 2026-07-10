// 데이터 모델 — DESIGN.md §2

/** design_token/tokens.ts의 BLOCK_COLORS 키와 1:1 */
export type BlockColor =
  | 'blue' | 'green' | 'orange' | 'red'
  | 'purple' | 'pink' | 'teal' | 'gray';

/** 시작 전 알림 오프셋(분). 0 = 시작 시각에 알림 */
export type AlarmOffset = 0 | 5 | 10 | 15 | 30 | 60;

/** Que 연동 블록의 라이트백 상태 — DESIGN.md §14.3 */
export type QueSyncState = 'synced' | 'pending' | 'error';

export interface TimeBlock {
  id: string;              // crypto.randomUUID() — 서버 동기화에도 안전한 전역 유일 키
  dateKey: string;         // 'yyyy-MM-dd' (로컬 날짜, 타임존 비의존)
  startMin: number;        // 0..1425, 5분 배수 (스토어 액션이 강제)
  endMin: number;          // startMin+15 .. 1440, 5분 배수
  title: string;           // 저장 시 빈 값/공백이면 '새 일정'으로 대체 (저장 비활성화 없음)
  icon: string;            // 큐레이션 아이콘 8개 중 1개(id, lib/icons.ts), 기본 'star'
  color: BlockColor;       // 기본 'blue'
  alarm: AlarmOffset | null; // null = 알림 없음 (끄면 오프셋은 에디터 로컬에만 세션 유지)
  note: string;
  project: string;         // 로컬 프로젝트 태그(선택, 기본 ''). Que 연동 블록은 projectLabel로 프리필(§14.4)
  completed: boolean;
  createdAt: number;       // epoch ms (감사용 절대 시각)
  updatedAt: number;       // 커밋된 변경마다 갱신 — 향후 서버 LWW 충돌 해결 기준(§13)
  // Que 연동(§14.3) — 두 필드가 없으면 로컬 전용 블록. sanitizeBlocks가 미지 필드를 보존해
  // 하위호환 안전(§13.2). ⚠ TimeBlock.id에 Que id를 넣지 않는다 — 링크는 비파괴 참조.
  queTaskId?: string;      // 링크한 Que Task.id (원격 참조)
  syncState?: QueSyncState;// 라이트백 상태. 로컬 전용 블록은 undefined.
}

export type EditorState =
  | { mode: 'closed' }
  | { mode: 'create'; draft: { dateKey: string; startMin: number; endMin: number } }
  | { mode: 'edit'; blockId: string };

/** 하단 탭(§6.5) — 오늘(타임라인) | 목표(OKR §15). */
export type AppTab = 'today' | 'okr';

// ---------- OKR — DESIGN.md §15 (앱 로컬 전용, Que 무관) ----------

/** 분기 목표(Objective). quarter='YYYY-Qn'(lib/time quarterKey). */
export interface Objective {
  id: string;        // crypto.randomUUID()
  quarter: string;   // 소속 분기 키 (예: '2026-Q3')
  title: string;     // 빈 값이면 스토어가 '새 목표'로 대체
  createdAt: number; // epoch ms
  updatedAt: number;
}

/** 핵심 결과(Key Result) — 목표를 측정하는 숫자. 진행률 = clamp(current/target, 0..1). */
export interface KeyResult {
  id: string;
  objectiveId: string; // 소속 Objective (삭제 시 연쇄 삭제)
  title: string;       // 빈 값이면 '새 핵심 결과'
  target: number;      // 목표 수치 (> 0)
  current: number;     // 현재 수치 (0 이상, target 초과 허용 — 표시는 100%로 클램프)
  unit: string;        // 단위 라벨 (예: '건', '%', '시간' — 빈 값 허용)
  createdAt: number;
  updatedAt: number;
}
