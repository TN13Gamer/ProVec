/**
 * Destructible arena obstacles for LAST STAND with collision physics:
 * - Explosive Barrels: block/slide on impact and detonate when destroyed.
 * - Supply Boxes: block/slide on impact and drop Ammo, Health, Grenades, or Flashbangs.
 */

export const OBSTACLE_TYPES = {
  barrel: {
    radius: 19,
    maxHealth: 45,
    mass: 1.2,
    color: '#b91c1c',
    accent: '#fbbf24',
  },
  box: {
    radius: 22,
    maxHealth: 50,
    mass: 1.6,
    color: '#78552b',
    accent: '#d97706',
  },
};

/**
 * Creates an obstacle at (x, y) with physics velocity.
 * @param {number} x
 * @param {number} y
 * @param {'barrel' | 'box'} type
 */
export function createObstacle(x, y, type = 'box') {
  const cfg = OBSTACLE_TYPES[type] || OBSTACLE_TYPES.box;
  return {
    type: type in OBSTACLE_TYPES ? type : 'box',
    x,
    y,
    vx: 0,
    vy: 0,
    mass: cfg.mass,
    radius: cfg.radius,
    maxHealth: cfg.maxHealth,
    health: cfg.maxHealth,
    hitFlash: 0,
    isDestroyed: false,
  };
}

/**
 * Spawns fewer obstacles (5 total) at randomized non-overlapping positions away from center.
 * @param {{ width: number, height: number }} bounds
 * @param {number} [count=5]
 * @returns {Array<any>}
 */
export function createArenaObstacles(bounds, count = 5) {
  const cx = bounds.width / 2;
  const cy = bounds.height / 2;
  const obstacles = [];
  const margin = 105;

  let attempts = 0;
  while (obstacles.length < count && attempts < 120) {
    attempts += 1;
    const x = margin + Math.random() * (bounds.width - margin * 2);
    const y = margin + Math.random() * (bounds.height - margin * 2);

    // Keep center player spawn clear
    if (Math.hypot(x - cx, y - cy) < 150) continue;

    // Keep obstacles spaced apart
    let tooClose = false;
    for (const existing of obstacles) {
      if (Math.hypot(x - existing.x, y - existing.y) < 120) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const type = obstacles.length % 2 === 0 ? 'barrel' : 'box';
    obstacles.push(createObstacle(x, y, type));
  }

  return obstacles;
}

/**
 * Applies a physical impulse to an obstacle.
 * @param {object} obs
 * @param {number} ix
 * @param {number} iy
 */
export function applyObstacleImpulse(obs, ix, iy) {
  const invMass = 1 / (obs.mass || 1);
  obs.vx += ix * invMass;
  obs.vy += iy * invMass;
}

/**
 * Resolves solid collision between circular entities (player/enemies) and obstacles,
 * transferring physical push momentum to the obstacle.
 * @param {{ x: number, y: number, radius: number, dashTimer?: number }} entity
 * @param {Array<any>} obstacles
 * @param {{ width: number, height: number }} [bounds]
 */
export function resolveEntityObstacleCollision(entity, obstacles, bounds = null) {
  for (const obs of obstacles) {
    if (obs.isDestroyed) continue;
    const dx = entity.x - obs.x;
    const dy = entity.y - obs.y;
    const dist = Math.hypot(dx, dy);
    const minDist = entity.radius + obs.radius;

    if (dist < minDist) {
      const nx = dist > 0.001 ? dx / dist : 1;
      const ny = dist > 0.001 ? dy / dist : 0;
      const overlap = minDist - dist;

      // Push entity & obstacle apart based on mass ratio
      const entityShare = 0.72;
      const obsShare = 0.28;
      entity.x += nx * overlap * entityShare;
      entity.y += ny * overlap * entityShare;
      obs.x -= nx * overlap * obsShare;
      obs.y -= ny * overlap * obsShare;

      // Transfer physical push velocity to obstacle
      const pushImpulse = entity.dashTimer > 0 ? 220 : 85;
      applyObstacleImpulse(obs, -nx * pushImpulse, -ny * pushImpulse);
    }
  }

  if (bounds) {
    const margin = entity.radius + 10;
    entity.x = Math.max(margin, Math.min(bounds.width - margin, entity.x));
    entity.y = Math.max(margin, Math.min(bounds.height - margin, entity.y));
  }
}

/**
 * Updates obstacle physics (velocity, friction, wall bounce, obstacle-vs-obstacle collisions).
 * @param {Array<any>} obstacles
 * @param {number} dt
 * @param {{ width: number, height: number }} [bounds]
 */
export function updateObstacles(obstacles, dt, bounds = null) {
  const damping = Math.pow(0.86, dt * 60);

  for (const obs of obstacles) {
    if (obs.isDestroyed) continue;

    if (obs.hitFlash > 0) {
      obs.hitFlash = Math.max(0, obs.hitFlash - dt);
    }

    if (Math.abs(obs.vx) > 0.5 || Math.abs(obs.vy) > 0.5) {
      obs.x += obs.vx * dt;
      obs.y += obs.vy * dt;
      obs.vx *= damping;
      obs.vy *= damping;
    } else {
      obs.vx = 0;
      obs.vy = 0;
    }

    // Bounce off arena boundaries
    if (bounds) {
      const pad = obs.radius + 12;
      if (obs.x < pad) {
        obs.x = pad;
        obs.vx = Math.abs(obs.vx) * 0.5;
      } else if (obs.x > bounds.width - pad) {
        obs.x = bounds.width - pad;
        obs.vx = -Math.abs(obs.vx) * 0.5;
      }
      if (obs.y < pad) {
        obs.y = pad;
        obs.vy = Math.abs(obs.vy) * 0.5;
      } else if (obs.y > bounds.height - pad) {
        obs.y = bounds.height - pad;
        obs.vy = -Math.abs(obs.vy) * 0.5;
      }
    }
  }

  // Obstacle-vs-obstacle elastic collision physics
  for (let i = 0; i < obstacles.length; i++) {
    const a = obstacles[i];
    if (a.isDestroyed) continue;
    for (let j = i + 1; j < obstacles.length; j++) {
      const b = obstacles[j];
      if (b.isDestroyed) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const minDist = a.radius + b.radius;

      if (dist < minDist) {
        const nx = dist > 0.001 ? dx / dist : 1;
        const ny = dist > 0.001 ? dy / dist : 0;
        const overlap = (minDist - dist) * 0.5;

        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velAlongNormal = rvx * nx + rvy * ny;
        if (velAlongNormal < 0) {
          const restitution = 0.6;
          const jImpulse = (-(1 + restitution) * velAlongNormal) / (1 / a.mass + 1 / b.mass);
          a.vx -= (jImpulse / a.mass) * nx;
          a.vy -= (jImpulse / a.mass) * ny;
          b.vx += (jImpulse / b.mass) * nx;
          b.vy += (jImpulse / b.mass) * ny;
        }
      }
    }
  }
}

/**
 * Renders barrels and supply boxes onto the canvas.
 * @param {Array<any>} obstacles
 * @param {CanvasRenderingContext2D} ctx
 */
export function renderObstacles(obstacles, ctx) {
  for (const obs of obstacles) {
    if (obs.isDestroyed) continue;

    ctx.save();
    ctx.translate(obs.x, obs.y);

    // Ground shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
    ctx.beginPath();
    ctx.ellipse(2, 6, obs.radius * 0.95, obs.radius * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    if (obs.type === 'barrel') {
      // Explosive Hazard Barrel
      ctx.beginPath();
      ctx.arc(0, 0, obs.radius, 0, Math.PI * 2);
      ctx.fillStyle = obs.hitFlash > 0 ? '#fca5a5' : '#991b1b';
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#ef4444';
      ctx.stroke();

      // Hazard warning stripe & cap
      ctx.beginPath();
      ctx.arc(0, 0, obs.radius * 0.62, 0, Math.PI * 2);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(6, -5, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Supply Box / Crate
      const r = obs.radius * 0.9;
      ctx.fillStyle = obs.hitFlash > 0 ? '#fde68a' : '#5c4023';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.strokeRect(-r, -r, r * 2, r * 2);

      // Diagonal crate brace
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-r + 3, -r + 3);
      ctx.lineTo(r - 3, r - 3);
      ctx.moveTo(r - 3, -r + 3);
      ctx.lineTo(-r + 3, r - 3);
      ctx.stroke();

      // Center supply stencil
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-4, -4, 8, 8);
    }

    // Minimal health bar when damaged
    if (obs.health < obs.maxHealth) {
      const bw = obs.radius * 2;
      ctx.fillStyle = '#090b0d';
      ctx.fillRect(-obs.radius, -obs.radius - 9, bw, 4);
      ctx.fillStyle = obs.type === 'barrel' ? '#ef4444' : '#f59e0b';
      ctx.fillRect(-obs.radius, -obs.radius - 9, bw * (obs.health / obs.maxHealth), 4);
    }

    ctx.restore();
  }
}
