// ────────────────────────────────────────────────────────────
// WorldScene: 타일 맵을 그리고, 플레이어를 격자 단위로 이동시키는 메인 씬.
//  - 맵 렌더링
//  - 방향키 / WASD 입력 → 한 타일씩 tween 이동 (이동 중 입력 무시)
//  - 벽/물 충돌 차단
//  - 카메라 추적
//  - 디버그 텍스트(현재 타일 좌표)
// ────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import {
  TILE,
  TILE_SIZE,
  TILE_TEXTURE,
  TEXTURES,
  BLOCKED_TILES,
  MOVE_DURATION,
  ENCOUNTER_RATE,
  ENCOUNTER_FLASH,
  WATER_ENCOUNTER_RATE,
  CAVE_ENCOUNTER_RATE,
  SURF_BADGE,
  CUT_BADGE,
  STRENGTH_BADGE,
  GAME_WIDTH,
  GAME_HEIGHT,
} from '../config.js';
import { getMap, START } from '../data/mapData.js';
import { getWildEncounter } from '../data/battleTestData.js';
import {
  playerState,
  healPartyFull,
  resetGame,
  setTileOverride,
  MAX_PARTY,
} from '../data/playerState.js';
import { saveGame, loadGame, hasSave, deleteSave, autoSave, setOverworldPos } from '../systems/saveLoad.js';
import { getItem, useHealItem, SHOP_LIST, sellPrice } from '../data/items.js';
import { josa } from '../utils/josa.js';

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super('WorldScene');
  }

  create() {
    // 저장이 있으면 불러와 그 맵/위치/파티로 시작, 없으면 기본 시작값
    let startMap = START.mapId;
    let startX = START.x;
    let startY = START.y;
    if (hasSave()) {
      const p = loadGame();
      if (p && Number.isInteger(p.x) && Number.isInteger(p.y)) {
        // 옛 세이브 호환: 막힌 칸/맵 밖이면 그 맵의 안전한 칸으로 조용히 보정
        const safe = this.resolveSafeSpawn(p.mapId || START.mapId, p.x, p.y);
        startMap = safe.mapId;
        startX = safe.x;
        startY = safe.y;
      }
    }

    this.isMoving = false; // tween 이동 중이면 true → 추가 입력 무시
    this.isEncountering = false; // 인카운트 연출~배틀 동안 true → 입력 무시
    this.isWarping = false; // 맵 전환 연출 중 true → 입력 무시
    this.menuOpen = false; // 필드 메뉴 열림 여부
    this.confirmOpen = false; // 확인창 열림 여부
    this.dialogueActive = false; // NPC 대화 중 여부
    this.mapRT = null; // 현재 맵 타일을 한 번에 구워 그리는 RenderTexture (큰 맵 성능용)
    this.npcSprites = []; // 현재 맵 NPC 색네모들
    this.npcs = []; // 현재 맵 NPC 데이터
    this.itemballSprites = []; // 현재 맵 아이템볼 색네모들
    this.itemballs = []; // 현재 맵 아이템볼 데이터
    this.surfing = false; // 파도타기 중 여부
    this.boxOpen = false; // 보관함 PC 화면 열림 여부
    this.boxGfx = []; // 보관함 화면 그래픽들

    this.createPlayer();
    this.setupCamera();
    this.setupInput();
    this.createDebugText();

    this.loadMap(startMap, startX, startY);

    // BattleScene 이 끝나고 이 씬이 resume 될 때 결과를 받아 처리.
    this.events.on('resume', this.onResume, this);
    // 필드 메뉴/확인창/대화 키 입력 (이동은 update 폴링이라 별개)
    this.input.keyboard.on('keydown', (e) => this.handleFieldKey(e));
    // 대화 진행은 클릭으로도 가능
    this.input.on('pointerdown', () => {
      if (this.dialogueActive) this.nextDialogueLine();
    });
  }

  // 맵을 그리고 플레이어를 (x,y)에 배치. 기존 맵 오브젝트는 정리.
  loadMap(mapId, x, y) {
    let map = getMap(mapId);
    if (!map) {
      // 알 수 없는 맵이면 시작 맵으로 폴백
      mapId = START.mapId;
      map = getMap(mapId);
      x = START.x;
      y = START.y;
    }
    this.mapId = mapId;
    // 원본 위에 tileOverrides(자르기/괴력 변경분)를 적용한 복사본 사용.
    //  (원본 maps 데이터는 건드리지 않아야 새 게임/리로드 때 깨끗하게 시작됨)
    this.tiles = this.effectiveTiles(map, mapId);
    this.mapWidth = map.width;
    this.mapHeight = map.height;
    this.warps = map.warps || [];

    // 이전 타일/ NPC 정리
    if (this.mapRT) {
      this.mapRT.destroy();
      this.mapRT = null;
    }
    this.npcSprites.forEach((s) => s.destroy());
    this.npcSprites = [];
    this.npcs = map.npcs || [];
    this.itemballSprites.forEach((s) => s.destroy());
    this.itemballSprites = [];
    this.itemballs = map.itemballs || [];
    this.surfing = false; // 맵 이동 시 파도타기 해제
    this.player.clearTint();

    // 타일 렌더: 개별 이미지(수천 개) 대신 단일 RenderTexture 에 한 번 굽는다.
    //  → 그리기 호출 1개로 끝나 큰 맵에서도 가볍고, 카메라가 알아서 컬링한다.
    const rt = this.add
      .renderTexture(0, 0, this.mapWidth * TILE_SIZE, this.mapHeight * TILE_SIZE)
      .setOrigin(0, 0)
      .setDepth(0);
    rt.beginDraw();
    for (let ty = 0; ty < this.mapHeight; ty++) {
      for (let tx = 0; tx < this.mapWidth; tx++) {
        const code = this.tiles[ty][tx];
        const texKey = TILE_TEXTURE[code] ?? TEXTURES.GROUND;
        rt.batchDraw(texKey, tx * TILE_SIZE, ty * TILE_SIZE);
      }
    }
    rt.endDraw();
    this.mapRT = rt;

    // NPC 색네모들 (충돌·대화 대상)
    this.npcs.forEach((n) => {
      const s = this.add
        .rectangle(this.tileToWorldX(n.x), this.tileToWorldY(n.y), 24, 24, n.color)
        .setStrokeStyle(2, 0x000000)
        .setDepth(5);
      this.npcSprites.push(s);
    });

    // 아이템볼 색네모들 (아직 안 주운 것만)
    this.itemballs.forEach((b) => {
      if (playerState.pickedItems.includes(b.id)) return;
      const s = this.add
        .rectangle(this.tileToWorldX(b.x), this.tileToWorldY(b.y), 16, 16, 0xffd54f)
        .setStrokeStyle(2, 0x000000)
        .setDepth(6);
      s._ballId = b.id;
      this.itemballSprites.push(s);
    });

    // 플레이어 배치 + 카메라 경계
    this.tileX = x;
    this.tileY = y;
    this.player.setPosition(this.tileToWorldX(x), this.tileToWorldY(y));
    this.cameras.main.setBounds(0, 0, this.mapWidth * TILE_SIZE, this.mapHeight * TILE_SIZE);
    this.updateDebugText();
    setOverworldPos({ x, y, mapId }); // 자동 저장용 위치 추적(워프/로드 직후)
  }

  // 맵 원본 타일에 tileOverrides(자르기/괴력 변경분)를 적용한 복사본을 만든다.
  effectiveTiles(map, mapId) {
    const tiles = map.tiles.map((row) => row.slice());
    const ov = playerState.tileOverrides[mapId];
    if (ov) {
      Object.keys(ov).forEach((key) => {
        const [ox, oy] = key.split(',').map(Number);
        if (tiles[oy] && tiles[oy][ox] !== undefined) tiles[oy][ox] = ov[key];
      });
    }
    return tiles;
  }

  // 옛 세이브 호환: 복원한 좌표가 맵 밖/막힌 칸이면 그 맵의 안전한 칸으로 보정한다.
  //  - 정상 좌표면 그대로 반환(영향 없음).
  //  - field1 등 시작 맵이면 START, 그 외 맵이면 그 맵의 첫 유효 칸으로.
  resolveSafeSpawn(mapId, x, y) {
    const map = getMap(mapId);
    if (!map) return { mapId: START.mapId, x: START.x, y: START.y };
    const tiles = this.effectiveTiles(map, mapId);
    const h = tiles.length;
    const w = tiles[0].length;
    const npcs = map.npcs || [];
    // 걸어서 설 수 있는 칸인가(맵 안 + 충돌 타일 아님 + NPC 없음)
    const walkable = (tx, ty) =>
      tx >= 0 && ty >= 0 && tx < w && ty < h &&
      !BLOCKED_TILES.includes(tiles[ty][tx]) &&
      !npcs.some((n) => n.x === tx && n.y === ty);

    if (Number.isInteger(x) && Number.isInteger(y) && walkable(x, y)) {
      return { mapId, x, y }; // 정상 → 그대로
    }
    // 보정 필요
    if (mapId === START.mapId && walkable(START.x, START.y)) {
      return { mapId, x: START.x, y: START.y };
    }
    // 그 맵의 첫 유효 칸(길/풀/동굴바닥 우선)으로
    const isOpenFloor = (c) =>
      c === TILE.GROUND || c === TILE.GRASS || c === TILE.CAVE_FLOOR;
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        if (walkable(tx, ty) && isOpenFloor(tiles[ty][tx])) {
          console.info(`[resolveSafeSpawn] ${mapId} (${x},${y}) → (${tx},${ty}) 보정`);
          return { mapId, x: tx, y: ty };
        }
      }
    }
    // 최후의 폴백
    return { mapId: START.mapId, x: START.x, y: START.y };
  }

  // 플레이어 스프라이트 생성 (위치는 loadMap 이 설정).
  createPlayer() {
    this.player = this.add
      .image(0, 0, TEXTURES.PLAYER)
      .setOrigin(0.5, 0.5)
      .setDepth(10);
    this.facing = 'down'; // 바라보는 방향
    // 바라보는 방향 표식(작은 흰 점)
    this.facingDot = this.add.rectangle(0, 0, 6, 6, 0xffffff).setDepth(11);
  }

  setupCamera() {
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.roundPixels = true; // 픽셀 흔들림 방지
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys(); // 방향키
    this.keys = this.input.keyboard.addKeys('W,A,S,D'); // WASD
    this.keyP = this.input.keyboard.addKey('P'); // 파티 상태 오버레이 토글
  }

  createDebugText() {
    this.debugText = this.add
      .text(6, 6, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#000000aa',
        padding: { x: 5, y: 3 },
      })
      .setScrollFactor(0) // 카메라가 움직여도 화면 구석에 고정
      .setDepth(100);
    this.updateDebugText();
  }

  updateDebugText() {
    this.debugText.setText(`[${this.mapId ?? '-'}]  x: ${this.tileX}  y: ${this.tileY}`);
  }

  // ── 좌표 변환: 타일 인덱스 → 월드 픽셀(타일 중앙) ──
  tileToWorldX(tx) {
    return tx * TILE_SIZE + TILE_SIZE / 2;
  }
  tileToWorldY(ty) {
    return ty * TILE_SIZE + TILE_SIZE / 2;
  }

  // 눌린 방향키/WASD 를 읽어 이동 방향(dx, dy)을 반환. 없으면 null.
  getInputDirection() {
    if (this.cursors.left.isDown || this.keys.A.isDown) return { dx: -1, dy: 0 };
    if (this.cursors.right.isDown || this.keys.D.isDown) return { dx: 1, dy: 0 };
    if (this.cursors.up.isDown || this.keys.W.isDown) return { dx: 0, dy: -1 };
    if (this.cursors.down.isDown || this.keys.S.isDown) return { dx: 0, dy: 1 };
    return null;
  }

  // 해당 타일이 막혀 있는지(맵 밖 or 벽/물) 검사.
  isBlocked(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.mapWidth || ty >= this.mapHeight) return true;
    const tile = this.tiles[ty][tx];
    if (tile === TILE.WATER) {
      if (!this.surfing) return true; // 파도타기 중이 아니면 물은 막힘
    } else if (BLOCKED_TILES.includes(tile)) {
      return true; // 벽 / 건물
    }
    if (this.npcs.some((n) => n.x === tx && n.y === ty)) return true; // NPC 충돌
    return false;
  }

  update() {
    this.updateFacingDot();
    // P 키로 파티 상태 오버레이 토글 (메뉴/확인창/대화가 없을 때만)
    if (
      !this.menuOpen &&
      !this.confirmOpen &&
      !this.dialogueActive &&
      !this.boxOpen &&
      Phaser.Input.Keyboard.JustDown(this.keyP)
    ) {
      this.togglePartyOverlay();
    }
    if (this.partyOverlay) return; // 오버레이가 열려 있으면 이동 정지
    if (this.boxOpen) return; // 보관함 화면 열려 있으면 이동 정지
    if (this.menuOpen || this.confirmOpen || this.dialogueActive) return; // 메뉴/확인창/대화 중 정지
    if (this.isMoving || this.isEncountering || this.isWarping) return; // 이동/배틀/맵전환 중 무시

    const dir = this.getInputDirection();
    if (!dir) return;

    this.facing = this.dirToFacing(dir); // 막혀도 바라보는 방향은 갱신

    const nextX = this.tileX + dir.dx;
    const nextY = this.tileY + dir.dy;
    if (this.isBlocked(nextX, nextY)) return; // 벽/물/NPC/맵밖이면 이동 취소

    this.stepInto(nextX, nextY);
  }

  // Shift 를 누른 채면 달리기(이동 tween 시간 절반)
  isRunning() {
    return !!(this.cursors && this.cursors.shift && this.cursors.shift.isDown);
  }

  // 한 타일 이동(tween) + 이동 완료 후처리
  stepInto(tx, ty) {
    this.tileX = tx;
    this.tileY = ty;
    this.isMoving = true;
    const duration = this.isRunning() ? MOVE_DURATION / 2 : MOVE_DURATION;
    this.tweens.add({
      targets: this.player,
      x: this.tileToWorldX(tx),
      y: this.tileToWorldY(ty),
      duration,
      ease: 'Linear',
      onComplete: () => {
        this.isMoving = false;
        this.updateDebugText();
        this.afterMove();
      },
    });
  }

  afterMove() {
    setOverworldPos({ x: this.tileX, y: this.tileY, mapId: this.mapId }); // 자동 저장용 위치 추적
    this.updateSurfState(); // 뭍에 올랐는지
    if (this.checkWarp()) return; // 워프(인카운트 스킵)
    if (this.checkItemBall()) return; // 밟아서 아이템볼 획득
    this.checkEncounter(); // 키큰풀/물 인카운트
  }

  // 상태가 바뀌는 순간 자동 저장(현재 위치 + playerState). 실패는 조용히 무시.
  saveAuto() {
    autoSave({ x: this.tileX, y: this.tileY, mapId: this.mapId });
  }

  // 물 위에 있다가 육지로 올라오면 파도타기 해제
  updateSurfState() {
    if (this.surfing && this.tiles[this.tileY][this.tileX] !== TILE.WATER) {
      this.surfing = false;
      this.player.clearTint();
      this.showToast('뭍에 올랐다.');
    }
  }

  // ── 인카운트 ────────────────────────────────────────────

  // 방금 도착한 타일이 키큰풀이면 확률적으로 야생 인카운트를 발생시킨다.
  checkEncounter() {
    const tile = this.tiles[this.tileY][this.tileX];
    if (tile === TILE.GRASS) {
      if (Math.random() < ENCOUNTER_RATE) this.startEncounter('grass');
    } else if (this.surfing && tile === TILE.WATER) {
      if (Math.random() < WATER_ENCOUNTER_RATE) this.startEncounter('water');
    } else if (tile === TILE.CAVE_FLOOR) {
      if (Math.random() < CAVE_ENCOUNTER_RATE) this.startEncounter('cave');
    }
  }

  // ── 워프(맵 전환) ───────────────────────────────────────

  // 현재 타일이 워프면 맵 전환을 발동. 발동했으면 true.
  checkWarp() {
    const warp = this.warps.find((w) => w.x === this.tileX && w.y === this.tileY);
    if (!warp) return false;
    this.isWarping = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.loadMap(warp.toMap, warp.toX, warp.toY);
      this.saveAuto(); // 맵 워프 진입 직후 자동 저장
      this.cameras.main.fadeIn(200, 0, 0, 0);
      this.isWarping = false;
    });
    return true;
  }

  // 화면을 번쩍인 뒤 WorldScene 을 멈추고 BattleScene 을 띄운다.
  // pause 라서 플레이어 위치 등 현재 상태는 그대로 보존됨.
  startEncounter(type) {
    this.isEncountering = true;
    this.cameras.main.flash(ENCOUNTER_FLASH, 255, 255, 255);
    this.time.delayedCall(ENCOUNTER_FLASH + 60, () => {
      this.scene.pause();
      // 내 몬스터는 BattleScene 이 playerState 에서 직접 가져오므로 야생만 전달.
      this.scene.launch('BattleScene', {
        wild: getWildEncounter(type, this.mapId),
      });
    });
  }

  // BattleScene 종료 후 재개될 때 호출. data.defeated(전멸) 면 회복+시작 지점 복귀.
  onResume(sys, data) {
    this.isEncountering = false;
    if (data && data.defeated) {
      // 전멸 시: 파티 전원 풀회복 + 마지막 회복센터로 복귀
      healPartyFull();
      const c = playerState.lastCenter || { mapId: START.mapId, x: START.x, y: START.y };
      this.loadMap(c.mapId, c.x, c.y);
    }
    this.cameras.main.flash(ENCOUNTER_FLASH, 255, 255, 255);
    this.saveAuto(); // 배틀 종료 후 필드 복귀 직후 자동 저장(승리/도망/포획/패배)
  }

  // 필드에서 P 키로 파티 상태 간단 오버레이 토글.
  togglePartyOverlay() {
    if (this.partyOverlay) {
      this.partyOverlay.destroy();
      this.partyOverlay = null;
      return;
    }
    const lines = playerState.party.map((m, i) => {
      const status = m.hp <= 0 ? '  (기절)' : '';
      return `${i + 1}. ${m.name}  Lv${m.level}  HP ${m.hp}/${m.maxHp}${status}`;
    });
    const body = `== 파티 ==\n${lines.join('\n')}\n\n[P] 닫기`;
    this.partyOverlay = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, body, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 12, y: 10 },
        align: 'left',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(200);
  }

  // ── 필드 메뉴 (Enter / M) ────────────────────────────────

  // ── 플레이어 방향 / NPC 상호작용 ──────────────────────────

  dirToFacing(dir) {
    if (dir.dx < 0) return 'left';
    if (dir.dx > 0) return 'right';
    if (dir.dy < 0) return 'up';
    return 'down';
  }

  updateFacingDot() {
    if (!this.facingDot) return;
    const off = { up: [0, -10], down: [0, 10], left: [-10, 0], right: [10, 0] }[this.facing];
    this.facingDot.setPosition(this.player.x + off[0], this.player.y + off[1]);
  }

  // 바라보는 앞 타일 좌표
  frontTile() {
    const off = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.facing];
    return { x: this.tileX + off[0], y: this.tileY + off[1] };
  }

  // 앞에 NPC 가 있으면 대화 시작
  tryInteract() {
    if (this.isMoving) return;
    const f = this.frontTile();
    const npc = this.npcs.find((n) => n.x === f.x && n.y === f.y);
    if (npc) {
      this.startDialogue(npc);
      return;
    }
    const ball = this.activeItemBall(f.x, f.y);
    if (ball) {
      this.pickItemBall(ball);
      return;
    }
    // 앞 타일이 맵 안일 때만 필드 기술/파도타기 판정
    if (f.x < 0 || f.y < 0 || f.x >= this.mapWidth || f.y >= this.mapHeight) return;
    const frontCode = this.tiles[f.y][f.x];
    if (frontCode === TILE.CUT_TREE) {
      this.tryCut(f);
    } else if (frontCode === TILE.PUSH_ROCK) {
      this.tryStrength(f);
    } else if (frontCode === TILE.WATER && !this.surfing) {
      this.trySurf(f);
    }
  }

  // ── 필드 기술: 자르기(나무 베기) ──
  tryCut(f) {
    if (!playerState.badges.includes(CUT_BADGE)) {
      this.showNpcMessage(['튼튼한 나무다. 더 강해져야 벨 수 있을 것 같다…']);
      return;
    }
    this.tiles[f.y][f.x] = TILE.GROUND;
    setTileOverride(this.mapId, f.x, f.y, TILE.GROUND);
    this.repaintTile(f.x, f.y);
    this.showNpcMessage(['나무를 베었다!']);
  }

  // ── 필드 기술: 괴력(바위 밀기) ──
  tryStrength(f) {
    if (!playerState.badges.includes(STRENGTH_BADGE)) {
      this.showNpcMessage(['바위가 꿈쩍도 않는다… 괴력이 있어야 밀 수 있을 것 같다.']);
      return;
    }
    // 바위 너머 칸 = 바라보는 방향으로 한 칸 더
    const off = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.facing];
    const tx = f.x + off[0];
    const ty = f.y + off[1];
    const inBounds = tx >= 0 && ty >= 0 && tx < this.mapWidth && ty < this.mapHeight;
    // 밀 곳이 걸을 수 있는 바닥(길/동굴바닥) + NPC/아이템볼 없음 일 때만 이동
    const targetCode = inBounds ? this.tiles[ty][tx] : null;
    const isFloor = targetCode === TILE.GROUND || targetCode === TILE.CAVE_FLOOR;
    const pushable =
      isFloor &&
      !this.npcs.some((n) => n.x === tx && n.y === ty) &&
      !this.activeItemBall(tx, ty);
    if (!pushable) {
      this.showNpcMessage(['바위가 움직이지 않는다.']);
      return;
    }
    // 바위가 비운 자리는 옮겨간 칸과 같은 바닥 종류로 되돌린다(동굴이면 동굴바닥).
    const floorType = targetCode;
    this.tiles[f.y][f.x] = floorType;
    this.tiles[ty][tx] = TILE.PUSH_ROCK;
    setTileOverride(this.mapId, f.x, f.y, floorType);
    setTileOverride(this.mapId, tx, ty, TILE.PUSH_ROCK);
    this.repaintTile(f.x, f.y);
    this.repaintTile(tx, ty);
    this.showNpcMessage(['괴력으로 바위를 밀었다!']);
  }

  // 단일 타일을 현재 tiles 값에 맞게 다시 그린다(자르기/괴력 후).
  //  타일 텍스처는 32×32 불투명이라 기존 위에 덮어 그리면 완전히 교체된다.
  repaintTile(x, y) {
    if (!this.mapRT) return;
    const texKey = TILE_TEXTURE[this.tiles[y][x]] ?? TEXTURES.GROUND;
    this.mapRT.draw(texKey, x * TILE_SIZE, y * TILE_SIZE);
  }

  trySurf(f) {
    if (!playerState.badges.includes(SURF_BADGE)) {
      this.showNpcMessage(['물이 깊어서 건널 수 없다…']);
      return;
    }
    this.showNpcMessage(['파도타기를 사용했다!'], () => {
      this.surfing = true;
      this.player.setTint(0x66ccff); // 파도타기 표시(색 변화)
      this.stepInto(f.x, f.y); // 첫 물 타일로 진입
    });
  }

  // ── 아이템볼 ──
  activeItemBall(x, y) {
    return (this.itemballs || []).find(
      (b) => b.x === x && b.y === y && !playerState.pickedItems.includes(b.id)
    );
  }

  checkItemBall() {
    const ball = this.activeItemBall(this.tileX, this.tileY);
    if (!ball) return false;
    this.pickItemBall(ball);
    return true;
  }

  pickItemBall(ball) {
    if (playerState.pickedItems.includes(ball.id)) return;
    const qty = ball.qty || 1;
    playerState.pickedItems.push(ball.id);
    playerState.items[ball.itemId] = (playerState.items[ball.itemId] || 0) + qty;
    const s = this.itemballSprites.find((sp) => sp._ballId === ball.id);
    if (s) {
      s.destroy();
      this.itemballSprites = this.itemballSprites.filter((sp) => sp !== s);
    }
    const name = getItem(ball.itemId).name;
    const msg = qty > 1 ? `${name} ${qty}개를 주웠다!` : `${josa(name, '을/를')} 주웠다!`;
    this.showNpcMessage([msg]);
    this.saveAuto(); // 아이템볼 획득 직후
  }

  startDialogue(npc) {
    if (npc.type === 'healer') {
      this.startHealer();
      return;
    }
    if (npc.type === 'merchant') {
      this.openShopMain();
      return;
    }
    if (npc.type === 'pc') {
      this.openBox();
      return;
    }
    if (npc.type === 'trainer' || npc.type === 'gymleader') {
      this.startTrainer(npc);
      return;
    }
    this.showNpcMessage([...npc.dialogue]);
  }

  startTrainer(npc) {
    if (playerState.defeatedTrainers.includes(npc.id)) {
      this.showNpcMessage([...npc.afterText]); // 이미 이긴 트레이너 → 후일담만
      return;
    }
    this.showNpcMessage([...npc.beforeText, `${npc.name}가 승부를 걸어왔다!`], () =>
      this.launchTrainerBattle(npc)
    );
  }

  launchTrainerBattle(npc) {
    this.isEncountering = true;
    this.cameras.main.flash(ENCOUNTER_FLASH, 255, 255, 255);
    this.time.delayedCall(ENCOUNTER_FLASH + 60, () => {
      this.scene.pause();
      this.scene.launch('BattleScene', { trainer: npc });
    });
  }

  // ── 대화창 ──
  showNpcMessage(lines, onEnd) {
    this.dialogueLines = lines;
    this.dialogueOnEnd = onEnd || null;
    this.dialogueActive = true;
    this.openDialogueBox();
    this.nextDialogueLine();
  }

  nextDialogueLine() {
    if (!this.dialogueLines || this.dialogueLines.length === 0) {
      this.endDialogue();
      return;
    }
    const line = this.dialogueLines.shift();
    this.dialogueText.setText(line);
    this.dialogueIndicator.setVisible(true);
  }

  endDialogue() {
    this.closeDialogueBox();
    this.dialogueActive = false;
    const cb = this.dialogueOnEnd;
    this.dialogueOnEnd = null;
    if (cb) cb(); // 대화 종료 후 후처리(예: 트레이너 배틀 시작)
  }

  openDialogueBox() {
    const w = GAME_WIDTH - 16;
    this.dlgBg = this.add
      .rectangle(8, GAME_HEIGHT - 80, w, 72, 0x202830, 0.96)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffffff)
      .setScrollFactor(0)
      .setDepth(150);
    this.dialogueText = this.add
      .text(20, GAME_HEIGHT - 66, '', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        wordWrap: { width: GAME_WIDTH - 60 },
        lineSpacing: 4,
      })
      .setScrollFactor(0)
      .setDepth(151);
    this.dialogueIndicator = this.add
      .text(GAME_WIDTH - 22, GAME_HEIGHT - 18, '▼', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(151)
      .setVisible(false);
  }

  closeDialogueBox() {
    [this.dlgBg, this.dialogueText, this.dialogueIndicator].forEach((o) => o && o.destroy());
    this.dlgBg = this.dialogueText = this.dialogueIndicator = null;
  }

  // ── 회복센터(힐러) ──
  startHealer() {
    this.openConfirm(
      '어서 오세요!\n몬스터들을 회복시켜 드릴까요?',
      () => this.healYes(),
      () => this.healNo()
    );
  }

  healYes() {
    this.closeConfirm();
    // 이 회복센터를 전멸 시 복귀 지점으로 기록
    playerState.lastCenter = { mapId: this.mapId, x: this.tileX, y: this.tileY };
    healPartyFull();
    this.showNpcMessage(['회복 중…', '몬스터들이 모두 건강해졌어요!']);
    this.saveAuto(); // 회복센터 회복 직후
  }

  healNo() {
    this.closeConfirm();
    this.showNpcMessage(['또 오세요!']);
  }

  // ── 필드 메뉴 / 대화 키 입력 ─────────────────────────────

  handleFieldKey(e) {
    if (this.isEncountering || this.isWarping) return; // 배틀/맵전환 중엔 무시

    // 보관함 PC 화면이 열려 있으면 전용 입력 처리
    if (this.boxOpen) {
      this.handleBoxKey(e);
      return;
    }
    // 대화 중: Space/Enter 로 다음 줄
    if (this.dialogueActive) {
      if (e.code === 'Space' || e.code === 'Enter') this.nextDialogueLine();
      return;
    }
    // 수량 선택 모드(상점)
    if (this.qtyMode) {
      this.handleQtyKey(e);
      return;
    }
    // 확인창(힐러 예/아니오, 새 게임 등)
    if (this.confirmOpen) {
      this.handleConfirmKey(e);
      return;
    }
    if (this.partyOverlay) return;
    // 필드 메뉴/상점 조작
    if (this.menuOpen) {
      switch (e.code) {
        case 'ArrowUp':
          this.moveMenuCursor(-1);
          break;
        case 'ArrowDown':
          this.moveMenuCursor(1);
          break;
        case 'Enter':
        case 'Space':
          this.menuItems[this.menuCursor].action();
          break;
        case 'Escape':
          (this.menuBack || (() => this.closeFieldMenu()))(); // 한 단계 뒤로
          break;
        case 'KeyM':
          this.closeFieldMenu();
          break;
        default:
          break;
      }
      return;
    }
    // 평소: Enter/M = 메뉴, Space = 앞 NPC 와 상호작용
    if (e.code === 'Enter' || e.code === 'KeyM') this.openFieldMenu();
    else if (e.code === 'Space') this.tryInteract();
  }

  openFieldMenu() {
    this.menuOpen = true;
    this.menuItems = [
      { label: '저장하기', action: () => this.doSave() },
      { label: '가방', action: () => this.openBag() },
      { label: '파티', action: () => this.showPartyFromMenu() },
      { label: '배지', action: () => this.openBadges() },
      { label: '새로 시작', action: () => this.askNewGame() },
      { label: '닫기', action: () => this.closeFieldMenu() },
    ];
    this.menuCursor = 0;
    this.menuTitle = `${playerState.money}코인`;
    this.menuWidth = 130;
    this.menuBack = () => this.closeFieldMenu();
    this.renderFieldMenu();
  }

  renderFieldMenu() {
    this.destroyMenuGfx();
    const w = this.menuWidth || 130;
    const x = GAME_WIDTH - w - 8;
    const y = 8;
    const titleH = this.menuTitle ? 22 : 0;
    const h = this.menuItems.length * 26 + 14 + titleH;
    this.menuBg = this.add
      .rectangle(x, y, w, h, 0x000000, 0.82)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffffff)
      .setScrollFactor(0)
      .setDepth(200);
    if (this.menuTitle) {
      this.menuTitleText = this.add
        .text(x + 10, y + 6, this.menuTitle, {
          fontFamily: 'sans-serif',
          fontSize: '12px',
          color: '#ffe082',
        })
        .setScrollFactor(0)
        .setDepth(201);
    }
    this.menuTexts = this.menuItems.map((it, i) => {
      const t = this.add
        .text(x + 12, y + 9 + titleH + i * 26, '', {
          fontFamily: 'sans-serif',
          fontSize: '14px',
          color: '#ffffff',
        })
        .setScrollFactor(0)
        .setDepth(201)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => {
        this.menuCursor = i;
        this.updateMenuHighlight();
      });
      t.on('pointerdown', () => {
        this.menuCursor = i;
        this.menuItems[i].action();
      });
      return t;
    });
    this.updateMenuHighlight();
  }

  // ── 배지 ─────────────────────────────────────────────────

  openBadges() {
    const items = playerState.badges.length
      ? playerState.badges.map((b) => ({ label: `◆ ${b}`, action: () => {} }))
      : [{ label: '아직 배지가 없다.', action: () => {} }];
    items.push({ label: '뒤로', action: () => this.openFieldMenu() });
    this.menuItems = items;
    this.menuCursor = items.length - 1; // '뒤로'에 커서
    this.menuTitle = `배지 (${playerState.badges.length})`;
    this.menuWidth = 170;
    this.menuBack = () => this.openFieldMenu();
    this.renderFieldMenu();
  }

  // ── 가방 (필드) ──────────────────────────────────────────

  openBag() {
    const order = ['회복', '볼'];
    const ids = Object.keys(playerState.items)
      .filter((id) => (playerState.items[id] || 0) > 0)
      .sort((a, b) => order.indexOf(getItem(a).category) - order.indexOf(getItem(b).category));
    const items = ids.map((id) => ({
      label: `${getItem(id).name} x${playerState.items[id]}`,
      action: () => this.onBagItem(id),
    }));
    items.push({ label: '뒤로', action: () => this.openFieldMenu() });
    this.menuItems = items;
    this.menuCursor = 0;
    this.menuTitle = `가방  (${playerState.money}코인)`;
    this.menuWidth = 190;
    this.menuBack = () => this.openFieldMenu();
    this.renderFieldMenu();
  }

  onBagItem(id) {
    const item = getItem(id);
    if (item.category !== '회복') {
      this.showToast('지금은 쓸 수 없어!'); // 볼류는 배틀에서만
      return;
    }
    this.pendingItem = id;
    this.openBagPartySelect();
  }

  openBagPartySelect() {
    const items = playerState.party.map((mon, i) => ({
      label: `${mon.name}  HP ${mon.hp}/${mon.maxHp}`,
      action: () => this.useItemOnPartyMember(i),
    }));
    items.push({ label: '뒤로', action: () => this.openBag() });
    this.menuItems = items;
    this.menuCursor = 0;
    this.menuTitle = '누구에게 쓸까?';
    this.menuWidth = 190;
    this.menuBack = () => this.openBag();
    this.renderFieldMenu();
  }

  useItemOnPartyMember(i) {
    const mon = playerState.party[i];
    const item = getItem(this.pendingItem);
    const healed = useHealItem(mon, item);
    if (healed <= 0) {
      this.showToast('효과가 없었다!');
      return;
    }
    playerState.items[this.pendingItem] -= 1;
    this.closeFieldMenu();
    this.showToast(`${mon.name}의 HP를 ${healed} 회복했다!`);
  }

  updateMenuHighlight() {
    this.menuTexts.forEach((t, i) => {
      const sel = i === this.menuCursor;
      t.setText((sel ? '▶ ' : '   ') + this.menuItems[i].label);
      t.setColor(sel ? '#ffff66' : '#ffffff');
    });
  }

  moveMenuCursor(d) {
    const n = this.menuItems.length;
    this.menuCursor = (this.menuCursor + d + n) % n;
    this.updateMenuHighlight();
  }

  destroyMenuGfx() {
    if (this.menuBg) {
      this.menuBg.destroy();
      this.menuBg = null;
    }
    if (this.menuTitleText) {
      this.menuTitleText.destroy();
      this.menuTitleText = null;
    }
    if (this.menuTexts) {
      this.menuTexts.forEach((t) => t.destroy());
      this.menuTexts = null;
    }
    if (this.qtyText) {
      this.qtyText.destroy();
      this.qtyText = null;
    }
  }

  // ── 상점 (merchant) ──────────────────────────────────────

  openShopMain() {
    this.menuOpen = true;
    this.qtyMode = false;
    this.menuItems = [
      { label: '사기', action: () => this.openShopBuy() },
      { label: '팔기', action: () => this.openShopSell() },
      { label: '나가기', action: () => this.closeFieldMenu() },
    ];
    this.menuCursor = 0;
    this.menuTitle = `상점  (${playerState.money}코인)`;
    this.menuWidth = 170;
    this.menuBack = () => this.closeFieldMenu();
    this.renderFieldMenu();
  }

  openShopBuy() {
    const items = SHOP_LIST.map((id) => {
      const item = getItem(id);
      return { label: `${item.name} ─ ${item.price}`, action: () => this.startBuyQty(id) };
    });
    items.push({ label: '뒤로', action: () => this.openShopMain() });
    this.menuItems = items;
    this.menuCursor = 0;
    this.menuTitle = `사기  (${playerState.money}코인)`;
    this.menuWidth = 200;
    this.menuBack = () => this.openShopMain();
    this.renderFieldMenu();
  }

  openShopSell() {
    const ids = Object.keys(playerState.items).filter((id) => (playerState.items[id] || 0) > 0);
    const items = ids.map((id) => ({
      label: `${getItem(id).name} ×${playerState.items[id]} ─ ${sellPrice(id)}`,
      action: () => this.startSellQty(id),
    }));
    items.push({ label: '뒤로', action: () => this.openShopMain() });
    this.menuItems = items;
    this.menuCursor = 0;
    this.menuTitle = `팔기  (${playerState.money}코인)`;
    this.menuWidth = 220;
    this.menuBack = () => this.openShopMain();
    this.renderFieldMenu();
  }

  startBuyQty(id) {
    const item = getItem(id);
    const maxByCoin = Math.floor(playerState.money / item.price);
    const max = Math.min(99, maxByCoin);
    if (max < 1) {
      this.showToast('코인이 부족합니다.');
      return;
    }
    this.openQty({
      label: item.name,
      unitPrice: item.price,
      max,
      isBuy: true,
      onConfirm: (qty) => this.confirmBuy(id, qty),
      back: () => this.openShopBuy(),
    });
  }

  confirmBuy(id, qty) {
    const item = getItem(id);
    const total = item.price * qty;
    if (playerState.money < total) {
      this.showToast('코인이 부족합니다.');
      this.openShopBuy();
      return;
    }
    playerState.money -= total;
    playerState.items[id] = (playerState.items[id] || 0) + qty;
    this.showToast(`${item.name} ${qty}개를 샀습니다! 감사합니다.`);
    this.saveAuto(); // 상점 구매 직후
    this.openShopBuy(); // 계속 쇼핑
  }

  startSellQty(id) {
    const max = playerState.items[id] || 0;
    if (max < 1) return;
    this.openQty({
      label: getItem(id).name,
      unitPrice: sellPrice(id),
      max,
      isBuy: false,
      onConfirm: (qty) => this.confirmSell(id, qty),
      back: () => this.openShopSell(),
    });
  }

  confirmSell(id, qty) {
    const gain = sellPrice(id) * qty;
    playerState.items[id] -= qty;
    if (playerState.items[id] <= 0) delete playerState.items[id];
    playerState.money += gain;
    this.showToast(`${getItem(id).name}를 팔아 ${gain}코인을 받았습니다.`);
    this.saveAuto(); // 상점 판매 직후
    this.openShopSell();
  }

  // ── 수량 선택 ──
  openQty(opts) {
    this.qtyOpts = opts;
    this.qtyValue = 1;
    this.qtyMode = true;
    this.menuBack = () => {
      this.qtyMode = false;
      opts.back();
    };
    this.renderQty();
  }

  renderQty() {
    this.destroyMenuGfx();
    const o = this.qtyOpts;
    const total = o.unitPrice * this.qtyValue;
    const w = 220;
    const x = GAME_WIDTH - w - 8;
    const y = 8;
    this.menuBg = this.add
      .rectangle(x, y, w, 84, 0x000000, 0.85)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffffff)
      .setScrollFactor(0)
      .setDepth(200);
    const verb = o.isBuy ? '구매' : '판매';
    const text = `${o.label}\n수량  ◀ ${this.qtyValue} ▶   (최대 ${o.max})\n${verb} 총액: ${total}코인\n[Enter] 확인   [Esc] 뒤로`;
    this.qtyText = this.add
      .text(x + 10, y + 8, text, {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#ffffff',
        lineSpacing: 4,
      })
      .setScrollFactor(0)
      .setDepth(201);
  }

  handleQtyKey(e) {
    const o = this.qtyOpts;
    switch (e.code) {
      case 'ArrowUp':
      case 'ArrowRight':
        if (this.qtyValue < o.max) {
          this.qtyValue += 1;
          this.renderQty();
        }
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        if (this.qtyValue > 1) {
          this.qtyValue -= 1;
          this.renderQty();
        }
        break;
      case 'Enter':
      case 'Space': {
        const qty = this.qtyValue;
        this.qtyMode = false;
        o.onConfirm(qty);
        break;
      }
      case 'Escape':
      case 'Backspace':
        this.qtyMode = false;
        o.back();
        break;
      default:
        break;
    }
  }

  closeFieldMenu() {
    this.destroyMenuGfx();
    this.menuOpen = false;
  }

  doSave() {
    const ok = saveGame({ x: this.tileX, y: this.tileY, mapId: this.mapId });
    this.showToast(ok ? '게임을 저장했다!' : '저장에 실패했다…');
  }

  showPartyFromMenu() {
    this.closeFieldMenu();
    this.togglePartyOverlay(); // 파티 오버레이 열기
  }

  askNewGame() {
    this.openConfirm('처음부터 시작할까요?\n(저장이 삭제됩니다)', () => {
      // 예
      deleteSave();
      resetGame();
      this.loadMap(START.mapId, START.x, START.y);
      this.closeConfirm();
      this.closeFieldMenu();
      this.showToast('새 게임을 시작했다.');
    });
  }

  // ── 확인창 (예/아니오) ───────────────────────────────────

  openConfirm(text, onYes, onNo) {
    this.confirmOpen = true;
    this.confirmYes = onYes;
    this.confirmNo = onNo || null;
    this.confirmCursor = 1; // 기본 '아니오'
    const w = 280;
    const h = 110;
    const x = GAME_WIDTH / 2;
    const y = GAME_HEIGHT / 2;
    this.confirmBg = this.add
      .rectangle(x, y, w, h, 0x000000, 0.9)
      .setStrokeStyle(2, 0xffffff)
      .setScrollFactor(0)
      .setDepth(210);
    this.confirmText = this.add
      .text(x, y - 24, text, {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(211);
    this.confirmOptions = ['예', '아니오'];
    this.confirmTexts = this.confirmOptions.map((label, i) => {
      const t = this.add
        .text(x - 50 + i * 100, y + 28, label, {
          fontFamily: 'sans-serif',
          fontSize: '14px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(211)
        .setInteractive({ useHandCursor: true });
      t.on('pointerover', () => {
        this.confirmCursor = i;
        this.updateConfirmHighlight();
      });
      t.on('pointerdown', () => {
        this.confirmCursor = i;
        this.confirmSelect();
      });
      return t;
    });
    this.updateConfirmHighlight();
  }

  updateConfirmHighlight() {
    this.confirmTexts.forEach((t, i) => {
      const sel = i === this.confirmCursor;
      t.setColor(sel ? '#ffff66' : '#ffffff');
      t.setText((sel ? '▶' : '') + this.confirmOptions[i]);
    });
  }

  handleConfirmKey(e) {
    switch (e.code) {
      case 'ArrowLeft':
      case 'ArrowRight':
        this.confirmCursor = this.confirmCursor === 0 ? 1 : 0;
        this.updateConfirmHighlight();
        break;
      case 'Enter':
      case 'Space':
        this.confirmSelect();
        break;
      case 'Escape':
      case 'Backspace':
        this.closeConfirm(); // 취소 = 아니오
        break;
      default:
        break;
    }
  }

  confirmSelect() {
    if (this.confirmCursor === 0) {
      if (this.confirmYes) this.confirmYes(); // 예 → 콜백(내부에서 closeConfirm)
    } else if (this.confirmNo) {
      this.confirmNo(); // 아니오 → 콜백(내부에서 closeConfirm)
    } else {
      this.closeConfirm();
    }
  }

  closeConfirm() {
    if (this.confirmBg) this.confirmBg.destroy();
    if (this.confirmText) this.confirmText.destroy();
    if (this.confirmTexts) this.confirmTexts.forEach((t) => t.destroy());
    this.confirmBg = this.confirmText = this.confirmTexts = null;
    this.confirmOpen = false;
  }

  // ── 토스트 (잠깐 뜨는 안내 메시지) ──
  showToast(text) {
    if (this.toast) this.toast.destroy();
    this.toast = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 26, text, {
        fontFamily: 'sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#000000cc',
        padding: { x: 10, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(220);
    this.time.delayedCall(1500, () => {
      if (this.toast) {
        this.toast.destroy();
        this.toast = null;
      }
    });
  }

  // ── 보관함 PC (20단계): 파티 ↔ 보관함 입출고 ──────────────
  openBox() {
    this.boxOpen = true;
    this.boxSide = playerState.party.length ? 'party' : 'box'; // 활성 컬럼
    this.boxPartyCursor = 0;
    this.boxBoxCursor = 0;
    this.boxScroll = 0; // 보관함 목록 윈도우 시작 인덱스
    this.boxActionItems = null; // 동작 메뉴(열려 있으면 배열)
    this.boxActionCursor = 0;
    this.boxSummaryOpen = false;
    this.renderBox();
  }

  closeBox() {
    this.destroyBoxGfx();
    if (this.boxMsgObj) {
      this.boxMsgObj.destroy();
      this.boxMsgObj = null;
    }
    this.boxOpen = false;
  }

  destroyBoxGfx() {
    if (this.boxGfx) this.boxGfx.forEach((o) => o.destroy());
    this.boxGfx = [];
  }

  // 현재 선택된 몬스터(활성 컬럼 + 커서)
  currentBoxMon() {
    const list = this.boxSide === 'party' ? playerState.party : playerState.box;
    const cursor = this.boxSide === 'party' ? this.boxPartyCursor : this.boxBoxCursor;
    return list[cursor] || null;
  }

  monRowLabel(mon) {
    const fainted = mon.hp <= 0 ? ' 기절' : '';
    return `${mon.name} Lv${mon.level} ${mon.hp}/${mon.maxHp}${fainted}`;
  }

  renderBox() {
    this.destroyBoxGfx();
    const add = (x, y, text, color = '#ffffff', size = 12, depth = 231) => {
      const t = this.add
        .text(x, y, text, { fontFamily: 'sans-serif', fontSize: `${size}px`, color })
        .setScrollFactor(0)
        .setDepth(depth);
      this.boxGfx.push(t);
      return t;
    };
    // 배경 패널 + 구분선
    const bg = this.add
      .rectangle(8, 6, GAME_WIDTH - 16, GAME_HEIGHT - 12, 0x10141c, 0.97)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffffff)
      .setScrollFactor(0)
      .setDepth(230);
    this.boxGfx.push(bg);
    const div = this.add
      .rectangle(GAME_WIDTH / 2, 46, 2, GAME_HEIGHT - 92, 0x445566)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(231);
    this.boxGfx.push(div);
    // 제목 + 컬럼 헤더
    add(GAME_WIDTH / 2 - 42, 14, '보관함 PC', '#80d8ff', 16, 231);
    add(20, 32, `파티 (${playerState.party.length}/${MAX_PARTY})`,
      this.boxSide === 'party' ? '#ffff66' : '#aaccee', 13, 231);
    add(248, 32, `보관함 (${playerState.box.length})`,
      this.boxSide === 'box' ? '#ffff66' : '#aaccee', 13, 231);

    // 두 컬럼(파티 6칸 고정 / 보관함 6칸 윈도우)
    this.drawBoxColumn('party', playerState.party, this.boxPartyCursor, 18, 0, MAX_PARTY, add);
    this.drawBoxColumn('box', playerState.box, this.boxBoxCursor, 246, this.boxScroll, 6, add);
    // 보관함 스크롤 표시
    if (this.boxScroll > 0) add(452, 52, '▲', '#cccccc', 12, 231);
    if (this.boxScroll + 6 < playerState.box.length) add(452, 184, '▼', '#cccccc', 12, 231);

    add(16, GAME_HEIGHT - 26, '←→ 목록전환   ↑↓ 선택   Enter 결정   Esc 닫기', '#99aabb', 11, 231);

    if (this.boxActionItems) this.renderBoxAction();
    if (this.boxSummaryOpen) this.renderBoxSummary();
  }

  drawBoxColumn(side, list, cursor, x0, scroll, count, add) {
    for (let r = 0; r < count; r++) {
      const idx = scroll + r;
      const mon = list[idx];
      const y = 52 + r * 26;
      const isSel = side === this.boxSide && idx === cursor && !!mon;
      let color = '#666666';
      let label = '— 빈 자리 —';
      if (mon) {
        label = this.monRowLabel(mon);
        color = isSel ? '#ffff66' : '#ffffff';
      }
      const t = add(x0, y, (isSel ? '▶ ' : '   ') + label, color, 12, 231);
      if (mon) {
        t.setInteractive({ useHandCursor: true });
        t.on('pointerdown', () => {
          this.boxSide = side;
          if (side === 'party') this.boxPartyCursor = idx;
          else {
            this.boxBoxCursor = idx;
            this.clampBoxScroll();
          }
          this.openBoxAction();
        });
      }
    }
  }

  renderBoxAction() {
    const w = 190;
    const h = 26 * this.boxActionItems.length + 16;
    const x = GAME_WIDTH / 2 - w / 2;
    const y = 84;
    const bg = this.add
      .rectangle(x, y, w, h, 0x000000, 0.92)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0xffffff)
      .setScrollFactor(0)
      .setDepth(240);
    this.boxGfx.push(bg);
    this.boxActionItems.forEach((it, i) => {
      const sel = i === this.boxActionCursor;
      const t = this.add
        .text(x + 14, y + 8 + i * 26, (sel ? '▶ ' : '   ') + it.label, {
          fontFamily: 'sans-serif',
          fontSize: '13px',
          color: sel ? '#ffff66' : '#ffffff',
        })
        .setScrollFactor(0)
        .setDepth(241)
        .setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        this.boxActionCursor = i;
        it.action();
      });
      this.boxGfx.push(t);
    });
  }

  renderBoxSummary() {
    const mon = this.currentBoxMon();
    if (!mon) {
      this.boxSummaryOpen = false;
      return;
    }
    const w = 300;
    const h = 234;
    const x = GAME_WIDTH / 2 - w / 2;
    const y = 42;
    const bg = this.add
      .rectangle(x, y, w, h, 0x0a0e16, 0.98)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x80d8ff)
      .setScrollFactor(0)
      .setDepth(245);
    this.boxGfx.push(bg);
    const lines = [
      `${mon.name}    Lv${mon.level}`,
      `타입: ${(mon.types || []).join('/')}`,
      `HP: ${mon.hp}/${mon.maxHp}`,
      `공격 ${mon.atk}    방어 ${mon.def}`,
      `특공 ${mon.spAtk}    특방 ${mon.spDef}`,
      `스피드 ${mon.speed}`,
      '기술:',
      ...mon.moves.map((m) => ` - ${m.name} (PP ${m.pp}/${m.maxPp})`),
    ];
    const t = this.add
      .text(x + 16, y + 14, lines.join('\n'), {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#ffffff',
        lineSpacing: 4,
      })
      .setScrollFactor(0)
      .setDepth(246);
    this.boxGfx.push(t);
    const hint = this.add
      .text(x + w / 2, y + h - 16, '[Esc/Enter] 닫기', {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#99aabb',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(246)
      .setInteractive({ useHandCursor: true });
    hint.on('pointerdown', () => this.closeBoxSummary());
    this.boxGfx.push(hint);
  }

  // ── 보관함 입력 ──
  handleBoxKey(e) {
    if (this.boxSummaryOpen) {
      if (['Escape', 'Enter', 'Space', 'Backspace'].includes(e.code)) this.closeBoxSummary();
      return;
    }
    if (this.boxActionItems) {
      const n = this.boxActionItems.length;
      switch (e.code) {
        case 'ArrowUp':
          this.boxActionCursor = (this.boxActionCursor - 1 + n) % n;
          this.renderBox();
          break;
        case 'ArrowDown':
          this.boxActionCursor = (this.boxActionCursor + 1) % n;
          this.renderBox();
          break;
        case 'Enter':
        case 'Space':
          this.boxActionItems[this.boxActionCursor].action();
          break;
        case 'Escape':
        case 'Backspace':
          this.closeBoxAction();
          break;
        default:
          break;
      }
      return;
    }
    // 목록 탐색
    switch (e.code) {
      case 'ArrowLeft':
        this.boxSide = 'party';
        this.renderBox();
        break;
      case 'ArrowRight':
        this.boxSide = 'box';
        this.renderBox();
        break;
      case 'ArrowUp':
        this.moveBoxCursor(-1);
        break;
      case 'ArrowDown':
        this.moveBoxCursor(1);
        break;
      case 'Enter':
      case 'Space':
        this.openBoxAction();
        break;
      case 'Escape':
      case 'Backspace':
      case 'KeyM':
        this.closeBox();
        break;
      default:
        break;
    }
  }

  moveBoxCursor(d) {
    if (this.boxSide === 'party') {
      const n = playerState.party.length;
      if (n === 0) return;
      this.boxPartyCursor = (this.boxPartyCursor + d + n) % n;
    } else {
      const n = playerState.box.length;
      if (n === 0) return;
      this.boxBoxCursor = (this.boxBoxCursor + d + n) % n;
      this.clampBoxScroll();
    }
    this.renderBox();
  }

  clampBoxScroll() {
    const VIS = 6;
    if (this.boxBoxCursor < this.boxScroll) this.boxScroll = this.boxBoxCursor;
    else if (this.boxBoxCursor >= this.boxScroll + VIS) this.boxScroll = this.boxBoxCursor - VIS + 1;
    const maxScroll = Math.max(0, playerState.box.length - VIS);
    this.boxScroll = Math.min(Math.max(0, this.boxScroll), maxScroll);
  }

  openBoxAction() {
    if (!this.currentBoxMon()) return; // 빈 자리면 무시
    const moveLabel = this.boxSide === 'party' ? '보관함으로 이동' : '파티로 이동';
    this.boxActionItems = [
      { label: moveLabel, action: () => this.boxMove() },
      { label: '요약 보기', action: () => this.openBoxSummary() },
      { label: '취소', action: () => this.closeBoxAction() },
    ];
    this.boxActionCursor = 0;
    this.renderBox();
  }

  closeBoxAction() {
    this.boxActionItems = null;
    this.renderBox();
  }

  openBoxSummary() {
    this.boxSummaryOpen = true;
    this.renderBox();
  }

  closeBoxSummary() {
    this.boxSummaryOpen = false;
    this.renderBox();
  }

  // 선택한 몬스터를 반대편으로 이동(규칙 검사 포함)
  boxMove() {
    if (this.boxSide === 'party') {
      // 파티 → 보관함: 보낸 뒤에도 '기절 안 한' 몬스터가 1마리 이상 남아야 함
      const i = this.boxPartyCursor;
      const mon = playerState.party[i];
      if (!mon) return;
      const aliveCount = playerState.party.filter((m) => m.hp > 0).length;
      const remainingAlive = aliveCount - (mon.hp > 0 ? 1 : 0);
      if (remainingAlive < 1) {
        this.boxToast('마지막 몬스터는 보관할 수 없어!');
        return;
      }
      playerState.party.splice(i, 1);
      playerState.box.push(mon);
      if (this.boxPartyCursor >= playerState.party.length) {
        this.boxPartyCursor = Math.max(0, playerState.party.length - 1);
      }
    } else {
      // 보관함 → 파티: 파티가 가득 차지 않았을 때만
      if (playerState.party.length >= MAX_PARTY) {
        this.boxToast('파티가 가득 찼어!');
        return;
      }
      const i = this.boxBoxCursor;
      const mon = playerState.box[i];
      if (!mon) return;
      playerState.box.splice(i, 1);
      playerState.party.push(mon);
      if (this.boxBoxCursor >= playerState.box.length) {
        this.boxBoxCursor = Math.max(0, playerState.box.length - 1);
      }
      this.clampBoxScroll();
    }
    this.boxActionItems = null;
    this.boxSummaryOpen = false;
    this.renderBox();
    this.saveAuto(); // 박스 입출고 직후
  }

  boxToast(text) {
    if (this.boxMsgObj) this.boxMsgObj.destroy();
    this.boxMsgObj = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 46, text, {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#ffd54f',
        backgroundColor: '#000000cc',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(250);
    this.time.delayedCall(1400, () => {
      if (this.boxMsgObj) {
        this.boxMsgObj.destroy();
        this.boxMsgObj = null;
      }
    });
  }
}
