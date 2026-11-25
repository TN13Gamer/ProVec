import { InputHandler } from './input.js';
import { Player } from './player.js';
import { updateEnemies, renderEnemies } from './enemy.js';
import { WaveManager, SURVIVAL_WAVES } from './waves.js';
import { resolveCombatCollisions, checkCircleCollision } from './collision.js';
import { GameUI } from './ui.js';
import { EffectsManager } from './effects.js';
import { SoundManager } from './sound.js';
import {
  spawnPickup,
  chooseRandomPickupType,
  updatePickups,
  renderPickups,
  PICKUP_TYPES,
} from './pickups.js';
import {
  createArenaObstacles,
  createObstacle,
  applyObstacleImpulse,
  resolveEntityObstacleCollision,
  updateObstacles,
  renderObstacles,
} from './obstacles.js';

function loadTransparentSprite(src, targetArr, idx) {
  const raw = new Image();
  raw.onload = () => {
    const off = document.createElement('canvas');
    off.width = raw.naturalWidth;
    off.height = raw.naturalHeight;
    const octx = off.getContext('2d');
    octx.drawImage(raw, 0, 0);
    const imgData = octx.getImageData(0, 0, off.width, off.height);
    const d = imgData.data;
    const bgR = d[0], bgG = d[1], bgB = d[2], bgA = d[3];
    if (bgA > 10) {
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - bgR) + Math.abs(d[i + 1] - bgG) + Math.abs(d[i + 2] - bgB) < 42) {
          d[i + 3] = 0;
        }
      }
      octx.putImageData(imgData, 0, 0);
    }
    targetArr[idx] = off;
  };
  raw.src = src;
}

const ENEMY_BULLET_FRAMES = [null, null];
const ENEMY_MISSILE_FRAMES = [null, null];
if (typeof Image !== 'undefined') {
  loadTransparentSprite('./assets/sprites/enemy_bullet_f1.png', ENEMY_BULLET_FRAMES, 0);
  loadTransparentSprite('./assets/sprites/enemy_bullet_f2.png', ENEMY_BULLET_FRAMES, 1);
  loadTransparentSprite('./assets/sprites/enemy_missile_f1.png', ENEMY_MISSILE_FRAMES, 0);
  loadTransparentSprite('./assets/sprites/enemy_missile_f2.png', ENEMY_MISSILE_FRAMES, 1);
}

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
const sound = new SoundManager();

const gameState = {
  state: 'menu', // 'menu' | 'playing' | 'paused' | 'gameover' | 'victory'
  difficulty: 'hard',
  score: 0,
  wave: 1,
  totalWaves: SURVIVAL_WAVES.length,
  isGameOver: false,
  isVictory: false,
  player,
  enemies: [],
  enemyBullets: [],
  pickups: [],
  obstacles: [],
  bullets: player.bullets,
  waveManager,
};

let lastTime = 0;
let animationFrameId = null;
let supplyDropTimer = 14.0;
let obstacleRespawnTimer = 15.0;
let lastAnnouncedWave = 0;
let lastStandAnnounced = false;
let wasRaging = false;

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
  sound.unlock();
  player.reset(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  gameState.enemies.length = 0;
  gameState.enemyBullets.length = 0;
  gameState.pickups.length = 0;
  gameState.obstacles = createArenaObstacles(bounds, 3 + Math.floor(Math.random() * 2), player);
  gameState.bullets = player.bullets;
  supplyDropTimer = 16.0;
  obstacleRespawnTimer = 15.0;
  waveManager.setDifficulty(gameState.difficulty);
  waveManager.reset();
  effects.reset();

  gameState.state = 'playing';
  gameState.score = 0;
  gameState.wave = waveManager.getCurrentWaveNumber();
  gameState.totalWaves = waveManager.waves.length;
  gameState.isGameOver = false;
  gameState.isVictory = false;
  lastAnnouncedWave = 1;
  lastStandAnnounced = false;
  wasRaging = false;
  ui.showCenterPopup('WAVE 1', 'ALIEN SWARM INBOUND — 01:30', 2.4, 'wave');
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
 * Handles destruction of a barrel (AoE explosion) or supply box (loot drop).
 * @param {object} obs
 */
function destroyObstacle(obs) {
  if (obs.isDestroyed) return;
  obs.isDestroyed = true;

  if (obs.type === 'barrel') {
    const blastRadius = 125;
    const blastDamage = 130;
    effects.spawnExplosion(obs.x, obs.y, {
      color: '#ef4444',
      secondaryColor: '#fde047',
      radius: 115,
      count: 34,
      shake: 9,
    });
    sound.playExplosion(1.1);

    // Damage enemies in blast radius
    for (let i = gameState.enemies.length - 1; i >= 0; i--) {
      const enemy = gameState.enemies[i];
      if (Math.hypot(enemy.x - obs.x, enemy.y - obs.y) <= blastRadius + enemy.radius) {
        enemy.takeDamage(blastDamage);
        if (enemy.isDead) {
          const pts =
            enemy.type === 'boss' ? 1500 : enemy.type === 'brute' ? 250 : enemy.type === 'spitter' ? 160 : 100;
          enemy.type === 'boss'
            ? 1500
            : enemy.type === 'brute'
              ? 250
              : enemy.type === 'missiler'
                ? 200
                : enemy.type === 'spitter'
                  ? 160
                  : enemy.type === 'stalker'
                    ? 140
                    : 100;
          gameState.score += pts;
          effects.spawnExplosion(enemy.x, enemy.y, { color: enemy.color, radius: 52, count: 20, shake: 4 });
          gameState.enemies.splice(i, 1);
        }
      }
    }

    // Damage player slightly if right next to barrel
    if (!player.isDead && Math.hypot(player.x - obs.x, player.y - obs.y) <= blastRadius * 0.75 + player.radius) {
      player.takeDamage(25);
    }

    // Chain-detonate nearby barrels / boxes
    for (const other of gameState.obstacles) {
      if (!other.isDestroyed && Math.hypot(other.x - obs.x, other.y - obs.y) <= blastRadius) {
        other.health -= 50;
        if (other.health <= 0) {
          destroyObstacle(other);
        }
      }
    }
  } else {
    // Supply box drops 1-2 collectables (Ammo, Health, Grenade, Flashbang)
    effects.spawnExplosion(obs.x, obs.y, {
      color: '#d97706',
      secondaryColor: '#fde68a',
      radius: 42,
      count: 14,
      shake: 2,
    });
    const dropCount = Math.random() < 0.45 ? 2 : 1;
    for (let i = 0; i < dropCount; i++) {
      const offsetX = (Math.random() - 0.5) * 26;
      const offsetY = (Math.random() - 0.5) * 26;
      spawnPickup(gameState.pickups, obs.x + offsetX, obs.y + offsetY, chooseRandomPickupType(player));
    }
  }
}

/**
 * @param {number} dt
 */
function update(dt) {
  ui.update(dt);

  if (gameState.state === 'menu') {
    effects.update(dt, bounds);
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
      effects.update(dt, bounds);
    }
    input.endFrame();
    return;
  }

  effects.update(dt, bounds);

  const prevBulletCount = player.bullets.length;
  const prevPlayerHealth = player.health;
  const prevReloading = player.reloadTimer > 0;
  const prevDashing = player.dashTimer > 0;

  player.update(dt, input, bounds);

  if (!prevReloading && player.reloadTimer > 0) {
    sound.playReload();
  }
  if (!prevDashing && player.dashTimer > 0) {
    sound.playDash();
  }

  if (player.bullets.length > prevBulletCount) {
    const barrelOffset = player.radius + 10;
    const muzzleX = player.x + Math.cos(player.angle) * barrelOffset;
    const muzzleY = player.y + Math.sin(player.angle) * barrelOffset;
    effects.spawnMuzzleFlash(muzzleX, muzzleY, player.angle);
    sound.playShoot(player.weaponKey, player.isRaging);
  }

  waveManager.update(dt, gameState.enemies);
  gameState.wave = waveManager.getCurrentWaveNumber();

  if (gameState.wave !== lastAnnouncedWave) {
    lastAnnouncedWave = gameState.wave;
    gameState.obstacles = createArenaObstacles(bounds, 3 + Math.floor(Math.random() * 2), player);
    if (gameState.wave === gameState.totalWaves) {
      ui.showCenterPopup(`WAVE ${gameState.wave}`, 'FINAL WAVE — BOSS OVERLORD INBOUND', 2.8, 'boss');
    } else {
      ui.showCenterPopup(`WAVE ${gameState.wave}`, 'HOSTILES INBOUND — 01:30', 2.4, 'wave');
    }
  }

  if (!lastStandAnnounced && player.lastStandTimer > 0) {
    lastStandAnnounced = true;
    sound.playLastStand();
    ui.showCenterPopup('LAST STAND', 'INVISIBLE FOR 5.0 SECONDS', 2.5, 'laststand');
  }

  if (player.isRaging && !wasRaging) {
    sound.playRage();
    ui.showCenterPopup('RAGE ACTIVATED', '2X DMG & RELOAD  |  1.5X SPEED  |  50% RES', 2.2, 'boss');
  }
  wasRaging = player.isRaging;

  updateEnemies(gameState.enemies, dt, player, gameState.enemyBullets);
  updateObstacles(gameState.obstacles, dt, bounds);
  updatePickups(gameState.pickups, dt);

  // Solid obstacle collisions for player & enemies
  resolveEntityObstacleCollision(player, gameState.obstacles, bounds);
  for (const enemy of gameState.enemies) {
    resolveEntityObstacleCollision(enemy, gameState.obstacles);
  }

  // Player bullets vs Incoming Missiles
  for (let i = player.bullets.length - 1; i >= 0; i--) {
    const b = player.bullets[i];
    let hitMissile = false;
    for (let j = gameState.enemyBullets.length - 1; j >= 0; j--) {
      const eb = gameState.enemyBullets[j];
      if (!eb.isMissile) continue;
      if (checkCircleCollision(b, eb)) {
        effects.spawnExplosion(eb.x, eb.y, {
          color: '#f97316',
          secondaryColor: '#fde047',
          radius: 38,
          count: 14,
          shake: 3,
        });
        gameState.score += 25;
        gameState.enemyBullets.splice(j, 1);
        hitMissile = true;
        break;
      }
    }
    if (hitMissile) {
      player.bullets.splice(i, 1);
    }
  }

  // Player & enemy bullets vs Obstacles (with grazing ricochet for Pulse Rifle)
  for (let i = player.bullets.length - 1; i >= 0; i--) {
    const b = player.bullets[i];
    for (const obs of gameState.obstacles) {
      if (obs.isDestroyed) continue;
      if (checkCircleCollision(b, obs)) {
        obs.health -= b.damage ?? 25;
        obs.hitFlash = 0.08;
        const bSpd = Math.hypot(b.vx, b.vy) || 1;
        applyObstacleImpulse(obs, (b.vx / bSpd) * 55, (b.vy / bSpd) * 55);
        effects.spawnHit(b.x, b.y, { color: obs.type === 'barrel' ? '#ef4444' : '#fbbf24' });

        if (obs.health <= 0) {
          destroyObstacle(obs);
          player.bullets.splice(i, 1);
        } else if ((b.bounces ?? 0) > 0) {
          // Check shallow grazing angle for ricochet
          const nx = (b.x - obs.x) / (Math.hypot(b.x - obs.x, b.y - obs.y) || 1);
          const ny = (b.y - obs.y) / (Math.hypot(b.x - obs.x, b.y - obs.y) || 1);
          const vDotN = (b.vx / bSpd) * nx + (b.vy / bSpd) * ny;
          if (Math.abs(vDotN) < 0.42) {
            const dot = b.vx * nx + b.vy * ny;
            b.vx = (b.vx - 2 * dot * nx) * 0.85;
            b.vy = (b.vy - 2 * dot * ny) * 0.85;
            b.x = obs.x + nx * (obs.radius + b.radius + 2);
            b.y = obs.y + ny * (obs.radius + b.radius + 2);
            b.bounces -= 1;
          } else {
            player.bullets.splice(i, 1);
          }
        } else {
          player.bullets.splice(i, 1);
        }
        break;
      }
    }
  }

  for (let i = gameState.enemyBullets.length - 1; i >= 0; i--) {
    const eb = gameState.enemyBullets[i];
    for (const obs of gameState.obstacles) {
      if (obs.isDestroyed) continue;
      if (checkCircleCollision(eb, obs)) {
        obs.health -= eb.damage ?? 12;
        obs.hitFlash = 0.08;
        effects.spawnHit(eb.x, eb.y, { color: eb.color ?? '#c084fc' });
        gameState.enemyBullets.splice(i, 1);
        if (obs.health <= 0) {
          destroyObstacle(obs);
        }
        break;
      }
    }
  }

  // Remove destroyed obstacles
  for (let i = gameState.obstacles.length - 1; i >= 0; i--) {
    if (gameState.obstacles[i].isDestroyed) {
      gameState.obstacles.splice(i, 1);
    }
  }

  // Periodically respawn a barrel or supply box (max 4)
  obstacleRespawnTimer -= dt;
  if (obstacleRespawnTimer <= 0 && gameState.obstacles.length < 4) {
    const ox = 110 + Math.random() * (CANVAS_WIDTH - 220);
    const oy = 110 + Math.random() * (CANVAS_HEIGHT - 220);
    if (Math.hypot(ox - player.x, oy - player.y) > 150) {
      gameState.obstacles.push(createObstacle(ox, oy, Math.random() < 0.5 ? 'barrel' : 'box'));
    }
    obstacleRespawnTimer = 18.0;
  }

  // Periodic arena supply drops
  supplyDropTimer -= dt;
  if (supplyDropTimer <= 0) {
    const px = 120 + Math.random() * (CANVAS_WIDTH - 240);
    const py = 120 + Math.random() * (CANVAS_HEIGHT - 240);
    spawnPickup(gameState.pickups, px, py, chooseRandomPickupType(player));
    supplyDropTimer = 16.0;
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
      sound.playPickup();
      gameState.pickups.splice(i, 1);
    }
  }

  // Update Boss projectiles and check hits against player
  // Update Enemy & Boss projectiles (including homing missiles) and check hits against player
  for (let i = gameState.enemyBullets.length - 1; i >= 0; i--) {
    const eb = gameState.enemyBullets[i];

    if (eb.isMissile) {
      eb.life -= dt;
      if (eb.life <= 0) {
        effects.spawnExplosion(eb.x, eb.y, { color: '#f97316', radius: 36, count: 12, shake: 2 });
        gameState.enemyBullets.splice(i, 1);
        continue;
      }

      if (!player.isDead && !player.isInvisible) {
        const currentAngle = Math.atan2(eb.vy, eb.vx);
        const targetAngle = Math.atan2(player.y - eb.y, player.x - eb.x);
        let diff = targetAngle - currentAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = 2.3 * dt;
        const newAngle = currentAngle + Math.max(-maxTurn, Math.min(maxTurn, diff));
        const spd = eb.speed ?? 240;
        eb.vx = Math.cos(newAngle) * spd;
        eb.vy = Math.sin(newAngle) * spd;
      }
    }

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
      const prevHp = player.health;
      player.takeDamage(eb.damage);
      if (player.health < prevHp) {
        player.applyKnockback(eb.x, eb.y, eb.isMissile ? 440 : 250);
      }
      if (eb.isMissile) {
        effects.spawnExplosion(eb.x, eb.y, { color: '#f97316', radius: 48, count: 18, shake: 5 });
      } else {
        effects.spawnHit(eb.x, eb.y, { color: eb.color ?? '#a855f7' });
      }
      gameState.enemyBullets.splice(i, 1);
    }
  }

  // Handle Grenade & Flashbang detonations
  const detonations = player.consumeDetonations();
  for (const det of detonations) {
    if (det.type === 'grenade') {
      const blastRadius = 85;
      const blastDamage = 140;
      sound.playExplosion(1.1);
      effects.spawnExplosion(det.x, det.y, {
        color: '#f97316',
        secondaryColor: '#fde047',
        radius: 80,
        count: 26,
        shake: 7,
      });

      for (const obs of gameState.obstacles) {
        const dx = obs.x - det.x;
        const dy = obs.y - det.y;
        const d = Math.hypot(dx, dy);
        if (!obs.isDestroyed && d <= blastRadius + obs.radius) {
          obs.health -= blastDamage;
          if (obs.health <= 0) {
            destroyObstacle(obs);
          } else if (d > 0.001) {
            applyObstacleImpulse(obs, (dx / d) * 320, (dy / d) * 320);
          }
        }
      }

      for (let i = gameState.enemies.length - 1; i >= 0; i--) {
        const enemy = gameState.enemies[i];
        const dist = Math.hypot(enemy.x - det.x, enemy.y - det.y);
        if (dist <= blastRadius + enemy.radius) {
          enemy.takeDamage(blastDamage);
          if (enemy.isDead) {
            const pts =
              enemy.type === 'boss'
                ? 1500
                : enemy.type === 'brute'
                  ? 250
                  : enemy.type === 'spitter'
                    ? 160
                    : 100;
            gameState.score += pts;
            effects.spawnExplosion(enemy.x, enemy.y, {
              color: enemy.color,
              count: enemy.type === 'boss' ? 45 : 22,
              radius: enemy.type === 'boss' ? 90 : 48,
              shake: enemy.type === 'boss' ? 10 : 4,
            });
            const dropChance =
              enemy.type === 'brute'
                ? 0.12
                : enemy.type === 'missiler'
                ? 0.08
                : enemy.type === 'spitter' || enemy.type === 'stalker'
                ? 0.06
                : 0.03;
            if (enemy.type !== 'boss' && Math.random() < dropChance) {
              spawnPickup(gameState.pickups, enemy.x, enemy.y, chooseRandomPickupType(player));
            }
            gameState.enemies.splice(i, 1);
          }
        }
      }
    } else if (det.type === 'flashbang') {
      const flashRadius = 220;
      sound.playFlashbang();
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
      const isMissiler = enemy.type === 'missiler';
      const isSpitter = enemy.type === 'spitter';
      const isStalker = enemy.type === 'stalker';
      effects.spawnExplosion(enemy.x, enemy.y, {
        color: enemy.color,
        count: isBoss ? 48 : isBrute ? 30 : 20,
        radius: isBoss ? 100 : isBrute ? 68 : 48,
        shake: isBoss ? 12 : isBrute ? 7 : 4,
      });
      sound.playExplosion(isBoss ? 1.5 : isBrute ? 1.0 : 0.7);
      gameState.score += isBoss ? 1500 : isBrute ? 250 : isMissiler ? 200 : isSpitter ? 160 : isStalker ? 140 : 100;
      player.addRage(isBoss ? 25 : isBrute ? 10 : 5);
      const dropChance = isBrute ? 0.12 : isMissiler ? 0.08 : isSpitter || isStalker ? 0.06 : 0.03;
      if (!isBoss && Math.random() < dropChance) {
        spawnPickup(gameState.pickups, enemy.x, enemy.y, chooseRandomPickupType(player));
      }
    } else if (enemy.health < prevHealth) {
      player.addRage(1);
      sound.playHit();
      effects.spawnHit(enemy.x, enemy.y, { color: '#fde047' });
    }
  }

  if (player.health < prevPlayerHealth) {
    sound.playPlayerDamage();
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
  } else if (waveManager.isTimedOut) {
    gameState.state = 'gameover';
    gameState.isGameOver = true;
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
    renderObstacles(gameState.obstacles, ctx);
    renderEnemies(gameState.enemies, ctx);

    // Enemy & Boss plasma projectiles / missiles
    if (gameState.enemyBullets.length > 0) {
      const frameIdx = Math.floor(ui.time * 12) % 2;
      const bulletImg = ENEMY_BULLET_FRAMES[frameIdx];
      const missileImg = ENEMY_MISSILE_FRAMES[frameIdx];
      const hasBulletSprite = bulletImg && bulletImg.width > 0;
      const hasMissileSprite = missileImg && missileImg.width > 0;

      ctx.save();
      for (const eb of gameState.enemyBullets) {
        if (eb.isMissile) {
          const angle = Math.atan2(eb.vy, eb.vx);
          ctx.save();
          ctx.translate(eb.x, eb.y);
          if (hasMissileSprite) {
            ctx.rotate(angle - Math.PI / 2);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(missileImg, -7, -17, 14, 34);
          } else {
            ctx.rotate(angle);
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.moveTo(-12, -3);
            ctx.lineTo(-19, 0);
            ctx.lineTo(-12, 3);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#f97316';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.4;
            ctx.fillRect(-10, -4, 16, 8);
            ctx.strokeRect(-10, -4, 16, 8);
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.moveTo(6, -4);
            ctx.lineTo(13, 0);
            ctx.lineTo(6, 4);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        } else if (hasBulletSprite) {
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(bulletImg, eb.x - 7, eb.y - 7, 14, 14);
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(eb.x, eb.y, eb.radius, 0, Math.PI * 2);
          ctx.fillStyle = eb.color ?? '#c084fc';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        }
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
