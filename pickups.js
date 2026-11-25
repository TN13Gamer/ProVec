/**
 * Collectable pickups system for LAST STAND.
 * Supports Ammo, Health, Grenade, and Flashbang drops.
 */

export const PICKUP_TYPES = {
  ammo: {
    label: 'AMMO',
    color: '#38bdf8',
    bg: 'rgba(14, 165, 233, 0.22)',
    radius: 14,
  },
  health: {
    label: 'MEDKIT',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.22)',
    radius: 14,
  },
  grenade: {
    label: 'GRENADE',
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.22)',
    radius: 13,
  },
  flashbang: {
    label: 'FLASH',
    color: '#e2e8f0',
    bg: 'rgba(226, 232, 240, 0.22)',
    radius: 13,
  },
};

/**
 * Spawns a collectable pickup at (x, y).
 * @param {Array<any>} pickups
 * @param {number} x
 * @param {number} y
 * @param {'ammo' | 'health' | 'grenade' | 'flashbang'} type
 */
export function spawnPickup(pickups, x, y, type) {
  const cfg = PICKUP_TYPES[type] || PICKUP_TYPES.ammo;
  pickups.push({
    type: type in PICKUP_TYPES ? type : 'ammo',
    x,
    y,
    radius: cfg.radius,
    life: 18,
    maxLife: 18,
    animTime: Math.random() * Math.PI * 2,
  });
}

/**
 * Chooses a random pickup type weighted by player needs.
 * @param {{ health?: number, maxHealth?: number }} [player]
 * @returns {'ammo' | 'health' | 'grenade' | 'flashbang'}
 */
export function chooseRandomPickupType(player = {}) {
  const lowHealth = (player.health ?? 100) < (player.maxHealth ?? 100) * 0.6;
  const roll = Math.random();
  if (lowHealth && roll < 0.35) return 'health';
  if (roll < 0.45) return 'ammo';
  if (roll < 0.68) return 'health';
  if (roll < 0.85) return 'grenade';
  return 'flashbang';
}

/**
 * Updates pickup timers and removes expired pickups.
 * @param {Array<any>} pickups
 * @param {number} dt
 */
export function updatePickups(pickups, dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.life -= dt;
    p.animTime += dt;
    if (p.life <= 0) {
      pickups.splice(i, 1);
    }
  }
}

/**
 * Renders all active collectables on the canvas.
 * @param {Array<any>} pickups
 * @param {CanvasRenderingContext2D} ctx
 */
export function renderPickups(pickups, ctx) {
  for (const p of pickups) {
    // Blink during last 3 seconds before despawn
    if (p.life < 3 && Math.floor(p.life * 8) % 2 === 0) {
      continue;
    }

    const cfg = PICKUP_TYPES[p.type] || PICKUP_TYPES.ammo;
    const bob = Math.sin(p.animTime * 4) * 3;
    const py = p.y + bob;

    ctx.save();

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(p.x, py, p.radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = cfg.bg;
    ctx.fill();
    ctx.lineWidth = 1.75;
    ctx.strokeStyle = cfg.color;
    ctx.stroke();

    // Inner icon
    ctx.fillStyle = cfg.color;
    if (p.type === 'health') {
      ctx.fillRect(p.x - 2.5, py - 7, 5, 14);
      ctx.fillRect(p.x - 7, py - 2.5, 14, 5);
    } else if (p.type === 'ammo') {
      ctx.fillRect(p.x - 6, py - 5, 3, 10);
      ctx.fillRect(p.x - 1.5, py - 6, 3, 11);
      ctx.fillRect(p.x + 3, py - 5, 3, 10);
    } else if (p.type === 'grenade') {
      ctx.beginPath();
      ctx.arc(p.x, py + 1, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.fillRect(p.x - 2, py - 7, 4, 3);
    } else {
      // Flashbang star/cylinder
      ctx.fillRect(p.x - 3.5, py - 6, 7, 12);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(p.x - 3.5, py - 1.5, 7, 3);
    }

    ctx.restore();
  }
}
