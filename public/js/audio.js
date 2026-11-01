/**
 * Audio Engine for Buddhist Temple TikTok Live
 * Features:
 * - Serene gentle Buddhist Meditation BGM loop
 * - Multi-track selection (Sáo trúc, Đàn tranh & suối thiền, Chuông xoay)
 * - Web Audio synthesized & WAV Bell (Chung) and Wooden Fish (Mõ)
 * - TTS blessing speech queue
 */

class TempleAudioEngine {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.bgmEnabled = true;
    this.bgmVolume = 0.25; // Gentle, peaceful default volume
    this.sfxVolume = 0.85;
    this.ttsEnabled = true;

    // Track URLs
    this.tracks = {
      'gentle_flute': 'assets/audio/meditation_gentle.wav',
      'zen_guzheng': 'assets/audio/meditation_guzheng.wav',
      'singing_bowl': 'assets/audio/meditation_bgm.wav'
    };
    this.currentTrack = 'zen_guzheng'; // Always default to meditation_guzheng (Đàn tranh thiền)

    // Audio elements
    this.bellAudio = new Audio('assets/audio/bell.wav');
    this.moAudio = new Audio('assets/audio/mo.wav');
    this.chimeAudio = new Audio('assets/audio/chime.wav');
    this.fortuneAudio = new Audio('assets/audio/fortune.wav');
    
    // Background Meditation Music (Always loop continuously)
    this.bgmAudio = new Audio(this.tracks[this.currentTrack]);
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = this.bgmVolume;

    // Preload & volumes
    this.bellAudio.volume = 0.9;
    this.moAudio.volume = 0.55;
    this.chimeAudio.volume = 0.7;
    this.fortuneAudio.volume = 0.8;

    // TTS speech queue
    this.ttsQueue = [];
    this.isSpeaking = false;

    // Web Speech API fallback
    this.hasWebSpeech = 'speechSynthesis' in window;
    this.viVoice = null;
    if (this.hasWebSpeech) {
      this.initWebSpeechVoices();
    }
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (this.bgmEnabled) {
      this.playBGM();
    }
  }

  switchTrack(trackKey) {
    if (this.tracks[trackKey]) {
      this.currentTrack = trackKey;
      const wasPlaying = !this.bgmAudio.paused;
      this.bgmAudio.pause();
      this.bgmAudio = new Audio(this.tracks[trackKey]);
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = this.bgmVolume;
      if (wasPlaying && this.bgmEnabled) {
        this.playBGM();
      }
    }
  }

  playBGM() {
    if (!this.bgmEnabled) return;
    this.bgmAudio.volume = this.bgmVolume;
    this.bgmAudio.loop = true;

    // Guarantee infinite seamless loop
    this.bgmAudio.onended = () => {
      if (this.bgmEnabled) {
        this.bgmAudio.currentTime = 0;
        this.bgmAudio.play().catch(() => {});
      }
    };

    const playPromise = this.bgmAudio.play();
    if (playPromise && playPromise.catch) {
      playPromise.catch(() => {
        console.log('BGM waiting for browser gesture or OBS source initialization...');
      });
    }
  }

  pauseBGM() {
    this.bgmAudio.pause();
  }

  setBGMVolume(vol) {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    this.bgmAudio.volume = this.bgmVolume;
  }

  initWebSpeechVoices() {
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      // Chỉ nhận giọng tiếng Việt chuẩn, tuyệt đối không fallback voices[0] (sẽ thành Microsoft David tiếng Anh)
      this.viVoice = voices.find(v => v.lang.startsWith('vi') || v.lang.includes('VN')) || null;
    };
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    updateVoices();
  }

  // Play Bell (Chuông chùa / Đại Hồng Chung)
  playBell() {
    if (!this.soundEnabled) return;
    try {
      this.bellAudio.currentTime = 0;
      this.bellAudio.play().catch(() => this.synthBell());
    } catch (e) {
      this.synthBell();
    }
  }

  // Web Audio Synthesized Bell fallback
  synthBell() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [216, 432, 648, 1080];
    const gains = [0.4, 0.25, 0.12, 0.06];
    const decays = [4.5, 3.2, 2.0, 1.2];

    freqs.forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(gains[i] * this.sfxVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decays[i]);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + decays[i]);
    });
  }

  // Play Mo (Tiếng Mõ chùa)
  playMo() {
    if (!this.soundEnabled) return;
    try {
      this.moAudio.currentTime = 0;
      this.moAudio.play().catch(() => this.synthMo());
    } catch (e) {
      this.synthMo();
    }
  }

  // Web Audio Synthesized Woodblock (Mõ) fallback
  synthMo() {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);

    gain.gain.setValueAtTime(0.7 * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playChime() {
    if (!this.soundEnabled) return;
    try {
      this.chimeAudio.currentTime = 0;
      this.chimeAudio.play().catch(() => {});
    } catch (e) {}
  }

  playFortuneShake() {
    if (!this.soundEnabled) return;
    try {
      this.fortuneAudio.currentTime = 0;
      this.fortuneAudio.play().catch(() => {});
    } catch (e) {}
  }

  // Speak queue management
  queueSpeech(spokenText, audioUrl = null) {
    if (!this.ttsEnabled || !spokenText) return;
    this.ttsQueue.push({ text: spokenText, url: audioUrl });
    this.processTTSQueue();
  }

  processTTSQueue() {
    if (this.isSpeaking || this.ttsQueue.length === 0) return;

    const item = this.ttsQueue.shift();
    this.isSpeaking = true;

    // Duck BGM gently during TTS
    const prevBgmVol = this.bgmAudio.volume;
    if (this.bgmAudio && !this.bgmAudio.paused) {
      this.bgmAudio.volume = Math.max(0.06, prevBgmVol * 0.35);
    }

    const restoreBgm = () => {
      if (this.bgmAudio) this.bgmAudio.volume = this.bgmVolume;
      this.isSpeaking = false;
      setTimeout(() => this.processTTSQueue(), 400);
    };

    if (item.url) {
      const audio = new Audio(item.url);
      audio.volume = 0.95;
      audio.onended = () => restoreBgm();
      audio.onerror = () => {
        this.speakWebSpeech(item.text, () => restoreBgm());
      };
      audio.play().catch(() => {
        this.speakWebSpeech(item.text, () => restoreBgm());
      });
    } else {
      this.speakWebSpeech(item.text, () => restoreBgm());
    }
  }

  speakWebSpeech(text, onComplete) {
    // Nếu hệ thống không hỗ trợ WebSpeech hoặc Windows không có giọng tiếng Việt (tránh phát giọng tiếng Anh Microsoft David)
    if (!this.hasWebSpeech || !this.viVoice) {
      if (onComplete) onComplete();
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'vi-VN';
    if (this.viVoice) utter.voice = this.viVoice;
    utter.rate = 0.92;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    utter.onend = () => { if (onComplete) onComplete(); };
    utter.onerror = () => { if (onComplete) onComplete(); };
    window.speechSynthesis.speak(utter);
  }
}

window.templeAudio = new TempleAudioEngine();
