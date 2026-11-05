/* ==========================================================================
   CodeLyrics Studio - Audio Engine with Smart Trimmer & Peak Chorus Detector
   - Trims songs to viral hook / chorus lengths (15s, 20s, 30s) for TikTok / Reels
   - Auto-detects peak energy chorus / reff using Web Audio RMS analysis
   - Zero-Latency sync offset calibration (+90ms lead time eliminates audio delay)
   ========================================================================== */

class AudioEngine {
  constructor() {
    this.audioEl = new Audio();
    this.audioCtx = null;
    this.analyser = null;
    this.dataArray = null;
    this.sourceNode = null;
    
    this.isPlaying = false;
    this.duration = 25.0;
    this.currentTime = 0;
    this.isSynth = false;
    this.synthInterval = null;

    // Trimming & Sync Offset
    this.trimStart = 0;
    this.trimEnd = 25.0;
    this.rawTotalDuration = 25.0;
    this.syncOffset = 0.09; // 90ms lead time: perfectly aligns visual typing with vocal attack
    this.currentRawSource = null;
    
    this.onTimeUpdate = null;
    this.onEnded = null;
    this.onPlayStateChange = null;

    this.mountAudioElement();
    this.initAudioListeners();
  }

  mountAudioElement() {
    if (typeof document === 'undefined') return;
    const attach = () => {
      if (document.body && !this.audioEl.parentElement) {
        this.audioEl.id = 'codeLyricsAudio';
        this.audioEl.style.display = 'none';
        this.audioEl.setAttribute('playsinline', '');
        this.audioEl.setAttribute('webkit-playsinline', '');
        document.body.appendChild(this.audioEl);
      }
    };
    if (document.body) {
      attach();
    } else {
      document.addEventListener('DOMContentLoaded', attach);
    }
  }

  async resumeAudio() {
    if (this.audioCtx && this.audioCtx.state !== 'running') {
      try {
        await this.audioCtx.resume();
      } catch (e) {}
    }
    if (this.isPlaying && this.audioEl && this.audioEl.paused) {
      try {
        await this.audioEl.play();
      } catch (e) {}
    }
  }

  initAudioListeners() {
    this.audioEl.addEventListener('timeupdate', () => {
      this.checkTrimBounds();
      this.currentTime = this.getRelativeTime();
      if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime, this.getTrimmedDuration());
    });

    this.audioEl.addEventListener('loadedmetadata', () => {
      this.rawTotalDuration = this.audioEl.duration || 25.0;
      if (this.trimEnd > this.rawTotalDuration || this.trimEnd === 25.0) {
        this.trimEnd = this.rawTotalDuration;
      }
      this.duration = this.getTrimmedDuration();
      if (this.onTimeUpdate) this.onTimeUpdate(0, this.duration);
    });

    this.audioEl.addEventListener('ended', () => {
      this.isPlaying = false;
      if (this.onPlayStateChange) this.onPlayStateChange(false);
      if (this.onEnded) this.onEnded();
    });

    this.audioEl.addEventListener('play', () => {
      this.isPlaying = true;
      if (this.onPlayStateChange) this.onPlayStateChange(true);
    });

    this.audioEl.addEventListener('pause', () => {
      this.isPlaying = false;
      if (this.onPlayStateChange) this.onPlayStateChange(false);
    });
  }

  initWebAudio() {
    if (this.audioCtx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      if (!this.sourceNode) {
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);
        this.sourceNode.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);
      }

      // Auto-resume whenever AudioContext is suspended (e.g. fullscreen transition)
      this.audioCtx.onstatechange = () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended' && this.isPlaying) {
          this.audioCtx.resume().catch(() => {});
        }
      };
    } catch (e) {
      console.warn('Web Audio Context warning:', e);
    }
  }

  getDirectAudioStream() {
    this.initWebAudio();
    if (!this.audioCtx) return null;

    if (!this.mediaStreamDest) {
      try {
        this.mediaStreamDest = this.audioCtx.createMediaStreamDestination();
        if (this.analyser) {
          this.analyser.connect(this.mediaStreamDest);
        } else if (this.sourceNode) {
          this.sourceNode.connect(this.mediaStreamDest);
        }
      } catch (e) {
        console.warn('Web Audio createMediaStreamDestination warning:', e);
      }
    }
    return this.mediaStreamDest ? this.mediaStreamDest.stream : null;
  }

  loadSource(src, duration = 25.0, isSynth = false) {
    this.pause();
    this.isSynth = isSynth;
    this.currentRawSource = src;
    this.trimStart = 0;
    this.trimEnd = duration;
    this.rawTotalDuration = duration;
    this.duration = duration;
    this.currentTime = 0;

    if (!isSynth && src) {
      this.audioEl.src = src;
      this.audioEl.load();
    }
    
    if (this.onTimeUpdate) this.onTimeUpdate(0, this.duration);
  }

  loadUserFile(file) {
    this.pause();
    this.isSynth = false;
    const objectUrl = URL.createObjectURL(file);
    this.currentRawSource = objectUrl;
    this.trimStart = 0;
    this.trimEnd = 30.0;
    this.audioEl.src = objectUrl;
    this.audioEl.load();
  }

  setTrim(start, end) {
    this.trimStart = Math.max(0, start);
    this.trimEnd = Math.max(this.trimStart + 1, end);
    this.duration = this.getTrimmedDuration();
    this.seek(0);
  }

  setSyncOffset(offsetMs) {
    // Allows user to tweak latency from -200ms to +200ms
    this.syncOffset = offsetMs / 1000.0;
  }

  getTrimmedDuration() {
    return Math.max(1, this.trimEnd - this.trimStart);
  }

  getRelativeTime() {
    if (this.isSynth) return this.currentTime;
    const raw = this.audioEl.currentTime || 0;
    return Math.max(0, raw - this.trimStart);
  }

  getCurrentTimeWithOffset() {
    // Adds calibrated lead offset so visual typing exactly hits the audio onset
    const rel = this.getRelativeTime();
    return Math.max(0, rel + this.syncOffset);
  }

  checkTrimBounds() {
    if (this.isSynth) return;
    if (this.audioEl.currentTime >= this.trimEnd) {
      this.pause();
      this.audioEl.currentTime = this.trimStart;
      this.currentTime = 0;
      if (this.onEnded) this.onEnded();
    }
  }

  play() {
    this.initWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    if (this.isSynth) {
      this.isPlaying = true;
      if (this.onPlayStateChange) this.onPlayStateChange(true);
      const startT = Date.now() - (this.currentTime * 1000);
      
      clearInterval(this.synthInterval);
      this.synthInterval = setInterval(() => {
        if (!this.isPlaying) return;
        this.currentTime = (Date.now() - startT) / 1000;
        if (this.currentTime >= this.duration) {
          this.pause();
          this.currentTime = 0;
          if (this.onEnded) this.onEnded();
        }
        if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime, this.duration);
      }, 30);
    } else {
      if (this.audioEl.currentTime < this.trimStart || this.audioEl.currentTime >= this.trimEnd) {
        this.audioEl.currentTime = this.trimStart;
      }
      this.audioEl.play().catch(err => {
        console.warn('Audio play notice:', err);
      });
    }
  }

  pause() {
    this.isPlaying = false;
    if (this.isSynth) {
      clearInterval(this.synthInterval);
    } else {
      this.audioEl.pause();
    }
    if (this.onPlayStateChange) this.onPlayStateChange(false);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  seek(relTime) {
    this.currentTime = Math.max(0, Math.min(relTime, this.duration));
    if (!this.isSynth) {
      this.audioEl.currentTime = this.trimStart + this.currentTime;
    }
    if (this.onTimeUpdate) this.onTimeUpdate(this.currentTime, this.duration);
  }

  getBeatIntensity() {
    if (!this.analyser || !this.isPlaying) {
      return this.isPlaying ? Math.sin(Date.now() * 0.005) * 0.2 + 0.3 : 0.0;
    }
    this.analyser.getByteFrequencyData(this.dataArray);
    let sum = 0;
    const count = 6;
    for (let i = 0; i < count; i++) {
      sum += this.dataArray[i];
    }
    return (sum / count) / 255;
  }

  // ==========================================================================
  // Smart Chorus / Peak Energy Detection for TikTok / Reels FYP
  // Uses Root-Mean-Square (RMS) audio energy analysis to find the viral chorus
  // ==========================================================================
  async detectPeakChorus(targetDuration = 20) {
    if (!this.currentRawSource || this.isSynth) {
      return { start: 0, end: Math.min(25, this.duration) };
    }

    try {
      const response = await fetch(this.currentRawSource);
      const arrayBuffer = await response.arrayBuffer();
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      
      const rawData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const totalSec = Math.floor(audioBuffer.duration);

      if (totalSec <= targetDuration) {
        return { start: 0, end: totalSec };
      }

      // Energy per 1-second segment
      const windowSize = sampleRate;
      const energy = new Float32Array(totalSec);

      for (let i = 0; i < totalSec; i++) {
        let sum = 0;
        const startIdx = i * windowSize;
        const step = 8;
        for (let j = 0; j < windowSize; j += step) {
          const val = rawData[startIdx + j] || 0;
          sum += val * val;
        }
        energy[i] = Math.sqrt(sum / (windowSize / step));
      }

      // Find sliding window with highest sustained volume (The Chorus / Reff!)
      let maxEnergy = 0;
      let bestStart = Math.min(30, Math.floor(totalSec * 0.3));

      const searchStart = Math.floor(Math.min(10, totalSec * 0.08));
      const searchEnd = Math.floor(totalSec - targetDuration);

      for (let s = searchStart; s < searchEnd; s++) {
        let windowEnergy = 0;
        for (let k = 0; k < targetDuration; k++) {
          windowEnergy += energy[s + k] || 0;
        }
        if (windowEnergy > maxEnergy) {
          maxEnergy = windowEnergy;
          bestStart = s;
        }
      }

      return {
        start: bestStart,
        end: bestStart + targetDuration,
        totalDuration: totalSec
      };
    } catch (e) {
      console.warn('Auto chorus analysis fallback:', e);
      return { start: 0, end: Math.min(20, this.rawTotalDuration) };
    }
  }
}
