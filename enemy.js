export const ENEMY_TYPES = {
  runner: {
    radius: 15,
    speed: 175,
    maxHealth: 40,
    damage: 10,
    attackInterval: 0.6,
    color: '#f97316',
    strokeColor: '#ffedd5',
  },
  brute: {
    radius: 26,
    speed: 95,
    maxHealth: 120,
    damage: 25,
    attackInterval: 1.0,
    color: '#dc2626',
    strokeColor: '#fee2e2',
  },
};

export class Enemy {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'runner' | 'brute'} [type='runner']
   */
  constructor(x, y, type = 'runner') {
    const config = ENEMY_TYPES[type] || ENEMY_TYPES.runner;
    this.x = x;
    this.y = y;
    this.type = type in ENEMY_TYPES ? type : 'runner';
    this.radius = config.radius;
    this.speed = config.speed;
    this.maxHealth = config.maxHealth;
    this.health = config.maxHealth;
    this.damage = config.damage;
    this.attackInterval = config.attackInterval;
    this.attackCooldown = 0;
    this.color = config.color;
    this.strokeColor = config.strokeColor;
    this.isDead = false;
  }

  /**
   * Moves toward the target position using normalized chase AI.
   * @param {number} dt
   * @param {{ x: number, y: number, isDead?: boolean }} target
   */
  update(dt, target) {
    if (this.isDead) {
      return;
    }

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    if (!target || target.isDead) {
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.001) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }
  }

  /**
   * @returns {boolean}
   */
  canAttack() {
    return !this.isDead && this.attackCooldown <= 0;
  }

  resetAttackCooldown() {
    this.attackCooldown = this.attackInterval;
  }

  /**
   * Applies damage to the enemy and marks it dead at 0 health.
   * @param {number} amount
   * @returns {number} Remaining health
   */
  takeDamage(amount) {
    if (this.isDead || amount <= 0) {
      return this.health;
    }

    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.isDead = true;
    }

    return this.health;
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    if (this.isDead) {
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.strokeColor;
    ctx.stroke();

    // Minimal health bar above damaged enemies
    if (this.health < this.maxHealth) {
      const barWidth = this.radius * 2;
      const barHeight = 4;
      const barX = this.x - this.radius;
      const barY = this.y - this.radius - 8;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(barX, barY, barWidth * (this.health / this.maxHealth), barHeight);
    }

    ctx.restore();
  }
}

/**
 * Updates all enemies and removes dead ones.
 * @param {Enemy[]} enemies
 * @param {number} dt
 * @param {{ x: number, y: number, isDead?: boolean }} target
 */
export function updateEnemies(enemies, dt, target) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.update(dt, target);
    if (enemy.isDead) {
      enemies.splice(i, 1);
    }
  }
}

/**
 * @param {Enemy[]} enemies
 * @param {CanvasRenderingContext2D} ctx
 */
export function renderEnemies(enemies, ctx) {
  for (const enemy of enemies) {
    enemy.render(ctx);
  }
}
