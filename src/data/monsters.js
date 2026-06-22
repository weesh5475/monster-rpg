// ────────────────────────────────────────────────────────────
// 몬스터 인스턴스 생성.
//   createMonster(종족id, 레벨) → 실제 능력치가 계산된 배틀용 몬스터 객체.
// 공식(3단계 기준):
//   최대HP = floor(기초hp * 2 * 레벨 / 100) + 레벨 + 10
//   그 외  = floor(기초스탯 * 2 * 레벨 / 100) + 5
// ────────────────────────────────────────────────────────────
import { getSpecies } from './species.js';
import { getMove } from './moves.js';

// 일반 능력치(atk/def/spAtk/spDef/speed) 계산 — 레벨업/진화 재계산에서도 재사용
export function calcStat(base, level) {
  return Math.floor((base * 2 * level) / 100) + 5;
}

// 최대 HP 계산
export function calcMaxHp(base, level) {
  return Math.floor((base * 2 * level) / 100) + level + 10;
}

export function createMonster(speciesId, level) {
  const species = getSpecies(speciesId);
  if (!species) {
    throw new Error(`알 수 없는 종족 id: ${speciesId}`);
  }
  const bs = species.baseStats;
  const maxHp = calcMaxHp(bs.hp, level);

  // 배울 기술 중 앞 4개를 보유 기술로. 각 기술은 현재PP=최대PP 로 인스턴스화.
  const moves = species.learnset.slice(0, 4).map((moveId) => {
    const m = getMove(moveId);
    return {
      id: m.id,
      name: m.name,
      type: m.type,
      category: m.category,
      power: m.power,
      accuracy: m.accuracy,
      maxPp: m.pp,
      pp: m.pp,
    };
  });

  return {
    speciesId: species.id,
    name: species.name,
    types: [...species.types],
    level,
    exp: level ** 3, // 누적 경험치 (레벨 L 도달 = L^3)
    color: species.color,
    catchRate: species.catchRate, // 포획 판정용
    maxHp,
    hp: maxHp,
    atk: calcStat(bs.atk, level),
    def: calcStat(bs.def, level),
    spAtk: calcStat(bs.spAtk, level),
    spDef: calcStat(bs.spDef, level),
    speed: calcStat(bs.speed, level),
    moves,
  };
}
