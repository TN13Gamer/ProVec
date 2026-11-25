/**
 * Destructible arena obstacles for LAST STAND:
 * - Explosive Barrels: block movement/shots and detonate when destroyed.
 * - Supply Boxes: block movement/shots and drop Ammo, Health, Grenades, or Flashbangs.
 */

export const OBSTACLE_TYPES = {
  barrel: {
    radius: 19,
    maxHealth: 45,
    color: '#b91c1c',
    accent: '#fbbf24',
  },
  box: {
    radius: 22,
    maxHealth: 50,
    color: '#78552b',
    accent: '#d97706',
  },
};

/**
 * Creates an obstacle at (x, y).
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
    radius: cfg.radius,
    maxHealth: cfg.maxHealth,
    health: cfg.maxHealth,
    hitFlash: 0,
    isDestroyed: false,
  };
}

/**
 * Generates an initial tactical layout of barrels and supply boxes away from center spawn.
 * @param {{ width: number, height: number }} bounds
 * @returns {Array<any>}
 */
export function createArenaObstacles(bounds) {
  const cx = bounds.width / 2;
  const cy = bounds.height / 2;
  const obstacles = [];

  const presets = [
    { x: cx - 320, y: cy - 170, type: 'barrel' },
    { x: cx + 320, y: cy - 170, type: 'box' },
    { x: cx - 340, y: cy + 170, type: 'box' },
    { x: cx + 340, y: cy + 170, type: 'barrel' },
    { x: cx - 180, y: cy - 210, type: 'box' },
    { x: cx + 180, y: cy + 210, type: 'box' },
    { x: cx, y: cy - 220, type: 'barrel' },
    { x: cx, y: cy + 220, type: 'barrel' },
    { x: cx - 470, y: cy, type: 'barrel' },
    { x: cx + 470, y: cy, type: 'box' },
  ];

  for (const p of presets) {
    obstacles.push(createObstacle(p.x, p.y, p.type));
  }
  return obstacles;
}

/**
 * Pushes circular entities (player/enemies) out of solid obstacles.
 * @param {{ x: number, y: number, radius: number }} entity
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
      const push = minDist - dist;
      entity.x += nx * push;
      entity.y += ny * push;
    }
  }

  if (bounds) {
    const margin = entity.radius + 10;
    entity.x = Math.max(margin, Math.min(bounds.width - margin, entity.x));
    entity.y = Math.max(margin, Math.min(bounds.height - margin, entity.y));
  }
}

/**
 * Updates hit flash timers on obstacles.
 * @param {Array<any>} obstacles
 * @param {number} dt
 */
export function updateObstacles(obstacles, dt) {
  for (const obs of obstacles) {
    if (obs.hitFlash > 0) {
      obs.hitFlash = Math.max(0, obs.hitFlash - dt);
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
