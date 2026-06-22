// ────────────────────────────────────────────────────────────
// 종족(Species) DB — 전부 임시 placeholder. 나중에 내 오리지널 몬스터로 교체.
//   { id, name, types:[1~2], baseStats:{hp,atk,def,spAtk,spDef,speed},
//     learnset:[기술id...], color(색네모용) }
// ────────────────────────────────────────────────────────────

export const SPECIES = {
  불꽃몬: {
    id: '불꽃몬',
    name: '불꽃몬',
    types: ['불꽃'],
    baseStats: { hp: 45, atk: 55, def: 45, spAtk: 60, spDef: 50, speed: 55 },
    learnset: ['몸통박치기', '불꽃세례', '깨물기'],
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
    learnset: ['몸통박치기', '물대포'],
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
    learnset: ['몸통박치기', '덩굴채찍'],
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
    learnset: ['몸통박치기', '깨물기'],
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
    learnset: ['몸통박치기', '불꽃세례', '깨물기'],
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
    learnset: ['몸통박치기', '물대포'],
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
    learnset: ['몸통박치기', '덩굴채찍'],
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
