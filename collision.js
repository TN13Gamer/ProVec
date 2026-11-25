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

      if (checkCircleCollision(bullet, enemy)) {
        enemy.takeDamage(bullet.damage ?? BULLET_DEFAULTS.DAMAGE);
        if (enemy.isDead) {
          enemies.splice(j, 1);
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
