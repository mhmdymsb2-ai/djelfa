import { WeaponId } from './types';

export type VoiceSpeaker = 'mosaab' | 'ally' | 'mafia' | 'informant' | 'police';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private screechGain: GainNode | null = null;
  private muted = false;
  private voiceMuted = false;

  public setMuted(m: boolean) {
    this.muted = m;
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    if (this.screechGain && this.ctx) {
      this.screechGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    if (m && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public setVoiceMuted(v: boolean) {
    this.voiceMuted = v;
    if (v && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public startEngineLoop() {
    const ctx = this.ensureContext();
    if (!ctx || this.engineOsc) return;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    gain.gain.value = 0;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    this.engineOsc = osc;
    this.engineGain = gain;

    // Tire screech generator (bandpass noise)
    const bufLen = ctx.sampleRate * 1.0;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      ch[i] = Math.random() * 2 - 1;
    }
    const screechSrc = ctx.createBufferSource();
    screechSrc.buffer = noiseBuf;
    screechSrc.loop = true;

    const screechFilter = ctx.createBiquadFilter();
    screechFilter.type = 'bandpass';
    screechFilter.frequency.value = 1650;
    screechFilter.Q.value = 4.2;

    const screechGain = ctx.createGain();
    screechGain.gain.value = 0;

    screechSrc.connect(screechFilter);
    screechFilter.connect(screechGain);
    screechGain.connect(ctx.destination);
    screechSrc.start();

    this.screechGain = screechGain;
  }

  public updateEngine(active: boolean, speedRatio: number, drifting = false) {
    if (!this.ctx || !this.engineOsc || !this.engineGain) {
      if (active && !this.muted) {
        this.startEngineLoop();
      }
      return;
    }
    const now = this.ctx.currentTime;
    if (!active || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      if (this.screechGain) this.screechGain.gain.setTargetAtTime(0, now, 0.06);
      return;
    }
    const targetFreq = 48 + Math.min(1, Math.abs(speedRatio)) * 118;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.07);
    this.engineGain.gain.setTargetAtTime(0.045 + Math.abs(speedRatio) * 0.038, now, 0.08);

    if (this.screechGain) {
      const screechLevel = drifting && Math.abs(speedRatio) > 0.28 ? 0.055 : 0;
      this.screechGain.gain.setTargetAtTime(screechLevel, now, 0.06);
    }
  }

  public playGunshot(weapon: WeaponId) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const duration = weapon === 'shotgun' ? 0.28 : weapon === 'ak47' ? 0.14 : 0.11;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.pow(1 - i / bufferSize, weapon === 'shotgun' ? 1.8 : 2.6);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = weapon === 'shotgun' ? 660 : weapon === 'ak47' ? 1100 : 1450;
    filter.Q.value = 0.9;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(weapon === 'shotgun' ? 0.36 : 0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(weapon === 'shotgun' ? 125 : 190, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.09);
    oscGain.gain.setValueAtTime(0.24, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playExplosion() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = 0.65;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, now);
    filter.frequency.exponentialRampToValueAtTime(75, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  public playCrash() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.16);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playRadioBeep() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.setValueAtTime(1480, now + 0.05);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playHit() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.06);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.1, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.2);
    });
  }

  public playReload() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(480, now + 0.08);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playSirenChirp() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.linearRampToValueAtTime(980, now + 0.14);
    osc.frequency.linearRampToValueAtTime(640, now + 0.28);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  // Arabic Speech Synthesis (التكلم مع اللاعب بالصوت)
  public speakArabic(text: string, speaker: VoiceSpeaker = 'mosaab') {
    if (this.muted || this.voiceMuted) return;
    this.playRadioBeep();

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const arVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith('ar-dz')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('ar'));
      if (arVoice) {
        utter.voice = arVoice;
      }
      utter.lang = arVoice?.lang || 'ar-SA';
      utter.rate = speaker === 'mafia' ? 0.92 : speaker === 'police' ? 0.98 : 1.04;
      utter.pitch =
        speaker === 'ally'
          ? 0.85
          : speaker === 'mafia'
          ? 0.72
          : speaker === 'police'
          ? 0.9
          : 1.0;
      utter.volume = 0.92;
      window.speechSynthesis.speak(utter);
    } catch {
      // Safe fallback if TTS unavailable in headless browser
    }
  }

  public stopSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public dispose() {
    this.stopSpeech();
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
      } catch {
        // ignore
      }
      this.engineOsc = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
