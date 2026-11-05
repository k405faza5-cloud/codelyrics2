/* ==========================================================================
   CodeLyrics Studio - Pure Coding & Music Experience Controller
   With Auto-Follow Camera & Auto-Record Video Export
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const bgCanvas = document.getElementById('bgCanvas');
  const codeContainer = document.getElementById('codeContainer');
  const bgCodeReflection = document.getElementById('bgCodeReflection');
  const codeViewport = document.getElementById('codeViewport');
  const lensFlare = document.getElementById('lensFlare');
  const screenScanlines = document.getElementById('screenScanlines');
  const controlsBar = document.getElementById('controlsBar');
  const sideDrawer = document.getElementById('sideDrawer');
  const recBadge = document.getElementById('recBadge');
  const recTimer = document.getElementById('recTimer');

  // Controls Elements
  const songSelect = document.getElementById('songSelect');
  const audioFileInput = document.getElementById('audioFileInput');
  const btnPlayPause = document.getElementById('btnPlayPause');
  const playIcon = document.getElementById('playIcon');
  const btnReplay = document.getElementById('btnReplay');
  const btnLoop = document.getElementById('btnLoop');
  const progressSlider = document.getElementById('progressSlider');
  const timeDisplay = document.getElementById('timeDisplay');
  const btnAutoRecord = document.getElementById('btnAutoRecord');
  const btnToggleDrawer = document.getElementById('btnToggleDrawer');
  const btnCloseDrawer = document.getElementById('btnCloseDrawer');
  const btnFullscreen = document.getElementById('btnFullscreen');

  // Protocol Check: If running on file://, inform user to run start.bat for 1-click tab record
  if (window.location.protocol === 'file:') {
    const banner = document.createElement('div');
    banner.className = 'protocol-banner';
    banner.innerHTML = `
      <span>⚠️ Kamu membuka web via file://. Jalankan <strong>start.bat</strong> agar fitur Auto Rekam Tab bisa langsung aktif otomatis.</span>
      <a href="http://localhost:8080/">Buka Localhost (start.bat)</a>
    `;
    document.body.prepend(banner);
  }

  // Generator & Editor Elements
  const rawLyricsInput = document.getElementById('rawLyricsInput');
  const btnConvertLyrics = document.getElementById('btnConvertLyrics');
  const generatedCodePreview = document.getElementById('generatedCodePreview');
  const btnApplyGenerated = document.getElementById('btnApplyGenerated');
  const linesEditorList = document.getElementById('linesEditorList');
  const btnAddLine = document.getElementById('btnAddLine');

  // Tap-to-Sync Elements
  const btnStartTapSync = document.getElementById('btnStartTapSync');
  const tapSyncModal = document.getElementById('tapSyncModal');
  const btnCloseTapSync = document.getElementById('btnCloseTapSync');
  const tapCurrentLineBox = document.getElementById('tapCurrentLineBox');
  const btnTapAction = document.getElementById('btnTapAction');
  const tapProgressText = document.getElementById('tapProgressText');

  // Trimmer & Zero-Delay Sync Elements
  const btnAutoChorus = document.getElementById('btnAutoChorus');
  const trimStartInput = document.getElementById('trimStartInput');
  const trimEndInput = document.getElementById('trimEndInput');
  const trimDurLabel = document.getElementById('trimDurLabel');
  const btnPreviewTrim = document.getElementById('btnPreviewTrim');
  const btnApplyTrim = document.getElementById('btnApplyTrim');
  const syncOffsetSlider = document.getElementById('syncOffsetSlider');
  const delayValueLabel = document.getElementById('delayValueLabel');

  // State
  let currentSong = SONG_PRESETS[0];
  let currentLines = JSON.parse(JSON.stringify(currentSong.lines));
  let isLooping = true;
  let is3DTilt = true;
  let generatedCandidateLines = [];
  let idleTimeout = null;

  // Initialize Engines
  const visuals = new VisualsEngine(bgCanvas);
  const typing = new TypingEngine(codeContainer, bgCodeReflection);
  const audio = new AudioEngine();
  const recorder = new AutoRecorder(audio);
  let tapSync = null;

  // Populate Song Select Dropdown
  function populateSongSelect() {
    songSelect.innerHTML = SONG_PRESETS.map((song) => `
      <option value="${song.id}">${song.title} - ${song.artist}</option>
    `).join('');
  }

  // Load Song
  function loadSong(preset) {
    currentSong = preset;
    currentLines = JSON.parse(JSON.stringify(preset.lines));
    typing.setLines(currentLines);

    // Audio source
    if (preset.id === 'love-me-not') {
      const audioSrc = typeof PRESET_AUDIO_BASE64 !== 'undefined' ? PRESET_AUDIO_BASE64 : preset.audioUrl;
      audio.loadSource(audioSrc, preset.duration, false);
    } else if (preset.source === 'local') {
      audio.loadSource(preset.audioUrl, preset.duration, false);
    } else {
      audio.loadSource(null, preset.duration, true);
    }

    // Update Slider & Time Display
    progressSlider.max = preset.duration;
    progressSlider.value = 0;
    updateTimeText(0, preset.duration);

    // Update Trimmer UI inputs
    if (trimStartInput && trimEndInput) {
      trimStartInput.value = 0;
      trimEndInput.value = preset.duration;
      trimDurLabel.textContent = `Durasi: ${preset.duration.toFixed(1)}s`;
    }

    // Update Select Dropdown
    songSelect.value = preset.id;

    // Render Editor lines
    renderLineEditor();
  }

  // Visual Loop (audio beat pulse + smooth subframe typing + camera tracking)
  function loop() {
    const beat = audio.getBeatIntensity();
    visuals.setAudioPulse(beat);

    if (audio.isPlaying) {
      typing.update(audio.getCurrentTimeWithOffset(), true, beat);
    }

    // Step the silky-smooth LERP camera physics on EVERY frame (60/120fps)
    typing.stepCamera(beat);

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Audio Event Listeners (Zero-delay calibrated)
  audio.onTimeUpdate = (currentTime, duration) => {
    progressSlider.value = currentTime;
    updateTimeText(currentTime, duration);
    typing.update(audio.getCurrentTimeWithOffset(), audio.isPlaying, audio.getBeatIntensity());
  };

  audio.onPlayStateChange = (playing) => {
    playIcon.textContent = playing ? '❚❚' : '▶';
    if (!playing && !recorder.isRecording) {
      controlsBar.classList.remove('idle-hidden');
    }
  };

  audio.onEnded = () => {
    // If currently recording, finish & auto-download the video!
    if (recorder.isRecording) {
      recorder.stop();
      return;
    }

    if (isLooping) {
      audio.seek(0);
      audio.play();
    } else {
      audio.seek(0);
      playIcon.textContent = '▶';
      controlsBar.classList.remove('idle-hidden');
    }
  };

  function updateTimeText(current, total) {
    const format = (sec) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    timeDisplay.textContent = `${format(current)} / ${format(total)}`;
  }

  // Auto-hide Controls Bar when mouse is idle during playback
  function resetIdleTimer() {
    if (recorder.isRecording) {
      controlsBar.classList.add('idle-hidden');
      controlsBar.classList.add('recording-hidden');
      return;
    }

    controlsBar.classList.remove('idle-hidden');
    clearTimeout(idleTimeout);

    if (audio.isPlaying && !sideDrawer.classList.contains('collapsed')) {
      // Don't hide if drawer is open
      return;
    }

    if (audio.isPlaying) {
      idleTimeout = setTimeout(() => {
        controlsBar.classList.add('idle-hidden');
      }, 2500);
    }
  }

  window.addEventListener('mousemove', resetIdleTimer);
  window.addEventListener('click', resetIdleTimer);

  // Song Select Change Handler
  songSelect.addEventListener('change', (e) => {
    const selectedId = e.target.value;
    const found = SONG_PRESETS.find(p => p.id === selectedId);
    if (found) {
      loadSong(found);
      audio.seek(0);
      audio.play();
    }
  });

  // User Custom Audio File Upload
  audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const songTitle = file.name.replace(/\.[^/.]+$/, "");
      const customPreset = {
        id: 'custom-' + Date.now(),
        title: '🎵 ' + songTitle,
        artist: 'Lagu Kustom',
        source: 'user',
        duration: 30.0,
        lines: [
          { id: 1, text: '// Lagu: ' + songTitle, timeStart: 0.1, timeEnd: 2.5, isComment: true },
          { id: 2, text: 'music.play("' + songTitle + '");', timeStart: 2.6, timeEnd: 5.5 },
          { id: 3, text: 'console.log("Masukkan lirik kustom di menu...");', timeStart: 5.6, timeEnd: 9.0 }
        ]
      };

      SONG_PRESETS.push(customPreset);
      populateSongSelect();
      loadSong(customPreset);
      audio.loadUserFile(file);
      audio.play();
    }
  });

  // Playback Control Handlers
  btnPlayPause.addEventListener('click', () => {
    audio.togglePlay();
  });

  btnReplay.addEventListener('click', () => {
    audio.seek(0);
    typing.update(0, audio.isPlaying);
    audio.play();
  });

  progressSlider.addEventListener('input', (e) => {
    const targetTime = parseFloat(e.target.value);
    audio.seek(targetTime);
    typing.update(targetTime, audio.isPlaying);
  });

  btnLoop.addEventListener('click', () => {
    isLooping = !isLooping;
    document.getElementById('loopStatus').style.opacity = isLooping ? '1' : '0.4';
  });

  // Fullscreen Stage Toggle with Audio Continuity Protection
  const keepAudioAlive = () => {
    if (audio) {
      audio.resumeAudio();
    }
  };

  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        keepAudioAlive();
      }).catch(err => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          keepAudioAlive();
        }).catch(() => {});
      }
    }
    keepAudioAlive();
  });

  // Watch for Fullscreen State Changes & Window Focus to prevent audio dropouts
  document.addEventListener('fullscreenchange', () => {
    keepAudioAlive();
    setTimeout(keepAudioAlive, 50);
    setTimeout(keepAudioAlive, 150);
    setTimeout(keepAudioAlive, 300);
    setTimeout(keepAudioAlive, 600);
  });

  document.addEventListener('webkitfullscreenchange', () => {
    keepAudioAlive();
    setTimeout(keepAudioAlive, 100);
    setTimeout(keepAudioAlive, 300);
  });

  window.addEventListener('focus', keepAudioAlive);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      keepAudioAlive();
    }
  });

  // Keyboard Shortcuts Handler
  const triggerAutoRecord = async () => {
    if (recorder.isRecording) {
      recorder.stop();
    } else {
      await recorder.start(currentSong.title);
    }
  };

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (tapSyncModal && tapSyncModal.classList.contains('active')) return;

    // [R] or [Alt+R]: Auto Rekam (Mulai / Hentikan)
    if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      triggerAutoRecord();
      return;
    }

    // [Space]: Play / Pause Lagu
    if (e.code === 'Space') {
      e.preventDefault();
      audio.togglePlay();
      return;
    }

    // [F]: Fullscreen Toggle
    if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      btnFullscreen.click();
      return;
    }

    // [0] or [Home]: Replay dari awal
    if (e.code === 'Home' || (e.code === 'Digit0' && !e.shiftKey)) {
      e.preventDefault();
      btnReplay.click();
      return;
    }
  });

  // ==========================================================================
  // Auto-Record Controller
  // ==========================================================================
  recorder.onTick = (timeStr) => {
    recTimer.textContent = timeStr;
  };

  recorder.onStateChange = (recording) => {
    if (recording) {
      document.body.classList.add('is-recording');
      btnAutoRecord.classList.add('recording');
      btnAutoRecord.innerHTML = '<span>⏹️</span> Hentikan Rekam <kbd class="kbd-hint">R</kbd>';
      recBadge.classList.add('active');
      sideDrawer.classList.add('collapsed');
      
      // Auto-hide control bar IMMEDIATELY (0ms delay) so it is never captured in video
      controlsBar.classList.add('idle-hidden');
      controlsBar.classList.add('recording-hidden');
    } else {
      document.body.classList.remove('is-recording');
      btnAutoRecord.classList.remove('recording');
      btnAutoRecord.innerHTML = '<span>⏺️</span> Auto Rekam <kbd class="kbd-hint">R</kbd>';
      recBadge.classList.remove('active');
      controlsBar.classList.remove('recording-hidden');
      controlsBar.classList.remove('idle-hidden');
    }
  };

  btnAutoRecord.addEventListener('click', triggerAutoRecord);

  // Drawer Toggle & Tabs
  btnToggleDrawer.addEventListener('click', () => {
    sideDrawer.classList.toggle('collapsed');
    resetIdleTimer();
  });

  btnCloseDrawer.addEventListener('click', () => {
    sideDrawer.classList.add('collapsed');
    resetIdleTimer();
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

      btn.classList.add('active');
      const tabName = btn.getAttribute('data-tab');
      const targetId = 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
      document.getElementById(targetId).style.display = 'block';
    });
  });

  // Auto Convert Lyrics to Code
  btnConvertLyrics.addEventListener('click', () => {
    const raw = rawLyricsInput.value.trim();
    if (!raw) {
      alert('Silakan masukkan lirik terlebih dahulu!');
      return;
    }

    const codeLines = CodeGenerator.convertLyricsToCode(raw);
    const timedLines = CodeGenerator.calculateAutoTimings(codeLines, audio.duration || 25.0);
    generatedCandidateLines = timedLines;

    // Show preview
    generatedCodePreview.value = timedLines.map((l) => `// [${l.timeStart}s - ${l.timeEnd}s]\n${l.text}`).join('\n\n');
  });

  btnApplyGenerated.addEventListener('click', () => {
    if (!generatedCandidateLines || generatedCandidateLines.length === 0) {
      alert('Belum ada kodingan yang di-generate! Tekan "Auto Convert" dulu.');
      return;
    }

    currentLines = JSON.parse(JSON.stringify(generatedCandidateLines));
    currentSong.lines = currentLines;
    typing.setLines(currentLines);
    renderLineEditor();
    sideDrawer.classList.add('collapsed');
    audio.seek(0);
    audio.play();
  });

  // Tap-to-Sync Assistant
  tapSync = new TapSyncManager(audio, (recorded) => {
    currentLines = recorded;
    currentSong.lines = currentLines;
    typing.setLines(currentLines);
    renderLineEditor();
    tapSyncModal.classList.remove('active');
    alert('Selesai! Timestamp lirik berhasil disinkronkan dengan ritme lagu.');
  });

  btnStartTapSync.addEventListener('click', () => {
    const raw = rawLyricsInput.value.trim();
    let lines = [];
    if (raw) {
      lines = CodeGenerator.convertLyricsToCode(raw);
    } else {
      lines = currentLines;
    }

    if (lines.length === 0) {
      alert('Masukkan lirik terlebih dahulu!');
      return;
    }

    tapSyncModal.classList.add('active');
    tapSync.start(lines);
    updateTapModalUI(lines[0].text, 1, lines.length);
  });

  function updateTapModalUI(text, cur, total) {
    tapCurrentLineBox.textContent = text || 'Selesai!';
    tapProgressText.textContent = `Baris: ${cur} / ${total}`;
  }

  btnTapAction.addEventListener('click', () => {
    handleTapSyncStep();
  });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && tapSyncModal.classList.contains('active')) {
      e.preventDefault();
      handleTapSyncStep();
    }
  });

  function handleTapSyncStep() {
    const res = tapSync.tap();
    if (res) {
      if (res.finished) {
        updateTapModalUI('Semua baris selesai disinkronkan!', res.total, res.total);
      } else {
        updateTapModalUI(res.currentLine ? res.currentLine.text : '', res.lineIndex, res.total);
      }
    }
  }

  btnCloseTapSync.addEventListener('click', () => {
    tapSync.cancel();
    tapSyncModal.classList.remove('active');
  });

  // Line Editor in Drawer
  function renderLineEditor() {
    linesEditorList.innerHTML = currentLines.map((line, idx) => `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: 6px; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem;">
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <input type="text" class="form-control" style="width: 44px; text-align: center; font-size: 0.75rem;" value="${line.lineNum || (idx+1)}" onchange="updateLineNum(${idx}, this.value)">
          <input type="text" class="form-control" style="flex: 1; font-family: var(--font-mono); font-size: 0.775rem;" value="${line.text.replace(/"/g, '&quot;')}" onchange="updateLineText(${idx}, this.value)">
          <button class="btn btn-icon" onclick="deleteLine(${idx})" style="color: #ff3355;">✕</button>
        </div>
        <div style="display: flex; gap: 0.5rem; font-size: 0.75rem; color: #94a3b8; align-items: center;">
          <span>Start:</span>
          <input type="number" step="0.1" class="form-control" style="width: 70px; padding: 2px 4px; font-size: 0.75rem;" value="${line.timeStart}" onchange="updateLineStart(${idx}, this.value)">
          <span>End:</span>
          <input type="number" step="0.1" class="form-control" style="width: 70px; padding: 2px 4px; font-size: 0.75rem;" value="${line.timeEnd}" onchange="updateLineEnd(${idx}, this.value)">
        </div>
      </div>
    `).join('');
  }

  window.updateLineText = (idx, val) => {
    currentLines[idx].text = val;
    typing.setLines(currentLines);
  };
  window.updateLineNum = (idx, val) => {
    currentLines[idx].lineNum = val;
    typing.setLines(currentLines);
  };
  window.updateLineStart = (idx, val) => {
    currentLines[idx].timeStart = parseFloat(val);
  };
  window.updateLineEnd = (idx, val) => {
    currentLines[idx].timeEnd = parseFloat(val);
  };
  window.deleteLine = (idx) => {
    currentLines.splice(idx, 1);
    typing.setLines(currentLines);
    renderLineEditor();
  };

  btnAddLine.addEventListener('click', () => {
    const last = currentLines[currentLines.length - 1];
    const newStart = last ? (last.timeEnd + 0.2) : 0.5;
    currentLines.push({
      id: currentLines.length + 1,
      text: 'new.line("text");',
      timeStart: parseFloat(newStart.toFixed(2)),
      timeEnd: parseFloat((newStart + 2.0).toFixed(2)),
      lineNum: String(currentLines.length + 1).padStart(2, '0')
    });
    typing.setLines(currentLines);
    renderLineEditor();
  });

  // Style Toggles
  document.querySelectorAll('.cursor-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-color');
      typing.setCursorColor(color);
    });
  });

  document.getElementById('toggleFlower').addEventListener('change', (e) => {
    visuals.settings.showFlower = e.target.checked;
  });

  document.getElementById('toggleLensFlare').addEventListener('change', (e) => {
    lensFlare.style.display = e.target.checked ? 'block' : 'none';
  });

  document.getElementById('toggleBgCode').addEventListener('change', (e) => {
    bgCodeReflection.style.display = e.target.checked ? 'block' : 'none';
  });

  document.getElementById('toggleParticles').addEventListener('change', (e) => {
    visuals.settings.showParticles = e.target.checked;
  });

  document.getElementById('toggleScanlines').addEventListener('change', (e) => {
    screenScanlines.style.display = e.target.checked ? 'block' : 'none';
  });

  document.getElementById('toggleTiltSwitch').addEventListener('change', (e) => {
    is3DTilt = e.target.checked;
    codeViewport.classList.toggle('tilt-active', is3DTilt);
  });

  // ==========================================================================
  // Trimmer & Zero-Delay Calibration Listeners
  // ==========================================================================
  function updateTrimUI() {
    const s = parseFloat(trimStartInput.value) || 0;
    const e = parseFloat(trimEndInput.value) || 25;
    const dur = Math.max(1, e - s);
    trimDurLabel.textContent = `Durasi: ${dur.toFixed(1)}s`;
  }

  trimStartInput.addEventListener('input', updateTrimUI);
  trimEndInput.addEventListener('input', updateTrimUI);

  document.querySelectorAll('.btn-trim-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const dur = parseFloat(btn.getAttribute('data-dur'));
      const s = parseFloat(trimStartInput.value) || 0;
      trimEndInput.value = (s + dur).toFixed(1);
      updateTrimUI();
    });
  });

  btnAutoChorus.addEventListener('click', async () => {
    btnAutoChorus.innerHTML = '⏳ Menganalisis Puncak Lagu (RMS)...';
    const res = await audio.detectPeakChorus(20);
    trimStartInput.value = res.start.toFixed(1);
    trimEndInput.value = res.end.toFixed(1);
    updateTrimUI();
    btnAutoChorus.innerHTML = '⚡ Auto Deteksi Bagian Reff / Viral Drop!';

    audio.setTrim(res.start, res.end);
    progressSlider.max = audio.getTrimmedDuration();
    audio.seek(0);
    audio.play();

    recorder.showToast(`✨ Reff / Hook lagu berhasil dideteksi di detik ${res.start}s - ${res.end}s!`);
  });

  btnPreviewTrim.addEventListener('click', () => {
    const s = parseFloat(trimStartInput.value) || 0;
    const e = parseFloat(trimEndInput.value) || 25;
    audio.setTrim(s, e);
    audio.seek(0);
    audio.play();
  });

  btnApplyTrim.addEventListener('click', () => {
    const s = parseFloat(trimStartInput.value) || 0;
    const e = parseFloat(trimEndInput.value) || 25;
    audio.setTrim(s, e);
    progressSlider.max = audio.getTrimmedDuration();
    sideDrawer.classList.add('collapsed');
    audio.seek(0);
    audio.play();
    recorder.showToast(`✅ Potongan lagu ${e - s}s berhasil diterapkan!`);
  });

  // Zero-Delay Sync Slider
  syncOffsetSlider.addEventListener('input', (e) => {
    const ms = parseInt(e.target.value);
    audio.setSyncOffset(ms);
    const sign = ms > 0 ? '+' : '';
    delayValueLabel.textContent = `${sign}${ms} ms ${ms === 90 ? '(Pas / Zero Delay)' : ''}`;
  });

  // ==========================================================================
  // Hashtags FYP Modal Listeners
  // ==========================================================================
  const btnOpenHashtags = document.getElementById('btnOpenHashtags');
  const hashtagsModal = document.getElementById('hashtagsModal');
  const btnCloseHashtags = document.getElementById('btnCloseHashtags');

  if (btnOpenHashtags && hashtagsModal) {
    btnOpenHashtags.addEventListener('click', () => {
      hashtagsModal.classList.add('active');
    });

    btnCloseHashtags.addEventListener('click', () => {
      hashtagsModal.classList.remove('active');
    });

    document.querySelectorAll('.btn-copy-fpy').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const textVal = document.getElementById(targetId).value;
        navigator.clipboard.writeText(textVal).then(() => {
          recorder.showToast('📋 Caption & Hashtag berhasil disalin!');
          const orig = btn.innerHTML;
          btn.innerHTML = '✅ Tersalin!';
          setTimeout(() => { btn.innerHTML = orig; }, 2000);
        });
      });
    });
  }

  // Initial Load
  populateSongSelect();
  loadSong(SONG_PRESETS[0]);
});
