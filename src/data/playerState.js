// ────────────────────────────────────────────────────────────
// 전역 플레이어 상태 (4단계: 파티 시스템)
//  - party: 몬스터 인스턴스 배열(최대 6). 같은 인스턴스를 계속 사용하므로
//    배틀이 끝나도 현재HP/PP가 그대로 유지된다.
//  - 모듈 로드 시 1회 시작 파티를 생성한다(테스트용 placeholder).
//    포획/저장이 생기면 이 초기화를 교체하면 됨.
// ────────────────────────────────────────────────────────────
import { createMonster } from './monsters.js';
import { START } from './mapData.js';

export const MAX_PARTY = 6;

export const playerState = {
  party: [],
  items: { 몬스터볼: 10, 상처약: 3 }, // 소지품 { 아이템id: 개수 }
  box: [], // 보관함: 파티가 꽉 찼을 때 잡은 몬스터를 보냄 (박스 UI는 다음 단계)
  money: 3000, // 보유 코인
  lastCenter: { mapId: START.mapId, x: START.x, y: START.y }, // 전멸 시 복귀 지점
  defeatedTrainers: [], // 이미 이긴 트레이너 id 목록(재대결 방지)
  badges: [], // 획득한 배지 id 목록
  pickedItems: [], // 이미 주운 아이템볼 id 목록(재획득 방지)
  // 베어낸 나무 / 밀어낸 바위 등 맵 타일 변경분.
  //  { [mapId]: { "x,y": 타일코드 } } — loadMap 에서 원본 위에 덮어 적용.
  tileOverrides: {},
};

// 맵 타일 변경분 기록(자르기/괴력 결과를 세션·저장에 반영)
export function setTileOverride(mapId, x, y, code) {
  if (!playerState.tileOverrides[mapId]) playerState.tileOverrides[mapId] = {};
  playerState.tileOverrides[mapId][`${x},${y}`] = code;
}

// 시작 파티 구성 (테스트용)
export function initParty() {
  playerState.party = [
    createMonster('불꽃몬', 5),
    createMonster('물몬', 5),
    createMonster('풀몬', 5),
  ];
}

// 활성(선두) 몬스터 = 기절하지 않은 첫 마리
export function getActiveMonster() {
  return playerState.party.find((m) => m.hp > 0) || null;
}

// 아직 싸울 수 있는(기절 안 한) 몬스터가 있는가
export function hasUsableMonster() {
  return playerState.party.some((m) => m.hp > 0);
}

// 파티 전원 HP/PP 풀회복 (전멸 시 임시 처리 — 다음 단계에서 회복센터로 교체)
export function healPartyFull() {
  playerState.party.forEach((mon) => {
    mon.hp = mon.maxHp;
    mon.moves.forEach((mv) => {
      mv.pp = mv.maxPp;
    });
  });
}

// 새 게임: 파티/소지품/보관함을 전부 초기 상태로 되돌림
export function resetGame() {
  initParty();
  playerState.items = { 몬스터볼: 10, 상처약: 3 };
  playerState.box = [];
  playerState.money = 3000;
  playerState.lastCenter = { mapId: START.mapId, x: START.x, y: START.y };
  playerState.defeatedTrainers = [];
  playerState.badges = [];
  playerState.pickedItems = [];
  playerState.tileOverrides = {};
}

// 모듈 로드 시 1회 초기화 → import 하는 순간 party 준비됨(세션 동안 유지)
initParty();
