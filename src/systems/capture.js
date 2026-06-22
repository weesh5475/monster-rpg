// ────────────────────────────────────────────────────────────
// 포획 판정 (5단계) — Phaser 비의존 순수 로직.
//   calcCaptureChance(야생, 볼보정) → 포획 확률 p (0~1)
//   rollCapture(p) → 성공 여부 boolean
// ────────────────────────────────────────────────────────────

export function calcCaptureChance(wild, ballModifier = 1.0) {
  // HP가 낮을수록 잘 잡힌다. 풀피 ≈0.33, 빈사 ≈1.0
  const hpFactor = (3 * wild.maxHp - 2 * wild.hp) / (3 * wild.maxHp);
  const p = hpFactor * wild.catchRate * ballModifier;
  return Math.min(1, p);
}

export function rollCapture(p) {
  return Math.random() < p;
}
