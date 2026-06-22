// ────────────────────────────────────────────────────────────
// 아이템 DB (10단계) — placeholder.
//   { id, name, category('회복'|'볼'), desc, price, effect? }
//   회복류는 effect:{ hp:+N }
// ────────────────────────────────────────────────────────────

export const ITEMS = {
  몬스터볼: { id: '몬스터볼', name: '몬스터볼', category: '볼', desc: '야생 몬스터를 잡는 도구.', price: 200 },
  상처약: { id: '상처약', name: '상처약', category: '회복', desc: 'HP를 20 회복한다.', price: 300, effect: { hp: 20 } },
  좋은상처약: { id: '좋은상처약', name: '좋은상처약', category: '회복', desc: 'HP를 50 회복한다.', price: 700, effect: { hp: 50 } },
};

export function getItem(id) {
  return ITEMS[id];
}

// 상점 판매 목록(구매 가능한 아이템 id 순서)
export const SHOP_LIST = ['몬스터볼', '상처약', '좋은상처약'];

// 되팔기 가격 = 정가의 절반
export function sellPrice(id) {
  return Math.floor(ITEMS[id].price / 2);
}

// 회복 아이템을 몬스터에게 사용 → 실제 회복량 반환(0이면 효과 없음: 풀피거나 회복 아이템 아님)
export function useHealItem(mon, item) {
  if (!item.effect || !item.effect.hp || mon.hp >= mon.maxHp) return 0;
  const before = mon.hp;
  mon.hp = Math.min(mon.maxHp, mon.hp + item.effect.hp);
  return mon.hp - before;
}
