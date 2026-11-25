/**
 * Visual effects system for LAST STAND.
 * Handles hit sparks, explosions, muzzle flashes, damage vignette, and screen shake.
 */

export class EffectsManager {
  constructor() {
    this.particles = [];
    this.rings = [];
    this.flashes = [];
    this.shakeTime = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.damageFlashAlpha = 0;
    this.screenFlashAlpha = 0;
  }

  /**
   * Clears all active effects.
   */
  reset() {
    this.particles.length = 0;
    this.rings.length = 0;
    this.flashes.length = 0;
    this.shakeTime = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.damageFlashAlpha = 0;
    this.screenFlashAlpha = 0;
  }

  /**
   * Spawns a lightweight hit spark effect at (x, y).
   * @param {number} x
   * @param {number} y
   * @param {{ color?: string, count?: number, speed?: number, radius?: number }} [options]
   */
  spawnHit(x, y, options = {}) {
    const color = options.color ?? '#fde047';
    const count = options.count ?? 8;
    const baseSpeed = options.speed ?? 190;
    const ringRadius = options.radius ?? 18;

    this.rings.push({
      x,
      y,
      radius: 4,
      maxRadius: ringRadius,
      life: 0.18,
      maxLife: 0.18,
      color,
      lineWidth: 2,
    });

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = baseSpeed * (0.45 + Math.random() * 0.75);
      const life = 0.16 + Math.random() * 0.14;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.8 + Math.random() * 2.2,
        life,
        maxLife: life,
        color,
        drag: 0.91,
        bounce: 0.55,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 14,
        isShard: false,
      });
    }
  }

  /**
   * Spawns an explosion effect with shockwave ring, core flash, and embers.
   * @param {number} x
   * @param {number} y
   * @param {{ color?: string, secondaryColor?: string, count?: number, radius?: number, shake?: number }} [options]
   */
  spawnExplosion(x, y, options = {}) {
    const color = options.color ?? '#f97316';
    const secondaryColor = options.secondaryColor ?? '#fde047';
    const count = options.count ?? 22;
    const maxRadius = options.radius ?? 52;
    const shake = options.shake ?? 5;

    // Expanding shockwave ring
    this.rings.push({
      x,
      y,
      radius: 6,
      maxRadius,
      life: 0.34,
      maxLife: 0.34,
      color,
      lineWidth: 3.5,
    });

    // Bright core flash
    this.flashes.push({
      x,
      y,
      radius: maxRadius * 0.45,
      life: 0.16,
      maxLife: 0.16,
      color: secondaryColor,
    });

    // Debris & ember particles with spin and bounce physics
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 260;
      const life = 0.28 + Math.random() * 0.36;
      const isHot = i % 3 === 0;

      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.4 + Math.random() * 3.6,
        life,
        maxLife: life,
        color: isHot ? secondaryColor : color,
        drag: 0.92,
        bounce: 0.65,
        angle: Math.random() * Math.PI * 2,
        vAngle: (Math.random() - 0.5) * 18,
        isShard: i % 4 === 0,
      });
    }

    if (shake > 0) {
      this.triggerScreenShake(shake, 0.22);
    }
  }

  /**
   * Spawns a brief muzzle flash at the gun barrel tip.
   * @param {number} x
   * @param {number} y
   * @param {number} angle
   */
  spawnMuzzleFlash(x, y, angle) {
    this.flashes.push({
      x,
      y,
      radius: 14,
      life: 0.07,
      maxLife: 0.07,
      color: '#38bdf8',
    });

    for (let i = 0; i < 4; i++) {
      const spread = angle + (Math.random() - 0.5) * 0.65;
      const speed = 130 + Math.random() * 120;
      const life = 0.08 + Math.random() * 0.06;
      this.particles.push({
        x,
        y,
        vx: Math.cos(spread) * speed,
        vy: Math.sin(spread) * speed,
        size: 1.8,
        life,
        maxLife: life,
        color: '#7dd3fc',
        drag: 0.85,
      });
    }
  }

  /**
   * Triggers a decaying camera shake.
   * @param {number} [intensity=5]
   * @param {number} [duration=0.2]
   */
  triggerScreenShake(intensity = 5, duration = 0.2) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  /**
   * Triggers a red edge flash when the player takes damage.
   * @param {number} [alpha=0.35]
   */
  triggerDamageFlash(alpha = 0.35) {
    this.damageFlashAlpha = Math.max(this.damageFlashAlpha, Math.min(0.7, alpha));
  }

  /**
   * Triggers a bright tactical flashbang screen flash.
   * @param {number} [alpha=0.45]
   */
  triggerFlashOverlay(alpha = 0.45) {
    this.screenFlashAlpha = Math.max(this.screenFlashAlpha, Math.min(0.85, alpha));
  }

  /**
   * Updates all active particles (with drag, spin, and wall bounce), rings, flashes, and screen shake timers.
   * @param {number} dt
   * @param {{ width: number, height: number } | null} [bounds=null]
   */
  update(dt, bounds = null) {
    const frameDragScale = dt * 60;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const damping = Math.pow(p.drag, frameDragScale);
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.vAngle) {
        p.angle = (p.angle || 0) + p.vAngle * dt;
      }

      if (bounds && p.bounce) {
        if (p.x < p.size) {
          p.x = p.size;
          p.vx = Math.abs(p.vx) * p.bounce;
        } else if (p.x > bounds.width - p.size) {
          p.x = bounds.width - p.size;
          p.vx = -Math.abs(p.vx) * p.bounce;
        }
        if (p.y < p.size) {
          p.y = p.size;
          p.vy = Math.abs(p.vy) * p.bounce;
        } else if (p.y > bounds.height - p.size) {
          p.y = bounds.height - p.size;
          p.vy = -Math.abs(p.vy) * p.bounce;
        }
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) {
        this.rings.splice(i, 1);
        continue;
      }
      const progress = 1 - r.life / r.maxLife;
      r.radius = 4 + (r.maxRadius - 4) * (1 - Math.pow(1 - progress, 2));
    }

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.flashes.splice(i, 1);
      }
    }

    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) {
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
      }
    }

    if (this.damageFlashAlpha > 0) {
      this.damageFlashAlpha = Math.max(0, this.damageFlashAlpha - dt * 1.4);
    }

    if (this.screenFlashAlpha > 0) {
      this.screenFlashAlpha = Math.max(0, this.screenFlashAlpha - dt * 1.6);
    }
  }

  /**
   * Applies screen shake transform if active. Pair with endShake(ctx).
   * @param {CanvasRenderingContext2D} ctx
   */
  beginShake(ctx) {
    ctx.save();
    if (this.shakeTime > 0 && this.shakeDuration > 0) {
      const decay = this.shakeTime / this.shakeDuration;
      const mag = this.shakeIntensity * decay;
      const offsetX = (Math.random() * 2 - 1) * mag;
      const offsetY = (Math.random() * 2 - 1) * mag;
      ctx.translate(offsetX, offsetY);
    }
  }

  /**
   * Restores canvas transform after beginShake(ctx).
   * @param {CanvasRenderingContext2D} ctx
   */
  endShake(ctx) {
    ctx.restore();
  }

  /**
   * Renders all world-space hit and explosion effects.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    ctx.save();

    // Shockwave rings
    for (const r of this.rings) {
      const alpha = Math.max(0, r.life / r.maxLife);
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lineWidth * (0.4 + alpha * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Core flashes
    for (const f of this.flashes) {
      const alpha = Math.max(0, f.life / f.maxLife);
      const currentRadius = f.radius * (0.35 + alpha * 0.65);
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, currentRadius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.45, f.color);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.globalAlpha = alpha;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, currentRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sparks, embers & rotating debris shards
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const r = p.size * (0.5 + alpha * 0.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      if (p.isShard) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle || 0);
        ctx.fillRect(-r, -r * 0.55, r * 2, r * 1.1);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Renders screen-space damage vignette overlay.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   */
  renderScreenOverlay(ctx, width, height) {
    if (this.damageFlashAlpha > 0.005) {
      ctx.save();
      const cx = width / 2;
      const cy = height / 2;
      const outerRadius = Math.hypot(cx, cy);
      const grad = ctx.createRadialGradient(cx, cy, outerRadius * 0.45, cx, cy, outerRadius);
      grad.addColorStop(0, 'rgba(239, 68, 68, 0)');
      grad.addColorStop(1, `rgba(239, 68, 68, ${this.damageFlashAlpha})`);

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    if (this.screenFlashAlpha > 0.005) {
      ctx.save();
      ctx.fillStyle = `rgba(224, 242, 254, ${this.screenFlashAlpha})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }
}
