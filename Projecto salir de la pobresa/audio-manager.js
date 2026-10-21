/* Original procedural soundtrack and SFX. No external media or audio dependencies.
 * The generated sounds are dedicated to CC0-1.0; see docs/mobile-audio/README.md.
 * Audio buffers live in memory; this module does not claim to ship audio files.
 */
"use strict";

class AudioManager {
  constructor(options = {}) {
    this.Context = window.AudioContext || window.webkitAudioContext;
    this.supported = Boolean(this.Context);
    this.context = null;
    this.unlocked = false;
    this.scene = "menu";
    this.blockers = new Set();
    this.buffers = new Map();
    this.voices = new Set();
    this.lastPlayed = new Map();
    this.music = null;
    this.musicBuffer = null;
    this.musicLoading = null;
    this.resumePending = null;
    this.options = { musicEnabled: true, effectsEnabled: true, masterVolume: 0.5, ...options };
    this.lastError = null;
  }

  // Called only from a trusted pointer/keyboard event, never at page load.
  unlock() {
    if (!this.supported) return Promise.resolve(false);
    try {
      if (!this.context) {
        this.context = new this.Context({ latencyHint: "interactive" });
        this.master = this.context.createGain();
        this.effects = this.context.createGain();
        this.effects.gain.value = 0.65;
        this.effects.connect(this.master);
        this.master.connect(this.context.destination);
        this.master.gain.value = this.options.masterVolume;
        this.context.onstatechange = () => {
          if (this.context.state === "suspended" && this.canRun()) void this.reconcile();
          else if (this.context.state === "running" && !this.canRun()) void this.reconcile();
        };
      }
      this.unlocked = true;
      return this.reconcile();
    } catch (error) {
      this.lastError = error.name;
      this.supported = false;
      return Promise.resolve(false);
    }
  }

  setOptions(options) {
    this.options = { ...this.options, ...options };
    const volume = Number(this.options.masterVolume);
    this.options.masterVolume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.5;
    if (this.master) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(this.options.masterVolume, this.context.currentTime, 0.015);
    }
    if (!this.options.effectsEnabled || !this.options.masterVolume) this.stopEffects();
    void this.reconcile();
  }

  setScene(scene) {
    if (this.scene === scene) return;
    this.scene = scene;
    if (scene === "paused") this.stopEffects();
    void this.reconcile();
  }

  setBlocked(reason, blocked) {
    if (blocked) this.blockers.add(reason);
    else this.blockers.delete(reason);
    if (blocked) this.stopEffects();
    void this.reconcile();
  }

  canRun() {
    return this.unlocked && !this.blockers.size && this.options.masterVolume > 0 &&
      (this.options.effectsEnabled || (this.scene === "menu" && this.options.musicEnabled));
  }

  reconcile() {
    const context = this.context;
    if (!context || context.state === "closed") return Promise.resolve(false);
    if (!this.canRun()) {
      this.stopMusic(true);
      if (context.state === "running") return context.suspend().then(() => false).catch(() => false);
      return Promise.resolve(false);
    }
    if (context.state !== "running") {
      if (!this.resumePending) {
        this.resumePending = context.resume().then(() => {
          this.resumePending = null;
          return this.reconcile();
        }).catch((error) => {
          this.resumePending = null;
          this.lastError = error.name;
          return false;
        });
      }
      return this.resumePending;
    }
    if (this.scene === "menu" && this.options.musicEnabled) this.startMusic();
    else this.stopMusic();
    return Promise.resolve(true);
  }

  startMusic() {
    if (this.music) return;
    if (!this.musicBuffer) {
      if (!this.musicLoading) {
        this.musicLoading = this.renderMenuMusic().then((buffer) => {
          this.musicBuffer = buffer;
          // Re-check scene/visibility: rendering may finish after leaving the menu.
          if (buffer) void this.reconcile();
          return buffer;
        }).catch((error) => { this.lastError = error.name; return null; });
      }
      return;
    }
    const context = this.context;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = this.musicBuffer;
    source.loop = true;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, context.currentTime + 0.12);
    source.connect(gain);
    gain.connect(this.master);
    const music = { source, gain };
    this.music = music;
    source.onended = () => {
      source.disconnect(); gain.disconnect();
      if (this.music === music) this.music = null;
    };
    source.start();
  }

  stopMusic(immediate = false) {
    const music = this.music;
    if (!music) return;
    this.music = null;
    const now = this.context.currentTime;
    music.gain.gain.cancelScheduledValues(now);
    music.gain.gain.setValueAtTime(music.gain.gain.value, now);
    music.gain.gain.linearRampToValueAtTime(0, now + (immediate ? 0 : 0.08));
    music.source.stop(now + (immediate ? 0 : 0.085));
  }

  play(name, progress = 0) {
    const context = this.context;
    if (!context || context.state !== "running" || !this.canRun() || !this.options.effectsEnabled) return false;
    if (name !== "button" && this.scene !== "game") return false;
    const intervals = { button: 0.035, move: 0.045, shoot: 0.09, damage: 0.1, maxSoldiers: 0, enemyDefeat: 0.08, allyCharge: 0.075 };
    if (!(name in intervals)) return false;
    const now = context.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -Infinity) < intervals[name]) return false;
    this.lastPlayed.set(name, now);
    // One voice per effect, at most seven voices overall. Rapid events never stack.
    for (const voice of this.voices) if (voice.name === name) this.stopVoice(voice);
    if (!this.buffers.has(name)) this.buffers.set(name, this.createEffect(name));
    const source = context.createBufferSource();
    source.buffer = this.buffers.get(name);
    if (name === "allyCharge") source.playbackRate.value = 0.8 + 0.65 * Math.max(0, Math.min(1, progress));
    source.connect(this.effects);
    const voice = { name, source };
    this.voices.add(voice);
    source.onended = () => { source.disconnect(); this.voices.delete(voice); };
    source.start();
    return true;
  }

  soldiersChanged(before, after, maximum) {
    if (before < maximum && after >= maximum) return this.play("maxSoldiers");
    return false;
  }

  stopVoice(voice) {
    voice.source.stop();
    voice.source.disconnect();
    this.voices.delete(voice);
  }

  stopEffects() {
    for (const voice of this.voices) this.stopVoice(voice);
  }

  createEffect(name) {
    const rate = 24000;
    const duration = { button: 0.055, move: 0.12, shoot: 0.09, damage: 0.28, maxSoldiers: 0.66, enemyDefeat: 0.18, allyCharge: 0.07 }[name];
    const buffer = this.context.createBuffer(1, Math.ceil(rate * duration), rate);
    const samples = buffer.getChannelData(0);
    const achievementNotes = [523.25, 659.25, 783.99, 1046.5];
    let phase = 0;
    for (let i = 0; i < samples.length; i += 1) {
      const t = i / rate;
      const progress = t / duration;
      let frequency = 720 + progress * 380;
      let envelope = Math.sin(Math.PI * progress) * (1 - progress);
      if (name === "move") frequency = 220 + 1100 * progress;
      if (name === "shoot") frequency = 1450 * Math.exp(-progress * 2.7);
      if (name === "damage") frequency = 130 - 75 * progress;
      if (name === "enemyDefeat") frequency = 280 * Math.exp(-progress * 1.8);
      if (name === "allyCharge") frequency = 690 + progress * 250;
      if (name === "maxSoldiers") {
        const note = Math.min(3, Math.floor(t / 0.165));
        frequency = achievementNotes[note];
        envelope = Math.sin(Math.PI * ((t % 0.165) / 0.165)) * (1 - progress * 0.25);
      }
      phase += 2 * Math.PI * frequency / rate;
      let sample = Math.sin(phase) + 0.18 * Math.sin(phase * 2);
      if (name === "damage") sample = Math.tanh(2 * Math.sin(phase)) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 32 * t));
      if (name === "enemyDefeat") sample = (Math.sin(phase) + 0.3 * Math.sin(phase * 2.67)) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 32 * t));
      samples[i] = sample * envelope * (name === "allyCharge" ? 0.2 : 0.42);
    }
    return buffer;
  }

  // Original eight-bar, 100 BPM ambient arpeggio. Rendered off the main thread
  // once, after user interaction; the resulting ~1.8 MB mono buffer is reused.
  async renderMenuMusic() {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) return null;
    const beat = 0.6;
    const bar = beat * 4;
    const offline = new Offline(1, Math.round(bar * 8 * 24000), 24000);
    const filter = offline.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    filter.connect(offline.destination);
    const frequency = (midi) => 440 * 2 ** ((midi - 69) / 12);
    const note = (midi, start, duration, volume, type = "sine", attack = 0.015) => {
      const oscillator = offline.createOscillator();
      const gain = offline.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency(midi);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + attack);
      gain.gain.linearRampToValueAtTime(0, start + duration);
      oscillator.connect(gain); gain.connect(filter);
      oscillator.start(start); oscillator.stop(start + duration);
    };
    const roots = [52, 48, 55, 50];
    const arp = [0, 7, 12, 7, 3, 7, 10, 7];
    for (let b = 0; b < 8; b += 1) {
      const root = roots[b % roots.length];
      for (const interval of [0, 7, 12]) note(root + interval, b * bar, bar, 0.045, "triangle", 0.45);
      note(root - 12, b * bar, bar, 0.09, "sine", 0.1);
      for (let step = 0; step < 8; step += 1) note(root + 12 + arp[step], b * bar + step * beat / 2, beat * 0.45, 0.12);
    }
    return offline.startRendering();
  }
}

window.AudioManager = AudioManager;
