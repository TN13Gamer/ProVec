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
    this.animTime = 0;
    this.isMoving = false;
    this.shootAnimTimer = 0;
    this.hurtTimer = 0;
    this.deathAnim = 0;
  }

  /**
   * Updates movement, aiming, shooting, and active projectiles.
   * @param {number} dt - Delta time in seconds
   * @param {import('./input.js').InputHandler} input
   * @param {{ width: number, height: number }} bounds
   */
  update(dt, input, bounds) {
    this._updateBullets(dt, bounds);
    this.animTime += dt;
    this.shootAnimTimer = Math.max(0, this.shootAnimTimer - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);

    if (this.isDead) {
      this.isMoving = false;
      this.deathAnim = Math.min(1, this.deathAnim + dt * 2.5);
      return;
    }

    const move = input.getMovementVector();
    this.isMoving = move.x !== 0 || move.y !== 0;
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
    this.shootAnimTimer = 0.1;
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
    this.hurtTimer = 0.18;
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

    // Ground shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 15, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const facing = Math.cos(this.angle) >= 0 ? 1 : -1;
    const stride = this.isMoving && !this.isDead ? Math.sin(this.animTime * 16) : 0;
    const bob = this.isMoving && !this.isDead ? Math.abs(Math.cos(this.animTime * 16)) * 2 : 0;

    if (this.isDead) {
      ctx.rotate(facing * (Math.PI / 2) * this.deathAnim);
      ctx.globalAlpha = 0.85;
    } else {
      ctx.translate(0, -bob);
    }

    ctx.save();
    ctx.scale(facing, 1);

    // Jetpack & cyan thruster
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-13, -7, 7, 15);
    ctx.strokeRect(-13, -7, 7, 15);

    if (this.isMoving && !this.isDead) {
      const flame = 5 + Math.sin(this.animTime * 30) * 2.5;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(-13, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.beginPath();
      ctx.moveTo(-13, -3);
      ctx.lineTo(-13 - flame, 0);
      ctx.lineTo(-13, 3);
      ctx.closePath();
      ctx.fill();
    }

    // Animated boots / legs
    ctx.fillStyle = '#334155';
    ctx.fillRect(-5 + stride * 4, 8, 5, 8);
    ctx.fillRect(1 - stride * 4, 8, 5, 8);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-5 + stride * 4, 14, 6, 3);
    ctx.fillRect(1 - stride * 4, 14, 6, 3);

    // Armored torso
    ctx.fillStyle = this.hurtTimer > 0 ? '#ef4444' : '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-8, -6, 16, 16, 4);
    ctx.fill();
    ctx.stroke();

    // Orange chest armor accent
    ctx.fillStyle = this.hurtTimer > 0 ? '#fca5a5' : '#f59e0b';
    ctx.fillRect(-4, -2, 8, 6);

    // Helmet base
    ctx.fillStyle = this.hurtTimer > 0 ? '#f87171' : '#475569';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, -9, 10.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Signature gold/orange helmet stripe
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-2.5, -19, 5, 7);

    // Glowing cyan visor
    ctx.fillStyle = this.isDead ? '#475569' : '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(-3, -12, 11, 5.5, 2.5);
    ctx.fill();
    if (!this.isDead) {
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(0, -11, 6, 2);
    }

    ctx.restore();

    // Aimed sci-fi rifle
    if (!this.isDead) {
      const recoil = this.shootAnimTimer > 0 ? -3 : 0;
      ctx.save();
      ctx.rotate(this.angle);
      ctx.translate(recoil, 0);

      // Rifle body
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.2;
      ctx.fillRect(4, -3.5, 19, 7);
      ctx.strokeRect(4, -3.5, 19, 7);

      // Energy barrel accent
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(14, -1.5, 8, 3);

      ctx.restore();
    }

    ctx.restore();
  }
}
