export const PLAYER_DEFAULTS = {
  MAX_HEALTH: 100,
  RADIUS: 18,
  SPEED: 280,
  FIRE_INTERVAL: 0.15,
  BULLET_SPEED: 750,
  BULLET_RADIUS: 4,
  SLIDE_DURATION: 0.26,
  SLIDE_SPEED: 660,
  SLIDE_COOLDOWN: 1.1,
  DODGE_DURATION: 0.24,
  DODGE_SPEED: 620,
  DODGE_COOLDOWN: 1.4,
  GRENADE_COOLDOWN: 4.5,
  FLASHBANG_COOLDOWN: 6.0,
};

export const WEAPONS = {
  primary: {
    id: 'primary',
    slot: 1,
    name: 'PULSE RIFLE',
    fireInterval: 0.14,
    bulletSpeed: 780,
    bulletRadius: 4,
    damage: 25,
    pellets: 1,
    spread: 0.02,
    color: '#38bdf8',
    auraRgba: '56, 189, 248',
    coreRgba: '224, 242, 254',
  },
  secondary: {
    id: 'secondary',
    slot: 2,
    name: 'SCATTER BLASTER',
    fireInterval: 0.48,
    bulletSpeed: 640,
    bulletRadius: 4,
    damage: 16,
    pellets: 5,
    spread: 0.3,
    color: '#f97316',
    auraRgba: '249, 115, 22',
    coreRgba: '254, 240, 138',
  },
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

    // Weapon state
    this.weaponKey = 'primary';
    this.weapon = WEAPONS.primary;

    // Slide & Dodge state
    this.slideTimer = 0;
    this.slideCooldown = 0;
    this.slideDir = { x: 1, y: 0 };

    this.dodgeTimer = 0;
    this.dodgeCooldown = 0;
    this.dodgeDir = { x: 1, y: 0 };
    this.isInvulnerable = false;
    this.afterimages = [];

    // Throwables (Grenade & Flashbang)
    this.grenadeCooldown = 0;
    this.flashbangCooldown = 0;
    this.throwables = [];
    this.detonatedThrowables = [];
  }

  /**
   * Throws a grenade or flashbang toward (targetX, targetY).
   * @param {'grenade' | 'flashbang'} type
   * @param {number} targetX
   * @param {number} targetY
   * @returns {boolean}
   */
  throwGadget(type, targetX, targetY) {
    if (this.isDead) return false;

    if (type === 'grenade') {
      if (this.grenadeCooldown > 0) return false;
      this.grenadeCooldown = PLAYER_DEFAULTS.GRENADE_COOLDOWN;
    } else if (type === 'flashbang') {
      if (this.flashbangCooldown > 0) return false;
      this.flashbangCooldown = PLAYER_DEFAULTS.FLASHBANG_COOLDOWN;
    } else {
      return false;
    }

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    const angle = dist > 0.001 ? Math.atan2(dy, dx) : this.angle;
    const fuse = type === 'grenade' ? 0.48 : 0.36;
    const throwDist = Math.min(320, Math.max(80, dist));
    const speed = throwDist / fuse;

    this.throwables.push({
      type,
      x: this.x + Math.cos(angle) * (this.radius + 6),
      y: this.y + Math.sin(angle) * (this.radius + 6),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      fuse,
      maxFuse: fuse,
    });
    return true;
  }

  /**
   * Returns and clears throwables that detonated this frame.
   * @returns {Array<{ type: 'grenade' | 'flashbang', x: number, y: number }>}
   */
  consumeDetonations() {
    if (this.detonatedThrowables.length === 0) return [];
    const out = this.detonatedThrowables.slice();
    this.detonatedThrowables.length = 0;
    return out;
  }

  /**
   * Switches between primary and secondary weapons.
   * @param {'primary' | 'secondary'} key
   */
  setWeapon(key) {
    if (key in WEAPONS && this.weaponKey !== key) {
      this.weaponKey = key;
      this.weapon = WEAPONS[key];
      this.fireCooldown = Math.min(this.fireCooldown, 0.08);
    }
  }

  /**
   * Toggles between primary and secondary weapons.
   */
  toggleWeapon() {
    this.setWeapon(this.weaponKey === 'primary' ? 'secondary' : 'primary');
  }

  /**
   * Starts a tactical slide in the movement or aim direction.
   * @param {{ x: number, y: number }} move
   */
  startSlide(move) {
    if (this.isDead || this.slideTimer > 0 || this.dodgeTimer > 0 || this.slideCooldown > 0) {
      return false;
    }
    const dir =
      move.x !== 0 || move.y !== 0
        ? { x: move.x, y: move.y }
        : { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    this.slideDir = dir;
    this.slideTimer = PLAYER_DEFAULTS.SLIDE_DURATION;
    this.slideCooldown = PLAYER_DEFAULTS.SLIDE_COOLDOWN;
    return true;
  }

  /**
   * Starts an evasive dodge roll with brief invulnerability frames.
   * @param {{ x: number, y: number }} move
   */
  startDodge(move) {
    if (this.isDead || this.dodgeTimer > 0 || this.slideTimer > 0 || this.dodgeCooldown > 0) {
      return false;
    }
    const dir =
      move.x !== 0 || move.y !== 0
        ? { x: move.x, y: move.y }
        : { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    this.dodgeDir = dir;
    this.dodgeTimer = PLAYER_DEFAULTS.DODGE_DURATION;
    this.dodgeCooldown = PLAYER_DEFAULTS.DODGE_COOLDOWN;
    this.isInvulnerable = true;
    return true;
  }

  /**
   * Updates movement, aiming, shooting, and active projectiles.
   * @param {number} dt - Delta time in seconds
   * @param {import('./input.js').InputHandler} input
   * @param {{ width: number, height: number }} bounds
   */
  update(dt, input, bounds) {
    this._updateBullets(dt, bounds);
    this._updateThrowables(dt, bounds);
    this.animTime += dt;
    this.shootAnimTimer = Math.max(0, this.shootAnimTimer - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.grenadeCooldown = Math.max(0, this.grenadeCooldown - dt);
    this.flashbangCooldown = Math.max(0, this.flashbangCooldown - dt);

    if (this.isDead) {
      this.isMoving = false;
      this.deathAnim = Math.min(1, this.deathAnim + dt * 2.5);
      return;
    }

    const move = input.getMovementVector();

    // Weapon switching (1, 2, Q, or Mouse Wheel)
    if (input.wasKeyPressed('Digit1')) {
      this.setWeapon('primary');
    } else if (input.wasKeyPressed('Digit2')) {
      this.setWeapon('secondary');
    } else if (input.wasKeyPressed('KeyQ') || input.getWheelDelta?.() !== 0) {
      this.toggleWeapon();
    }

    // Cooldowns & afterimages
    this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].life -= dt;
      if (this.afterimages[i].life <= 0) {
        this.afterimages.splice(i, 1);
      }
    }

    // Trigger slide (Shift) or dodge (E / Right Click)
    if (input.wasKeyPressed('ShiftLeft') || input.wasKeyPressed('ShiftRight')) {
      this.startSlide(move);
    } else if (input.wasKeyPressed('KeyE') || input.wasRightClicked?.()) {
      this.startDodge(move);
    }

    if (this.dodgeTimer > 0) {
      this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
      this.isInvulnerable = this.dodgeTimer > 0;
      this.isMoving = true;
      this.x += this.dodgeDir.x * PLAYER_DEFAULTS.DODGE_SPEED * dt;
      this.y += this.dodgeDir.y * PLAYER_DEFAULTS.DODGE_SPEED * dt;
      if (Math.random() < 0.65) {
        this.afterimages.push({ x: this.x, y: this.y, life: 0.14, maxLife: 0.14, color: '#38bdf8' });
      }
    } else if (this.slideTimer > 0) {
      this.slideTimer = Math.max(0, this.slideTimer - dt);
      this.isInvulnerable = false;
      this.isMoving = true;
      this.x += this.slideDir.x * PLAYER_DEFAULTS.SLIDE_SPEED * dt;
      this.y += this.slideDir.y * PLAYER_DEFAULTS.SLIDE_SPEED * dt;
      if (Math.random() < 0.65) {
        this.afterimages.push({ x: this.x, y: this.y, life: 0.12, maxLife: 0.12, color: '#f59e0b' });
      }
    } else {
      this.isInvulnerable = false;
      this.isMoving = move.x !== 0 || move.y !== 0;
      this.x += move.x * this.speed * dt;
      this.y += move.y * this.speed * dt;
    }

    this.x = Math.max(this.radius, Math.min(bounds.width - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(bounds.height - this.radius, this.y));

    const mouse = input.getMousePosition();
    this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

    // Throwables: G for Grenade, F for Flashbang
    if (input.wasKeyPressed('KeyG')) {
      this.throwGadget('grenade', mouse.x, mouse.y);
    } else if (input.wasKeyPressed('KeyF')) {
      this.throwGadget('flashbang', mouse.x, mouse.y);
    }

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.dodgeTimer <= 0 && input.isShooting() && this.fireCooldown <= 0) {
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

    const w = this.weapon || WEAPONS.primary;
    const barrelOffset = this.radius + 8;
    const spawnX = this.x + Math.cos(this.angle) * barrelOffset;
    const spawnY = this.y + Math.sin(this.angle) * barrelOffset;

    let firstBullet = null;
    for (let i = 0; i < w.pellets; i++) {
      const offsetAngle =
        w.pellets === 1
          ? (Math.random() - 0.5) * w.spread
          : ((i / (w.pellets - 1)) - 0.5) * w.spread + (Math.random() - 0.5) * 0.04;
      const shotAngle = this.angle + offsetAngle;

      const bullet = {
        x: spawnX,
        y: spawnY,
        vx: Math.cos(shotAngle) * w.bulletSpeed,
        vy: Math.sin(shotAngle) * w.bulletSpeed,
        radius: w.bulletRadius,
        damage: w.damage,
        color: w.color,
        auraRgba: w.auraRgba,
        coreRgba: w.coreRgba,
      };
      this.bullets.push(bullet);
      if (!firstBullet) firstBullet = bullet;
    }

    this.fireCooldown = w.fireInterval;
    this.shootAnimTimer = 0.1;
    return firstBullet;
  }

  /**
   * Applies damage to the player and updates death state.
   * @param {number} amount
   * @returns {number} Remaining health
   */
  takeDamage(amount) {
    if (this.isDead || this.isInvulnerable || amount <= 0) {
      return this.health;
    }

    this.health = Math.max(0, this.health - amount);
    this.hurtTimer = 0.18;
    if (this.health <= 0) {
      this.isDead = true;
    }

    return this.health;
  }

  _updateThrowables(dt, bounds) {
    for (let i = this.throwables.length - 1; i >= 0; i--) {
      const t = this.throwables[i];
      t.x = Math.max(12, Math.min(bounds.width - 12, t.x + t.vx * dt));
      t.y = Math.max(12, Math.min(bounds.height - 12, t.y + t.vy * dt));
      t.vx *= Math.pow(0.95, dt * 60);
      t.vy *= Math.pow(0.95, dt * 60);
      t.fuse -= dt;

      if (t.fuse <= 0) {
        this.detonatedThrowables.push({ type: t.type, x: t.x, y: t.y });
        this.throwables.splice(i, 1);
      }
    }
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
      const auraRgba = b.auraRgba ?? '56, 189, 248';
      const coreRgba = b.coreRgba ?? '224, 242, 254';

      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(angle);

      // Outer plasma aura
      const auraGrad = ctx.createLinearGradient(-length, 0, b.radius * 2, 0);
      auraGrad.addColorStop(0, `rgba(${auraRgba}, 0)`);
      auraGrad.addColorStop(0.55, `rgba(${auraRgba}, 0.55)`);
      auraGrad.addColorStop(1, `rgba(${auraRgba}, 0.95)`);

      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.moveTo(-length, 0);
      ctx.quadraticCurveTo(-length * 0.25, -halfWidth * 1.9, b.radius * 1.6, 0);
      ctx.quadraticCurveTo(-length * 0.25, halfWidth * 1.9, -length, 0);
      ctx.fill();

      // White-hot inner core
      const coreGrad = ctx.createLinearGradient(-length * 0.7, 0, b.radius * 1.2, 0);
      coreGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      coreGrad.addColorStop(0.6, `rgba(${coreRgba}, 0.85)`);
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

    // Slide / Dodge afterimages
    for (const ghost of this.afterimages) {
      const alpha = (ghost.life / ghost.maxLife) * 0.35;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ghost.color;
      ctx.beginPath();
      ctx.arc(ghost.x, ghost.y, this.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // In-flight Grenades & Flashbangs
    for (const t of this.throwables) {
      const isGrenade = t.type === 'grenade';
      const blink = Math.sin(this.animTime * 28) > 0;
      ctx.save();
      ctx.beginPath();
      ctx.arc(t.x, t.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = isGrenade ? (blink ? '#ef4444' : '#f97316') : (blink ? '#ffffff' : '#38bdf8');
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    }

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
    } else if (this.dodgeTimer > 0) {
      const rollProgress = 1 - this.dodgeTimer / PLAYER_DEFAULTS.DODGE_DURATION;
      ctx.rotate(facing * rollProgress * Math.PI * 2);
      ctx.globalAlpha = 0.85;
    } else if (this.slideTimer > 0) {
      ctx.translate(0, 5);
      ctx.rotate(-facing * 0.35);
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
