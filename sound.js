/**
 * High-quality procedural Web Audio API sound engine for LAST STAND.
 * Uses filtered noise, sub-bass punches, and a master compressor to avoid harsh/buzzy tones.
 */

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
  }

  _ensureContext() {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.15;

      const master = this.ctx.createGain();
      master.gain.value = 0.55;
      master.connect(comp);
      comp.connect(this.ctx.destination);
      this.master = master;

      // Reusable 1-second white noise buffer
      const len = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  unlock() {
    this._ensureContext();
  }

  _playNoise(duration, filterType, startFreq, endFreq, peakGain, delay = 0) {
    const ctx = this._ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const t = ctx.currentTime + delay;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(startFreq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.01);
  }

  _playTone(type, startFreq, endFreq, duration, peakGain, delay = 0) {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime + delay;

    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, endFreq), t + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  /**
   * @param {'primary' | 'secondary'} [weaponKey='primary']
   * @param {boolean} [isRaging=false]
   */
  playShoot(weaponKey = 'primary', isRaging = false) {
    if (weaponKey === 'secondary') {
      // Heavy tactical shotgun boom
      this._playNoise(0.14, 'lowpass', 1200, 180, 0.28);
      this._playTone('sine', isRaging ? 150 : 125, 42, 0.13, 0.24);
    } else {
      // Crisp suppressed pulse rifle pop
      this._playNoise(0.045, 'bandpass', isRaging ? 1900 : 1500, 420, 0.12);
      this._playTone('triangle', isRaging ? 320 : 260, 88, 0.065, 0.12);
    }
  }

  playHit() {
    this._playTone('sine', 210, 95, 0.04, 0.06);
  }

  playExplosion(scale = 1) {
    const dur = Math.min(0.55, 0.32 * scale);
    this._playNoise(dur, 'lowpass', 480, 55, Math.min(0.45, 0.3 * scale));
    this._playTone('sine', 105, 28, Math.min(0.4, 0.26 * scale), Math.min(0.4, 0.28 * scale));
  }

  playPlayerDamage() {
    this._playNoise(0.12, 'lowpass', 520, 120, 0.18);
    this._playTone('triangle', 120, 48, 0.15, 0.22);
  }

  playPickup() {
    this._playTone('sine', 523.25, 523.25, 0.08, 0.1, 0);
    this._playTone('sine', 659.25, 659.25, 0.12, 0.11, 0.065);
  }

  playDash() {
    this._playNoise(0.14, 'bandpass', 950, 280, 0.16);
  }

  playReload() {
    this._playNoise(0.025, 'highpass', 1800, 900, 0.1, 0);
    this._playNoise(0.03, 'highpass', 2200, 1100, 0.12, 0.07);
  }

  playRage() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    // Deep sub-bass power surge + rising filtered synth roar
    this._playTone('sine', 75, 190, 0.45, 0.34, 0);
    this._playTone('sawtooth', 110, 330, 0.42, 0.22, 0.02);
    this._playTone('triangle', 220, 440, 0.38, 0.18, 0.06);
    this._playNoise(0.35, 'bandpass', 300, 1800, 0.24, 0);
  }

  playFlashbang() {
    this._playNoise(0.16, 'bandpass', 2200, 600, 0.22);
    this._playTone('sine', 440, 220, 0.18, 0.1);
  }

  playLastStand() {
    this._playTone('sine', 293.66, 440, 0.22, 0.14, 0);
    this._playTone('sine', 440, 587.33, 0.26, 0.14, 0.1);
  }
}
