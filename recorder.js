/* ==========================================================================
   CodeLyrics Studio - Auto Record & Export Engine
   - 1-Click Auto-Target Current Tab (preferCurrentTab + selfBrowserSurface)
   - Eliminates monitor selection clutter (monitorTypeSurfaces: 'exclude')
   - Region Capture: Automatically crops video to pure 9:16 portrait viewport
   - Studio-grade Direct Web Audio Stream: 100% crystal-clear synchronized audio
   - Automatic File Protocol detection with helpful modal & guidance
   - Exports pristine 60FPS video (.webm) directly to user download folder
   ========================================================================== */

class AutoRecorder {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.stream = null;
    this.finalStream = null;
    this.timerInterval = null;
    this.startTime = 0;
    this.songTitle = 'Viral_Coding_Song';
    
    this.onStateChange = null;
    this.onTick = null;
  }

  async start(songTitle = 'Viral_Coding_Song', allowAnySurface = false) {
    if (this.isRecording) return false;

    const isFileProtocol = (window.location.protocol === 'file:');

    // 1. Chrome blocks Tab capture on file:/// protocol. Guide user to localhost / start.bat
    if (isFileProtocol && !allowAnySurface) {
      this.showFileProtocolModal(songTitle);
      return false;
    }

    try {
      this.showToast('ℹ️ Pilih Tab "CodeLyrics" ini lalu klik "Bagikan"...');

      // 2. CaptureController (Prevents abrupt window focus switching)
      let controller = null;
      if (typeof CaptureController !== 'undefined') {
        try {
          controller = new CaptureController();
          if (typeof controller.setFocusBehavior === 'function') {
            controller.setFocusBehavior('no-focus-change');
          }
        } catch (e) {
          controller = null;
        }
      }

      // 3. Constraints optimized to lock onto the current tab
      const modernConstraints = {
        video: {
          displaySurface: 'browser',
          frameRate: { ideal: 60, max: 60 },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: {
          suppressLocalAudioPlayback: false
        },
        suppressLocalAudioPlayback: false,
        preferCurrentTab: true,          // Chromium 107+: Pre-selects this tab
        selfBrowserSurface: 'include',    // Chromium 107+: Includes this tab
        systemAudio: 'include',          // Includes tab audio
        surfaceSwitching: 'include',
        monitorTypeSurfaces: 'exclude'   // Chromium 107+: Excludes monitors so tab is highlighted
      };

      if (controller) {
        modernConstraints.controller = controller;
      }

      let captureStream = null;

      // Try modern constraints first
      try {
        captureStream = await navigator.mediaDevices.getDisplayMedia(modernConstraints);
      } catch (firstErr) {
        if (firstErr.name === 'NotAllowedError') {
          // User clicked 'Batal' / cancelled prompt
          console.log('Screen capture prompt cancelled by user');
          return false;
        }

        console.warn('Modern capture constraints fallback:', firstErr);
        // Fallback for older browsers
        captureStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'browser',
            frameRate: { ideal: 60, max: 60 }
          },
          audio: true,
          preferCurrentTab: true,
          selfBrowserSurface: 'include'
        });
      }

      if (!captureStream) return false;

      // 4. Region Capture: Auto-crop to 9:16 portrait viewport (#codeViewport)
      const viewportEl = document.getElementById('codeViewport');
      if (window.CropTarget && typeof CropTarget.fromElement === 'function' && viewportEl) {
        try {
          const cropTarget = await CropTarget.fromElement(viewportEl);
          const [videoTrack] = captureStream.getVideoTracks();
          if (videoTrack && typeof videoTrack.cropTo === 'function') {
            await videoTrack.cropTo(cropTarget);
            console.log('Region Capture active: perfectly cropped to 9:16 portrait viewport');
          }
        } catch (cropErr) {
          console.warn('Region Capture CropTarget notice:', cropErr);
        }
      }

      // 5. Combine Video Track with Studio-Grade Direct Web Audio Stream
      const finalStream = new MediaStream();
      const videoTrack = captureStream.getVideoTracks()[0];
      if (videoTrack) {
        finalStream.addTrack(videoTrack);
      }

      // Ensure Web Audio context is resumed
      if (this.audioEngine) {
        await this.audioEngine.resumeAudio();
      }

      const directAudioStream = this.audioEngine ? this.audioEngine.getDirectAudioStream() : null;
      const directAudioTrack = directAudioStream ? directAudioStream.getAudioTracks()[0] : null;
      const tabAudioTrack = captureStream.getAudioTracks()[0];

      // Direct Web Audio is 100% clear, immune to browser mute or unchecking tab audio
      if (directAudioTrack) {
        finalStream.addTrack(directAudioTrack);
      } else if (tabAudioTrack) {
        finalStream.addTrack(tabAudioTrack);
      }

      this.stream = captureStream;
      this.finalStream = finalStream;
      this.recordedChunks = [];
      this.songTitle = songTitle;

      // 6. Best supported codec
      let mimeType = 'video/webm;codecs=vp9,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      this.mediaRecorder = new MediaRecorder(finalStream, {
        mimeType: mimeType,
        videoBitsPerSecond: 8000000 // 8 Mbps high-bitrate studio quality
      });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.saveAndDownload();
        this.cleanup();
      };

      // Handle user manually clicking "Stop sharing" on browser toolbar
      if (videoTrack) {
        videoTrack.onended = () => {
          if (this.isRecording) {
            this.stop();
          }
        };
      }

      // Set state & notify listeners immediately (hides controls bar before 1st frame)
      this.isRecording = true;
      this.startTime = Date.now();
      if (this.onStateChange) this.onStateChange(true);

      // Start recording
      this.mediaRecorder.start(250); // timeslice 250ms

      // Rewind & Play Audio
      this.audioEngine.seek(0);
      this.audioEngine.play();

      // Start timer tick
      this.timerInterval = setInterval(() => {
        if (this.onTick) {
          const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
          const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
          const s = String(elapsed % 60).padStart(2, '0');
          this.onTick(`${m}:${s}`);
        }
      }, 500);

      return true;

    } catch (err) {
      console.warn('Auto record cancelled or error:', err);
      this.cleanup();
      if (this.onStateChange) this.onStateChange(false);
      return false;
    }
  }

  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
    if (this.onStateChange) this.onStateChange(false);
  }

  cleanup() {
    clearInterval(this.timerInterval);
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.finalStream) {
      this.finalStream.getTracks().forEach(track => track.stop());
      this.finalStream = null;
    }
  }

  saveAndDownload() {
    if (!this.recordedChunks || this.recordedChunks.length === 0) return;

    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const cleanName = (this.songTitle || 'Coding_Lyrics')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .replace(/\s+/g, '_');

    const filename = `CodeLyrics_${cleanName}_${Date.now()}.webm`;

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 250);

    // Show toast
    this.showToast(`✅ Video "${filename}" berhasil diunduh otomatis!`);
  }

  showToast(message) {
    let toast = document.getElementById('recToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'recToast';
      toast.className = 'rec-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4500);
  }

  showFileProtocolModal(songTitle) {
    let modal = document.getElementById('fileProtocolModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'fileProtocolModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-card" style="max-width: 540px; text-align: left;">
          <div class="modal-header">
            <div class="modal-title" style="display: flex; align-items: center; gap: 0.5rem; color: #ff3366;">
              <span>⚠️</span> Rekam Tab Butuh Local Server
            </div>
            <button class="btn btn-icon btn-close-proto">✕</button>
          </div>
          <div class="modal-body" style="display: flex; flex-direction: column; gap: 1rem; font-size: 0.85rem; color: #cbd5e1; line-height: 1.55;">
            <p>
              Browser Google Chrome & Edge <strong>menonaktifkan pilihan Tab</strong> jika file web dibuka langsung dari <code>file:///</code> demi alasan keamanan browser.
            </p>
            <div style="background: rgba(255, 42, 85, 0.08); border: 1px solid rgba(255, 42, 85, 0.3); border-radius: 8px; padding: 1rem;">
              <strong style="color: #ff3366; display: block; margin-bottom: 0.5rem;">💡 Solusi Mudah (Auto Rekam Tab 1-Klik):</strong>
              <ol style="margin-left: 1.25rem; display: flex; flex-direction: column; gap: 0.4rem;">
                <li>Buka folder project: <code>d:\\Project ROBLOX\\codelyrics-web\\</code></li>
                <li>Klik ganda file <strong>start.bat</strong></li>
                <li>Browser akan otomatis membuka <strong>http://localhost:8080/</strong></li>
                <li>Tekan tombol <strong>Auto Rekam</strong> lagi &rarr; Tab ini langsung otomatis terpilih!</li>
              </ol>
            </div>
            <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem;">
              <button id="btnTryLocalhost" class="btn btn-primary" style="font-weight: 600;">
                🚀 Buka http://localhost:8080/
              </button>
              <button id="btnFallbackWindowRec" class="btn btn-sm" style="background: rgba(255, 255, 255, 0.08); border-color: var(--border-color);">
                🎥 Tetap Rekam Layar / Jendela
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('.btn-close-proto').addEventListener('click', () => {
        modal.classList.remove('active');
      });

      modal.querySelector('#btnTryLocalhost').addEventListener('click', () => {
        window.location.href = 'http://localhost:8080/';
      });

      modal.querySelector('#btnFallbackWindowRec').addEventListener('click', () => {
        modal.classList.remove('active');
        this.start(songTitle, true);
      });
    }

    modal.classList.add('active');
  }
}
