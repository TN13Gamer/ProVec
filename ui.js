/**
 * UI and visual presentation for LAST STAND.
 * Renders the arena background on canvas and drives the external DOM HUD & menus
 * so the playable game screen stays completely uncluttered.
 */

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;

const mapImage = typeof Image !== 'undefined' ? new Image() : null;
let mapImageLoaded = false;
if (mapImage) {
  mapImage.onload = () => {
    mapImageLoaded = true;
  };
  mapImage.src = './assets/map.jpg';
}

const COLORS = {
  bgDeep: '#020617',
  bgCenter: '#0f172a',
  gridMinor: 'rgba(56, 189, 248, 0.06)',
};

/**
 * Renders the dark sci-fi arena background onto the canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} [width=1280]
 * @param {number} [height=720]
 * @param {number} [time=0]
 */
export function renderArenaBackground(ctx, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, time = 0) {
  ctx.save();

  const cx = width / 2;
  const cy = height / 2;

  if (mapImageLoaded && mapImage && mapImage.naturalWidth > 0) {
    const imgRatio = mapImage.naturalWidth / mapImage.naturalHeight;
    const canvasRatio = width / height;
    let drawW = width;
    let drawH = height;
    let drawX = 0;
    let drawY = 0;

    if (imgRatio > canvasRatio) {
      drawH = height;
      drawW = height * imgRatio;
      drawX = (width - drawW) / 2;
    } else {
      drawW = width;
      drawH = width / imgRatio;
      drawY = (height - drawH) / 2;
    }

    ctx.drawImage(mapImage, drawX, drawY, drawW, drawH);
    ctx.fillStyle = 'rgba(2, 6, 23, 0.24)';
    ctx.fillRect(0, 0, width, height);
  } else {
    const bgGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(width, height) * 0.72);
    bgGrad.addColorStop(0, COLORS.bgCenter);
    bgGrad.addColorStop(0.65, '#070d1d');
    bgGrad.addColorStop(1, COLORS.bgDeep);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const minorStep = 64;
    ctx.strokeStyle = COLORS.gridMinor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = minorStep; x < width; x += minorStep) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, height);
    }
    for (let y = minorStep; y < height; y += minorStep) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
    }
    ctx.stroke();
  }

  // Subtle edge vignette
  const vignette = ctx.createRadialGradient(
    cx,
    cy,
    Math.min(width, height) * 0.38,
    cx,
    cy,
    Math.hypot(cx, cy)
  );
  vignette.addColorStop(0, 'rgba(2, 6, 23, 0)');
  vignette.addColorStop(1, 'rgba(2, 6, 23, 0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

/**
 * External DOM-driven UI controller for LAST STAND.
 */
export class GameUI {
  /**
   * @param {HTMLCanvasElement | null} [canvas=null]
   * @param {{ onStart?: () => void, onRestart?: () => void, onResume?: () => void, onPause?: () => void }} [callbacks]
   */
  constructor(canvas = null, callbacks = {}) {
    this.canvas = canvas;
    this.onStart = callbacks.onStart ?? null;
    this.onRestart = callbacks.onRestart ?? null;
    this.onResume = callbacks.onResume ?? null;
    this.onPause = callbacks.onPause ?? null;

    this.time = 0;
    this.currentState = 'menu';
    this.popupTimer = 0;

    this.els = typeof document !== 'undefined'
      ? {
          hudHealthText: document.getElementById('hudHealthText'),
          hudHealthBar: document.getElementById('hudHealthBar'),
          hudRagePanel: document.getElementById('hudRagePanel'),
          hudRageText: document.getElementById('hudRageText'),
          hudRageBar: document.getElementById('hudRageBar'),
          hudWaveText: document.getElementById('hudWaveText'),
          hudWaveTimer: document.getElementById('hudWaveTimer'),
          hudScoreText: document.getElementById('hudScoreText'),
          btnPause: document.getElementById('btnPause'),
          bossBarWrap: document.getElementById('bossBarWrap'),
          bossHealthText: document.getElementById('bossHealthText'),
          bossHealthBar: document.getElementById('bossHealthBar'),
          lastStandBanner: document.getElementById('lastStandBanner'),
          lastStandTimer: document.getElementById('lastStandTimer'),
          centerPopup: document.getElementById('centerPopup'),
          centerPopupTitle: document.getElementById('centerPopupTitle'),
          centerPopupSub: document.getElementById('centerPopupSub'),
          cardPrimary: document.getElementById('cardPrimary'),
          cardSecondary: document.getElementById('cardSecondary'),
          ammoPrimary: document.getElementById('ammoPrimary'),
          ammoSecondary: document.getElementById('ammoSecondary'),
          cardDash: document.getElementById('cardDash'),
          valDash: document.getElementById('valDash'),
          cardGrenade: document.getElementById('cardGrenade'),
          valGrenade: document.getElementById('valGrenade'),
          cardFlash: document.getElementById('cardFlash'),
          valFlash: document.getElementById('valFlash'),
          menuOverlay: document.getElementById('menuOverlay'),
          menuCard: document.getElementById('menuCard'),
          menuTitle: document.getElementById('menuTitle'),
          menuSubtitle: document.getElementById('menuSubtitle'),
          menuStats: document.getElementById('menuStats'),
          menuFinalScore: document.getElementById('menuFinalScore'),
          menuWaveLabel: document.getElementById('menuWaveLabel'),
          menuFinalWave: document.getElementById('menuFinalWave'),
          menuControls: document.getElementById('menuControls'),
          btnStart: document.getElementById('btnStart'),
          btnResume: document.getElementById('btnResume'),
          btnRestart: document.getElementById('btnRestart'),
          menuHint: document.getElementById('menuHint'),
        }
      : {};

    this._bindButtons();
  }

  _bindButtons() {
    this.els.btnStart?.addEventListener('click', () => {
      this.onStart?.();
    });
    this.els.btnResume?.addEventListener('click', () => {
      this.onResume?.();
    });
    this.els.btnRestart?.addEventListener('click', () => {
      this.onRestart?.();
    });
    this.els.btnPause?.addEventListener('click', () => {
      if (this.currentState === 'playing') {
        this.onPause?.();
      } else if (this.currentState === 'paused') {
        this.onResume?.();
      }
    });
  }

  /**
   * Shows a centered tactical popup notification for duration seconds.
   * @param {string} title
   * @param {string} [subtitle='']
   * @param {number} [duration=2.4]
   * @param {'wave' | 'boss' | 'laststand'} [variant='wave']
   */
  showCenterPopup(title, subtitle = '', duration = 2.4, variant = 'wave') {
    if (!this.els.centerPopup) return;
    this.els.centerPopupTitle.textContent = title;
    this.els.centerPopupSub.textContent = subtitle;
    this.els.centerPopup.classList.remove('hidden', 'variant-boss', 'variant-laststand');
    if (variant === 'boss') {
      this.els.centerPopup.classList.add('variant-boss');
    } else if (variant === 'laststand') {
      this.els.centerPopup.classList.add('variant-laststand');
    }
    this.popupTimer = duration;
  }

  hideCenterPopup() {
    this.popupTimer = 0;
    this.els.centerPopup?.classList.add('hidden');
  }

  /**
   * @param {number} dt
   */
  update(dt) {
    this.time += dt;
    if (this.popupTimer > 0) {
      this.popupTimer = Math.max(0, this.popupTimer - dt);
      if (this.popupTimer === 0) {
        this.els.centerPopup?.classList.add('hidden');
      }
    }
  }

  /**
   * @param {object} gameState
   * @returns {string}
   */
  _resolveState(gameState) {
    if (gameState?.isVictory) return 'victory';
    if (gameState?.isGameOver || gameState?.player?.isDead) return 'gameover';
    const raw = (gameState?.state ?? gameState?.status ?? 'playing').toLowerCase();
    if (raw === 'game_over') return 'gameover';
    return raw;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} [width=1280]
   * @param {number} [height=720]
   */
  renderBackground(ctx, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
    renderArenaBackground(ctx, width, height, this.time);
  }

  /**
   * Updates external DOM HUD and Menu overlays from gameState.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} gameState
   */
  render(ctx, gameState = {}) {
    const state = this._resolveState(gameState);
    this.currentState = state;

    if (state !== 'playing') {
      this.hideCenterPopup();
    }

    this._updateHUD(gameState, state);
    this._updateMenuOverlay(gameState, state);
  }

  _updateHUD(gameState, state) {
    const player = gameState.player || {};
    const maxHealth = Math.max(1, player.maxHealth ?? 100);
    const health = Math.max(0, Math.min(maxHealth, player.health ?? maxHealth));
    const ratio = (health / maxHealth) * 100;

    if (this.els.hudHealthText) {
      this.els.hudHealthText.textContent = `${Math.ceil(health)} / ${maxHealth}`;
    }
    if (this.els.hudHealthBar) {
      this.els.hudHealthBar.style.width = `${ratio}%`;
      this.els.hudHealthBar.style.backgroundColor =
        ratio <= 25 ? '#ef4444' : ratio <= 50 ? '#eab308' : '#22c55e';
    }

    // Rage meter
    const maxRage = Math.max(1, player.maxRage ?? 100);
    const rage = Math.max(0, Math.min(maxRage, player.rage ?? 0));
    const ragePct = Math.round((rage / maxRage) * 100);
    const isRaging = Boolean(player.isRaging);
    if (this.els.hudRageBar) {
      this.els.hudRageBar.style.width = `${ragePct}%`;
    }
    if (this.els.hudRageText) {
      this.els.hudRageText.textContent = isRaging
        ? `ACTIVE ${player.rageTimer.toFixed(1)}s`
        : ragePct >= 100
        ? 'READY [Q]'
        : `${ragePct}%`;
    }
    this.els.hudRagePanel?.classList.toggle('rage-ready', !isRaging && ragePct >= 100);
    this.els.hudRagePanel?.classList.toggle('rage-active', isRaging);

    const wave =
      gameState.wave ??
      gameState.currentWave ??
      gameState.waveManager?.getCurrentWaveNumber?.() ??
      1;
    const totalWaves = gameState.totalWaves ?? gameState.waveManager?.waves?.length ?? 5;
    if (this.els.hudWaveText) {
      this.els.hudWaveText.textContent = `WAVE ${wave} / ${totalWaves}`;
    }

    const waveSec = Math.ceil(gameState.waveManager?.getWaveTimeRemaining?.() ?? 90);
    const mins = Math.floor(waveSec / 60);
    const secs = waveSec % 60;
    if (this.els.hudWaveTimer) {
      this.els.hudWaveTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      this.els.hudWaveTimer.classList.toggle('urgent', waveSec <= 15);
    }

    const score = Math.max(0, Math.floor(gameState.score ?? 0));
    if (this.els.hudScoreText) {
      this.els.hudScoreText.textContent = score.toLocaleString('en-US');
    }

    if (this.els.btnPause) {
      this.els.btnPause.disabled = state !== 'playing' && state !== 'paused';
      this.els.btnPause.textContent = state === 'paused' ? 'RESUME' : 'PAUSE';
    }

    // Boss bar
    const boss = Array.isArray(gameState.enemies)
      ? gameState.enemies.find((e) => e.type === 'boss' && !e.isDead)
      : null;
    if (this.els.bossBarWrap) {
      this.els.bossBarWrap.classList.toggle('hidden', !boss || state === 'menu');
      if (boss) {
        const bRatio = Math.max(0, Math.min(100, (boss.health / Math.max(1, boss.maxHealth)) * 100));
        if (this.els.bossHealthText) {
          this.els.bossHealthText.textContent = `${Math.ceil(boss.health)} / ${boss.maxHealth}`;
        }
        if (this.els.bossHealthBar) {
          this.els.bossHealthBar.style.width = `${bRatio}%`;
        }
      }
    }

    // LAST STAND critical cloak banner
    const lsTimer = player.lastStandTimer ?? 0;
    if (this.els.lastStandBanner) {
      const showLS = lsTimer > 0 && state === 'playing';
      this.els.lastStandBanner.classList.toggle('hidden', !showLS);
      if (showLS && this.els.lastStandTimer) {
        this.els.lastStandTimer.textContent = `INVISIBLE: ${lsTimer.toFixed(1)}s`;
      }
    }

    // Weapons & abilities
    const weaponKey = player.weaponKey ?? 'primary';
    const isPrimary = weaponKey === 'primary';
    const isReloading = (player.reloadTimer ?? 0) > 0;
    const ammoState = player.ammoState ?? {
      primary: { mag: 30, reserve: 120 },
      secondary: { mag: 6, reserve: 24 },
    };

    this.els.cardPrimary?.classList.toggle('active', isPrimary);
    this.els.cardSecondary?.classList.toggle('secondary-active', !isPrimary);

    if (this.els.ammoPrimary) {
      this.els.ammoPrimary.textContent =
        isPrimary && isReloading
          ? 'RELOADING...'
          : `${ammoState.primary.mag} / ${ammoState.primary.reserve}`;
    }
    if (this.els.ammoSecondary) {
      this.els.ammoSecondary.textContent =
        !isPrimary && isReloading
          ? 'RELOADING...'
          : `${ammoState.secondary.mag} / ${ammoState.secondary.reserve}`;
    }

    const dashCd = Math.max(0, player.dashCooldown ?? 0);
    if (this.els.valDash) {
      this.els.valDash.textContent = dashCd <= 0.01 ? 'SHIFT' : `${dashCd.toFixed(1)}s`;
    }
    this.els.cardDash?.classList.toggle('ready', dashCd <= 0.01);
    this.els.cardDash?.classList.toggle('depleted', dashCd > 0.01);

    const selectedAcc = player.selectedAccessory ?? 'grenade';
    const gCount = player.grenadeCount ?? 0;
    if (this.els.valGrenade) this.els.valGrenade.textContent = `x${gCount}`;
    this.els.cardGrenade?.classList.toggle('ready', gCount > 0);
    this.els.cardGrenade?.classList.toggle('depleted', gCount <= 0);
    this.els.cardGrenade?.classList.toggle('selected', selectedAcc === 'grenade');

    const fCount = player.flashbangCount ?? 0;
    if (this.els.valFlash) this.els.valFlash.textContent = `x${fCount}`;
    this.els.cardFlash?.classList.toggle('ready', fCount > 0);
    this.els.cardFlash?.classList.toggle('depleted', fCount <= 0);
    this.els.cardFlash?.classList.toggle('selected', selectedAcc === 'flashbang');
  }

  _updateMenuOverlay(gameState, state) {
    const overlay = this.els.menuOverlay;
    if (!overlay) return;

    if (state === 'playing') {
      overlay.classList.add('hidden');
      return;
    }

    overlay.classList.remove('hidden');
    this.els.menuCard?.classList.remove('theme-danger', 'theme-victory');

    const score = Math.max(0, Math.floor(gameState.score ?? 0)).toLocaleString('en-US');
    const wave = gameState.wave ?? gameState.currentWave ?? 1;
    const totalWaves = gameState.totalWaves ?? 5;

    if (state === 'menu') {
      this.els.menuTitle.textContent = 'LAST STAND';
      this.els.menuSubtitle.textContent = 'TOP-DOWN SCI-FI SURVIVAL ARENA';
      this.els.menuStats?.classList.add('hidden');
      this.els.menuControls?.classList.remove('hidden');
      this.els.btnStart?.classList.remove('hidden');
      this.els.btnResume?.classList.add('hidden');
      this.els.btnRestart?.classList.add('hidden');
      this.els.menuHint.textContent = 'Click START MISSION or press ENTER to deploy';
    } else if (state === 'paused') {
      this.els.menuTitle.textContent = 'PAUSED';
      this.els.menuSubtitle.textContent = 'MISSION SUSPENDED';
      this.els.menuStats?.classList.add('hidden');
      this.els.menuControls?.classList.remove('hidden');
      this.els.btnStart?.classList.add('hidden');
      this.els.btnResume?.classList.remove('hidden');
      this.els.btnRestart?.classList.remove('hidden');
      this.els.btnRestart.textContent = 'RESTART';
      this.els.menuHint.textContent = 'Press P or ESC to resume';
    } else if (state === 'gameover') {
      this.els.menuCard?.classList.add('theme-danger');
      this.els.menuTitle.textContent = 'GAME OVER';
      this.els.menuSubtitle.textContent = 'DEFENSES OVERRUN';
      this.els.menuStats?.classList.remove('hidden');
      this.els.menuFinalScore.textContent = score;
      this.els.menuWaveLabel.textContent = 'WAVE REACHED';
      this.els.menuFinalWave.textContent = `${wave} / ${totalWaves}`;
      this.els.menuControls?.classList.add('hidden');
      this.els.btnStart?.classList.add('hidden');
      this.els.btnResume?.classList.add('hidden');
      this.els.btnRestart?.classList.remove('hidden');
      this.els.btnRestart.textContent = 'RESTART';
      this.els.menuHint.textContent = 'Click RESTART or press R to try again';
    } else if (state === 'victory') {
      this.els.menuCard?.classList.add('theme-victory');
      this.els.menuTitle.textContent = 'VICTORY';
      this.els.menuSubtitle.textContent = 'ALL HOSTILE WAVES ELIMINATED';
      this.els.menuStats?.classList.remove('hidden');
      this.els.menuFinalScore.textContent = score;
      this.els.menuWaveLabel.textContent = 'WAVES SURVIVED';
      this.els.menuFinalWave.textContent = `${totalWaves} / ${totalWaves}`;
      this.els.menuControls?.classList.add('hidden');
      this.els.btnStart?.classList.add('hidden');
      this.els.btnResume?.classList.add('hidden');
      this.els.btnRestart?.classList.remove('hidden');
      this.els.btnRestart.textContent = 'PLAY AGAIN';
      this.els.menuHint.textContent = 'Click PLAY AGAIN or press R to restart';
    }
  }
}

export { GameUI as UI };
