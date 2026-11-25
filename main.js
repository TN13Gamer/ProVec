import { InputHandler } from './input.js';
import { Player } from './player.js';
import { updateEnemies, renderEnemies } from './enemy.js';
import { WaveManager, SURVIVAL_WAVES } from './waves.js';
import { resolveCombatCollisions, checkCircleCollision } from './collision.js';
import { GameUI } from './ui.js';
import { EffectsManager } from './effects.js';
import {
  spawnPickup,
  chooseRandomPickupType,
  updatePickups,
  renderPickups,
  PICKUP_TYPES,
} from './pickups.js';

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
  enemyBullets: [],
  pickups: [],
  bullets: player.bullets,
  waveManager,
};

let lastTime = 0;
let animationFrameId = null;
let supplyDropTimer = 8.5;

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
  gameState.enemyBullets.length = 0;
  gameState.pickups.length = 0;
  gameState.bullets = player.bullets;
  supplyDropTimer = 8.5;
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

export function resumeGame() {
  if (gameState.state === 'paused') {
    gameState.state = 'playing';
    lastTime = performance.now();
  }
}

export function pauseGame() {
  if (gameState.state === 'playing') {
    gameState.state = 'paused';
  }
}

const ui = new GameUI(canvas, {
  onStart: startGame,
  onRestart: restart,
  onResume: resumeGame,
  onPause: pauseGame,
});

/**
 * @param {number} dt
 */
function update(dt) {
  ui.update(dt);

  if (gameState.state === 'menu') {
    effects.update(dt);
    if (input.wasKeyPressed('Enter') || input.wasKeyPressed('Space')) {
      startGame();
    }
    input.endFrame();
    return;
  }

  if (input.wasKeyPressed('KeyP') || input.wasKeyPressed('Escape')) {
    if (gameState.state === 'playing') {
      gameState.state = 'paused';
      input.endFrame();
      return;
    } else if (gameState.state === 'paused') {
      resumeGame();
      input.endFrame();
      return;
    }
  }

  if ((gameState.state === 'gameover' || gameState.state === 'victory') && input.wasKeyPressed('KeyR')) {
    restart();
    input.endFrame();
    return;
  }

  if (gameState.state !== 'playing') {
    if (gameState.state !== 'paused') {
      effects.update(dt);
    }
    input.endFrame();
    return;
  }

  effects.update(dt);

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

  updateEnemies(gameState.enemies, dt, player, gameState.enemyBullets);
  updatePickups(gameState.pickups, dt);

  // Periodic arena supply drops
  supplyDropTimer -= dt;
  if (supplyDropTimer <= 0) {
    const px = 120 + Math.random() * (CANVAS_WIDTH - 240);
    const py = 120 + Math.random() * (CANVAS_HEIGHT - 240);
    spawnPickup(gameState.pickups, px, py, chooseRandomPickupType(player));
    supplyDropTimer = 8.5;
  }

  // Collect pickups on touch
  for (let i = gameState.pickups.length - 1; i >= 0; i--) {
    const p = gameState.pickups[i];
    if (checkCircleCollision(player, p)) {
      if (p.type === 'ammo') {
        player.addAmmo(30, 8);
      } else if (p.type === 'health') {
        player.heal(35);
      } else if (p.type === 'grenade') {
        player.grenadeCount += 1;
      } else if (p.type === 'flashbang') {
        player.flashbangCount += 1;
      }
      const color = PICKUP_TYPES[p.type]?.color ?? '#38bdf8';
      effects.spawnHit(p.x, p.y, { color, count: 10, radius: 24 });
      gameState.pickups.splice(i, 1);
    }
  }

  // Update Boss projectiles and check hits against player
  for (let i = gameState.enemyBullets.length - 1; i >= 0; i--) {
    const eb = gameState.enemyBullets[i];
    eb.x += eb.vx * dt;
    eb.y += eb.vy * dt;

    if (
      eb.x < -eb.radius ||
      eb.x > CANVAS_WIDTH + eb.radius ||
      eb.y < -eb.radius ||
      eb.y > CANVAS_HEIGHT + eb.radius
    ) {
      gameState.enemyBullets.splice(i, 1);
      continue;
    }

    if (!player.isDead && checkCircleCollision(eb, player)) {
      player.takeDamage(eb.damage);
      effects.spawnHit(eb.x, eb.y, { color: '#a855f7' });
      gameState.enemyBullets.splice(i, 1);
    }
  }

  // Handle Grenade & Flashbang detonations
  const detonations = player.consumeDetonations();
  for (const det of detonations) {
    if (det.type === 'grenade') {
      const blastRadius = 155;
      const blastDamage = 140;
      effects.spawnExplosion(det.x, det.y, {
        color: '#f97316',
        secondaryColor: '#fde047',
        radius: 140,
        count: 38,
        shake: 9,
      });

      for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const enemy = gameState.enemies[i];
        const dist = Math.hypot(enemy.x - det.x, enemy.y - det.y);
        if (dist <= blastRadius + enemy.radius) {
          enemy.takeDamage(blastDamage);
          if (enemy.isDead) {
            const pts = enemy.type === 'boss' ? 1500 : enemy.type === 'brute' ? 250 : 100;
            gameState.score += pts;
            effects.spawnExplosion(enemy.x, enemy.y, {
              color: enemy.color,
              count: enemy.type === 'boss' ? 45 : 22,
              radius: enemy.type === 'boss' ? 90 : 48,
              shake: enemy.type === 'boss' ? 10 : 4,
            });
            if (enemy.type !== 'runner' || Math.random() < 0.35) {
              spawnPickup(gameState.pickups, enemy.x, enemy.y, chooseRandomPickupType(player));
            }
            gameState.enemies.splice(i, 1);
          }
        }
      }
    } else if (det.type === 'flashbang') {
      const flashRadius = 220;
      effects.spawnExplosion(det.x, det.y, {
        color: '#e0f2fe',
        secondaryColor: '#ffffff',
        radius: 170,
        count: 26,
        shake: 4,
      });
      effects.triggerFlashOverlay(0.45);

      for (const enemy of gameState.enemies) {
        const dist = Math.hypot(enemy.x - det.x, enemy.y - det.y);
        if (dist <= flashRadius + enemy.radius) {
          enemy.applyStun(3.0);
        }
      }
    }
  }

  // Snapshot enemy health before combat resolution to trigger hit/kill effects and score
  const enemySnapshots = gameState.enemies.map((enemy) => ({
    enemy,
    prevHealth: enemy.health,
  }));

  resolveCombatCollisions(gameState);

  for (const snap of enemySnapshots) {
    const { enemy, prevHealth } = snap;
    if (enemy.isDead) {
      const isBoss = enemy.type === 'boss';
      const isBrute = enemy.type === 'brute';
      effects.spawnExplosion(enemy.x, enemy.y, {
        color: enemy.color,
        count: isBoss ? 48 : isBrute ? 30 : 20,
        radius: isBoss ? 100 : isBrute ? 68 : 48,
        shake: isBoss ? 12 : isBrute ? 7 : 4,
      });
      gameState.score += isBoss ? 1500 : isBrute ? 250 : 100;
      if (!isBoss && (isBrute || Math.random() < 0.32)) {
        spawnPickup(gameState.pickups, enemy.x, enemy.y, chooseRandomPickupType(player));
      }
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
    renderPickups(gameState.pickups, ctx);
    renderEnemies(gameState.enemies, ctx);

    // Boss plasma projectiles
    if (gameState.enemyBullets.length > 0) {
      ctx.save();
      for (const eb of gameState.enemyBullets) {
        ctx.beginPath();
        ctx.arc(eb.x, eb.y, eb.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#c084fc';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
      ctx.restore();
    }

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
