// 데이터 모델 — DESIGN.md §2

/** design_token/tokens.ts의 BLOCK_COLORS 키와 1:1 */
export type BlockColor =
  | 'blue' | 'green' | 'orange' | 'red'
  | 'purple' | 'pink' | 'teal' | 'gray';

/** 시작 전 알림 오프셋(분). 0 = 시작 시각에 알림 */
export type AlarmOffset = 0 | 5 | 10 | 15 | 30 | 60;

export interface TimeBlock {
  id: string;              // crypto.randomUUID() — 서버 동기화에도 안전한 전역 유일 키
  dateKey: string;         // 'yyyy-MM-dd' (로컬 날짜, 타임존 비의존)
  startMin: number;        // 0..1425, 5분 배수 (스토어 액션이 강제)
  endMin: number;          // startMin+15 .. 1440, 5분 배수
  title: string;           // 저장 시 빈 값/공백이면 '새 일정'으로 대체 (저장 비활성화 없음)
  emoji: string;           // 큐레이션 목록 중 1개, 기본 '📌'
  color: BlockColor;       // 기본 'blue'
  alarm: AlarmOffset | null; // null = 알림 없음 (끄면 오프셋은 에디터 로컬에만 세션 유지)
  note: string;
  completed: boolean;
  createdAt: number;       // epoch ms (감사용 절대 시각)
  updatedAt: number;       // 커밋된 변경마다 갱신 — 향후 서버 LWW 충돌 해결 기준(§13)
}

export type EditorState =
  | { mode: 'closed' }
  | { mode: 'create'; draft: { dateKey: string; startMin: number; endMin: number } }
  | { mode: 'edit'; blockId: string };
