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
  boss: {
    radius: 44,
    speed: 82,
    maxHealth: 950,
    damage: 35,
    attackInterval: 0.9,
    color: '#a855f7',
    strokeColor: '#f3e8ff',
  },
};

export class Enemy {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'runner' | 'brute' | 'boss'} [type='runner']
   * @param {{ speedMultiplier?: number, healthMultiplier?: number }} [scaling]
   */
  constructor(x, y, type = 'runner', scaling = {}) {
    const config = ENEMY_TYPES[type] || ENEMY_TYPES.runner;
    const speedMult = scaling.speedMultiplier ?? 1;
    const healthMult = scaling.healthMultiplier ?? 1;

    this.x = x;
    this.y = y;
    this.type = type in ENEMY_TYPES ? type : 'runner';
    this.radius = config.radius;
    this.speed = config.speed * speedMult;
    this.maxHealth = Math.round(config.maxHealth * healthMult);
    this.health = this.maxHealth;
    this.damage = config.damage;
    this.attackInterval = config.attackInterval;
    this.attackCooldown = 0;
    this.stunTimer = 0;
    this.bossFireCooldown = 2.0;
    this.animTime = 0;
    this.color = config.color;
    this.strokeColor = config.strokeColor;
    this.isDead = false;
  }

  /**
   * Stuns/blinds the enemy for a duration (used by Flashbang).
   * @param {number} duration
   */
  applyStun(duration) {
    if (this.isDead || duration <= 0) return;
    // Boss resists full duration slightly (60% of stun duration)
    const effective = this.type === 'boss' ? duration * 0.6 : duration;
    this.stunTimer = Math.max(this.stunTimer, effective);
  }

  /**
   * Moves toward the target position using normalized chase AI.
   * @param {number} dt
   * @param {{ x: number, y: number, isDead?: boolean }} target
   * @param {Array<any>} [enemyBullets]
   */
  update(dt, target, enemyBullets = null) {
    if (this.isDead) {
      return;
    }

    this.animTime += dt;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    if (this.stunTimer > 0) {
      this.stunTimer = Math.max(0, this.stunTimer - dt);
      return;
    }

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

    // Boss radial plasma burst attack
    if (this.type === 'boss' && enemyBullets) {
      this.bossFireCooldown -= dt;
      if (this.bossFireCooldown <= 0) {
        const baseAngle = Math.atan2(dy, dx);
        const count = 7;
        const spread = 1.4;
        for (let i = 0; i < count; i++) {
          const angle = baseAngle + (i / (count - 1) - 0.5) * spread;
          enemyBullets.push({
            x: this.x + Math.cos(angle) * (this.radius + 6),
            y: this.y + Math.sin(angle) * (this.radius + 6),
            vx: Math.cos(angle) * 280,
            vy: Math.sin(angle) * 280,
            radius: 7,
            damage: 18,
          });
        }
        this.bossFireCooldown = 2.3;
      }
    }
  }

  /**
   * @returns {boolean}
   */
  canAttack() {
    return !this.isDead && this.stunTimer <= 0 && this.attackCooldown <= 0;
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

    if (this.type === 'boss') {
      // Boss outer pulsing aura
      const pulse = 6 + Math.sin(this.animTime * 4) * 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.stunTimer > 0 ? '#cbd5e1' : this.color;
    ctx.fill();
    ctx.lineWidth = this.type === 'boss' ? 3.5 : 2;
    ctx.strokeStyle = this.stunTimer > 0 ? '#ffffff' : this.strokeColor;
    ctx.stroke();

    if (this.type === 'boss') {
      // Inner armored core
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.48, 0, Math.PI * 2);
      ctx.fillStyle = '#3b0764';
      ctx.fill();
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Stunned indicator ring
    if (this.stunTimer > 0) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 5, this.animTime * 8, this.animTime * 8 + Math.PI * 1.3);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Minimal health bar above damaged regular enemies (boss uses top HUD bar)
    if (this.type !== 'boss' && this.health < this.maxHealth) {
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
export function updateEnemies(enemies, dt, target, enemyBullets = null) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    enemy.update(dt, target, enemyBullets);
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
