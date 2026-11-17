// Synthesised sound effects, no audio files: every sound is a few oscillators and a
// noise buffer shaped by an envelope, built on the first user gesture (browsers block
// audio before one). Everything is guarded: with no audio device, or in a headless
// browser, every call is a silent no-op and the game plays on.

/** Master loudness; kept low so the game never shouts. */
const VOLUME = 0.12;

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) return context;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = VOLUME;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  /** One oscillator note: frequency slides from `from` to `to` over `seconds`. */
  function tone(from, to, seconds, type, gainValue, delay = 0) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    try {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, from), start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + seconds);
      gain.gain.setValueAtTime(gainValue, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + seconds + 0.02);
    } catch {
      // A sound is never worth breaking the game over.
    }
  }

  /** Filtered noise: the shared burst behind explosions and the NOVA. */
  function noise(seconds, gainValue, cutoff, delay = 0) {
    const ctx = ensure();
    if (ctx === null || muted) return;
    try {
      const start = ctx.currentTime + delay;
      const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainValue, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
    } catch {
      // See tone().
    }
  }

  return {
    /** Call from a user gesture so the context is allowed to start. */
    unlock() {
      const ctx = ensure();
      if (ctx !== null && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      tone(920, 420, 0.07, 'square', 0.10);
    },
    hit() {
      tone(300, 140, 0.08, 'triangle', 0.16);
    },
    explode() {
      noise(0.28, 0.5, 900);
      tone(180, 42, 0.28, 'sawtooth', 0.22);
    },
    bigExplode() {
      noise(0.6, 0.7, 600);
      tone(120, 30, 0.55, 'sawtooth', 0.3);
    },
    pickup() {
      tone(660, 990, 0.09, 'sine', 0.14);
    },
    nova() {
      noise(0.7, 0.6, 2400);
      tone(180, 1400, 0.6, 'sawtooth', 0.16);
      tone(90, 700, 0.6, 'square', 0.1, 0.05);
    },
    waveClear() {
      tone(523, 523, 0.12, 'sine', 0.16);
      tone(659, 659, 0.12, 'sine', 0.16, 0.1);
      tone(784, 784, 0.2, 'sine', 0.18, 0.2);
    },
    win() {
      tone(523, 523, 0.16, 'sine', 0.18);
      tone(659, 659, 0.16, 'sine', 0.18, 0.14);
      tone(784, 784, 0.16, 'sine', 0.18, 0.28);
      tone(1047, 1047, 0.4, 'sine', 0.2, 0.42);
    },
    lose() {
      tone(330, 330, 0.2, 'triangle', 0.18);
      tone(262, 262, 0.2, 'triangle', 0.18, 0.18);
      tone(196, 130, 0.45, 'triangle', 0.2, 0.36);
    },
  };
}
