// ────────────────────────────────────────────────────────────
// 게임 전역 설정 상수
// 새 단계에서 값을 바꾸거나 추가할 때 이 파일만 보면 되도록 모아 둠.
// ────────────────────────────────────────────────────────────

// 한 타일 크기(px)
export const TILE_SIZE = 32;

// 화면(뷰포트)에 보이는 타일 수 → 기본 해상도 계산용
export const VIEW_TILES_X = 15; // 가로 15칸
export const VIEW_TILES_Y = 10; // 세로 10칸

export const GAME_WIDTH = TILE_SIZE * VIEW_TILES_X; // 480
export const GAME_HEIGHT = TILE_SIZE * VIEW_TILES_Y; // 320

// 플레이어가 한 타일 이동하는 데 걸리는 시간(ms). 작을수록 빠름.
export const MOVE_DURATION = 150;

// ── 배틀 / 인카운트 관련 ──
// 키큰풀 타일로 한 칸 이동을 완료할 때마다 야생 인카운트가 발생할 확률(0~1).
export const ENCOUNTER_RATE = 0.1; // 기본 10%
// 데미지에 더해지는 랜덤 변동폭. 실제 데미지 = 공격력 + Between(-값, +값) (최소 1).
export const DAMAGE_VARIANCE = 2;
// 배틀 메시지 한 줄이 화면에 머무는 시간(ms). 이 시간이 지나면 다음 메시지로.
export const BATTLE_MESSAGE_DELAY = 950;
// 인카운트 시작 시 화면 플래시 연출 시간(ms).
export const ENCOUNTER_FLASH = 280;

// 파도타기 중 물 한 칸 이동 시 야생 조우 확률.
export const WATER_ENCOUNTER_RATE = 0.1;
// 동굴 바닥 한 칸 이동 시 야생 조우 확률(낮은 확률).
export const CAVE_ENCOUNTER_RATE = 0.08;

// ── 필드 기술 게이트 배지 (17단계) ──
//  배지명을 코드 한 곳에서 관리. 추후 지역별로 다른 배지를 요구하도록 확장 가능.
export const CUT_BADGE = '불꽃배지'; // 자르기(나무 베기) 사용 조건
export const STRENGTH_BADGE = '물배지'; // 괴력(바위 밀기) 사용 조건
// 파도타기 해금에 필요한 배지. 배지명을 코드 한 곳에서 관리하기 위한 상수.
//  - 현재: field1↔route2 호수는 첫 배지 '불꽃배지'로 건넌다.
//  - 추후: '물배지'(둘째 체육관)는 더 깊은 물(나중에 추가할 지역) 게이트로 쓸 예정 →
//    지역별로 필요한 배지를 다르게 두는 식으로 확장(예: SURF_BADGE_DEEP).
export const SURF_BADGE = '불꽃배지';

// ── 타일 종류 코드 (맵 데이터 배열에서 사용) ──
export const TILE = {
  GROUND: 0, // 길 / 땅
  WALL: 1, // 벽 / 나무
  WATER: 2, // 물
  GRASS: 3, // 키큰풀 (인카운트존)
  DOOR: 4, // 문 (워프 발동, 통과 가능)
  BUILDING: 5, // 건물 (충돌)
  CAVE_FLOOR: 6, // 동굴 바닥 (걷기 가능, 낮은 확률 인카운트존)
  CAVE_WALL: 7, // 동굴 벽 (충돌)
  CUT_TREE: 8, // 자를 수 있는 나무 (충돌, 자르기로 길로 변함) ※ 6/7은 동굴이 선점 → 8 사용
  PUSH_ROCK: 9, // 밀 수 있는 바위 (충돌, 괴력으로 이동)
};

// ── 코드에서 생성할 텍스처 키 이름 ──
export const TEXTURES = {
  GROUND: 'tile-ground',
  WALL: 'tile-wall',
  WATER: 'tile-water',
  GRASS: 'tile-grass',
  DOOR: 'tile-door',
  BUILDING: 'tile-building',
  CAVE_FLOOR: 'tile-cave-floor',
  CAVE_WALL: 'tile-cave-wall',
  CUT_TREE: 'tile-cut-tree',
  PUSH_ROCK: 'tile-push-rock',
  PLAYER: 'player',
};

// 타일 코드 → 텍스처 키 매핑
export const TILE_TEXTURE = {
  [TILE.GROUND]: TEXTURES.GROUND,
  [TILE.WALL]: TEXTURES.WALL,
  [TILE.WATER]: TEXTURES.WATER,
  [TILE.GRASS]: TEXTURES.GRASS,
  [TILE.DOOR]: TEXTURES.DOOR,
  [TILE.BUILDING]: TEXTURES.BUILDING,
  [TILE.CAVE_FLOOR]: TEXTURES.CAVE_FLOOR,
  [TILE.CAVE_WALL]: TEXTURES.CAVE_WALL,
  [TILE.CUT_TREE]: TEXTURES.CUT_TREE,
  [TILE.PUSH_ROCK]: TEXTURES.PUSH_ROCK,
};

// 플레이어가 들어갈 수 없는(충돌) 타일 종류 (문 DOOR 는 통과 가능 → 제외)
//  CUT_TREE/PUSH_ROCK 도 기본은 충돌 → 자르기/괴력으로 치우기 전까지 막힘.
export const BLOCKED_TILES = [
  TILE.WALL,
  TILE.WATER,
  TILE.BUILDING,
  TILE.CAVE_WALL,
  TILE.CUT_TREE,
  TILE.PUSH_ROCK,
];

// ── 플레이스홀더 색상 (0xRRGGBB) ──
export const COLORS = {
  GROUND_FILL: 0x9bd66b, // 연두
  GROUND_LINE: 0x8ac95c,
  WALL_FILL: 0x2f5d34, // 진한 초록(나무/벽)
  WALL_LINE: 0x214626,
  WATER_FILL: 0x3a78d6, // 파랑
  WATER_LINE: 0x2f63b3,
  GRASS_FILL: 0x4f8f3a, // 어두운 초록(키큰풀)
  GRASS_LINE: 0x437a31,
  DOOR_FILL: 0xffb74d, // 주황(문)
  DOOR_LINE: 0xe09b3a,
  BUILDING_FILL: 0x90a4ae, // 회색(건물)
  BUILDING_LINE: 0x6c7a82,
  CAVE_FLOOR_FILL: 0x5a5550, // 어두운 회갈색(동굴 바닥)
  CAVE_FLOOR_LINE: 0x4a443f,
  CAVE_WALL_FILL: 0x2b2926, // 더 어두운 회색(동굴 벽)
  CAVE_WALL_LINE: 0x1b1a18,
  CUT_TREE_FILL: 0x2e7d32, // 진한 초록(벨 수 있는 나무)
  CUT_TREE_LINE: 0x1b5e20,
  PUSH_ROCK_FILL: 0x8d8d8d, // 회색(밀 수 있는 바위)
  PUSH_ROCK_LINE: 0x5f5f5f,
  PLAYER_FILL: 0xe23b3b, // 빨강
  PLAYER_LINE: 0x7a1414,
};

// ── 배틀 화면 UI 색상 (전부 플레이스홀더) ──
export const BATTLE_COLORS = {
  BG_TOP: 0x6fbf73, // 배틀 배경 위쪽(들판 느낌)
  BG_BOTTOM: 0xd8c79a, // 배틀 배경 아래쪽(땅 느낌)
  PANEL: 0x202830, // 메시지 박스 / 정보판 배경
  PANEL_LINE: 0xf5f5f5, // 패널 테두리
  TEXT: '#ffffff',
  HP_BG: 0x444444, // HP바 바탕
  HP_HIGH: 0x4caf50, // HP 50% 이상(초록)
  HP_MID: 0xffc107, // HP 20~50%(노랑)
  HP_LOW: 0xf44336, // HP 20% 미만(빨강)
  BTN: 0x37474f, // 버튼 기본
  BTN_HOVER: 0x546e7a, // 버튼 호버
  BTN_LINE: 0xffffff,
};
