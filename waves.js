import { Enemy } from './enemy.js';

export const SURVIVAL_WAVES = [
  {
    wave: 1,
    totalEnemies: 8,
    spawnInterval: 1.4,
    types: ['runner'],
  },
  {
    wave: 2,
    totalEnemies: 14,
    spawnInterval: 1.0,
    types: ['runner', 'brute'],
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
    this.spawnTimer = 0;
    this.isComplete = false;
  }

  /**
   * @returns {number} 1-based current wave number
   */
  getCurrentWaveNumber() {
    return Math.min(this.currentWaveIndex + 1, this.waves.length);
  }

  /**
   * Spawns a single enemy just outside one of the four arena edges.
   * @param {'runner' | 'brute'} type
   * @returns {Enemy}
   */
  spawnEnemyAtEdge(type) {
    const margin = 36;
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

    return new Enemy(x, y, type);
  }

  /**
   * Updates wave spawning and progresses through the survival waves.
   * @param {number} dt
   * @param {Enemy[]} enemies
   */
  update(dt, enemies) {
    if (this.isComplete) {
      return;
    }

    const wave = this.waves[this.currentWaveIndex];
    if (!wave) {
      this.isComplete = true;
      return;
    }

    if (this.spawnedCount < wave.totalEnemies) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const type = wave.types[Math.floor(Math.random() * wave.types.length)];
        enemies.push(this.spawnEnemyAtEdge(type));
        this.spawnedCount += 1;
        this.spawnTimer = wave.spawnInterval;
      }
      return;
    }

    if (enemies.length === 0) {
      if (this.currentWaveIndex + 1 < this.waves.length) {
        this.currentWaveIndex += 1;
        this.spawnedCount = 0;
        this.spawnTimer = 0.5;
      } else {
        this.isComplete = true;
      }
    }
  }
}
