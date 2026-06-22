// ────────────────────────────────────────────────────────────
// 기술(Move) DB — 전부 임시 placeholder. 나중에 오리지널 기술로 교체.
//   { id, name, type, category('물리'|'특수'|'변화'), power, accuracy, pp, effect? }
//   accuracy: 숫자(명중 굴림) | null('-' = 항상 적중, 보통 자신 대상 변화기)
//   effect: 부가/주효과
//     { status:'par', target:'enemy' }                 // 상태이상(마비)
//     { stat:'atk'|'def', delta:±N, target:'self'|'enemy' } // 랭크 변화
//   ※ power 0 또는 category '변화' = 데미지 없는 효과기로 취급.
// ────────────────────────────────────────────────────────────

export const MOVES = {
  // ── 기존(6) ──
  몸통박치기: { id: '몸통박치기', name: '몸통박치기', type: '노말', category: '물리', power: 40, accuracy: 100, pp: 35 },
  불꽃세례: { id: '불꽃세례', name: '불꽃세례', type: '불꽃', category: '특수', power: 40, accuracy: 100, pp: 25 },
  물대포: { id: '물대포', name: '물대포', type: '물', category: '특수', power: 40, accuracy: 100, pp: 25 },
  덩굴채찍: { id: '덩굴채찍', name: '덩굴채찍', type: '풀', category: '물리', power: 45, accuracy: 100, pp: 25 },
  전기쇼크: { id: '전기쇼크', name: '전기쇼크', type: '전기', category: '특수', power: 40, accuracy: 100, pp: 30 },
  깨물기: { id: '깨물기', name: '깨물기', type: '악', category: '물리', power: 60, accuracy: 100, pp: 25 },

  // ── 추가 공격기(22단계) ──
  할퀴기: { id: '할퀴기', name: '할퀴기', type: '노말', category: '물리', power: 40, accuracy: 100, pp: 35 },
  막치기: { id: '막치기', name: '막치기', type: '노말', category: '물리', power: 60, accuracy: 100, pp: 20 },
  불꽃엄니: { id: '불꽃엄니', name: '불꽃엄니', type: '불꽃', category: '물리', power: 65, accuracy: 95, pp: 15 },
  물의파동: { id: '물의파동', name: '물의파동', type: '물', category: '특수', power: 60, accuracy: 100, pp: 20 },
  잎날가르기: { id: '잎날가르기', name: '잎날가르기', type: '풀', category: '물리', power: 55, accuracy: 95, pp: 25 },
  바위던지기: { id: '바위던지기', name: '바위던지기', type: '바위', category: '물리', power: 50, accuracy: 90, pp: 15 },
  그림자손톱: { id: '그림자손톱', name: '그림자손톱', type: '고스트', category: '물리', power: 70, accuracy: 100, pp: 15 },

  // ── 상태이상 / 랭크변화(22단계) ──
  전기자석파: {
    id: '전기자석파', name: '전기자석파', type: '전기', category: '특수', power: 0, accuracy: 100, pp: 20,
    effect: { status: 'par', target: 'enemy' },
  },
  노려보기: {
    id: '노려보기', name: '노려보기', type: '노말', category: '변화', power: 0, accuracy: 100, pp: 30,
    effect: { stat: 'def', delta: -1, target: 'enemy' },
  },
  울음소리: {
    id: '울음소리', name: '울음소리', type: '노말', category: '변화', power: 0, accuracy: 100, pp: 40,
    effect: { stat: 'atk', delta: -1, target: 'enemy' },
  },
  칼춤: {
    id: '칼춤', name: '칼춤', type: '노말', category: '변화', power: 0, accuracy: null, pp: 20,
    effect: { stat: 'atk', delta: 2, target: 'self' },
  },
  단단해지기: {
    id: '단단해지기', name: '단단해지기', type: '노말', category: '변화', power: 0, accuracy: null, pp: 30,
    effect: { stat: 'def', delta: 1, target: 'self' },
  },
};

export function getMove(id) {
  return MOVES[id];
}
