export class InputHandler {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressedKeys = new Set();
    this.mouse = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      isDown: false,
      justPressed: false,
      rightDown: false,
      rightJustPressed: false,
    };
    this.wheelDelta = 0;

    this._onKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
      }
      if (!this.keys.has(e.code)) {
        this.justPressedKeys.add(e.code);
      }
      this.keys.add(e.code);
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    this._onMouseMove = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    };

    this._onMouseDown = (e) => {
      if (e.button === 0) {
        if (!this.mouse.isDown) {
          this.mouse.justPressed = true;
        }
        this.mouse.isDown = true;
      } else if (e.button === 2) {
        if (!this.mouse.rightDown) {
          this.mouse.rightJustPressed = true;
        }
        this.mouse.rightDown = true;
      }
    };

    this._onMouseUp = (e) => {
      if (e.button === 0) {
        this.mouse.isDown = false;
      } else if (e.button === 2) {
        this.mouse.rightDown = false;
      }
    };

    this._onContextMenu = (e) => {
      e.preventDefault();
    };

    this._onWheel = (e) => {
      this.wheelDelta += Math.sign(e.deltaY);
    };

    this._onBlur = () => {
      this.keys.clear();
      this.justPressedKeys.clear();
      this.mouse.isDown = false;
      this.mouse.justPressed = false;
      this.mouse.rightDown = false;
      this.mouse.rightJustPressed = false;
      this.wheelDelta = 0;
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    this.canvas.addEventListener('contextmenu', this._onContextMenu);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: true });
    window.addEventListener('mouseup', this._onMouseUp);
  }

  /**
   * Returns a normalized 2D movement vector from WASD keys.
   * @returns {{ x: number, y: number }}
   */
  getMovementVector() {
    let x = 0;
    let y = 0;

    if (this.keys.has('KeyW')) y -= 1;
    if (this.keys.has('KeyS')) y += 1;
    if (this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('KeyD')) x += 1;

    if (x !== 0 && y !== 0) {
      const length = Math.hypot(x, y);
      x /= length;
      y /= length;
    }

    return { x, y };
  }

  /**
   * Returns current mouse position in canvas coordinates.
   * @returns {{ x: number, y: number }}
   */
  getMousePosition() {
    return { x: this.mouse.x, y: this.mouse.y };
  }

  /**
   * Returns true while left mouse button or Spacebar is held down.
   * @returns {boolean}
   */
  isShooting() {
    return this.mouse.isDown || this.keys.has('Space');
  }

  /**
   * Returns true if the key was pressed during the current frame.
   * @param {string} code
   * @returns {boolean}
   */
  wasKeyPressed(code) {
    return this.justPressedKeys.has(code);
  }

  /**
   * Returns true while the given key is held down.
   * @param {string} code
   * @returns {boolean}
   */
  isKeyDown(code) {
    return this.keys.has(code);
  }

  /**
   * Returns true if right mouse button was pressed during the current frame.
   * @returns {boolean}
   */
  wasRightClicked() {
    return this.mouse.rightJustPressed;
  }

  /**
   * Returns non-zero scroll direction if mouse wheel moved this frame.
   * @returns {number}
   */
  getWheelDelta() {
    return this.wheelDelta;
  }

  /**
   * Clears per-frame input edge states. Call at the end of each frame.
   */
  endFrame() {
    this.justPressedKeys.clear();
    this.mouse.justPressed = false;
    this.mouse.rightJustPressed = false;
    this.wheelDelta = 0;
  }

  /**
   * Removes all registered event listeners.
   */
  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('contextmenu', this._onContextMenu);
    this.canvas.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('mouseup', this._onMouseUp);
  }
}
