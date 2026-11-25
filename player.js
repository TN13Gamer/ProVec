const PLAYER_BULLET_FRAMES = [];
if (typeof Image !== 'undefined') {
  for (const src of [
    './assets/sprites/player_bullet_f1.png',
    './assets/sprites/player_bullet_f2.png',
  ]) {
    const raw = new Image();
    const idx = PLAYER_BULLET_FRAMES.length;
    PLAYER_BULLET_FRAMES.push(null);
    raw.onload = () => {
      const off = document.createElement('canvas');
      off.width = raw.naturalWidth;
      off.height = raw.naturalHeight;
      const octx = off.getContext('2d');
      octx.drawImage(raw, 0, 0);
      const imgData = octx.getImageData(0, 0, off.width, off.height);
      const d = imgData.data;
      const bgR = d[0], bgG = d[1], bgB = d[2], bgA = d[3];
      if (bgA > 10) {
        for (let i = 0; i < d.length; i += 4) {
          if (Math.abs(d[i] - bgR) + Math.abs(d[i + 1] - bgG) + Math.abs(d[i + 2] - bgB) < 42) {
            d[i + 3] = 0;
          }
        }
        octx.putImageData(imgData, 0, 0);
      }
      PLAYER_BULLET_FRAMES[idx] = off;
    };
    raw.src = src;
  }
}

export const PLAYER_DEFAULTS = {
  MAX_HEALTH: 150,
  RADIUS: 18,
  SPEED: 280,
  FIRE_INTERVAL: 0.15,
  BULLET_SPEED: 750,
  BULLET_RADIUS: 4,
  DASH_DURATION: 0.22,
  DASH_SPEED: 680,
  DASH_COOLDOWN: 0.5,
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
    magSize: 30,
    startReserve: 120,
    reloadTime: 1.1,
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
    magSize: 6,
    startReserve: 24,
    reloadTime: 2.3,
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

    // Weapon & Ammo state
    this.weaponKey = 'primary';
    this.weapon = WEAPONS.primary;
    this.ammoState = {
      primary: { mag: WEAPONS.primary.magSize, reserve: WEAPONS.primary.startReserve },
      secondary: { mag: WEAPONS.secondary.magSize, reserve: WEAPONS.secondary.startReserve },
    };
    this.reloadTimer = 0;
    this.reloadDuration = 0;

    // Unified Slide / Dash state
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDir = { x: 1, y: 0 };
    this.isInvulnerable = false;
    this.afterimages = [];

    // Critical-health LAST STAND state (5s invisibility)
    this.lastStandUsed = false;
    this.lastStandTimer = 0;
    this.isInvisible = false;

    // Knockback velocity
    this.knockVx = 0;
    this.knockVy = 0;

    // Rage meter state
    this.rage = 0;
    this.maxRage = 100;
    this.isRaging = false;
    this.rageTimer = 0;
    this.rageDuration = 8.0;

    // Out-of-combat health regeneration
    this.timeSinceLastDamage = 0;

    // Collectable Throwables (Grenade & Flashbang)
    this.selectedAccessory = 'grenade';
    this.grenadeCount = 2;
    this.flashbangCount = 2;
    this.grenadeCooldown = 0;
    this.flashbangCooldown = 0;
    this.throwables = [];
    this.detonatedThrowables = [];
  }

  /**
   * Toggles the active throwable accessory between Grenade and Flashbang.
   */
  toggleAccessory() {
    this.selectedAccessory = this.selectedAccessory === 'grenade' ? 'flashbang' : 'grenade';
  }

  /**
   * Starts reloading the active weapon if needed and reserve ammo is available.
   */
  startReload() {
    if (this.isDead || this.reloadTimer > 0) return false;
    const ammo = this.ammoState[this.weaponKey];
    if (!ammo || ammo.mag >= this.weapon.magSize || ammo.reserve <= 0) {
      return false;
    }
    this.reloadDuration = this.weapon.reloadTime;
    this.reloadTimer = this.weapon.reloadTime;
    return true;
  }

  /**
   * Restores reserve ammo for both weapons.
   */
  addAmmo(primaryAmount = 30, secondaryAmount = 8) {
    this.ammoState.primary.reserve += primaryAmount;
    this.ammoState.secondary.reserve += secondaryAmount;
  }

  /**
   * Heals the player up to maxHealth.
   * @param {number} amount
   */
  heal(amount) {
    if (this.isDead || amount <= 0) return;
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  /**
   * Applies directional knockback away from (fromX, fromY).
   * @param {number} fromX
   * @param {number} fromY
   * @param {number} [force=360]
   */
  applyKnockback(fromX, fromY, force = 360) {
    if (this.isDead || this.isInvulnerable || this.isInvisible) return;
    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const dist = Math.hypot(dx, dy);
    const nx = dist > 0.001 ? dx / dist : Math.cos(this.angle + Math.PI);
    const ny = dist > 0.001 ? dy / dist : Math.sin(this.angle + Math.PI);
    this.knockVx += nx * force;
    this.knockVy += ny * force;
  }

  /**
   * Adds rage charge up to maxRage (ignored while already raging).
   * @param {number} amount
   */
  addRage(amount) {
    if (this.isDead || this.isRaging || amount <= 0) return;
    this.rage = Math.min(this.maxRage, this.rage + amount);
  }

  /**
   * Activates Rage mode if the meter is full (2x damage, 1.5x speed, 50% damage resistance).
   * @returns {boolean}
   */
  activateRage() {
    if (this.isDead || this.isRaging || this.rage < this.maxRage) {
      return false;
    }
    this.isRaging = true;
    this.rageTimer = this.rageDuration;
    return true;
  }

  /**
   * Throws a grenade or flashbang toward (targetX, targetY) if available.
   * @param {'grenade' | 'flashbang'} type
   * @param {number} targetX
   * @param {number} targetY
   * @returns {boolean}
   */
  throwGadget(type, targetX, targetY) {
    if (this.isDead) return false;

    if (type === 'grenade') {
      if (this.grenadeCount <= 0 || this.grenadeCooldown > 0) return false;
      this.grenadeCount -= 1;
      this.grenadeCooldown = 0.45;
    } else if (type === 'flashbang') {
      if (this.flashbangCount <= 0 || this.flashbangCooldown > 0) return false;
      this.flashbangCount -= 1;
      this.flashbangCooldown = 0.45;
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
      this.reloadTimer = 0;
      this.reloadDuration = 0;
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
   * Starts a tactical slide/dash in the movement or aim direction with brief i-frames.
   * @param {{ x: number, y: number }} move
   */
  startDash(move) {
    if (this.isDead || this.dashTimer > 0 || this.dashCooldown > 0) {
      return false;
    }
    const dir =
      move.x !== 0 || move.y !== 0
        ? { x: move.x, y: move.y }
        : { x: Math.cos(this.angle), y: Math.sin(this.angle) };
    this.dashDir = dir;
    this.dashTimer = PLAYER_DEFAULTS.DASH_DURATION;
    this.dashCooldown = PLAYER_DEFAULTS.DASH_COOLDOWN;
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

    if (this.lastStandTimer > 0) {
      this.lastStandTimer = Math.max(0, this.lastStandTimer - dt);
      this.isInvisible = this.lastStandTimer > 0;
    } else {
      this.isInvisible = false;
    }

    if (this.isDead) {
      this.isMoving = false;
      this.isInvisible = false;
      this.isRaging = false;
      this.deathAnim = Math.min(1, this.deathAnim + dt * 2.5);
      return;
    }

    // Regenerate health if undamaged for 5 seconds
    this.timeSinceLastDamage += dt;
    if (this.timeSinceLastDamage >= 5.0 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + 12 * dt);
    }

    if (this.isRaging) {
      this.rageTimer = Math.max(0, this.rageTimer - dt);
      this.rage = (this.rageTimer / this.rageDuration) * this.maxRage;
      if (this.rageTimer <= 0) {
        this.isRaging = false;
        this.rage = 0;
      }
    }

    const move = input.getMovementVector();

    // Weapon switching (Mouse Scroll / 1), Accessory switch (2), Rage (Q), & Reload (R)
    if (input.getWheelDelta?.() !== 0 || input.wasKeyPressed('Digit1')) {
      this.toggleWeapon();
    } else if (input.wasKeyPressed('Digit2')) {
      this.toggleAccessory();
    } else if (input.wasKeyPressed('KeyQ')) {
      this.activateRage();
    } else if (input.wasKeyPressed('KeyR')) {
      this.startReload();
    }

    // Active reload timer (2x faster during Rage mode)
    if (this.reloadTimer > 0) {
      const reloadRate = this.isRaging ? 2 : 1;
      this.reloadTimer = Math.max(0, this.reloadTimer - dt * reloadRate);
      if (this.reloadTimer === 0) {
        const ammo = this.ammoState[this.weaponKey];
        const needed = this.weapon.magSize - ammo.mag;
        const load = Math.min(needed, ammo.reserve);
        ammo.mag += load;
        ammo.reserve -= load;
      }
    }

    // Cooldowns & afterimages
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].life -= dt;
      if (this.afterimages[i].life <= 0) {
        this.afterimages.splice(i, 1);
      }
    }

    // Trigger Dash (Shift)
    if (input.wasKeyPressed('ShiftLeft') || input.wasKeyPressed('ShiftRight')) {
      this.startDash(move);
    }

    const speedMult = this.isRaging ? 1.5 : 1.0;

    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      this.isInvulnerable = this.dashTimer > 0;
      this.isMoving = true;
      this.x += this.dashDir.x * PLAYER_DEFAULTS.DASH_SPEED * (this.isRaging ? 1.2 : 1) * dt;
      this.y += this.dashDir.y * PLAYER_DEFAULTS.DASH_SPEED * (this.isRaging ? 1.2 : 1) * dt;
      if (Math.random() < 0.7) {
        this.afterimages.push({
          x: this.x,
          y: this.y,
          life: 0.14,
          maxLife: 0.14,
          color: this.isRaging ? '#ef4444' : '#38bdf8',
        });
      }
    } else {
      this.isInvulnerable = false;
      this.isMoving = move.x !== 0 || move.y !== 0;
      this.x += move.x * this.speed * speedMult * dt;
      this.y += move.y * this.speed * speedMult * dt;
    }

    // Apply & decay knockback impulse
    if (Math.abs(this.knockVx) > 1 || Math.abs(this.knockVy) > 1) {
      this.x += this.knockVx * dt;
      this.y += this.knockVy * dt;
      const decay = Math.pow(0.84, dt * 60);
      this.knockVx *= decay;
      this.knockVy *= decay;
    } else {
      this.knockVx = 0;
      this.knockVy = 0;
    }

    const margin = this.radius + 10;
    this.x = Math.max(margin, Math.min(bounds.width - margin, this.x));
    this.y = Math.max(margin, Math.min(bounds.height - margin, this.y));

    const mouse = input.getMousePosition();
    this.angle = Math.atan2(mouse.y - this.y, mouse.x - this.x);

    // Throw selected accessory on Right Click (G/F also work directly)
    if (input.wasRightClicked?.()) {
      this.throwGadget(this.selectedAccessory, mouse.x, mouse.y);
    } else if (input.wasKeyPressed('KeyG')) {
      this.selectedAccessory = 'grenade';
      this.throwGadget('grenade', mouse.x, mouse.y);
    } else if (input.wasKeyPressed('KeyF')) {
      this.selectedAccessory = 'flashbang';
      this.throwGadget('flashbang', mouse.x, mouse.y);
    }

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.reloadTimer <= 0 && input.isShooting() && this.fireCooldown <= 0) {
      this.shoot();
    }
  }

  /**
   * Spawns projectiles in the current aim direction if magazine has ammo.
   * @returns {object | null}
   */
  shoot() {
    if (this.isDead || this.reloadTimer > 0) {
      return null;
    }

    const w = this.weapon || WEAPONS.primary;
    const ammo = this.ammoState[this.weaponKey];
    if (ammo.mag <= 0) {
      this.startReload();
      return null;
    }

    ammo.mag -= 1;
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
        prevX: spawnX,
        prevY: spawnY,
        vx: Math.cos(shotAngle) * w.bulletSpeed,
        vy: Math.sin(shotAngle) * w.bulletSpeed,
        radius: w.bulletRadius,
        damage: w.damage * (this.isRaging ? 2 : 1),
        bounces: w.id === 'primary' ? 1 : 0,
        color: this.isRaging ? '#ef4444' : w.color,
        auraRgba: this.isRaging ? '239, 68, 68' : w.auraRgba,
        coreRgba: this.isRaging ? '254, 226, 226' : w.coreRgba,
      };
      this.bullets.push(bullet);
      if (!firstBullet) firstBullet = bullet;
    }

    this.fireCooldown = w.fireInterval;
    this.shootAnimTimer = 0.1;

    if (ammo.mag === 0 && ammo.reserve > 0) {
      this.startReload();
    }

    return firstBullet;
  }

  /**
   * Applies damage to the player and updates death state.
   * @param {number} amount
   * @returns {number} Remaining health
   */
  takeDamage(amount) {
    if (this.isDead || this.isInvulnerable || this.isInvisible || amount <= 0) {
      return this.health;
    }

    const effectiveAmount = this.isRaging ? amount * 0.5 : amount;
    this.health = Math.max(0, this.health - effectiveAmount);
    this.timeSinceLastDamage = 0;
    this.hurtTimer = 0.18;
    this.addRage(10);
    if (this.health <= 0) {
      this.isDead = true;
    } else if (!this.lastStandUsed && this.health <= this.maxHealth * 0.25) {
      this.lastStandUsed = true;
      this.lastStandTimer = 5.0;
      this.isInvisible = true;
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
      b.prevX = b.x;
      b.prevY = b.y;
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
    // Player projectiles (use transparent PNG sprite frames when loaded, fallback to glowing energy bolts)
    const bulletFrame =
      PLAYER_BULLET_FRAMES.length > 0
        ? PLAYER_BULLET_FRAMES[Math.floor(this.animTime * 14) % PLAYER_BULLET_FRAMES.length]
        : null;
    const useBulletSprite = bulletFrame && bulletFrame.width > 0 && !this.isRaging;

    ctx.save();
    if (!useBulletSprite) {
      ctx.globalCompositeOperation = 'lighter';
    }
    for (const b of this.bullets) {
      const angle = Math.atan2(b.vy, b.vx);

      if (useBulletSprite) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(angle + Math.PI / 2);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bulletFrame, -6, -12, 12, 24);
        ctx.restore();
        continue;
      }

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

    // Rage fiery aura
    if (!this.isDead && this.isRaging) {
      const auraR = this.radius + 7 + Math.sin(this.animTime * 18) * 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, auraR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    const facing = Math.cos(this.angle) >= 0 ? 1 : -1;
    const stride = this.isMoving && !this.isDead ? Math.sin(this.animTime * 16) : 0;
    const bob = this.isMoving && !this.isDead ? Math.abs(Math.cos(this.animTime * 16)) * 2 : 0;

    if (this.isDead) {
      ctx.rotate(facing * (Math.PI / 2) * this.deathAnim);
      ctx.globalAlpha = 0.85;
    } else if (this.isInvisible) {
      ctx.globalAlpha = 0.26 + Math.sin(this.animTime * 14) * 0.08;
      if (this.dashTimer > 0) {
        ctx.translate(0, 5);
        ctx.rotate(-facing * 0.35);
      } else {
        ctx.translate(0, -bob);
      }
    } else if (this.dashTimer > 0) {
      ctx.translate(0, -bob);
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

    // Reload progress bar above player
    if (!this.isDead && this.reloadTimer > 0 && this.reloadDuration > 0) {
      const progress = 1 - this.reloadTimer / this.reloadDuration;
      const barW = 36;
      const barH = 5;
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(-barW / 2, -32, barW, barH);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-barW / 2, -32, barW * progress, barH);
      ctx.restore();
    }

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
