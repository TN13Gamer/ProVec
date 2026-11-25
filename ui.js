/**
 * UI and visual presentation for LAST STAND.
 * Renders the dark sci-fi arena background, HUD (health, score, wave),
 * Main Menu, Game Over, Victory screens, and interactive buttons.
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
  gridMajor: 'rgba(56, 189, 248, 0.14)',
  accent: '#38bdf8',
  accentBright: '#7dd3fc',
  panelBg: 'rgba(15, 23, 42, 0.82)',
  panelBorder: 'rgba(56, 189, 248, 0.35)',
  textPrimary: '#f8fafc',
  textMuted: '#94a3b8',
  healthHigh: '#22c55e',
  healthMid: '#eab308',
  healthLow: '#ef4444',
  danger: '#ef4444',
  victory: '#22c55e',
};

/**
 * Draws a rounded rectangle path.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Checks whether a point (px, py) lies inside a rect.
 * @param {number} px
 * @param {number} py
 * @param {{ x: number, y: number, width: number, height: number } | null} rect
 * @returns {boolean}
 */
function isPointInRect(px, py, rect) {
  if (!rect) return false;
  return (
    px >= rect.x &&
    px <= rect.x + rect.width &&
    py >= rect.y &&
    py <= rect.y + rect.height
  );
}

/**
 * Renders the dark sci-fi arena background with tactical grid, center reticle, and perimeter glow.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} [width=1280]
 * @param {number} [height=720]
 * @param {number} [time=0] - Elapsed time in seconds for subtle animations
 */
export function renderArenaBackground(ctx, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, time = 0) {
  ctx.save();

  const cx = width / 2;
  const cy = height / 2;

  if (mapImageLoaded && mapImage && mapImage.naturalWidth > 0) {
    // Cover-fit the map texture onto the 1280x720 arena
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

    // Subtle dark tint so entities, bullets, and HUD stay high-contrast
    ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
    ctx.fillRect(0, 0, width, height);
  } else {
    // Fallback procedural dark sci-fi grid while map loads
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

  // Arena perimeter frame & corner brackets
  const pad = 12;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

  const cornerLen = 24;
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Top-left
  ctx.moveTo(pad, pad + cornerLen);
  ctx.lineTo(pad, pad);
  ctx.lineTo(pad + cornerLen, pad);
  // Top-right
  ctx.moveTo(width - pad - cornerLen, pad);
  ctx.lineTo(width - pad, pad);
  ctx.lineTo(width - pad, pad + cornerLen);
  // Bottom-left
  ctx.moveTo(pad, height - pad - cornerLen);
  ctx.lineTo(pad, height - pad);
  ctx.lineTo(pad + cornerLen, height - pad);
  // Bottom-right
  ctx.moveTo(width - pad - cornerLen, height - pad);
  ctx.lineTo(width - pad, height - pad);
  ctx.lineTo(width - pad, height - pad - cornerLen);
  ctx.stroke();

  // Subtle edge vignette
  const vignette = ctx.createRadialGradient(
    cx,
    cy,
    Math.min(width, height) * 0.35,
    cx,
    cy,
    Math.hypot(cx, cy)
  );
  vignette.addColorStop(0, 'rgba(2, 6, 23, 0)');
  vignette.addColorStop(1, 'rgba(2, 6, 23, 0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.restore();
}

/**
 * Renders the in-game HUD: player health bar, wave indicator, and score display.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{
 *   player?: { health?: number, maxHealth?: number },
 *   score?: number,
 *   wave?: number,
 *   currentWave?: number,
 *   totalWaves?: number,
 *   waveManager?: { getCurrentWaveNumber?: () => number, waves?: Array<any> },
 *   enemies?: Array<any>
 * }} gameState
 * @param {number} [width=1280]
 * @param {number} [height=720]
 * @param {number} [time=0]
 */
export function renderHUD(ctx, gameState = {}, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, time = 0) {
  ctx.save();

  const player = gameState.player || {};
  const maxHealth = Math.max(1, player.maxHealth ?? 100);
  const health = Math.max(0, Math.min(maxHealth, player.health ?? maxHealth));
  const healthRatio = health / maxHealth;

  const score = Math.max(0, Math.floor(gameState.score ?? 0));
  const wave =
    gameState.wave ??
    gameState.currentWave ??
    gameState.waveManager?.getCurrentWaveNumber?.() ??
    1;
  const totalWaves = gameState.totalWaves ?? gameState.waveManager?.waves?.length ?? null;

  // --- 1. Player Health Bar (Top-Left) ---
  const hpPanelX = 24;
  const hpPanelY = 20;
  const hpPanelW = 264;
  const hpPanelH = 56;

  roundedRectPath(ctx, hpPanelX, hpPanelY, hpPanelW, hpPanelH, 8);
  ctx.fillStyle = COLORS.panelBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = healthRatio <= 0.25 ? 'rgba(239, 68, 68, 0.7)' : COLORS.panelBorder;
  ctx.stroke();

  ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('SHIELD INTEGRITY', hpPanelX + 14, hpPanelY + 9);

  ctx.font = '700 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.ceil(health)} / ${maxHealth}`, hpPanelX + hpPanelW - 14, hpPanelY + 8);

  // Health bar track
  const barX = hpPanelX + 14;
  const barY = hpPanelY + 30;
  const barW = hpPanelW - 28;
  const barH = 14;

  roundedRectPath(ctx, barX, barY, barW, barH, 4);
  ctx.fillStyle = '#0f172a';
  ctx.fill();

  // Health bar fill
  let barColor = COLORS.healthHigh;
  if (healthRatio <= 0.25) {
    const blink = 0.75 + Math.sin(time * 10) * 0.25;
    barColor = `rgba(239, 68, 68, ${blink})`;
  } else if (healthRatio <= 0.5) {
    barColor = COLORS.healthMid;
  }

  if (healthRatio > 0) {
    const fillW = Math.max(4, barW * healthRatio);
    roundedRectPath(ctx, barX, barY, fillW, barH, 4);
    ctx.fillStyle = barColor;
    ctx.fill();
  }

  // Sci-fi segment ticks
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.55)';
  ctx.lineWidth = 1.5;
  const segments = 4;
  for (let i = 1; i < segments; i++) {
    const sx = barX + (barW / segments) * i;
    ctx.beginPath();
    ctx.moveTo(sx, barY);
    ctx.lineTo(sx, barY + barH);
    ctx.stroke();
  }

  // --- 2. Wave Indicator (Top-Center) ---
  const wavePanelW = 190;
  const wavePanelH = 48;
  const wavePanelX = width / 2 - wavePanelW / 2;
  const wavePanelY = 20;

  roundedRectPath(ctx, wavePanelX, wavePanelY, wavePanelW, wavePanelH, 8);
  ctx.fillStyle = COLORS.panelBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.panelBorder;
  ctx.stroke();

  const waveLabel = totalWaves ? `WAVE ${wave} / ${totalWaves}` : `WAVE ${wave}`;
  ctx.font = '800 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.accentBright;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(waveLabel, width / 2, wavePanelY + wavePanelH / 2 + 1);

  // --- 3. Score Display (Top-Right) ---
  const scorePanelW = 200;
  const scorePanelH = 56;
  const scorePanelX = width - scorePanelW - 24;
  const scorePanelY = 20;

  roundedRectPath(ctx, scorePanelX, scorePanelY, scorePanelW, scorePanelH, 8);
  ctx.fillStyle = COLORS.panelBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.panelBorder;
  ctx.stroke();

  ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.textMuted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('SCORE', scorePanelX + scorePanelW - 14, scorePanelY + 9);

  ctx.font = '800 22px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(score.toLocaleString('en-US'), scorePanelX + scorePanelW - 14, scorePanelY + 25);

  // --- 4. Weapon & Mobility Abilities Bar (Bottom-Left) ---
  const weaponKey = player.weaponKey ?? 'primary';
  const isPrimary = weaponKey === 'primary';
  const slideCd = Math.max(0, player.slideCooldown ?? 0);
  const dodgeCd = Math.max(0, player.dodgeCooldown ?? 0);

  const loadX = 24;
  const loadY = height - 74;
  const loadW = 430;
  const loadH = 54;

  roundedRectPath(ctx, loadX, loadY, loadW, loadH, 8);
  ctx.fillStyle = COLORS.panelBg;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.panelBorder;
  ctx.stroke();

  // Primary slot [1]
  roundedRectPath(ctx, loadX + 10, loadY + 8, 114, 38, 6);
  ctx.fillStyle = isPrimary ? 'rgba(56, 189, 248, 0.22)' : 'rgba(15, 23, 42, 0.7)';
  ctx.fill();
  ctx.lineWidth = isPrimary ? 1.5 : 1;
  ctx.strokeStyle = isPrimary ? '#38bdf8' : 'rgba(148, 163, 184, 0.25)';
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = isPrimary ? '#7dd3fc' : '#64748b';
  ctx.fillText('[1] PRIMARY', loadX + 18, loadY + 13);
  ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = isPrimary ? '#f8fafc' : '#94a3b8';
  ctx.fillText('PULSE RIFLE', loadX + 18, loadY + 26);

  // Secondary slot [2]
  roundedRectPath(ctx, loadX + 132, loadY + 8, 128, 38, 6);
  ctx.fillStyle = !isPrimary ? 'rgba(249, 115, 22, 0.22)' : 'rgba(15, 23, 42, 0.7)';
  ctx.fill();
  ctx.lineWidth = !isPrimary ? 1.5 : 1;
  ctx.strokeStyle = !isPrimary ? '#f97316' : 'rgba(148, 163, 184, 0.25)';
  ctx.stroke();

  ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = !isPrimary ? '#fdba74' : '#64748b';
  ctx.fillText('[2] SECONDARY', loadX + 140, loadY + 13);
  ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = !isPrimary ? '#f8fafc' : '#94a3b8';
  ctx.fillText('SCATTER GUN', loadX + 140, loadY + 26);

  // Slide & Dodge indicators
  const abilities = [
    { label: 'SLIDE', key: 'SHIFT', cd: slideCd, x: loadX + 272, color: '#f59e0b' },
    { label: 'DODGE', key: 'E/RMB', cd: dodgeCd, x: loadX + 350, color: '#38bdf8' },
  ];
  for (const ab of abilities) {
    const ready = ab.cd <= 0.01;
    roundedRectPath(ctx, ab.x, loadY + 8, 70, 38, 6);
    ctx.fillStyle = ready ? 'rgba(30, 41, 59, 0.9)' : 'rgba(15, 23, 42, 0.6)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = ready ? ab.color : 'rgba(148, 163, 184, 0.2)';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = ready ? ab.color : '#64748b';
    ctx.fillText(ab.label, ab.x + 35, loadY + 13);
    ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = ready ? '#f8fafc' : '#94a3b8';
    ctx.fillText(ready ? ab.key : `${ab.cd.toFixed(1)}s`, ab.x + 35, loadY + 27);
  }

  ctx.restore();
}

/**
 * Draws a sci-fi styled interactive button and returns its bounding box.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, width: number, height: number, label: string, hovered?: boolean, accentColor?: string }} opts
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
function drawActionButton(ctx, opts) {
  const { x, y, width, height, label, hovered = false, accentColor = COLORS.accent } = opts;

  ctx.save();
  roundedRectPath(ctx, x, y, width, height, 8);
  ctx.fillStyle = hovered ? 'rgba(56, 189, 248, 0.22)' : 'rgba(15, 23, 42, 0.9)';
  ctx.fill();

  ctx.lineWidth = hovered ? 2.5 : 1.75;
  ctx.strokeStyle = hovered ? '#e0f2fe' : accentColor;
  ctx.stroke();

  if (hovered) {
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.font = '800 18px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = hovered ? '#ffffff' : accentColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + width / 2, y + height / 2 + 1);
  ctx.restore();

  return { x, y, width, height };
}

/**
 * Renders the Main Menu overlay.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} [width=1280]
 * @param {number} [height=720]
 * @param {{ hoveredButton?: string | null, time?: number }} [options]
 * @returns {{ startButton: { x: number, y: number, width: number, height: number } }}
 */
export function renderMainMenu(ctx, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, options = {}) {
  const cx = width / 2;
  const cy = height / 2;
  const hovered = options.hoveredButton === 'start';

  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.fillRect(0, 0, width, height);

  // Center card
  const cardW = 540;
  const cardH = 380;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COLORS.panelBorder;
  ctx.stroke();

  // Title
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(56, 189, 248, 0.55)';
  ctx.shadowBlur = 24;
  ctx.font = '900 58px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText('LAST STAND', cx, cardY + 76);
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.accentBright;
  ctx.fillText('TOP-DOWN SCI-FI SURVIVAL ARENA', cx, cardY + 118);

  // Divider
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 48, cardY + 148);
  ctx.lineTo(cardX + cardW - 48, cardY + 148);
  ctx.stroke();

  // Controls info
  ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText('WASD — Move   |   MOUSE / SPACE — Aim & Fire   |   1 / 2 / Q — Switch Gun', cx, cardY + 178);
  ctx.fillText('SHIFT — Tactical Slide   |   E / RIGHT CLICK — Dodge Roll', cx, cardY + 206);
  ctx.fillText('P / ESC — Pause   |   R — Quick Restart', cx, cardY + 234);

  // Start Button
  const btnW = 240;
  const btnH = 54;
  const startButton = drawActionButton(ctx, {
    x: cx - btnW / 2,
    y: cardY + 276,
    width: btnW,
    height: btnH,
    label: 'START MISSION',
    hovered,
    accentColor: COLORS.accent,
  });

  ctx.font = '500 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Click button or press ENTER to deploy', cx, cardY + 350);

  ctx.restore();
  return { startButton };
}

/**
 * Renders the Game Over overlay with score, wave reached, and Restart button.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ score?: number, wave?: number, currentWave?: number }} [gameState]
 * @param {number} [width=1280]
 * @param {number} [height=720]
 * @param {{ hoveredButton?: string | null }} [options]
 * @returns {{ restartButton: { x: number, y: number, width: number, height: number } }}
 */
export function renderGameOverScreen(
  ctx,
  gameState = {},
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  options = {}
) {
  const cx = width / 2;
  const cy = height / 2;
  const score = Math.max(0, Math.floor(gameState.score ?? 0));
  const wave = gameState.wave ?? gameState.currentWave ?? 1;
  const hovered = options.hoveredButton === 'restart';

  ctx.save();
  ctx.fillStyle = 'rgba(15, 6, 12, 0.82)';
  ctx.fillRect(0, 0, width, height);

  const cardW = 460;
  const cardH = 320;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.fill();
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(239, 68, 68, 0.55)';
  ctx.shadowBlur = 22;
  ctx.font = '900 48px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.danger;
  ctx.fillText('GAME OVER', cx, cardY + 68);
  ctx.shadowBlur = 0;

  ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText('DEFENSES OVERRUN', cx, cardY + 108);

  // Stats
  ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(`FINAL SCORE: ${score.toLocaleString('en-US')}`, cx, cardY + 158);
  ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText(`WAVE REACHED: ${wave}`, cx, cardY + 190);

  const btnW = 220;
  const btnH = 50;
  const restartButton = drawActionButton(ctx, {
    x: cx - btnW / 2,
    y: cardY + 228,
    width: btnW,
    height: btnH,
    label: 'RESTART',
    hovered,
    accentColor: COLORS.danger,
  });

  ctx.font = '500 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Click RESTART or press R to try again', cx, cardY + 296);

  ctx.restore();
  return { restartButton };
}

/**
 * Renders the Victory overlay with final score, waves cleared, and Restart button.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ score?: number, wave?: number, currentWave?: number, totalWaves?: number }} [gameState]
 * @param {number} [width=1280]
 * @param {number} [height=720]
 * @param {{ hoveredButton?: string | null }} [options]
 * @returns {{ restartButton: { x: number, y: number, width: number, height: number } }}
 */
export function renderVictoryScreen(
  ctx,
  gameState = {},
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  options = {}
) {
  const cx = width / 2;
  const cy = height / 2;
  const score = Math.max(0, Math.floor(gameState.score ?? 0));
  const wave = gameState.totalWaves ?? gameState.wave ?? gameState.currentWave ?? 2;
  const hovered = options.hoveredButton === 'restart';

  ctx.save();
  ctx.fillStyle = 'rgba(2, 16, 14, 0.8)';
  ctx.fillRect(0, 0, width, height);

  const cardW = 460;
  const cardH = 320;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.fill();
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.55)';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(34, 197, 94, 0.5)';
  ctx.shadowBlur = 22;
  ctx.font = '900 48px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.victory;
  ctx.fillText('VICTORY', cx, cardY + 68);
  ctx.shadowBlur = 0;

  ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.accentBright;
  ctx.fillText('ALL HOSTILE WAVES ELIMINATED', cx, cardY + 108);

  // Stats
  ctx.font = '700 20px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.textPrimary;
  ctx.fillText(`FINAL SCORE: ${score.toLocaleString('en-US')}`, cx, cardY + 158);
  ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.textMuted;
  ctx.fillText(`WAVES SURVIVED: ${wave}`, cx, cardY + 190);

  const btnW = 220;
  const btnH = 50;
  const restartButton = drawActionButton(ctx, {
    x: cx - btnW / 2,
    y: cardY + 228,
    width: btnW,
    height: btnH,
    label: 'PLAY AGAIN',
    hovered,
    accentColor: COLORS.victory,
  });

  ctx.font = '500 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Click PLAY AGAIN or press R to restart', cx, cardY + 296);

  ctx.restore();
  return { restartButton };
}

/**
 * Renders the Pause overlay with Resume and Restart buttons.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} [width=1280]
 * @param {number} [height=720]
 * @param {{ hoveredButton?: string | null }} [options]
 * @returns {{ resumeButton: { x: number, y: number, width: number, height: number }, restartButton: { x: number, y: number, width: number, height: number } }}
 */
export function renderPauseScreen(ctx, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, options = {}) {
  const cx = width / 2;
  const cy = height / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
  ctx.fillRect(0, 0, width, height);

  const cardW = 420;
  const cardH = 300;
  const cardX = cx - cardW / 2;
  const cardY = cy - cardH / 2;

  roundedRectPath(ctx, cardX, cardY, cardW, cardH, 14);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.fill();
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = COLORS.panelBorder;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 40px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = COLORS.accentBright;
  ctx.fillText('PAUSED', cx, cardY + 62);

  const btnW = 220;
  const btnH = 48;
  const resumeButton = drawActionButton(ctx, {
    x: cx - btnW / 2,
    y: cardY + 116,
    width: btnW,
    height: btnH,
    label: 'RESUME',
    hovered: options.hoveredButton === 'resume',
    accentColor: COLORS.accent,
  });

  const restartButton = drawActionButton(ctx, {
    x: cx - btnW / 2,
    y: cardY + 180,
    width: btnW,
    height: btnH,
    label: 'RESTART',
    hovered: options.hoveredButton === 'restart',
    accentColor: '#f59e0b',
  });

  ctx.font = '500 12px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Press P or ESC to resume', cx, cardY + 264);

  ctx.restore();
  return { resumeButton, restartButton };
}

/**
 * Stateful UI controller for LAST STAND.
 * Manages button hitboxes, pointer hover/click handling, and screen rendering.
 */
export class GameUI {
  /**
   * @param {HTMLCanvasElement | null} [canvas=null]
   * @param {{ onStart?: () => void, onRestart?: () => void, onResume?: () => void }} [callbacks]
   */
  constructor(canvas = null, callbacks = {}) {
    this.canvas = canvas;
    this.onStart = callbacks.onStart ?? null;
    this.onRestart = callbacks.onRestart ?? null;
    this.onResume = callbacks.onResume ?? null;

    this.time = 0;
    this.hoveredButton = null;
    this.currentState = 'menu';
    this.buttons = {
      start: null,
      restart: null,
      resume: null,
    };

    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onClick = this._handleClick.bind(this);

    if (this.canvas) {
      this.attachEvents(this.canvas);
    }
  }

  /**
   * Binds mousemove and click listeners to the target canvas.
   * @param {HTMLCanvasElement} canvas
   */
  attachEvents(canvas) {
    this.detachEvents();
    this.canvas = canvas;
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('click', this._onClick);
  }

  /**
   * Removes bound canvas listeners.
   */
  detachEvents() {
    if (!this.canvas) return;
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('click', this._onClick);
  }

  /**
   * @param {MouseEvent} event
   * @returns {{ x: number, y: number }}
   */
  _getCanvasCoords(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  /**
   * @param {MouseEvent} event
   */
  _handleMouseMove(event) {
    const { x, y } = this._getCanvasCoords(event);
    this.handlePointerMove(x, y);
  }

  /**
   * @param {MouseEvent} event
   */
  _handleClick(event) {
    const { x, y } = this._getCanvasCoords(event);
    this.handleClick(x, y);
  }

  /**
   * Updates hover state from canvas-space pointer coordinates.
   * @param {number} x
   * @param {number} y
   */
  handlePointerMove(x, y) {
    if (this.currentState === 'menu' && isPointInRect(x, y, this.buttons.start)) {
      this.hoveredButton = 'start';
    } else if (this.currentState === 'paused' && isPointInRect(x, y, this.buttons.resume)) {
      this.hoveredButton = 'resume';
    } else if (
      (this.currentState === 'paused' || this.currentState === 'gameover' || this.currentState === 'victory') &&
      isPointInRect(x, y, this.buttons.restart)
    ) {
      this.hoveredButton = 'restart';
    } else {
      this.hoveredButton = null;
    }

    if (this.canvas) {
      this.canvas.style.cursor = this.hoveredButton ? 'pointer' : 'crosshair';
    }
  }

  /**
   * Handles a click at canvas-space coordinates (x, y).
   * @param {number} x
   * @param {number} y
   * @returns {'start' | 'restart' | 'resume' | null}
   */
  handleClick(x, y) {
    if (this.currentState === 'menu' && isPointInRect(x, y, this.buttons.start)) {
      if (this.onStart) this.onStart();
      return 'start';
    }

    if (this.currentState === 'paused' && isPointInRect(x, y, this.buttons.resume)) {
      if (this.onResume) this.onResume();
      return 'resume';
    }

    if (
      (this.currentState === 'paused' || this.currentState === 'gameover' || this.currentState === 'victory') &&
      isPointInRect(x, y, this.buttons.restart)
    ) {
      if (this.onRestart) this.onRestart();
      return 'restart';
    }

    return null;
  }

  /**
   * Advances internal UI animation timer.
   * @param {number} dt
   */
  update(dt) {
    this.time += dt;
  }

  /**
   * Resolves normalized game state string ('menu' | 'playing' | 'gameover' | 'victory').
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
   * Renders the background layer.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} [width=1280]
   * @param {number} [height=720]
   */
  renderBackground(ctx, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
    renderArenaBackground(ctx, width, height, this.time);
  }

  /**
   * Renders HUD and active screen overlay based on gameState.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} gameState
   * @param {number} [width=1280]
   * @param {number} [height=720]
   */
  render(ctx, gameState = {}, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT) {
    const state = this._resolveState(gameState);
    this.currentState = state;
    this.buttons.start = null;
    this.buttons.restart = null;
    this.buttons.resume = null;

    if (state === 'menu') {
      const { startButton } = renderMainMenu(ctx, width, height, {
        hoveredButton: this.hoveredButton,
        time: this.time,
      });
      this.buttons.start = startButton;
      return;
    }

    renderHUD(ctx, gameState, width, height, this.time);

    if (state === 'paused') {
      const { resumeButton, restartButton } = renderPauseScreen(ctx, width, height, {
        hoveredButton: this.hoveredButton,
      });
      this.buttons.resume = resumeButton;
      this.buttons.restart = restartButton;
    } else if (state === 'gameover') {
      const { restartButton } = renderGameOverScreen(ctx, gameState, width, height, {
        hoveredButton: this.hoveredButton,
      });
      this.buttons.restart = restartButton;
    } else if (state === 'victory') {
      const { restartButton } = renderVictoryScreen(ctx, gameState, width, height, {
        hoveredButton: this.hoveredButton,
      });
      this.buttons.restart = restartButton;
    }
  }
}

export { GameUI as UI };
