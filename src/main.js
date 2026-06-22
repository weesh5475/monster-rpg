// ────────────────────────────────────────────────────────────
// 게임 진입점: Phaser.Game 인스턴스를 만들고 씬을 등록한다.
// ────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import BootScene from './scenes/BootScene.js';
import WorldScene from './scenes/WorldScene.js';
import BattleScene from './scenes/BattleScene.js';

const config = {
  type: Phaser.AUTO, // WebGL 우선, 안 되면 Canvas 로 자동 폴백
  parent: 'game', // index.html 의 <div id="game">
  width: GAME_WIDTH, // 480
  height: GAME_HEIGHT, // 320
  pixelArt: true, // 픽셀아트 선명하게 (보간 끔)
  backgroundColor: '#1d1d1d',
  scale: {
    mode: Phaser.Scale.FIT, // 비율 유지하며 창 크기에 맞춰 확대
    autoCenter: Phaser.Scale.CENTER_BOTH, // 화면 가운데 정렬
  },
  scene: [BootScene, WorldScene, BattleScene], // 첫 씬은 BootScene
};

// eslint-disable-next-line no-new
new Phaser.Game(config);
