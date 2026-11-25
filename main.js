import { InputHandler } from './input.js';
import { Player } from './player.js';

export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;

/**
 * Resolves an existing canvas or creates a 1280x720 canvas in the document.
 * @returns {HTMLCanvasElement}
 */
function setupCanvas() {
  let canvas = document.getElementById('gameCanvas') || document.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'gameCanvas';
    document.body.appendChild(canvas);
  }
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  return canvas;
}

const canvas = setupCanvas();
const ctx = canvas.getContext('2d');
const input = new InputHandler(canvas);
const player = new Player(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

const bounds = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };

let lastTime = 0;
let animationFrameId = null;

/**
 * Resets the core game state to its initial values.
 */
export function restart() {
  player.reset(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  lastTime = performance.now();
}

/**
 * @param {number} dt
 */
function update(dt) {
  if (input.wasKeyPressed('KeyR')) {
    restart();
  }

  player.update(dt, input, bounds);
  input.endFrame();
}

function render() {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  player.render(ctx);
}

/**
 * @param {number} timestamp
 */
function gameLoop(timestamp) {
  if (lastTime === 0) {
    lastTime = timestamp;
  }

  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  update(dt);
  render();

  animationFrameId = requestAnimationFrame(gameLoop);
}

export function start() {
  if (animationFrameId === null) {
    lastTime = 0;
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

export { canvas, input, player };

start();
