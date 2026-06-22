// ────────────────────────────────────────────────────────────
// 야생 인카운트 생성 헬퍼 (4단계).
//   - 내 몬스터는 더 이상 여기서 만들지 않는다 → playerState.party 사용.
//   - 야생만 매번 createMonster 로 새로 생성: [물몬, 풀몬] 랜덤, 레벨 2~4.
// 다음 단계에서 지역별 조우 테이블로 갈아끼울 때 이 파일만 바꾸면 됨.
// ────────────────────────────────────────────────────────────
import { createMonster } from './monsters.js';

export function getWildEncounter(type, mapId) {
  if (type === 'water') {
    // 물 위 조우: 물몬 Lv3~5
    const level = 3 + Math.floor(Math.random() * 3);
    return createMonster('물몬', level);
  }
  if (type === 'cave') {
    // 동굴 조우: 돌몬 Lv4~6
    const level = 4 + Math.floor(Math.random() * 3);
    return createMonster('돌몬', level);
  }
  // 키큰풀 조우 — 지역별로 종족/레벨이 다름
  if (mapId === 'route2') {
    // route2: 풀몬/물몬 Lv4~6
    const pool = ['풀몬', '물몬'];
    const speciesId = pool[Math.floor(Math.random() * pool.length)];
    const level = 4 + Math.floor(Math.random() * 3);
    return createMonster(speciesId, level);
  }
  // 기본(field1 등): 물몬/풀몬 Lv2~4
  const pool = ['물몬', '풀몬'];
  const speciesId = pool[Math.floor(Math.random() * pool.length)];
  const level = 2 + Math.floor(Math.random() * 3);
  return createMonster(speciesId, level);
}
