/**
 * TARS — Tactical Audio Response System
 * Intelligent Emergency Sound Engine for Vanguard GDC
 *
 * Uses Web Audio API for reliable, programmatic sound generation.
 * No external audio files required — fully self-contained.
 *
 * Threat-Level Sound Matrix:
 *   LOW      → Soft notification chime (gentle two-tone bell)
 *   MEDIUM   → Repeating tactical beep (staccato double-pulse)
 *   CRITICAL → Emergency siren (oscillating frequency sweep)
 */

class TARS {
  constructor() {
    this.audioCtx = null;
    this.activeNodes = [];
    this.intervalIds = [];
    this.isActive = false;
    this.currentLevel = null;
  }

  /**
   * Ensure AudioContext is initialized and resumed
   */
  _ensureContext() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // ─── THREAT CLASSIFICATION ENGINE ────────────────────────────────────

  /**
   * Classify threat based on severity, urgency, hazard type, and confidence.
   * @param {{ message?: string, priority?: string, hazardType?: string, confidence?: number }} params
   * @returns {'LOW' | 'MEDIUM' | 'CRITICAL'}
   */
  classifyThreat({ message = '', priority = '', hazardType = '', confidence = 0 }) {
    const msg = (message || '').toUpperCase();
    const pri = (priority || '').toUpperCase();
    const haz = (hazardType || '').toUpperCase();

    // ── CRITICAL triggers ──
    const criticalKeywords = [
      'FIRE', 'EXPLOSION', 'GUN', 'WEAPON', 'INTRUDER', 'STABBING',
      'HOSTAGE', 'BOMB', 'ACTIVE SHOOTER', 'KNIFE', 'ARMED',
      'ALTERCATION', 'COLLAPSED', 'TRAPPED',
    ];
    if (pri === 'CRITICAL' || pri === 'FIRE') return 'CRITICAL';
    if (haz === 'FIRE' || haz === 'THREAT') return 'CRITICAL';
    if (criticalKeywords.some(kw => msg.includes(kw))) return 'CRITICAL';
    if (confidence >= 90) return 'CRITICAL';

    // ── MEDIUM triggers ──
    const mediumKeywords = [
      'SMOKE', 'GAS', 'CONGESTION', 'CROWD', 'PANIC', 'STRUCTURAL',
      'FLOOD', 'MEDICAL', 'EMERGENCY', 'SUSPICIOUS', 'UNAUTHORIZED',
      'DAMAGE', 'VIBRATION', 'BURST', 'WATER',
    ];
    if (pri === 'MEDIUM' || pri === 'HIGH') return 'MEDIUM';
    if (mediumKeywords.some(kw => msg.includes(kw))) return 'MEDIUM';
    if (confidence >= 50) return 'MEDIUM';

    // ── LOW default ──
    return 'LOW';
  }

  // ─── SOUND GENERATORS ────────────────────────────────────────────────

  /**
   * LOW: Soft notification chime — gentle three-note ascending bell
   */
  playLow() {
    try {
      const ctx = this._ensureContext();
      const now = ctx.currentTime;

      // C5 (523Hz) → E5 (659Hz) → G5 (784Hz)
      this._playTone(ctx, 523.25, now,        0.18, 0.10, 'sine');
      this._playTone(ctx, 659.25, now + 0.22,  0.22, 0.10, 'sine');
      this._playTone(ctx, 783.99, now + 0.46,  0.16, 0.07, 'sine');

      this.currentLevel = 'LOW';
      this.isActive = true;

      // Auto-stop after chime completes
      const timerId = setTimeout(() => { this.isActive = false; }, 900);
      this.intervalIds.push(timerId);
    } catch (e) {
      console.warn('[TARS] Low sound failed:', e);
    }
  }

  /**
   * MEDIUM: Repeating tactical double-beep — staccato alert pattern
   */
  playMedium() {
    try {
      const ctx = this._ensureContext();
      this.currentLevel = 'MEDIUM';
      this.isActive = true;

      const beepPattern = () => {
        if (!this.isActive) return;
        const now = ctx.currentTime;
        // Double-pulse pattern: two quick beeps
        this._playTone(ctx, 880, now,        0.08, 0.22, 'square');
        this._playTone(ctx, 880, now + 0.12, 0.08, 0.22, 'square');
      };

      beepPattern(); // Immediate first cycle
      const id = setInterval(beepPattern, 1400);
      this.intervalIds.push(id);
    } catch (e) {
      console.warn('[TARS] Medium sound failed:', e);
    }
  }

  /**
   * CRITICAL: Emergency siren — oscillating frequency sweep with harmonic depth
   */
  playCritical() {
    try {
      const ctx = this._ensureContext();
      this.currentLevel = 'CRITICAL';
      this.isActive = true;

      // ── Primary siren oscillator (sine sweep 440↔880 Hz) ──
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.30, ctx.currentTime);

      const now = ctx.currentTime;
      for (let i = 0; i < 40; i++) {
        osc.frequency.linearRampToValueAtTime(880, now + i * 1.4 + 0.7);
        osc.frequency.linearRampToValueAtTime(440, now + i * 1.4 + 1.4);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      this.activeNodes.push({ osc, gain });

      // ── Secondary harmonic (sawtooth 220↔440 Hz at low volume) ──
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(220, ctx.currentTime);
      gain2.gain.setValueAtTime(0.06, ctx.currentTime);

      for (let i = 0; i < 40; i++) {
        osc2.frequency.linearRampToValueAtTime(440, now + i * 1.4 + 0.7);
        osc2.frequency.linearRampToValueAtTime(220, now + i * 1.4 + 1.4);
      }

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      this.activeNodes.push({ osc: osc2, gain: gain2 });
    } catch (e) {
      console.warn('[TARS] Critical sound failed:', e);
    }
  }

  /**
   * ESCALATION: Rapid harsh buzzer — brief authority-dispatch confirmation
   */
  playEscalation() {
    try {
      const ctx = this._ensureContext();
      const now = ctx.currentTime;

      // Five rapid harsh pulses
      for (let i = 0; i < 5; i++) {
        this._playTone(ctx, 600,  now + i * 0.14,        0.06, 0.35, 'square');
        this._playTone(ctx, 900,  now + i * 0.14 + 0.06, 0.05, 0.28, 'square');
      }
      // Final descending confirmation tone
      this._playTone(ctx, 500, now + 0.8, 0.25, 0.20, 'sine');
      this._playTone(ctx, 400, now + 1.1, 0.30, 0.15, 'sine');
    } catch (e) {
      console.warn('[TARS] Escalation sound failed:', e);
    }
  }

  // ─── INTERNAL HELPERS ────────────────────────────────────────────────

  /**
   * Play a single tone burst with smooth envelope
   */
  _playTone(ctx, freq, startTime, duration, volume, type) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    // Smooth ADSR-like envelope
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.008);
    gain.gain.setValueAtTime(volume, startTime + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  // ─── PUBLIC API ──────────────────────────────────────────────────────

  /**
   * Trigger sound by classified level string
   * @param {'LOW' | 'MEDIUM' | 'CRITICAL'} level
   * @returns {string} The level triggered
   */
  triggerByLevel(level) {
    this.silence(); // Stop any existing sounds first
    switch (level) {
      case 'LOW':      this.playLow(); break;
      case 'MEDIUM':   this.playMedium(); break;
      case 'CRITICAL': this.playCritical(); break;
      default:         this.playLow();
    }
    return level;
  }

  /**
   * Auto-classify alert data and trigger appropriate sound
   * @param {Object} alertData - Alert object with message, priority, etc.
   * @returns {string} The classified threat level
   */
  trigger(alertData) {
    const level = this.classifyThreat({
      message: alertData.message,
      priority: alertData.priority,
      hazardType: alertData.emergencyType || alertData.contextType,
      confidence: alertData.aiConfidence || 0,
    });
    this.triggerByLevel(level);
    return level;
  }

  /**
   * Silence all active sounds and clear intervals
   */
  silence() {
    // Gracefully stop oscillators
    this.activeNodes.forEach(({ osc, gain }) => {
      try {
        if (this.audioCtx) {
          gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        }
        osc.stop();
      } catch (e) { /* already stopped */ }
    });
    this.activeNodes = [];

    // Clear all interval/timeout timers
    this.intervalIds.forEach(id => {
      clearInterval(id);
      clearTimeout(id);
    });
    this.intervalIds = [];

    this.isActive = false;
    this.currentLevel = null;
  }

  /**
   * Get current engine status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      currentLevel: this.currentLevel,
    };
  }
}

// Singleton export
export const tars = new TARS();
export default tars;
