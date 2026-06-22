// ────────────────────────────────────────────────────────────
// 데미지 공식 (기술 1회) — Phaser 비의존 순수 로직.
//   calculateDamage(공격자, 방어자, 기술) → { hit, damage, multiplier }
//   effectivenessMessage(배율) → 상성 메시지(또는 null)
// ────────────────────────────────────────────────────────────
import { getTypeMultiplier } from '../data/typeChart.js';

export function calculateDamage(attacker, defender, move) {
  // 1) 명중 판정: 랜덤(0~100) < 기술.명중 → 명중
  const accRoll = Math.random() * 100;
  if (accRoll >= move.accuracy) {
    return { hit: false, damage: 0, multiplier: 1 };
  }

  // 2) 물리/특수에 따라 사용할 공격/방어 스탯 결정
  const isPhysical = move.category === '물리';
  const A = isPhysical ? attacker.atk : attacker.spAtk;
  const D = isPhysical ? defender.def : defender.spDef;

  // 3) 기본 데미지
  const base = Math.floor(
    ((((2 * attacker.level) / 5 + 2) * move.power * (A / D)) / 50) + 2
  );

  // 4) 보정: STAB × 타입상성 × 랜덤(0.85~1.00)
  const multiplier = getTypeMultiplier(move.type, defender.types);
  if (multiplier === 0) {
    // 상성 무효 → 데미지 0 (턴은 소비)
    return { hit: true, damage: 0, multiplier: 0 };
  }

  const stab = attacker.types.includes(move.type) ? 1.5 : 1.0;
  const randFactor = 0.85 + Math.random() * 0.15;

  // 5) 최종 데미지 (최소 1)
  const damage = Math.max(1, Math.floor(base * stab * multiplier * randFactor));

  return { hit: true, damage, multiplier };
}

// 상성 메시지. 1배(보통)는 메시지 없음(null).
export function effectivenessMessage(multiplier) {
  if (multiplier === 0) return '효과가 없는 것 같다…';
  if (multiplier >= 2) return '효과가 굉장했다!';
  if (multiplier > 0 && multiplier <= 0.5) return '효과가 별로인 듯하다…';
  return null;
}
