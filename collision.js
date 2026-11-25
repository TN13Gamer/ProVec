import { BULLET_DEFAULTS } from './bullets.js';

/**
 * Checks whether two circular entities overlap.
 * @param {{ x: number, y: number, radius: number }} a
 * @param {{ x: number, y: number, radius: number }} b
 * @returns {boolean}
 */
export function checkCircleCollision(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const radiusSum = a.radius + b.radius;
  return dx * dx + dy * dy < radiusSum * radiusSum;
}

/**
 * Continuous swept segment-to-circle collision check to prevent fast bullet tunneling.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {number} r1
 * @param {{ x: number, y: number, radius: number }} target
 * @returns {boolean}
 */
export function checkSegmentCircleCollision(x1, y1, x2, y2, r1, target) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) {
    return checkCircleCollision({ x: x2, y: y2, radius: r1 }, target);
  }
  const t = Math.max(0, Math.min(1, ((target.x - x1) * dx + (target.y - y1) * dy) / lenSq));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  const distX = target.x - closestX;
  const distY = target.y - closestY;
  const radiusSum = r1 + target.radius;
  return distX * distX + distY * distY <= radiusSum * radiusSum;
}

/**
 * Resolves bullet-vs-enemy and enemy-vs-player collisions using the shared game object.
 * @param {{
 *   player: { x: number, y: number, radius: number, isDead: boolean, bullets?: Array<any>, takeDamage: (n: number) => number },
 *   enemies: Array<any>,
 *   bullets?: Array<any>
 * }} game
 */
export function resolveCombatCollisions(game) {
  const { player, enemies } = game;
  const bullets = game.bullets ?? player?.bullets ?? [];

  // Bullets vs Enemies
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    let hit = false;

    for (let j = enemies.length - 1; j >= 0; j--) {
      const enemy = enemies[j];
      if (enemy.isDead) continue;

      if (
        checkSegmentCircleCollision(
          bullet.prevX ?? bullet.x,
          bullet.prevY ?? bullet.y,
          bullet.x,
          bullet.y,
          bullet.radius,
          enemy
        )
      ) {
        const dmg = bullet.damage ?? BULLET_DEFAULTS.DAMAGE;
        enemy.takeDamage(dmg);
        if (enemy.isDead) {
          enemies.splice(j, 1);
        } else {
          // Physical bullet knockback on enemy
          const spd = Math.hypot(bullet.vx ?? 0, bullet.vy ?? 0) || 1;
          const resist = enemy.type === 'boss' ? 0.15 : enemy.type === 'brute' ? 0.35 : 1.0;
          const push = Math.min(10, dmg * 0.22) * resist;
          enemy.x += ((bullet.vx ?? 0) / spd) * push;
          enemy.y += ((bullet.vy ?? 0) / spd) * push;
        }
        hit = true;
        break;
      }
    }

    if (hit) {
      bullets.splice(i, 1);
    }
  }

  // Enemies vs Player
  if (!player || player.isDead) {
    return;
  }

  for (const enemy of enemies) {
    if (enemy.isDead) continue;

    if (checkCircleCollision(enemy, player) && enemy.canAttack()) {
      const prevHealth = player.health;
      player.takeDamage(enemy.damage);
      if (player.health < prevHealth) {
        const kb = enemy.type === 'boss' ? 560 : enemy.type === 'brute' ? 460 : 340;
        player.applyKnockback?.(enemy.x, enemy.y, kb);
      }
      enemy.resetAttackCooldown();
    }
  }
}
