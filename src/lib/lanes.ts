// 겹침 레이아웃 — DESIGN.md §4.6 (순수 함수, 스토어·DOM 비의존 — 테스트 가능)
//
// - startMin 오름차순, 동률 시 긴 블록 우선(endMin 내림차순, 최종 동률은 id) 정렬
//   → 클러스터(전이적 겹침 구간) 분할 → 클러스터 내 그리디 최소 lane 배정.
// - 클러스터 내 모든 블록이 laneCount를 공유(균등 폭 분모).
// - 경계가 맞닿은 것(end === start)은 겹침 아님 — 새 클러스터/lane 재사용.
// - excludeId: 이동 드래그 중인 블록은 계산에서 제외(결과에 없음) — 카드가 풀폭
//   90% 불투명도로 위에 렌더(§4.6). 드래그 중 이웃 리플로 방지, 드롭 시 1회 재계산.
// - 호출자는 useMemo로 파생(§4.6) — 하루 ≤50개, O(n log n) ≈ 0.01ms. 입력 불변.

/** 계산에 필요한 최소 구조 — TimeBlock이 구조적으로 만족 */
export interface LaneBlock {
  id: string;
  startMin: number;
  endMin: number;
}

export interface LanePlacement {
  lane: number;      // 0-based, 좌→우
  laneCount: number; // 클러스터 공유 lane 수(균등 폭 분모)
}

/** 블록 id → lane 배치. excludeId로 제외된 블록은 결과에 없다. */
export function computeLanes(
  blocks: readonly LaneBlock[],
  excludeId?: string | null,
): Record<string, LanePlacement> {
  const sorted = blocks
    .filter((b) => b.id !== excludeId)
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin || a.id.localeCompare(b.id));

  const result: Record<string, LanePlacement> = {};

  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = []; // lane별 마지막 블록의 endMin
  let clusterEnd = 0;          // 클러스터 내 최대 endMin — 전이적 겹침 경계

  const flush = () => {
    for (const member of cluster) {
      result[member.id] = { lane: member.lane, laneCount: laneEnds.length };
    }
    cluster = [];
    laneEnds = [];
  };

  for (const b of sorted) {
    // 시작이 클러스터 최대 끝 이상(맞닿음 포함)이면 겹침 사슬 종료 → 새 클러스터
    if (cluster.length > 0 && b.startMin >= clusterEnd) flush();
    // 그리디 최소 lane: 이미 끝난(맞닿음 포함) 가장 왼쪽 lane 재사용, 없으면 신설
    let lane = laneEnds.findIndex((end) => end <= b.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.endMin);
    } else {
      laneEnds[lane] = b.endMin;
    }
    cluster.push({ id: b.id, lane });
    clusterEnd = Math.max(clusterEnd, b.endMin);
  }
  flush();

  return result;
}
