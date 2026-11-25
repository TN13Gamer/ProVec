import { Enemy } from './enemy.js';

export const SURVIVAL_WAVES = [
  {
    wave: 1,
    totalEnemies: 8,
    spawnInterval: 1.3,
    types: ['runner'],
    speedMultiplier: 1.0,
    healthMultiplier: 1.0,
    hasBoss: false,
  },
  {
    wave: 2,
    totalEnemies: 14,
    spawnInterval: 1.0,
    types: ['runner', 'spitter', 'brute'],
    speedMultiplier: 1.08,
    healthMultiplier: 1.1,
    hasBoss: false,
  },
  {
    wave: 3,
    totalEnemies: 20,
    spawnInterval: 0.8,
    types: ['runner', 'spitter', 'brute'],
    speedMultiplier: 1.16,
    healthMultiplier: 1.25,
    hasBoss: false,
  },
  {
    wave: 4,
    totalEnemies: 26,
    spawnInterval: 0.65,
    types: ['runner', 'spitter', 'brute'],
    speedMultiplier: 1.25,
    healthMultiplier: 1.4,
    hasBoss: false,
  },
  {
    wave: 5,
    totalEnemies: 18,
    spawnInterval: 0.9,
    types: ['runner', 'spitter', 'brute'],
    speedMultiplier: 1.3,
    healthMultiplier: 1.5,
    hasBoss: true,
  },
];

export class WaveManager {
  /**
   * @param {{ width: number, height: number }} bounds
   * @param {Array<{ wave: number, totalEnemies: number, spawnInterval: number, types: Array<'runner' | 'brute'> }>} [waves]
   */
  constructor(bounds, waves = SURVIVAL_WAVES) {
    this.bounds = bounds;
    this.waves = waves;
    this.reset();
  }

  reset() {
    this.currentWaveIndex = 0;
    this.spawnedCount = 0;
    this.bossSpawned = false;
    this.spawnTimer = 0;
    this.waveTimer = 90;
    this.isTimedOut = false;
    this.isComplete = false;
  }

  /**
   * @returns {number} Remaining seconds for the current wave
   */
  getWaveTimeRemaining() {
    return Math.max(0, this.waveTimer);
  }

  /**
   * @returns {number} 1-based current wave number
   */
  getCurrentWaveNumber() {
    return Math.min(this.currentWaveIndex + 1, this.waves.length);
  }

  /**
   * Spawns a single enemy just outside one of the four arena edges.
   * @param {'runner' | 'brute' | 'boss'} type
   * @param {{ speedMultiplier?: number, healthMultiplier?: number }} [scaling]
   * @returns {Enemy}
   */
  spawnEnemyAtEdge(type, scaling = {}) {
    const margin = type === 'boss' ? 56 : 36;
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;

    if (edge === 0) {
      x = Math.random() * this.bounds.width;
      y = -margin;
    } else if (edge === 1) {
      x = this.bounds.width + margin;
      y = Math.random() * this.bounds.height;
    } else if (edge === 2) {
      x = Math.random() * this.bounds.width;
      y = this.bounds.height + margin;
    } else {
      x = -margin;
      y = Math.random() * this.bounds.height;
    }

    return new Enemy(x, y, type, scaling);
  }

  /**
   * Updates wave spawning and progresses through the survival waves.
   * @param {number} dt
   * @param {Enemy[]} enemies
   */
  update(dt, enemies) {
    if (this.isComplete || this.isTimedOut) {
      return;
    }

    const wave = this.waves[this.currentWaveIndex];
    if (!wave) {
      this.isComplete = true;
      return;
    }

    this.waveTimer = Math.max(0, this.waveTimer - dt);
    if (this.waveTimer <= 0 && !(this.spawnedCount >= wave.totalEnemies && enemies.length === 0)) {
      this.isTimedOut = true;
      return;
    }

    const scaling = {
      speedMultiplier: wave.speedMultiplier ?? 1,
      healthMultiplier: wave.healthMultiplier ?? 1,
    };

    if (wave.hasBoss && !this.bossSpawned) {
      enemies.push(this.spawnEnemyAtEdge('boss', scaling));
      this.bossSpawned = true;
    }

    if (this.spawnedCount < wave.totalEnemies) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const type = wave.types[Math.floor(Math.random() * wave.types.length)];
        enemies.push(this.spawnEnemyAtEdge(type, scaling));
        this.spawnedCount += 1;
        this.spawnTimer = wave.spawnInterval;
      }
      return;
    }

    if (enemies.length === 0) {
      if (this.currentWaveIndex + 1 < this.waves.length) {
        this.currentWaveIndex += 1;
        this.spawnedCount = 0;
        this.bossSpawned = false;
        this.spawnTimer = 1.0;
        this.waveTimer = 90;
      } else {
        this.isComplete = true;
      }
    }
  }
}
