export const PLAYER_DEFAULTS = {
  MAX_HEALTH: 100,
  RADIUS: 18,
  SPEED: 280,
  FIRE_INTERVAL: 0.15,
  BULLET_SPEED: 750,
  BULLET_RADIUS: 4,
};

export class Player {
  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    this.maxHealth = PLAYER_DEFAULTS.MAX_HEALTH;
    this.radius = PLAYER_DEFAULTS.RADIUS;
    this.speed = PLAYER_DEFAULTS.SPEED;
    this.fireInterval = PLAYER_DEFAULTS.FIRE_INTERVAL;
    this.bulletSpeed = PLAYER_DEFAULTS.BULLET_SPEED;
    this.bulletRadius = PLAYER_DEFAULTS.BULLET_RADIUS;

    this.reset(x, y);
  }

  /**
   * Resets player state for a new run or restart.
   * @param {number} x
   * @param {number} y
   */
  reset(x, y) {
    this.x = x;
    this.y = y;
    this.angle = 0;
    this.health = this.maxHealth;
    this.isDead = false;
    this.fireCooldown = 0;
    this.bullets = [];
  }

  /**
   * Updates movement, aiming, shooting, and active projectiles.
   * @param {number} dt - Delta time in seconds
   * @param {import('./input.js').InputHandler} input
   * @param {{ width: number, height: number }} bounds
   */
  update(dt, input, bounds) {
    this._updateBullets(dt, bounds);

    if (this.isDead) {
      return;
    }

    const move = input.getMovementVector();
    this.x += move.x * this.speed * dt;
    this.y += move.y * this.speed * dt;

    this.x = Math.max(this.radius, Math.min(bounds.width - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(bounds.height - this.radius, this.y));

    const mouse = input.getMousePosition();
    this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (input.isShooting() && this.fireCooldown <= 0) {
      this.shoot();
    }
  }

  /**
   * Spawns a projectile in the current aim direction.
   * @returns {{ x: number, y: number, vx: number, vy: number, radius: number } | null}
   */
  shoot() {
    if (this.isDead) {
      return null;
    }

    const barrelOffset = this.radius + 8;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    const bullet = {
      x: this.x + cos * barrelOffset,
      y: this.y + sin * barrelOffset,
      vx: cos * this.bulletSpeed,
      vy: sin * this.bulletSpeed,
      radius: this.bulletRadius,
    };

    this.bullets.push(bullet);
    this.fireCooldown = this.fireInterval;
    return bullet;
  }

  /**
   * Applies damage to the player and updates death state.
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
   * @param {number} dt
   * @param {{ width: number, height: number }} bounds
   */
  _updateBullets(dt, bounds) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (
        b.x < -b.radius ||
        b.x > bounds.width + b.radius ||
        b.y < -b.radius ||
        b.y > bounds.height + b.radius
      ) {
        this.bullets.splice(i, 1);
      }
    }
  }

  /**
   * Renders the player and its projectiles onto the canvas.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    // Glowing tapered energy bolts
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bullets) {
      const angle = Math.atan2(b.vy, b.vx);
      const length = Math.max(22, b.radius * 6);
      const halfWidth = Math.max(3, b.radius * 0.9);

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(angle);

      // Outer plasma aura
      const auraGrad = ctx.createLinearGradient(-length, 0, b.radius * 2, 0);
      auraGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      auraGrad.addColorStop(0.55, 'rgba(56, 189, 248, 0.55)');
      auraGrad.addColorStop(1, 'rgba(125, 211, 252, 0.95)');

      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.moveTo(-length, 0);
      ctx.quadraticCurveTo(-length * 0.25, -halfWidth * 1.9, b.radius * 1.6, 0);
      ctx.quadraticCurveTo(-length * 0.25, halfWidth * 1.9, -length, 0);
      ctx.fill();

      // White-hot inner core
      const coreGrad = ctx.createLinearGradient(-length * 0.7, 0, b.radius * 1.2, 0);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      coreGrad.addColorStop(0.6, 'rgba(224, 242, 254, 0.85)');
      coreGrad.addColorStop(1, '#ffffff');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.moveTo(-length * 0.7, 0);
      ctx.quadraticCurveTo(-length * 0.15, -halfWidth * 0.75, b.radius * 1.1, 0);
      ctx.quadraticCurveTo(-length * 0.15, halfWidth * 0.75, -length * 0.7, 0);
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Gun barrel
    ctx.fillStyle = this.isDead ? '#64748b' : '#cbd5e1';
    ctx.fillRect(this.radius - 4, -4, 14, 8);

    // Player body
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.isDead ? '#7f1d1d' : '#38bdf8';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.isDead ? '#ef4444' : '#e0f2fe';
    ctx.stroke();

    ctx.restore();
  }
}
