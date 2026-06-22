// ────────────────────────────────────────────────────────────
// BattleScene (4단계): 파티 시스템.
//  - 메인 메뉴: [싸운다][몬스터][가방(비활성)][도망친다]
//  - [몬스터]: 파티 목록에서 교체 (자발적 교체는 턴 소비 → 야생이 1회 공격)
//  - 활성 몬스터 기절 → 남으면 강제 교체(턴 소비 X), 없으면 전멸
//  - 내 몬스터는 playerState.party 의 실제 인스턴스를 사용 → HP/PP 가 배틀 후에도 유지
//  - 마우스 + 키보드(방향키/Enter·Space/Esc·Backspace) 공용 커서 메뉴
//  - 메시지: 클릭/아무 키로 진행(끝에 ▼)
// ────────────────────────────────────────────────────────────
import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, BATTLE_COLORS } from '../config.js';
import { calculateDamage, effectivenessMessage } from '../systems/damage.js';
import { playerState, getActiveMonster, hasUsableMonster, MAX_PARTY } from '../data/playerState.js';
import { calcCaptureChance, rollCapture } from '../systems/capture.js';
import { expForLevel, gainExp } from '../systems/growth.js';
import { getSpecies } from '../data/species.js';
import { getItem, useHealItem } from '../data/items.js';
import { createMonster, instantiateMove } from '../data/monsters.js';
import { josa } from '../utils/josa.js';
import { autoSave } from '../systems/saveLoad.js';

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  init(data) {
    this.isTrainer = !!data.trainer;
    if (this.isTrainer) {
      this.trainer = data.trainer;
      this.trainerTeam = data.trainer.team.map((t) => createMonster(t.speciesId, t.level));
      this.trainerIndex = 0;
      this.wildMon = this.trainerTeam[0]; // 현재 상대(트레이너의 첫 마리)
    } else {
      this.trainer = null;
      this.wildMon = data.wild;
    }
    this.playerMon = getActiveMonster(); // 파티의 실제 인스턴스
    this.mode = 'busy'; // 'busy' | 'message' | 'menu'
    this._resolveMessage = null;
    this.partyForced = false; // 기절 후 강제 교체 모드인지
    // 커서 메뉴 상태
    this.menuButtons = null;
    this.menuItems = null;
    this.menuCols = 1;
    this.menuCursor = 0;
    this.menuOnCancel = null;
    this.partyPanel = null;
  }

  create() {
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.buildBackground();
    this.buildMonsters();
    this.wildUI = this.buildInfoPanel(this.wildMon, 252, 18, 210, false);
    this.playerUI = this.buildInfoPanel(this.playerMon, 150, 150, 210, true);
    this.buildMessageBox();
    this.bindInput();
    this.runIntro();
  }

  async runIntro() {
    this.mode = 'busy';
    if (this.isTrainer) {
      await this.showMessage(`${josa(this.trainer.name, '이/가')} 승부를 걸어왔다!`);
      await this.showMessage(
        `${josa(this.trainer.name, '은/는')} ${josa(this.wildMon.name, '을/를')} 내보냈다!`
      );
    } else {
      await this.showMessage(`앗! 야생 ${josa(this.wildMon.name, '이/가')} 나타났다!`);
    }
    await this.showMessage(`가라, ${this.playerMon.name}!`);
    this.openMainMenu();
  }

  // 상대 호칭(야생이면 "야생 ○○", 트레이너면 그냥 이름)
  opponentLabel() {
    return this.isTrainer ? this.wildMon.name : `야생 ${this.wildMon.name}`;
  }

  // 상대 몬스터 교체 시 색네모/정보판 갱신
  refreshOpponentUI() {
    this.wildSprite.setFillStyle(this.wildMon.color);
    this.applyInfo(this.wildUI, this.wildMon);
  }

  // ── 화면 구성 ────────────────────────────────────────────

  buildBackground() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.7, BATTLE_COLORS.BG_TOP).setOrigin(0, 0);
    this.add
      .rectangle(0, GAME_HEIGHT * 0.7, GAME_WIDTH, GAME_HEIGHT * 0.3, BATTLE_COLORS.BG_BOTTOM)
      .setOrigin(0, 0);
  }

  buildMonsters() {
    this.wildSprite = this.add
      .rectangle(385, 105, 62, 62, this.wildMon.color)
      .setStrokeStyle(3, 0x000000);
    this.playerSprite = this.add
      .rectangle(95, 158, 68, 68, this.playerMon.color)
      .setStrokeStyle(3, 0x000000);
  }

  buildInfoPanel(mon, x, y, w, showExp = false) {
    const h = 46;
    this.add
      .rectangle(x, y, w, h, BATTLE_COLORS.PANEL)
      .setOrigin(0, 0)
      .setStrokeStyle(2, BATTLE_COLORS.PANEL_LINE);

    const nameText = this.add.text(x + 8, y + 5, '', {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: BATTLE_COLORS.TEXT,
    });

    const barX = x + 8;
    const barY = y + 31;
    const barW = w - 62;
    const barH = 8;
    this.add.rectangle(barX, barY, barW, barH, BATTLE_COLORS.HP_BG).setOrigin(0, 0.5);
    const hpBar = this.add
      .rectangle(barX, barY, barW, barH, BATTLE_COLORS.HP_HIGH)
      .setOrigin(0, 0.5);
    const hpText = this.add
      .text(barX + barW + 6, barY, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: BATTLE_COLORS.TEXT,
      })
      .setOrigin(0, 0.5);

    const ui = { nameText, hpBar, hpText, barW };

    // 내 몬스터에만 경험치바 (HP바 바로 아래 얇은 막대)
    if (showExp) {
      const ebY = barY + 10;
      this.add.rectangle(barX, ebY, barW, 3, 0x222244).setOrigin(0, 0.5);
      ui.expBar = this.add.rectangle(barX, ebY, barW, 3, 0x4488ff).setOrigin(0, 0.5);
      ui.expBarW = barW;
    }

    this.applyInfo(ui, mon);
    return ui;
  }

  // 현재 레벨 구간의 경험치 진행 비율(0~1)
  expRatio(mon) {
    const cur = expForLevel(mon.level);
    const next = expForLevel(mon.level + 1);
    if (next <= cur) return 1;
    return Phaser.Math.Clamp((mon.exp - cur) / (next - cur), 0, 1);
  }

  // 정보판 텍스트/HP바를 해당 몬스터 상태로 즉시 맞춤(교체 시 재사용)
  applyInfo(ui, mon) {
    ui.nameText.setText(`${mon.name}  Lv${mon.level}  ${mon.types.join('·')}`);
    const ratio = Phaser.Math.Clamp(mon.hp / mon.maxHp, 0, 1);
    ui.hpBar.width = ui.barW * ratio;
    ui.hpBar.setFillStyle(this.hpColor(ratio));
    ui.hpText.setText(`${mon.hp}/${mon.maxHp}`);
    if (ui.expBar) {
      ui.expBar.width = ui.expBarW * this.expRatio(mon);
    }
  }

  buildMessageBox() {
    this.add
      .rectangle(8, 226, GAME_WIDTH - 16, 86, BATTLE_COLORS.PANEL)
      .setOrigin(0, 0)
      .setStrokeStyle(2, BATTLE_COLORS.PANEL_LINE);
    this.msgText = this.add.text(22, 240, '', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: BATTLE_COLORS.TEXT,
      wordWrap: { width: 250 },
      lineSpacing: 4,
    });
    this.indicator = this.add
      .text(GAME_WIDTH - 26, 300, '▼', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: BATTLE_COLORS.TEXT,
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.tweens.add({ targets: this.indicator, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });
  }

  // ── 메시지 ───────────────────────────────────────────────

  setStaticMessage(text) {
    this.msgText.setText(text);
    this.indicator.setVisible(false);
  }

  showMessage(text) {
    return new Promise((resolve) => {
      this.msgText.setText(text);
      this.indicator.setVisible(true);
      this.mode = 'message';
      this._resolveMessage = resolve;
    });
  }

  onAdvanceInput() {
    if (this.mode !== 'message') return;
    this.indicator.setVisible(false);
    const resolve = this._resolveMessage;
    this._resolveMessage = null;
    this.mode = 'busy';
    if (resolve) resolve();
  }

  // ── 입력 (마우스 + 키보드) ───────────────────────────────

  bindInput() {
    this.input.keyboard.on('keydown', (e) => this.handleKey(e));
    this.input.on('pointerdown', () => {
      if (this.mode === 'message') this.onAdvanceInput();
    });
  }

  handleKey(e) {
    if (this.mode === 'message') {
      this.onAdvanceInput();
      return;
    }
    if (this.mode === 'menu') {
      switch (e.code) {
        case 'ArrowLeft':
          this.moveCursor(-1, 0);
          break;
        case 'ArrowRight':
          this.moveCursor(1, 0);
          break;
        case 'ArrowUp':
          this.moveCursor(0, -1);
          break;
        case 'ArrowDown':
          this.moveCursor(0, 1);
          break;
        case 'Enter':
        case 'Space':
          this.selectIndex(this.menuCursor);
          break;
        case 'Escape':
        case 'Backspace':
          if (this.menuOnCancel) this.menuOnCancel();
          break;
        default:
          break;
      }
    }
  }

  // ── 커서 메뉴 시스템 ─────────────────────────────────────

  // items: [{label, enabled, onSelect}], opts: {positions, cols, cursor, onCancel, btnW, btnH}
  openMenu(items, opts) {
    this.closeMenu();
    this.menuItems = items;
    this.menuCols = opts.cols || 1;
    this.menuCursor = opts.cursor || 0;
    this.menuOnCancel = opts.onCancel || null;
    this.mode = 'menu';
    this.menuButtons = items.map((item, i) =>
      this.makeMenuButton(opts.positions[i].x, opts.positions[i].y, item, i, opts)
    );
    this.refreshMenuHighlight();
  }

  closeMenu() {
    if (this.menuButtons) this.menuButtons.forEach((b) => b.destroy());
    this.menuButtons = null;
    this.menuItems = null;
  }

  makeMenuButton(x, y, item, index, opts) {
    const w = opts.btnW || 120;
    const h = opts.btnH || 30;
    const rect = this.add
      .rectangle(0, 0, w, h, BATTLE_COLORS.BTN)
      .setStrokeStyle(2, BATTLE_COLORS.BTN_LINE);
    const txt = this.add
      .text(0, 0, item.label, {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: BATTLE_COLORS.TEXT,
        align: 'center',
      })
      .setOrigin(0.5);
    const c = this.add.container(x, y, [rect, txt]);
    c.setSize(w, h);
    c.setDepth(60);
    c.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains
    );
    c.on('pointerover', () => {
      this.menuCursor = index;
      this.refreshMenuHighlight();
    });
    c.on('pointerdown', () => this.selectIndex(index));
    c._rect = rect;
    c._txt = txt;
    c._item = item;
    return c;
  }

  refreshMenuHighlight() {
    if (!this.menuButtons) return;
    this.menuButtons.forEach((b, i) => {
      const item = b._item;
      if (!item.enabled) {
        b._rect.setFillStyle(0x2a2a2a);
        b._txt.setColor('#777777');
      } else if (i === this.menuCursor) {
        b._rect.setFillStyle(BATTLE_COLORS.BTN_HOVER);
        b._txt.setColor('#ffff66'); // 커서 강조
      } else {
        b._rect.setFillStyle(BATTLE_COLORS.BTN);
        b._txt.setColor('#ffffff');
      }
    });
  }

  moveCursor(dx, dy) {
    const n = this.menuItems.length;
    let c = this.menuCursor;
    if (dx) c = (c + dx + n) % n;
    if (dy) {
      const nc = c + dy * this.menuCols;
      if (nc >= 0 && nc < n) c = nc;
    }
    this.menuCursor = c;
    this.refreshMenuHighlight();
  }

  selectIndex(i) {
    const item = this.menuItems && this.menuItems[i];
    if (!item || !item.enabled) return;
    item.onSelect();
  }

  // ── 메뉴들 ───────────────────────────────────────────────

  openMainMenu() {
    this.partyForced = false;
    this.busy = false;
    this.setStaticMessage('어떻게 할까?');
    const items = [
      { label: '싸운다', enabled: true, onSelect: () => this.openMoveMenu() },
      { label: '몬스터', enabled: true, onSelect: () => this.openPartyMenu(false) },
      { label: '가방', enabled: true, onSelect: () => this.openBagMenu() },
      { label: '도망친다', enabled: true, onSelect: () => this.run() },
    ];
    this.openMenu(items, {
      positions: [
        { x: 325, y: 250 },
        { x: 420, y: 250 },
        { x: 325, y: 288 },
        { x: 420, y: 288 },
      ],
      cols: 2,
      btnW: 88,
      btnH: 30,
      cursor: 0,
      onCancel: null,
    });
  }

  openMoveMenu() {
    const moves = this.playerMon.moves;
    const items = moves.map((mv, i) => ({
      label: `${mv.name}\nPP ${mv.pp}/${mv.maxPp}`,
      enabled: mv.pp > 0,
      onSelect: () => this.onChooseMove(i),
    }));
    items.push({ label: '뒤로', enabled: true, onSelect: () => this.openMainMenu() });

    const positions = moves.map((_, i) => ({
      x: 110 + (i % 2) * 145,
      y: 248 + Math.floor(i / 2) * 38,
    }));
    positions.push({ x: 410, y: 286 }); // 뒤로

    this.setStaticMessage('기술을 고르세요.');
    this.openMenu(items, { positions, cols: 2, btnW: 135, btnH: 34, cursor: 0 });
  }

  onChooseMove(i) {
    const mv = this.playerMon.moves[i];
    if (!mv || mv.pp <= 0) return;
    this.closeMenu();
    this.resolveTurn(mv);
  }

  openPartyMenu(forced) {
    this.partyForced = forced;
    // 배경 패널
    this.partyPanel = this.add
      .rectangle(GAME_WIDTH / 2, 130, 340, 244, 0x202830, 0.98)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(55);
    this.partyTitle = this.add
      .text(GAME_WIDTH / 2, 24, '몬스터', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(56);

    const items = playerState.party.map((mon, i) => {
      const fainted = mon.hp <= 0;
      const isActive = mon === this.playerMon;
      const tag = fainted ? '  (기절)' : isActive ? '  (출전중)' : '';
      return {
        label: `${mon.name}  Lv${mon.level}  HP ${mon.hp}/${mon.maxHp}${tag}`,
        enabled: !fainted && !isActive,
        onSelect: () => this.doSwitch(i),
      };
    });
    if (!forced) {
      items.push({
        label: '뒤로',
        enabled: true,
        onSelect: () => {
          this.closePartyMenu();
          this.openMainMenu();
        },
      });
    }

    const positions = items.map((_, i) => ({ x: GAME_WIDTH / 2, y: 56 + i * 30 }));
    const firstSelectable = Math.max(0, items.findIndex((it) => it.enabled));

    this.setStaticMessage(forced ? '내보낼 몬스터를 고르세요.' : '몬스터를 고르세요.');
    this.openMenu(items, {
      positions,
      cols: 1,
      btnW: 300,
      btnH: 26,
      cursor: firstSelectable,
      onCancel: forced
        ? null // 강제 교체 중에는 취소 불가
        : () => {
            this.closePartyMenu();
            this.openMainMenu();
          },
    });
    this.menuButtons.forEach((b) => b.setDepth(57)); // 패널 위로
  }

  closePartyMenu() {
    if (this.partyPanel) {
      this.partyPanel.destroy();
      this.partyPanel = null;
    }
    if (this.partyTitle) {
      this.partyTitle.destroy();
      this.partyTitle = null;
    }
    this.closeMenu();
  }

  async doSwitch(index) {
    const newMon = playerState.party[index];
    if (!newMon || newMon.hp <= 0 || newMon === this.playerMon) return;
    const forced = this.partyForced;
    const oldMon = this.playerMon;
    this.closePartyMenu();
    this.mode = 'busy';

    // 자발적 교체는 돌아올 몬스터가 살아있으니 "돌아와!" 먼저, 강제 교체는 생략.
    if (!forced) {
      await this.showMessage(`돌아와, ${oldMon.name}!`);
    }
    this.playerMon = newMon;
    this.playerSprite.setFillStyle(newMon.color);
    this.applyInfo(this.playerUI, newMon);
    await this.showMessage(`가라, ${newMon.name}!`);

    if (forced) {
      this.openMainMenu(); // 기절 후 강제 교체 → 턴 소비 없음
    } else {
      await this.wildAttackOnly(); // 자발적 교체 → 야생이 1회 공격
    }
  }

  // ── 가방 / 포획 ─────────────────────────────────────────

  openBagMenu() {
    // 회복류 먼저, 볼류 나중 순으로 개수>0 아이템만
    const order = ['회복', '볼'];
    const ids = Object.keys(playerState.items)
      .filter((id) => (playerState.items[id] || 0) > 0)
      .sort((a, b) => order.indexOf(getItem(a).category) - order.indexOf(getItem(b).category));

    const items = ids.map((id) => ({
      label: `${getItem(id).name} x${playerState.items[id]}`,
      enabled: true,
      onSelect: () => this.useBattleItem(id),
    }));
    items.push({ label: '뒤로', enabled: true, onSelect: () => this.openMainMenu() });

    const startY = 240;
    const positions = items.map((_, i) => ({ x: 380, y: startY + i * 22 }));
    this.setStaticMessage('아이템을 고르세요.');
    this.openMenu(items, { positions, cols: 1, btnW: 180, btnH: 20, cursor: 0, onCancel: () => this.openMainMenu() });
  }

  async useBattleItem(id) {
    const item = getItem(id);
    this.closeMenu();

    if (item.category === '볼') {
      this.throwBall(); // 기존 포획 로직
      return;
    }

    // 회복 아이템
    this.mode = 'busy';
    const healed = useHealItem(this.playerMon, item);
    if (healed <= 0) {
      await this.showMessage('효과가 없었다!');
      this.openMainMenu();
      return;
    }
    playerState.items[id] -= 1;
    this.refreshHp('player');
    await this.showMessage(
      `${josa(item.name, '을/를')} 썼다! ${this.playerMon.name}의 HP를 ${healed} 회복했다!`
    );
    await this.wildAttackOnly(); // 회복도 턴 소비
  }

  async throwBall() {
    if (this.isTrainer) {
      this.mode = 'busy';
      await this.showMessage('트레이너의 몬스터에게는 쓸 수 없다!');
      this.openMainMenu();
      return;
    }
    const balls = playerState.items['몬스터볼'] || 0;
    if (balls <= 0) return;
    this.closeMenu();
    this.mode = 'busy';
    playerState.items['몬스터볼'] = balls - 1; // 개수 1 감소

    await this.showMessage('몬스터볼을 던졌다!');

    const p = calcCaptureChance(this.wildMon, 1.0);
    const success = rollCapture(p);
    const shakes = Phaser.Math.Between(2, 3);
    for (let i = 0; i < shakes; i++) {
      this.shakeWild();
      await this.showMessage('흔들…');
    }

    if (success) {
      await this.showMessage(`찰칵! 야생 ${josa(this.wildMon.name, '을/를')} 잡았다!`);
      if (playerState.party.length < MAX_PARTY) {
        playerState.party.push(this.wildMon); // 현재 상태(HP/PP/레벨) 그대로
      } else {
        playerState.box.push(this.wildMon);
        await this.showMessage('파티가 가득 차서 보관함으로 보냈다.');
      }
      autoSave(); // 포획 성공 직후
      this.endBattle({ defeated: false });
    } else {
      await this.showMessage(`앗! 몬스터볼에서 ${josa(this.wildMon.name, '이/가')} 튀어나왔다!`);
      await this.wildAttackOnly(); // 던지기는 턴 소비 → 야생이 1회 공격
    }
  }

  // ── 턴 처리 ─────────────────────────────────────────────

  pickWildMove() {
    const usable = this.wildMon.moves.filter((m) => m.pp > 0);
    const pool = usable.length > 0 ? usable : this.wildMon.moves;
    return Phaser.Utils.Array.GetRandom(pool);
  }

  decideOrder(playerMove, wildMove) {
    const p = { atk: this.playerMon, def: this.wildMon, move: playerMove, side: 'player' };
    const w = { atk: this.wildMon, def: this.playerMon, move: wildMove, side: 'wild' };
    if (this.playerMon.speed > this.wildMon.speed) return [p, w];
    if (this.playerMon.speed < this.wildMon.speed) return [w, p];
    return Math.random() < 0.5 ? [p, w] : [w, p];
  }

  isBattleOver() {
    return this.playerMon.hp <= 0 || this.wildMon.hp <= 0;
  }

  async resolveTurn(playerMove) {
    this.mode = 'busy';
    const wildMove = this.pickWildMove();
    const order = this.decideOrder(playerMove, wildMove);
    for (const action of order) {
      if (this.isBattleOver()) break;
      await this.performAction(action);
    }
    await this.checkFaintAndContinue();
  }

  // 교체 턴 소비: 야생만 1회 공격
  async wildAttackOnly() {
    const move = this.pickWildMove();
    await this.performAction({ atk: this.wildMon, def: this.playerMon, move, side: 'wild' });
    await this.checkFaintAndContinue();
  }

  async performAction(action) {
    const { atk, def, move, side } = action;
    if (atk.hp <= 0) return;

    if (move.pp > 0) move.pp -= 1;
    const userLabel = side === 'player' ? atk.name : this.opponentLabel();
    await this.showMessage(`${userLabel}의 ${move.name}!`);

    const result = calculateDamage(atk, def, move);
    if (!result.hit) {
      await this.showMessage('하지만 빗나갔다!');
      return;
    }

    def.hp = Math.max(0, def.hp - result.damage);
    this.refreshHp(side === 'player' ? 'wild' : 'player');

    if (result.multiplier === 0) {
      await this.showMessage('효과가 없는 것 같다…');
      return;
    }
    const eff = effectivenessMessage(result.multiplier);
    if (eff) await this.showMessage(eff);
  }

  async checkFaintAndContinue() {
    if (this.wildMon.hp <= 0) {
      await this.showMessage(`${josa(this.opponentLabel(), '을/를')} 쓰러뜨렸다!`);
      await this.awardExp();

      if (this.isTrainer) {
        // 트레이너: 다음 몬스터가 있으면 교체, 없으면 패배
        this.trainerIndex += 1;
        if (this.trainerIndex < this.trainerTeam.length) {
          this.wildMon = this.trainerTeam[this.trainerIndex];
          this.refreshOpponentUI();
          await this.showMessage(
            `${josa(this.trainer.name, '은/는')} ${josa(this.wildMon.name, '을/를')} 내보냈다!`
          );
          this.openMainMenu();
          return;
        }
        await this.trainerDefeated();
        return;
      }

      // 야생: 코인 + 종료
      await this.awardMoney();
      this.endBattle({ defeated: false });
      return;
    }
    if (this.playerMon.hp <= 0) {
      await this.showMessage(`${josa(this.playerMon.name, '은/는')} 쓰러졌다!`);
      if (hasUsableMonster()) {
        await this.showMessage('다음 몬스터를 내보내자.');
        this.openPartyMenu(true); // 강제 교체(턴 소비 없음)
      } else {
        await this.showMessage('눈앞이 깜깜해졌다...');
        this.endBattle({ defeated: true });
      }
      return;
    }
    this.openMainMenu();
  }

  // 야생을 쓰러뜨린 직후 출전 중인 내 몬스터에게 경험치 지급 + 레벨업/진화 연출
  async awardExp() {
    const wildSp = getSpecies(this.wildMon.speciesId);
    const amount = Math.floor((wildSp.baseExp * this.wildMon.level) / 5);
    const events = gainExp(this.playerMon, amount);
    for (const ev of events) {
      if (ev.type === 'exp') {
        await this.showMessage(`${josa(this.playerMon.name, '은/는')} ${ev.amount} 경험치를 얻었다!`);
        this.applyInfo(this.playerUI, this.playerMon);
      } else if (ev.type === 'levelup') {
        this.applyInfo(this.playerUI, this.playerMon);
        await this.showMessage(
          `${josa(this.playerMon.name, '은/는')} 레벨 ${josa(String(ev.level), '이/가')} 되었다!`
        );
      } else if (ev.type === 'learn') {
        // 4개 미만 → 이미 자동 습득됨. 메시지만.
        await this.showMessage(`${josa(this.playerMon.name, '은/는')} ${josa(ev.moveName, '을/를')} 배웠다!`);
      } else if (ev.type === 'learn-choice') {
        // 4개 꽉 참 → 잊을 기술 고르기
        await this.resolveLearnChoice(ev.moveId, ev.moveName);
      } else if (ev.type === 'evolve') {
        await this.showMessage(`어라…? ${ev.from}의 모습이…!`);
        this.playerSprite.setFillStyle(this.playerMon.color);
        this.applyInfo(this.playerUI, this.playerMon);
        await this.showMessage(`축하합니다! ${josa(ev.from, '은/는')} ${josa(ev.to, '으로/로')} 진화했다!`);
        autoSave(); // 진화 직후
      }
    }
  }

  // 기술 4개일 때 새 기술 습득: 잊을 기술 고르기 흐름.
  async resolveLearnChoice(moveId, moveName) {
    const name = this.playerMon.name;
    await this.showMessage(`${josa(name, '은/는')} ${josa(moveName, '을/를')} 배우고 싶어한다.`);
    await this.showMessage(`하지만 기술이 4개다. 잊을 기술을 고를까?`);
    const idx = await this.askForgetMove();
    if (idx < 0) {
      await this.showMessage(`${josa(name, '은/는')} ${josa(moveName, '을/를')} 배우기를 포기했다.`);
      return;
    }
    const oldName = this.playerMon.moves[idx].name;
    this.playerMon.moves[idx] = instantiateMove(moveId);
    await this.showMessage(
      `${josa(name, '은/는')} ${josa(oldName, '을/를')} 잊고 ${josa(moveName, '을/를')} 배웠다!`
    );
    autoSave(); // 기술 교체 직후
  }

  // 현재 보유 기술 4개 + [그만두기] 메뉴 → 고른 인덱스(0~3) 또는 -1(취소) 반환
  askForgetMove() {
    return new Promise((resolve) => {
      const moves = this.playerMon.moves;
      const done = (val) => {
        this.closeMenu();
        this.mode = 'busy';
        resolve(val);
      };
      const items = moves.map((mv, i) => ({
        label: `${mv.name}\nPP ${mv.pp}/${mv.maxPp}`,
        enabled: true,
        onSelect: () => done(i),
      }));
      items.push({ label: '그만두기', enabled: true, onSelect: () => done(-1) });
      const positions = moves.map((_, i) => ({
        x: 110 + (i % 2) * 145,
        y: 248 + Math.floor(i / 2) * 38,
      }));
      positions.push({ x: 410, y: 286 }); // 그만두기
      this.setStaticMessage('잊을 기술을 고르세요.');
      this.openMenu(items, {
        positions,
        cols: 2,
        btnW: 135,
        btnH: 34,
        cursor: 0,
        onCancel: () => done(-1),
      });
    });
  }

  // 야생 격파 보상 코인
  async awardMoney() {
    const coins = Math.floor(this.wildMon.level * 20);
    playerState.money += coins;
    await this.showMessage(`${coins}코인을 얻었다!`);
  }

  async trainerDefeated() {
    await this.showMessage(`${josa(this.trainer.name, '을/를')} 쓰러뜨렸다!`);
    playerState.money += this.trainer.prize;
    await this.showMessage(`${this.trainer.name}에게서 ${this.trainer.prize}코인을 받았다!`);
    if (this.trainer.badgeId && !playerState.badges.includes(this.trainer.badgeId)) {
      playerState.badges.push(this.trainer.badgeId);
      await this.showMessage(`${josa(this.trainer.badgeId, '을/를')} 손에 넣었다!`);
    }
    for (const line of this.trainer.afterText) {
      await this.showMessage(line);
    }
    if (!playerState.defeatedTrainers.includes(this.trainer.id)) {
      playerState.defeatedTrainers.push(this.trainer.id);
    }
    this.endBattle({ defeated: false });
  }

  async run() {
    this.closeMenu();
    this.mode = 'busy';
    if (this.isTrainer) {
      await this.showMessage('트레이너 전투에서는 도망칠 수 없다!');
      this.openMainMenu();
      return;
    }
    await this.showMessage('무사히 도망쳤다!');
    this.endBattle({ defeated: false });
  }

  // 포획 연출: 야생 색네모를 좌우로 살짝 흔든다 (에셋 없이 tween)
  shakeWild() {
    this.tweens.add({
      targets: this.wildSprite,
      x: 385 - 7,
      duration: 55,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.wildSprite.x = 385;
      },
    });
  }

  // ── HP바 ─────────────────────────────────────────────────

  hpColor(ratio) {
    return ratio >= 0.5
      ? BATTLE_COLORS.HP_HIGH
      : ratio >= 0.2
        ? BATTLE_COLORS.HP_MID
        : BATTLE_COLORS.HP_LOW;
  }

  refreshHp(side) {
    const ui = side === 'wild' ? this.wildUI : this.playerUI;
    const mon = side === 'wild' ? this.wildMon : this.playerMon;
    const ratio = Phaser.Math.Clamp(mon.hp / mon.maxHp, 0, 1);
    ui.hpBar.setFillStyle(this.hpColor(ratio));
    ui.hpText.setText(`${mon.hp}/${mon.maxHp}`);
    this.tweens.add({ targets: ui.hpBar, width: ui.barW * ratio, duration: 350, ease: 'Linear' });
  }

  // ── 종료 ─────────────────────────────────────────────────

  endBattle(result) {
    this.mode = 'busy';
    this.closeMenu();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.stop();
      this.scene.resume('WorldScene', result);
    });
  }
}
