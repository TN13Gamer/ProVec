import { InputHandler } from './input.js';
import { Player } from './player.js';
import { updateEnemies, renderEnemies } from './enemy.js';
import { WaveManager, SURVIVAL_WAVES } from './waves.js';
import { resolveCombatCollisions } from './collision.js';
import { GameUI } from './ui.js';
import { EffectsManager } from './effects.js';

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

/**
 * Resolves an existing canvas or creates a 1280x720 canvas in the document.
 * @returns {HTMLCanvasElement}
 */
function setupCanvas() {
  let canvas = document.getElementById('gameCanvas') || document.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';
    document.body.appendChild(canvas);
  }
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

const canvas = setupCanvas();
const ctx = canvas.getContext('2d');
const input = new InputHandler(canvas);
const player = new Player(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
const bounds = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };

const waveManager = new WaveManager(bounds, SURVIVAL_WAVES);
const effects = new EffectsManager();

const gameState = {
  state: 'menu', // 'menu' | 'playing' | 'gameover' | 'victory'
  score: 0,
  wave: 1,
  totalWaves: SURVIVAL_WAVES.length,
  isGameOver: false,
  isVictory: false,
  player,
  enemies: [],
  bullets: player.bullets,
  waveManager,
};

let lastTime = 0;
let animationFrameId = null;

/**
 * Starts a fresh mission from the main menu or restarts during/after a run.
 */
export function startGame() {
  restart();
}

/**
 * Resets the core game state to its initial playing values.
 */
export function restart() {
  player.reset(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  gameState.enemies.length = 0;
  gameState.bullets = player.bullets;
  waveManager.reset();
  effects.reset();

  gameState.state = 'playing';
  gameState.score = 0;
  gameState.wave = waveManager.getCurrentWaveNumber();
  gameState.totalWaves = waveManager.waves.length;
  gameState.isGameOver = false;
  gameState.isVictory = false;
  lastTime = performance.now();
}

const ui = new GameUI(canvas, {
  onStart: startGame,
  onRestart: restart,
});

/**
 * @param {number} dt
 */
function update(dt) {
  ui.update(dt);
  effects.update(dt);

  if (gameState.state === 'menu') {
    if (input.wasKeyPressed('Enter') || input.wasKeyPressed('Space')) {
      startGame();
    }
    input.endFrame();
    return;
  }

  if (input.wasKeyPressed('KeyR')) {
    restart();
    input.endFrame();
    return;
  }

  if (gameState.state !== 'playing') {
    input.endFrame();
    return;
  }

  const prevBulletCount = player.bullets.length;
  const prevPlayerHealth = player.health;

  player.update(dt, input, bounds);

  if (player.bullets.length > prevBulletCount) {
    const barrelOffset = player.radius + 10;
    const muzzleX = player.x + Math.cos(player.angle) * barrelOffset;
    const muzzleY = player.y + Math.sin(player.angle) * barrelOffset;
    effects.spawnMuzzleFlash(muzzleX, muzzleY, player.angle);
  }

  waveManager.update(dt, gameState.enemies);
  gameState.wave = waveManager.getCurrentWaveNumber();

  updateEnemies(gameState.enemies, dt, player);

  // Snapshot enemy health before combat resolution to trigger hit/kill effects and score
  const enemySnapshots = gameState.enemies.map((enemy) => ({
    enemy,
    prevHealth: enemy.health,
  }));

  resolveCombatCollisions(gameState);

  for (const snap of enemySnapshots) {
    const { enemy, prevHealth } = snap;
    if (enemy.isDead) {
      const isBrute = enemy.type === 'brute';
      effects.spawnExplosion(enemy.x, enemy.y, {
        color: enemy.color,
        count: isBrute ? 30 : 20,
        radius: isBrute ? 68 : 48,
        shake: isBrute ? 7 : 4,
      });
      gameState.score += isBrute ? 250 : 100;
    } else if (enemy.health < prevHealth) {
      effects.spawnHit(enemy.x, enemy.y, { color: '#fde047' });
    }
  }

  if (player.health < prevPlayerHealth) {
    effects.triggerDamageFlash(0.4);
    effects.triggerScreenShake(6, 0.22);
  }

  if (player.isDead) {
    gameState.state = 'gameover';
    gameState.isGameOver = true;
    effects.spawnExplosion(player.x, player.y, {
      color: '#ef4444',
      secondaryColor: '#fde047',
      count: 36,
      radius: 80,
      shake: 10,
    });
  } else if (waveManager.isComplete && gameState.enemies.length === 0) {
    gameState.state = 'victory';
    gameState.isVictory = true;
  }

  input.endFrame();
}

function render() {
  ui.renderBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);

  if (gameState.state !== 'menu') {
    effects.beginShake(ctx);
    renderEnemies(gameState.enemies, ctx);
    player.render(ctx);
    effects.render(ctx);
    effects.endShake(ctx);

    effects.renderScreenOverlay(ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  ui.render(ctx, gameState, CANVAS_WIDTH, CANVAS_HEIGHT);
}

/**
 * @param {number} timestamp
 */
function gameLoop(timestamp) {
  if (lastTime === 0) {
    lastTime = timestamp;
  }

  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  update(dt);
  render();

  animationFrameId = requestAnimationFrame(gameLoop);
}

export function start() {
  if (animationFrameId === null) {
    lastTime = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

export { canvas, input, player, gameState, ui, effects };

start();
