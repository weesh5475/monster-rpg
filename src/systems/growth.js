// ────────────────────────────────────────────────────────────
// 성장 시스템 (6단계): 경험치 → 레벨업 → (기술 습득) → 진화.
//   expForLevel(L) = L^3 (레벨 L 도달에 필요한 누적 경험치)
//   gainExp(mon, amount) → 발생한 이벤트 배열 반환
//     이벤트: {type:'exp', amount} | {type:'levelup', level}
//           | {type:'learn', moveName}                  (기술 4개 미만 → 자동 습득, 이미 적용됨)
//           | {type:'learn-choice', moveId, moveName}   (4개 꽉 참 → 호출부가 교체 결정)
//           | {type:'evolve', from, to}
//   ※ 기술 습득은 해당 레벨업 직후, 진화보다 먼저 처리된다.
// 메시지/연출은 호출부(BattleScene)가 이벤트를 보고 처리한다.
// ────────────────────────────────────────────────────────────
import { getSpecies } from '../data/species.js';
import { calcStat, calcMaxHp, instantiateMove } from '../data/monsters.js';
import { getMove } from '../data/moves.js';

export function expForLevel(level) {
  return level ** 3;
}

// 현재 종족·레벨 기준으로 능력치 재계산. maxHP 증가분만큼 현재HP도 올림.
export function recalcStats(mon) {
  const bs = getSpecies(mon.speciesId).baseStats;
  const oldMaxHp = mon.maxHp;
  mon.maxHp = calcMaxHp(bs.hp, mon.level);
  mon.atk = calcStat(bs.atk, mon.level);
  mon.def = calcStat(bs.def, mon.level);
  mon.spAtk = calcStat(bs.spAtk, mon.level);
  mon.spDef = calcStat(bs.spDef, mon.level);
  mon.speed = calcStat(bs.speed, mon.level);
  const gain = mon.maxHp - oldMaxHp;
  if (gain > 0) mon.hp += gain; // 증가분만큼 현재HP 상승
  return gain;
}

// 종족을 진화형으로 교체. 기술·현재HP·exp 는 유지, 능력치/이름/타입/색상은 갱신.
export function evolve(mon, newSpeciesId) {
  const sp = getSpecies(newSpeciesId);
  mon.speciesId = sp.id;
  mon.name = sp.name;
  mon.types = [...sp.types];
  mon.color = sp.color;
  mon.catchRate = sp.catchRate;
  recalcStats(mon); // 새 종족 기준 재계산(현재HP 증가분 반영)
}

// 경험치 획득 + 레벨업(여러 번) + 진화 처리. 발생 이벤트 배열 반환.
export function gainExp(mon, amount) {
  const events = [{ type: 'exp', amount }];
  mon.exp += amount;

  while (mon.exp >= expForLevel(mon.level + 1)) {
    mon.level += 1;
    recalcStats(mon);
    events.push({ type: 'levelup', level: mon.level });

    // 이 레벨에 배우는 기술 처리(진화보다 먼저). 진화 전 종족 learnset 기준.
    const learnSp = getSpecies(mon.speciesId);
    const toLearn = learnSp.learnset.filter((e) => e.level === mon.level);
    for (const entry of toLearn) {
      if (mon.moves.some((m) => m.id === entry.moveId)) continue; // 이미 보유 → 스킵
      const move = getMove(entry.moveId);
      if (!move) continue;
      if (mon.moves.length < 4) {
        mon.moves.push(instantiateMove(entry.moveId)); // 자동 습득
        events.push({ type: 'learn', moveName: move.name });
      } else {
        // 4개 꽉 참 → 교체 여부는 호출부(BattleScene)가 결정
        events.push({ type: 'learn-choice', moveId: entry.moveId, moveName: move.name });
      }
    }

    // 레벨업으로 진화 레벨 도달 시 진화
    const sp = getSpecies(mon.speciesId);
    if (sp.evolvesTo && sp.evolveLevel && mon.level >= sp.evolveLevel) {
      const fromName = mon.name;
      evolve(mon, sp.evolvesTo);
      events.push({ type: 'evolve', from: fromName, to: mon.name });
    }
  }
  return events;
}
