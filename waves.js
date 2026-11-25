import { Enemy } from './enemy.js';

export const DIFFICULTIES = {
  easy: {
    label: 'EASY',
    speedMultiplier: 1.0,
    healthMultiplier: 1.0,
    damageMultiplier: 1.0,
    fireRateMultiplier: 1.0,
    spawnRateMultiplier: 1.0,
  },
  medium: {
    label: 'MEDIUM',
    speedMultiplier: 1.18,
    healthMultiplier: 1.15,
    damageMultiplier: 1.25,
    fireRateMultiplier: 1.25,
    spawnRateMultiplier: 1.15,
  },
  hard: {
    label: 'HARD',
    speedMultiplier: 1.38,
    healthMultiplier: 1.35,
    damageMultiplier: 1.5,
    fireRateMultiplier: 1.5,
    spawnRateMultiplier: 1.35,
  },
};

export const SURVIVAL_WAVES = [
  {
    wave: 1,
    totalEnemies: 8,
    spawnInterval: 1.45,
    types: ['runner'],
    speedMultiplier: 1.0,
    healthMultiplier: 1.0,
    hasBoss: false,
  },
  {
    wave: 2,
    totalEnemies: 13,
    spawnInterval: 1.15,
    types: ['runner', 'spitter', 'brute'],
    speedMultiplier: 1.05,
    healthMultiplier: 1.08,
    hasBoss: false,
  },
  {
    wave: 3,
    totalEnemies: 18,
    spawnInterval: 0.95,
    types: ['runner', 'spitter', 'brute'],
    speedMultiplier: 1.1,
    healthMultiplier: 1.18,
    hasBoss: false,
  },
  {
    wave: 4,
    totalEnemies: 23,
    spawnInterval: 0.8,
    types: ['runner', 'spitter', 'brute'],
    speedMultiplier: 1.15,
    healthMultiplier: 1.28,
    hasBoss: false,
  },
  {
    wave: 5,
    totalEnemies: 16,
    spawnInterval: 1.05,
    types: ['runner', 'spitter', 'brute'],
    speedMultiplier: 1.2,
    healthMultiplier: 1.38,
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
    this.difficultyKey = 'easy';
    this.difficulty = DIFFICULTIES.easy;
    this.reset();
  }

  /**
   * Sets difficulty level ('easy' | 'medium' | 'hard').
   * @param {'easy' | 'medium' | 'hard'} level
   */
  setDifficulty(level) {
    if (level in DIFFICULTIES) {
      this.difficultyKey = level;
      this.difficulty = DIFFICULTIES[level];
    }
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

    const diff = this.difficulty || DIFFICULTIES.easy;
    const scaling = {
      speedMultiplier: (wave.speedMultiplier ?? 1) * diff.speedMultiplier,
      healthMultiplier: (wave.healthMultiplier ?? 1) * diff.healthMultiplier,
      damageMultiplier: diff.damageMultiplier,
      fireRateMultiplier: diff.fireRateMultiplier,
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
        this.spawnTimer = wave.spawnInterval / diff.spawnRateMultiplier;
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
