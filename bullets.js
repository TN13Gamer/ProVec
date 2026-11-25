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
 * @param {Array<{ x: number, y: number, vx?: number, vy?: number, radius: number }>} bullets
 * @param {CanvasRenderingContext2D} ctx
 */
export function renderBullets(bullets, ctx) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of bullets) {
    const angle = Math.atan2(b.vy ?? 0, b.vx ?? 1);
    const length = Math.max(22, b.radius * 6);
    const halfWidth = Math.max(3, b.radius * 0.9);

    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(angle);

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
}
