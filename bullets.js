export const BULLET_DEFAULTS = {
  SPEED: 750,
  RADIUS: 4,
  DAMAGE: 25,
};

export class BulletManager {
  constructor() {
    this.bullets = [];
  }

  /**
   * Spawns a bullet at (x, y) traveling along angle.
   * @param {number} x
   * @param {number} y
   * @param {number} angle
   * @param {{ speed?: number, radius?: number, damage?: number }} [options]
   */
  spawn(x, y, angle, options = {}) {
    const speed = options.speed ?? BULLET_DEFAULTS.SPEED;
    const radius = options.radius ?? BULLET_DEFAULTS.RADIUS;
    const damage = options.damage ?? BULLET_DEFAULTS.DAMAGE;

    const bullet = {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      damage,
    };

    this.bullets.push(bullet);
    return bullet;
  }

  /**
   * Moves active bullets and removes those outside canvas bounds.
   * @param {number} dt
   * @param {{ width: number, height: number }} bounds
   */
  update(dt, bounds) {
    updateBullets(this.bullets, dt, bounds);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    renderBullets(this.bullets, ctx);
  }

  clear() {
    this.bullets.length = 0;
  }
}

/**
 * Standalone updater compatible with any bullet array (including player.bullets).
 * @param {Array<{ x: number, y: number, vx: number, vy: number, radius: number }>} bullets
 * @param {number} dt
 * @param {{ width: number, height: number }} bounds
 */
export function updateBullets(bullets, dt, bounds) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    if (
      b.x < -b.radius ||
      b.x > bounds.width + b.radius ||
      b.y < -b.radius ||
      b.y > bounds.height + b.radius
    ) {
      bullets.splice(i, 1);
    }
  }
}

/**
 * @param {Array<{ x: number, y: number, radius: number }>} bullets
 * @param {CanvasRenderingContext2D} ctx
 */
export function renderBullets(bullets, ctx) {
  ctx.fillStyle = '#fde047';
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
