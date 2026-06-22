// ────────────────────────────────────────────────────────────
// 저장 / 불러오기 (7단계) — localStorage 기반.
//   saveGame(player) / loadGame() / hasSave() / deleteSave()
// 몬스터는 최소 정보만 저장하고, 불러올 때 createMonster 로 재생성한 뒤
// exp·현재HP·각 기술 PP 만 덮어쓴다(능력치는 재계산되므로 안전).
// 전부 try/catch — 저장이 없거나 손상돼도 멈추지 않고 새 게임으로 진행.
// ────────────────────────────────────────────────────────────
import { playerState } from '../data/playerState.js';
import { createMonster } from '../data/monsters.js';

const SAVE_KEY = 'monsterRpgSave';
const SAVE_VERSION = 1;

// 몬스터 → 저장용 최소 데이터
function serializeMon(mon) {
  return {
    speciesId: mon.speciesId,
    level: mon.level,
    exp: mon.exp,
    hp: mon.hp,
    moves: mon.moves.map((m) => ({ id: m.id, pp: m.pp })),
  };
}

// 저장 데이터 → 몬스터 인스턴스 (createMonster 후 상태 덮어쓰기)
function deserializeMon(s) {
  const mon = createMonster(s.speciesId, s.level); // 능력치 재계산됨
  if (typeof s.exp === 'number') mon.exp = s.exp;
  if (typeof s.hp === 'number') mon.hp = Math.max(0, Math.min(s.hp, mon.maxHp));
  if (Array.isArray(s.moves)) {
    s.moves.forEach((sm) => {
      const mv = mon.moves.find((m) => m.id === sm.id);
      if (mv && typeof sm.pp === 'number') mv.pp = Math.max(0, Math.min(sm.pp, mv.maxPp));
    });
  }
  return mon;
}

// player: { x, y, mapId }
export function saveGame(player) {
  try {
    const data = {
      version: SAVE_VERSION,
      party: playerState.party.map(serializeMon),
      box: playerState.box.map(serializeMon),
      items: { ...playerState.items },
      money: playerState.money,
      lastCenter: { ...playerState.lastCenter },
      defeatedTrainers: [...playerState.defeatedTrainers],
      badges: [...playerState.badges],
      pickedItems: [...playerState.pickedItems],
      tileOverrides: JSON.parse(JSON.stringify(playerState.tileOverrides || {})),
      player: { x: player.x, y: player.y, mapId: player.mapId },
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('[saveGame] 저장 실패', e);
    return false;
  }
}

// 성공 시 playerState 를 복원하고 player 위치({x,y,mapId})를 반환. 실패/없으면 null.
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);

    // 먼저 로컬 변수로 전부 복원해 성공할 때만 반영(부분 손상 방지)
    const party = (data.party || []).map(deserializeMon);
    const box = (data.box || []).map(deserializeMon);
    const items = data.items && typeof data.items === 'object' ? { ...data.items } : { 몬스터볼: 0 };

    playerState.party = party;
    playerState.box = box;
    playerState.items = items;
    playerState.money = typeof data.money === 'number' ? data.money : playerState.money;
    if (data.lastCenter) playerState.lastCenter = { ...data.lastCenter };
    playerState.defeatedTrainers = Array.isArray(data.defeatedTrainers) ? [...data.defeatedTrainers] : [];
    playerState.badges = Array.isArray(data.badges) ? [...data.badges] : [];
    playerState.pickedItems = Array.isArray(data.pickedItems) ? [...data.pickedItems] : [];
    playerState.tileOverrides =
      data.tileOverrides && typeof data.tileOverrides === 'object' ? data.tileOverrides : {};

    const p = data.player || {};
    return { x: p.x, y: p.y, mapId: p.mapId || 'map1' };
  } catch (e) {
    console.error('[loadGame] 불러오기 실패 — 새 게임으로 시작', e);
    return null;
  }
}

export function hasSave() {
  try {
    return localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    console.error('[deleteSave] 삭제 실패', e);
  }
}
