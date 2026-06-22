// ────────────────────────────────────────────────────────────
// 종족(Species) DB — 전부 임시 placeholder. 나중에 내 오리지널 몬스터로 교체.
//   { id, name, types:[1~2], baseStats:{hp,atk,def,spAtk,spDef,speed},
//     learnset:[{level, moveId}...] (레벨 도달 시 습득), color(색네모용) }
//   ※ learnset 은 레벨 오름차순. createMonster 는 "현재 레벨 이하" 중 앞 4개를 보유.
// ────────────────────────────────────────────────────────────

export const SPECIES = {
  불꽃몬: {
    id: '불꽃몬',
    name: '불꽃몬',
    types: ['불꽃'],
    baseStats: { hp: 45, atk: 55, def: 45, spAtk: 60, spDef: 50, speed: 55 },
    // 불꽃/노말 위주. Lv5 시작이면 할퀴기·불꽃세례·노려보기 보유 →
    //  Lv6 칼춤(자속 공격↑ 테스트), Lv7 불꽃엄니(4개→교체 흐름).
    learnset: [
      { level: 1, moveId: '할퀴기' },
      { level: 1, moveId: '불꽃세례' },
      { level: 4, moveId: '노려보기' },
      { level: 6, moveId: '칼춤' },
      { level: 7, moveId: '불꽃엄니' },
    ],
    color: 0xff7043, // 주황
    catchRate: 0.7, // 포획률(0~1, 클수록 잘 잡힘)
    baseExp: 50, // 처치 시 경험치 계산 기준
    evolvesTo: '불꽃룡', // 진화형 종족 id (없으면 null)
    evolveLevel: 8, // 진화 레벨 (테스트용 placeholder)
  },
  물몬: {
    id: '물몬',
    name: '물몬',
    types: ['물'],
    baseStats: { hp: 50, atk: 50, def: 55, spAtk: 55, spDef: 55, speed: 40 },
    // 물/노말 위주 + 전기자석파(마비 유틸, 테스트용). Lv5면 4개 보유 → Lv7 물의파동(교체 흐름).
    learnset: [
      { level: 1, moveId: '몸통박치기' },
      { level: 1, moveId: '물대포' },
      { level: 3, moveId: '전기자석파' },
      { level: 5, moveId: '단단해지기' },
      { level: 7, moveId: '물의파동' },
    ],
    color: 0x42a5f5, // 파랑
    catchRate: 0.8,
    baseExp: 50,
    evolvesTo: '물룡',
    evolveLevel: 8,
  },
  풀몬: {
    id: '풀몬',
    name: '풀몬',
    types: ['풀'],
    baseStats: { hp: 55, atk: 50, def: 55, spAtk: 55, spDef: 55, speed: 40 },
    // 풀/노말 위주. Lv5면 몸통박치기·덩굴채찍·잎날가르기 보유 → Lv7 울음소리(상대 공격↓).
    learnset: [
      { level: 1, moveId: '몸통박치기' },
      { level: 1, moveId: '덩굴채찍' },
      { level: 4, moveId: '잎날가르기' },
      { level: 7, moveId: '울음소리' },
    ],
    color: 0x66bb6a, // 초록
    catchRate: 0.8,
    baseExp: 50,
    evolvesTo: '풀룡',
    evolveLevel: 8,
  },

  // ── 동굴 종족 (15단계, placeholder) ──
  돌몬: {
    id: '돌몬',
    name: '돌몬',
    types: ['바위'],
    baseStats: { hp: 50, atk: 60, def: 70, spAtk: 30, spDef: 45, speed: 35 },
    // 바위/노말 위주.
    learnset: [
      { level: 1, moveId: '몸통박치기' },
      { level: 1, moveId: '바위던지기' },
      { level: 6, moveId: '단단해지기' },
      { level: 9, moveId: '막치기' },
    ],
    color: 0x9e8b6f, // 흙빛 회갈색
    catchRate: 0.7,
    baseExp: 50,
    evolvesTo: null,
    evolveLevel: null,
  },

  // ── 진화형 (placeholder) ──
  불꽃룡: {
    id: '불꽃룡',
    name: '불꽃룡',
    types: ['불꽃'],
    baseStats: { hp: 65, atk: 80, def: 65, spAtk: 85, spDef: 70, speed: 80 },
    learnset: [
      { level: 1, moveId: '할퀴기' },
      { level: 1, moveId: '불꽃세례' },
      { level: 4, moveId: '노려보기' },
      { level: 6, moveId: '칼춤' },
      { level: 7, moveId: '불꽃엄니' },
      { level: 12, moveId: '막치기' },
      { level: 16, moveId: '깨물기' },
    ],
    color: 0xe64a19, // 진한 주황
    catchRate: 0.45,
    baseExp: 110,
    evolvesTo: null,
    evolveLevel: null,
  },
  물룡: {
    id: '물룡',
    name: '물룡',
    types: ['물'],
    baseStats: { hp: 75, atk: 70, def: 80, spAtk: 75, spDef: 80, speed: 55 },
    learnset: [
      { level: 1, moveId: '몸통박치기' },
      { level: 1, moveId: '물대포' },
      { level: 3, moveId: '전기자석파' },
      { level: 5, moveId: '단단해지기' },
      { level: 7, moveId: '물의파동' },
      { level: 12, moveId: '막치기' },
      { level: 16, moveId: '깨물기' },
    ],
    color: 0x1976d2, // 진한 파랑
    catchRate: 0.5,
    baseExp: 110,
    evolvesTo: null,
    evolveLevel: null,
  },
  풀룡: {
    id: '풀룡',
    name: '풀룡',
    types: ['풀'],
    baseStats: { hp: 80, atk: 75, def: 80, spAtk: 80, spDef: 80, speed: 55 },
    learnset: [
      { level: 1, moveId: '몸통박치기' },
      { level: 1, moveId: '덩굴채찍' },
      { level: 4, moveId: '잎날가르기' },
      { level: 7, moveId: '울음소리' },
      { level: 12, moveId: '막치기' },
      { level: 16, moveId: '깨물기' },
    ],
    color: 0x388e3c, // 진한 초록
    catchRate: 0.5,
    baseExp: 110,
    evolvesTo: null,
    evolveLevel: null,
  },
};

export function getSpecies(id) {
  return SPECIES[id];
}
