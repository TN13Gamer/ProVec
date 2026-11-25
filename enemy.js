const ALIEN_SPRITES = {};
if (typeof Image !== 'undefined') {
  const spriteMap = {
    runner: './assets/sprites/alien_1_scout.png',
    stalker: './assets/sprites/alien_2_raider.png',
    brute: './assets/sprites/alien_3_tank.png',
    missiler: './assets/sprites/alien_5_missile_launcher.png',
  };
  for (const [key, src] of Object.entries(spriteMap)) {
    const img = new Image();
    img.src = src;
    ALIEN_SPRITES[key] = img;
  }
}

export const ENEMY_TYPES = {
  // Melee 1: Aggressive, fast, low health
  runner: {
    name: 'SCOUT',
    radius: 14,
    speed: 185,
    maxHealth: 25,
    damage: 9,
    attackInterval: 0.7,
    color: '#84cc16',
    strokeColor: '#d9f99d',
  },
  // Melee 2: Medium movement, medium health
  stalker: {
    name: 'RAIDER',
    radius: 20,
    speed: 125,
    maxHealth: 80,
    damage: 13,
    attackInterval: 0.9,
    color: '#3b82f6',
    strokeColor: '#bfdbfe',
  },
  // Melee 3: Tank, slow, very high health
  brute: {
    name: 'TANK',
    radius: 29,
    speed: 72,
    maxHealth: 320,
    damage: 24,
    attackInterval: 1.1,
    color: '#dc2626',
    strokeColor: '#fca5a5',
  },
  // Shooter 1: Bullet shooter
  spitter: {
    name: 'SPITTER',
    radius: 17,
    speed: 115,
    maxHealth: 50,
    damage: 9,
    attackInterval: 0.95,
    color: '#14b8a6',
    strokeColor: '#99f6e4',
  },
  // Shooter 2: Missile shooter
  missiler: {
    name: 'LAUNCHER',
    radius: 21,
    speed: 85,
    maxHealth: 90,
    damage: 12,
    attackInterval: 1.0,
    color: '#f59e0b',
    strokeColor: '#fde68a',
  },
  boss: {
    name: 'OVERLORD',
    radius: 44,
    speed: 80,
    maxHealth: 950,
    damage: 25,
    attackInterval: 1.0,
    color: '#a855f7',
    strokeColor: '#f3e8ff',
  },
};

export class Enemy {
  /**
   * @param {number} x
   * @param {number} y
   * @param {'runner' | 'brute' | 'spitter' | 'boss'} [type='runner']
   * @param {{ speedMultiplier?: number, healthMultiplier?: number, damageMultiplier?: number, fireRateMultiplier?: number }} [scaling]
   */
  constructor(x, y, type = 'runner', scaling = {}) {
    const config = ENEMY_TYPES[type] || ENEMY_TYPES.runner;
    const speedMult = scaling.speedMultiplier ?? 1;
    const healthMult = scaling.healthMultiplier ?? 1;
    const damageMult = scaling.damageMultiplier ?? 1;
    const fireRateMult = scaling.fireRateMultiplier ?? 1;

    this.x = x;
    this.y = y;
    this.type = type in ENEMY_TYPES ? type : 'runner';
    this.name = config.name || this.type.toUpperCase();
    this.radius = config.radius;
    this.speed = config.speed * speedMult;
    this.maxHealth = Math.round(config.maxHealth * healthMult);
    this.health = this.maxHealth;
    this.damage = Math.round(config.damage * damageMult);
    this.attackInterval = config.attackInterval / fireRateMult;
    this.fireRateMultiplier = fireRateMult;
    this.damageMultiplier = damageMult;
    this.attackCooldown = 0;
    this.stunTimer = 0;
    this.bossFireCooldown = 2.0 / fireRateMult;
    this.rangedFireCooldown = (1.1 + Math.random() * 0.8) / fireRateMult;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.strafeTimer = 1.5 + Math.random() * 1.5;
    this.aiSeed = Math.random() * Math.PI * 2;
    this.lungeTimer = 0;
    this.lungeCooldown = 0;
    this.angle = 0;
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

    if (!target || target.isDead || target.isInvisible) {
      return;
    }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);

    this.lungeCooldown = Math.max(0, this.lungeCooldown - dt);
    if (this.type === 'runner' && dist < 165 && dist > 40 && this.lungeCooldown <= 0) {
      this.lungeTimer = 0.2;
      this.lungeCooldown = 3.0 / this.fireRateMultiplier;
    }

    let currentSpeed = this.speed;
    if (this.lungeTimer > 0) {
      this.lungeTimer = Math.max(0, this.lungeTimer - dt);
      currentSpeed *= 1.35;
    }

    if (dist > 0.001) {
      this.angle = Math.atan2(dy, dx);
      const nx = dx / dist;
      const ny = dy / dist;

      if (this.type === 'spitter' || this.type === 'missiler') {
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
          this.strafeDir *= -1;
          this.strafeTimer = 1.4 + Math.random() * 1.6;
        }
        const preferredFar = this.type === 'missiler' ? 370 : 310;
        const preferredNear = this.type === 'missiler' ? 230 : 180;
        if (dist > preferredFar) {
          this.x += nx * currentSpeed * dt;
          this.y += ny * currentSpeed * dt;
        } else if (dist < preferredNear) {
          this.x -= nx * currentSpeed * 0.8 * dt;
          this.y -= ny * currentSpeed * 0.8 * dt;
        } else {
          this.x += -ny * this.strafeDir * currentSpeed * 0.72 * dt;
          this.y += nx * this.strafeDir * currentSpeed * 0.72 * dt;
        }
      } else if (this.type === 'runner') {
        // Runners weave laterally as they rush in
        const weave = Math.sin(this.animTime * 5.5 + this.aiSeed) * 0.35;
        this.x += (nx - ny * weave) * currentSpeed * dt;
        this.y += (ny + nx * weave) * currentSpeed * dt;
      } else if (this.type === 'stalker') {
        // Stalkers flank at an angle until close, then rush straight in
        const flank = dist > 140 ? 0.38 * this.strafeDir : 0;
        this.x += (nx - ny * flank) * currentSpeed * dt;
        this.y += (ny + nx * flank) * currentSpeed * dt;
      } else {
        this.x += nx * currentSpeed * dt;
        this.y += ny * currentSpeed * dt;
      }
    }

    // Shooter 1: Spitter rapid plasma bullets
    if (this.type === 'spitter' && enemyBullets) {
      this.rangedFireCooldown -= dt;
      if (this.rangedFireCooldown <= 0 && dist < 520) {
        const angle = Math.atan2(dy, dx);
        enemyBullets.push({
          x: this.x + Math.cos(angle) * (this.radius + 6),
          y: this.y + Math.sin(angle) * (this.radius + 6),
          vx: Math.cos(angle) * 290,
          vy: Math.sin(angle) * 290,
          radius: 5.5,
          damage: Math.round(9 * this.damageMultiplier),
          color: '#f43f5e',
        });
        this.rangedFireCooldown = 2.35 / this.fireRateMultiplier;
      }
    }

    // Shooter 2: Missiler guided bio-missiles
    if (this.type === 'missiler' && enemyBullets) {
      this.rangedFireCooldown -= dt;
      if (this.rangedFireCooldown <= 0 && dist < 580) {
        const angle = Math.atan2(dy, dx);
        enemyBullets.push({
          isMissile: true,
          x: this.x + Math.cos(angle) * (this.radius + 8),
          y: this.y + Math.sin(angle) * (this.radius + 8),
          vx: Math.cos(angle) * 195,
          vy: Math.sin(angle) * 195,
          speed: 195,
          life: 2.6,
          radius: 10,
          damage: Math.round(16 * this.damageMultiplier),
          color: '#f97316',
        });
        this.rangedFireCooldown = 3.4 / this.fireRateMultiplier;
      }
    }

    // Boss radial plasma burst attack
    if (this.type === 'boss' && enemyBullets) {
      this.bossFireCooldown -= dt;
      if (this.bossFireCooldown <= 0) {
        const baseAngle = Math.atan2(dy, dx);
        const count = 7;
        const spread = 1.5;
        for (let i = 0; i < count; i++) {
          const angle = baseAngle + (i / (count - 1) - 0.5) * spread;
          enemyBullets.push({
            x: this.x + Math.cos(angle) * (this.radius + 6),
            y: this.y + Math.sin(angle) * (this.radius + 6),
            vx: Math.cos(angle) * 250,
            vy: Math.sin(angle) * 250,
            radius: 7,
            damage: Math.round(13 * this.damageMultiplier),
          });
        }
        this.bossFireCooldown = 2.6 / this.fireRateMultiplier;
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
    ctx.translate(this.x, this.y);

    // Ground shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 6, this.radius * 0.95, this.radius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.type === 'boss') {
      const pulse = 7 + Math.sin(this.animTime * 4) * 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Rotate alien to face player
    ctx.save();
    ctx.rotate(this.angle);

    const stunned = this.stunTimer > 0;
    const legSwing = stunned ? 0 : Math.sin(this.animTime * (this.type === 'runner' ? 20 : 12));
    const sprite = ALIEN_SPRITES[this.type];

    if (sprite && sprite.complete && sprite.naturalWidth > 0) {
      const size = this.radius * 2.5;
      ctx.save();
      ctx.rotate(this.angle + Math.PI / 2);
      ctx.imageSmoothingEnabled = false;
      if (stunned) ctx.globalAlpha = 0.65;
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else if (this.type === 'runner') {
      // Scuttling alien legs (3 pairs)
      ctx.strokeStyle = stunned ? '#cbd5e1' : '#365314';
      ctx.lineWidth = 2.4;
      for (let side of [-1, 1]) {
        for (let i = -1; i <= 1; i++) {
          const offset = i * 6 + legSwing * (i % 2 === 0 ? 3 : -3);
          ctx.beginPath();
          ctx.moveTo(i * 4, side * 6);
          ctx.lineTo(offset, side * (this.radius + 4));
          ctx.stroke();
        }
      }

      // Wiggling segmented alien tail
      const tailWag = Math.sin(this.animTime * 14) * 5;
      ctx.strokeStyle = stunned ? '#94a3b8' : '#4d7c0f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-this.radius + 4, 0);
      ctx.quadraticCurveTo(-this.radius - 8, tailWag, -this.radius - 15, -tailWag * 0.6);
      ctx.stroke();

      // Elongated alien carapace
      ctx.fillStyle = stunned ? '#cbd5e1' : '#65a30d';
      ctx.strokeStyle = stunned ? '#ffffff' : '#d9f99d';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius, this.radius * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Mandibles
      ctx.strokeStyle = '#ecfccb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.radius - 3, -5);
      ctx.lineTo(this.radius + 6, -2);
      ctx.moveTo(this.radius - 3, 5);
      ctx.lineTo(this.radius + 6, 2);
      ctx.stroke();

      // Glowing alien eyes
      ctx.fillStyle = stunned ? '#fde047' : '#fef08a';
      ctx.beginPath();
      ctx.arc(this.radius * 0.45, -4, 2.3, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.45, 4, 2.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'brute') {
      // Heavy clawed alien limbs
      ctx.strokeStyle = stunned ? '#94a3b8' : '#7f1d1d';
      ctx.lineWidth = 4.5;
      for (let side of [-1, 1]) {
        for (let i of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(i * 6, side * 12);
          ctx.lineTo(i * 12 + legSwing * 3, side * (this.radius + 6));
          ctx.stroke();
        }
      }

      // Armored alien thorax
      ctx.fillStyle = stunned ? '#cbd5e1' : '#991b1b';
      ctx.strokeStyle = stunned ? '#ffffff' : '#fca5a5';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius, this.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Chitin dorsal plates
      ctx.fillStyle = stunned ? '#94a3b8' : '#dc2626';
      ctx.beginPath();
      ctx.ellipse(-4, 0, this.radius * 0.55, this.radius * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();

      // Forward horns / pincers
      ctx.fillStyle = '#fecaca';
      ctx.beginPath();
      ctx.moveTo(this.radius - 6, -11);
      ctx.lineTo(this.radius + 10, -5);
      ctx.lineTo(this.radius - 2, -4);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(this.radius - 6, 11);
      ctx.lineTo(this.radius + 10, 5);
      ctx.lineTo(this.radius - 2, 4);
      ctx.closePath();
      ctx.fill();

      // Triple glowing predatory eyes
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(this.radius * 0.5, -6, 2.8, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.5, 6, 2.8, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.65, 0, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'spitter') {
      // Ranged Alien Spitter (teal carapace + glowing bio-plasma sac + snout)
      ctx.strokeStyle = stunned ? '#94a3b8' : '#0f766e';
      ctx.lineWidth = 2.8;
      for (let side of [-1, 1]) {
        for (let i of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(i * 4, side * 7);
          ctx.lineTo(i * 8 + legSwing * 2.5, side * (this.radius + 5));
          ctx.stroke();
        }
      }

      // Glowing plasma sac on back
      ctx.fillStyle = stunned ? '#cbd5e1' : '#f43f5e';
      ctx.beginPath();
      ctx.arc(-6, 0, this.radius * 0.52, 0, Math.PI * 2);
      ctx.fill();

      // Main teal carapace
      ctx.fillStyle = stunned ? '#cbd5e1' : '#0d9488';
      ctx.strokeStyle = stunned ? '#ffffff' : '#99f6e4';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(2, 0, this.radius * 0.9, this.radius * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Bio-cannon snout
      ctx.fillStyle = '#134e4a';
      ctx.fillRect(this.radius * 0.5, -4, 10, 8);
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(this.radius * 0.5 + 10, 0, 3, 0, Math.PI * 2);
      ctx.fill();

      // Glowing eyes
      ctx.fillStyle = '#fda4af';
      ctx.beginPath();
      ctx.arc(this.radius * 0.45, -5, 2.4, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.45, 5, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'stalker') {
      // Medium Melee Alien: armored blue-cobalt hunter
      ctx.strokeStyle = stunned ? '#94a3b8' : '#1e40af';
      ctx.lineWidth = 3.2;
      for (let side of [-1, 1]) {
        for (let i of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(i * 5, side * 9);
          ctx.lineTo(i * 10 + legSwing * 3, side * (this.radius + 5));
          ctx.stroke();
        }
      }

      ctx.fillStyle = stunned ? '#cbd5e1' : '#1d4ed8';
      ctx.strokeStyle = stunned ? '#ffffff' : '#93c5fd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius, this.radius * 0.78, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Razor mandibles
      ctx.fillStyle = '#dbeafe';
      ctx.beginPath();
      ctx.moveTo(this.radius - 4, -7);
      ctx.lineTo(this.radius + 8, -3);
      ctx.lineTo(this.radius - 2, -2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(this.radius - 4, 7);
      ctx.lineTo(this.radius + 8, 3);
      ctx.lineTo(this.radius - 2, 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(this.radius * 0.48, -5, 2.5, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.48, 5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'missiler') {
      // Missile Shooter Alien: heavy amber carapace with twin dorsal missile pods
      ctx.strokeStyle = stunned ? '#94a3b8' : '#78350f';
      ctx.lineWidth = 3.4;
      for (let side of [-1, 1]) {
        for (let i of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(i * 5, side * 10);
          ctx.lineTo(i * 9 + legSwing * 2, side * (this.radius + 5));
          ctx.stroke();
        }
      }

      ctx.fillStyle = stunned ? '#cbd5e1' : '#b45309';
      ctx.strokeStyle = stunned ? '#ffffff' : '#fde68a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius, this.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Twin dorsal missile launcher pods
      ctx.fillStyle = '#451a03';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-6, -15, 16, 7);
      ctx.strokeRect(-6, -15, 16, 7);
      ctx.fillRect(-6, 8, 16, 7);
      ctx.strokeRect(-6, 8, 16, 7);

      // Glowing warhead tips
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(8, -14, 4, 5);
      ctx.fillRect(8, 9, 4, 5);

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(this.radius * 0.5, -4, 2.5, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.5, 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // BOSS: Alien Hive Overlord
      // 6 writhing tentacles / alien limbs
      ctx.strokeStyle = stunned ? '#cbd5e1' : '#6b21a8';
      ctx.lineWidth = 5;
      for (let i = 0; i < 6; i++) {
        const baseAngle = ((i / 6) * Math.PI * 2) + Math.PI / 6;
        const wiggle = Math.sin(this.animTime * 8 + i * 1.4) * 0.22;
        const a = baseAngle + wiggle;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (this.radius * 0.6), Math.sin(a) * (this.radius * 0.6));
        ctx.lineTo(Math.cos(a) * (this.radius + 14), Math.sin(a) * (this.radius + 14));
        ctx.stroke();
      }

      // Main alien carapace
      ctx.fillStyle = stunned ? '#cbd5e1' : '#581c87';
      ctx.strokeStyle = stunned ? '#ffffff' : '#e879f9';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.radius, this.radius * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Bioluminescent hive core
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(-4, 0, this.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Massive mandibles
      ctx.fillStyle = '#f5d0fe';
      ctx.beginPath();
      ctx.moveTo(this.radius - 8, -18);
      ctx.lineTo(this.radius + 16, -8);
      ctx.lineTo(this.radius - 2, -6);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(this.radius - 8, 18);
      ctx.lineTo(this.radius + 16, 8);
      ctx.lineTo(this.radius - 2, 6);
      ctx.closePath();
      ctx.fill();

      // 4 glowing alien eyes
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(this.radius * 0.52, -10, 4, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.52, 10, 4, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.68, -4, 3, 0, Math.PI * 2);
      ctx.arc(this.radius * 0.68, 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Stunned indicator ring
    if (this.stunTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 6, this.animTime * 8, this.animTime * 8 + Math.PI * 1.3);
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Minimal health bar above damaged regular enemies (boss uses top HUD bar)
    if (this.type !== 'boss' && this.health < this.maxHealth) {
      const barWidth = this.radius * 2;
      const barHeight = 4;
      const barX = -this.radius;
      const barY = -this.radius - 10;

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(barX, barY, barWidth, barHeight);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(barX, barY, barWidth * (this.health / this.maxHealth), barHeight);
    }

    // Alien name tag
    ctx.font = '700 9px "Consolas", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(9, 11, 13, 0.75)';
    const labelY = this.type !== 'boss' && this.health < this.maxHealth ? -this.radius - 13 : -this.radius - 6;
    ctx.fillStyle = this.strokeColor || '#e5e7eb';
    ctx.fillText(this.name, 0, labelY);

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

  // Soft separation so aliens fan out instead of stacking into one blob
  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i];
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.radius + b.radius + 4;
      if (dist > 0.001 && dist < minDist) {
        const push = (minDist - dist) * 0.35;
        const nx = dx / dist;
        const ny = dy / dist;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
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
