// ────────────────────────────────────────────────────────────
// BootScene: 게임이 시작될 때 가장 먼저 도는 씬.
// 여기서 플레이스홀더 텍스처를 만든 뒤 곧바로 WorldScene 으로 넘어간다.
// (외부 에셋이 생기면 여기서 preload 도 담당하게 됨)
// ────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import { createPlaceholderTextures } from '../utils/textures.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    createPlaceholderTextures(this);
    this.scene.start('WorldScene');
  }
}
