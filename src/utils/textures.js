// ────────────────────────────────────────────────────────────
// 외부 이미지 없이 Phaser graphics → generateTexture 로
// 플레이스홀더 텍스처를 코드에서 직접 만든다.
// 나중에 진짜 스프라이트로 교체할 때는 이 파일만 바꾸면 됨.
// ────────────────────────────────────────────────────────────
import { TILE_SIZE, TEXTURES, COLORS } from '../config.js';

// 단색 사각형 타일 텍스처 하나 생성 (옅은 테두리 포함)
function makeTile(scene, key, fillColor, lineColor) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(fillColor, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  // 격자 구분이 보이도록 살짝 테두리
  g.lineStyle(1, lineColor, 1);
  g.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.generateTexture(key, TILE_SIZE, TILE_SIZE);
  g.destroy();
}

// 자를 수 있는 나무: 초록 타일 + 가운데 둥근 수관 + 갈색 줄기 (벽과 구분되게)
function makeCutTree(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(COLORS.GROUND_FILL, 1); // 바닥(베면 길이 드러나는 느낌)
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.fillStyle(0x6d4c41, 1); // 줄기(갈색)
  g.fillRect(TILE_SIZE / 2 - 2, TILE_SIZE - 10, 4, 8);
  g.fillStyle(COLORS.CUT_TREE_FILL, 1); // 수관(진초록)
  g.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2 - 2, TILE_SIZE / 2 - 5);
  g.lineStyle(2, COLORS.CUT_TREE_LINE, 1);
  g.strokeCircle(TILE_SIZE / 2, TILE_SIZE / 2 - 2, TILE_SIZE / 2 - 5);
  g.generateTexture(TEXTURES.CUT_TREE, TILE_SIZE, TILE_SIZE);
  g.destroy();
}

// 밀 수 있는 바위: 동굴 바닥색 + 가운데 둥근 회색 바위 (벽과 구분되게)
function makePushRock(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(COLORS.CAVE_FLOOR_FILL, 1); // 바닥
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.fillStyle(COLORS.PUSH_ROCK_FILL, 1); // 바위 몸체
  g.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2 - 4);
  g.lineStyle(2, COLORS.PUSH_ROCK_LINE, 1);
  g.strokeCircle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 2 - 4);
  g.generateTexture(TEXTURES.PUSH_ROCK, TILE_SIZE, TILE_SIZE);
  g.destroy();
}

// 플레이어 텍스처: 타일보다 약간 작은 빨강 네모 (테두리 포함)
function makePlayer(scene) {
  const size = TILE_SIZE - 8; // 타일 안에 여백을 두고 들어가도록
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(COLORS.PLAYER_FILL, 1);
  g.fillRect(0, 0, size, size);
  g.lineStyle(2, COLORS.PLAYER_LINE, 1);
  g.strokeRect(1, 1, size - 2, size - 2);
  g.generateTexture(TEXTURES.PLAYER, size, size);
  g.destroy();
}

// 모든 플레이스홀더 텍스처를 한 번에 생성 (BootScene 에서 호출)
export function createPlaceholderTextures(scene) {
  makeTile(scene, TEXTURES.GROUND, COLORS.GROUND_FILL, COLORS.GROUND_LINE);
  makeTile(scene, TEXTURES.WALL, COLORS.WALL_FILL, COLORS.WALL_LINE);
  makeTile(scene, TEXTURES.WATER, COLORS.WATER_FILL, COLORS.WATER_LINE);
  makeTile(scene, TEXTURES.GRASS, COLORS.GRASS_FILL, COLORS.GRASS_LINE);
  makeTile(scene, TEXTURES.DOOR, COLORS.DOOR_FILL, COLORS.DOOR_LINE);
  makeTile(scene, TEXTURES.BUILDING, COLORS.BUILDING_FILL, COLORS.BUILDING_LINE);
  makeTile(scene, TEXTURES.CAVE_FLOOR, COLORS.CAVE_FLOOR_FILL, COLORS.CAVE_FLOOR_LINE);
  makeTile(scene, TEXTURES.CAVE_WALL, COLORS.CAVE_WALL_FILL, COLORS.CAVE_WALL_LINE);
  makeCutTree(scene);
  makePushRock(scene);
  makePlayer(scene);
}
