// ────────────────────────────────────────────────────────────
// 기술(Move) DB — 전부 임시 placeholder. 나중에 오리지널 기술로 교체.
//   { id, name, type, category('물리'|'특수'), power, accuracy, pp }
// ────────────────────────────────────────────────────────────

export const MOVES = {
  몸통박치기: { id: '몸통박치기', name: '몸통박치기', type: '노말', category: '물리', power: 40, accuracy: 100, pp: 35 },
  불꽃세례: { id: '불꽃세례', name: '불꽃세례', type: '불꽃', category: '특수', power: 40, accuracy: 100, pp: 25 },
  물대포: { id: '물대포', name: '물대포', type: '물', category: '특수', power: 40, accuracy: 100, pp: 25 },
  덩굴채찍: { id: '덩굴채찍', name: '덩굴채찍', type: '풀', category: '물리', power: 45, accuracy: 100, pp: 25 },
  전기쇼크: { id: '전기쇼크', name: '전기쇼크', type: '전기', category: '특수', power: 40, accuracy: 100, pp: 30 },
  깨물기: { id: '깨물기', name: '깨물기', type: '악', category: '물리', power: 60, accuracy: 100, pp: 25 },
};

export function getMove(id) {
  return MOVES[id];
}
