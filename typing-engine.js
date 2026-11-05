/* ==========================================================================
   CodeLyrics Studio - Synchronized Typing Engine with Word-by-Word Auto-Zoom
   - Red cursor is placed directly contiguous with the text (character-by-character)
   - Portrait 9:16 Mathematical Projection Camera (transform-origin: 0 0)
   - Zero-Delay Audio Alignment: Characters & zoom appear instantly with vocal attack
   - Post-Punch Hold & Pre-Line Anticipation: Eliminates premature/delayed zoom-out
   - 60/120 FPS Mathematical LERP physics: 100% stutter-free and slow & buttery smooth
   ========================================================================== */

class TypingEngine {
  constructor(container, bgReflectionEl) {
    this.container = container;
    this.bgReflectionEl = bgReflectionEl;
    this.lines = [];
    this.activeLineIdx = -1;
    this.cursorColor = '#ff1e42';
    this.onProgress = null;
    this.beatIntensity = 0;

    // Mathematical LERP Camera State
    this.camera = {
      currentX: 0,
      currentY: 0,
      currentZoom: 1.10,
      currentRot: 0,
      targetX: 0,
      targetY: 0,
      targetZoom: 1.10,
      targetRot: 0
    };

    this.currentTime = 0;
    this.lineProgress = 0;
    this.isTyping = false;
  }

  setLines(lines) {
    this.lines = lines;
    this.activeLineIdx = -1;
    this.camera.currentX = 0;
    this.camera.currentY = 0;
    this.camera.currentZoom = 1.10;
    this.camera.targetX = 0;
    this.camera.targetY = 0;
    this.camera.targetZoom = 1.10;
    this.renderInitial();
  }

  setCursorColor(color) {
    this.cursorColor = color;
    document.documentElement.style.setProperty('--cursor-color', color);
    document.documentElement.style.setProperty('--cursor-glow', `${color}b3`);
  }

  renderInitial() {
    this.container.innerHTML = '';
    this.container.style.transformOrigin = '0 0';
    this.container.style.transform = 'translate3d(0, 0, 0) scale(1.10)';
    
    // Background reflection ghost code
    if (this.bgReflectionEl) {
      const codeSnippet = this.lines.map(l => l.text).join('\n');
      this.bgReflectionEl.textContent = codeSnippet + '\n' + codeSnippet;
    }
  }

  update(currentTime, isPlaying, beatIntensity = 0) {
    if (!this.lines || this.lines.length === 0) return;
    this.currentTime = currentTime;
    this.beatIntensity = beatIntensity;

    let activeIdx = -1;
    let completedLines = [];
    let currentLinePartial = null;
    let lastCompletedIdx = -1;
    let progress = 0;

    for (let i = 0; i < this.lines.length; i++) {
      const line = this.lines[i];
      if (currentTime >= line.timeEnd) {
        completedLines.push({ ...line, full: true });
        lastCompletedIdx = i;
      } else if (currentTime >= line.timeStart && currentTime < line.timeEnd) {
        activeIdx = i;
        progress = Math.max(0, Math.min(1, (currentTime - line.timeStart) / (line.timeEnd - line.timeStart)));
        const charLen = Math.min(line.text.length, Math.floor(line.text.length * progress));
        const partialText = line.text.slice(0, charLen);
        currentLinePartial = {
          ...line,
          partialText: partialText,
          isTyping: true
        };
        break;
      } else {
        // Future lines
        break;
      }
    }

    this.lineProgress = progress;
    this.isTyping = (activeIdx !== -1);
    const currentFocalIdx = (activeIdx !== -1) ? activeIdx : lastCompletedIdx;

    // Performance optimization: only touch DOM when lines or typed characters actually change!
    const domCacheKey = `${completedLines.length}|${currentLinePartial ? currentLinePartial.partialText : ''}|${currentFocalIdx}|${isPlaying}`;
    if (domCacheKey !== this.lastDomCacheKey) {
      this.renderDOM(completedLines, currentLinePartial, currentFocalIdx, isPlaying);
      this.lastDomCacheKey = domCacheKey;
    }

    this.computeCameraTargets(currentTime, progress, this.isTyping, currentLinePartial, currentFocalIdx);

    if (this.onProgress) {
      this.onProgress(currentTime, currentFocalIdx);
    }
  }

  renderDOM(completedLines, currentLinePartial, focalIdx, isPlaying) {
    let html = '';
    const totalRendered = completedLines.length + (currentLinePartial ? 1 : 0);

    // Render fully completed lines
    for (let i = 0; i < completedLines.length; i++) {
      const line = completedLines[i];
      const isFocal = (i === focalIdx && !currentLinePartial);
      const distFromFocal = focalIdx - i;
      
      let depthClass = '';
      if (isFocal) {
        depthClass = 'line-active';
      } else if (distFromFocal === 1) {
        depthClass = 'line-prev-1';
      } else if (distFromFocal === 2) {
        depthClass = 'line-prev-2';
      } else if (distFromFocal > 2) {
        depthClass = 'line-old';
      }

      const highlighted = SyntaxHighlighter.highlight(line.text, line.errorWord, line.isComment);
      const lineNum = line.lineNum || String(i + 1).padStart(2, '0');

      html += `
        <div class="code-line ${depthClass}" data-line="${i}">
          <span class="line-number">${lineNum}</span>
          <span class="line-content">${highlighted}${isFocal ? `<span class="code-cursor ${isPlaying ? '' : 'blink'}"></span>` : ''}</span>
        </div>
      `;
    }

    // Render currently typing line (active focal line)
    if (currentLinePartial) {
      const line = currentLinePartial;
      const lineIdx = completedLines.length;
      const highlighted = SyntaxHighlighter.highlight(line.partialText, line.errorWord, line.isComment);
      const lineNum = line.lineNum || String(lineIdx + 1).padStart(2, '0');

      html += `
        <div class="code-line line-active" data-line="${lineIdx}">
          <span class="line-number">${lineNum}</span>
          <span class="line-content">${highlighted}<span class="code-cursor"></span></span>
        </div>
      `;
    }

    // Empty state at 00:00
    if (totalRendered === 0) {
      html = `
        <div class="code-line line-active">
          <span class="line-number">01</span>
          <span class="line-content"><span class="code-cursor blink"></span></span>
        </div>
      `;
    }

    this.container.innerHTML = html;
  }

  computeCameraTargets(currentTime, lineProgress, isTyping, currentLinePartial, focalIdx) {
    const activeEl = this.container.querySelector('.code-line.line-active') || this.container.lastElementChild;
    if (!activeEl) return;

    const surfaceEl = this.container.parentElement;
    const surfaceWidth = surfaceEl ? surfaceEl.clientWidth : 380;
    const surfaceHeight = surfaceEl ? surfaceEl.clientHeight : 650;

    // Detect punchy words (inside quotes "", error words, or final phrase)
    let isPunchMoment = false;
    if (currentLinePartial) {
      const text = currentLinePartial.partialText || '';
      const quotes = (text.match(/["']/g) || []).length;
      const isInsideQuote = (quotes % 2 === 1);
      const isErrorWord = currentLinePartial.errorWord && text.includes(currentLinePartial.errorWord);
      const isEndClimax = lineProgress > 0.55;

      if (isInsideQuote || isErrorWord || isEndClimax) {
        isPunchMoment = true;
      }
    }

    // Smooth Zoom-Out Transition:
    // When a line finishes, hold the zoom for 0.30s so the vocal tail resonates
    // before easing back out, eliminating any premature or lagging zoom-out!
    let isHoldingCompletedPunch = false;
    if (!isTyping && focalIdx >= 0 && focalIdx < this.lines.length) {
      const finishedLine = this.lines[focalIdx];
      if (currentTime >= finishedLine.timeEnd && currentTime <= finishedLine.timeEnd + 0.32) {
        isHoldingCompletedPunch = true;
      }
    }

    // Pre-Anticipation: If next line starts in < 0.15s, start moving smoothly towards it
    let isAnticipatingNext = false;
    if (!isTyping && (focalIdx + 1) < this.lines.length) {
      const nextLine = this.lines[focalIdx + 1];
      if (currentTime >= nextLine.timeStart - 0.15) {
        isAnticipatingNext = true;
      }
    }

    // Dynamic Word-by-Word Zoom:
    let targetZoom = 1.08;
    if (isTyping) {
      if (isPunchMoment) {
        targetZoom = 1.34 + (lineProgress * 0.16); // up to 1.50x
      } else {
        targetZoom = 1.12 + (lineProgress * 0.18); // 1.12x to 1.30x
      }
    } else if (isHoldingCompletedPunch) {
      targetZoom = 1.30; // Hold zoom smoothly on completed word
    } else if (isAnticipatingNext) {
      targetZoom = 1.12; // Easing in towards next line
    } else {
      targetZoom = 1.08; // Relaxed breather between phrases
    }

    if (this.beatIntensity) {
      targetZoom += this.beatIntensity * 0.035;
    }

    // Cursor position & screen projection
    const cursorEl = activeEl.querySelector('.code-cursor');
    const cursorX = activeEl.offsetLeft + (cursorEl ? cursorEl.offsetLeft : 50);
    const cursorY = activeEl.offsetTop + 14;

    const focalX = surfaceWidth * 0.38;
    const focalY = surfaceHeight * 0.44;

    const t = currentTime * 1.1;
    const driftX = Math.sin(t) * 2.2;
    const driftY = Math.cos(t * 0.85) * 1.8;
    this.camera.targetRot = Math.sin(t * 0.6) * 0.32;

    this.camera.targetX = focalX - (cursorX * targetZoom) + driftX;
    this.camera.targetY = focalY - (cursorY * targetZoom) + driftY;
    this.camera.targetZoom = targetZoom;
  }

  // Called on EVERY requestAnimationFrame (60/120fps) for pure buttery smooth LERP
  stepCamera(beatIntensity = 0) {
    const lerp = (cur, target, speed) => cur + (target - cur) * speed;
    
    // Smooth damping speeds (slow & cinematic, zero stutter)
    const posSpeed = 0.048;  // Camera tracking glide
    const zoomSpeed = 0.040; // Smooth optical zoom ease

    this.camera.currentX = lerp(this.camera.currentX, this.camera.targetX, posSpeed);
    this.camera.currentY = lerp(this.camera.currentY, this.camera.targetY, posSpeed);
    this.camera.currentZoom = lerp(this.camera.currentZoom, this.camera.targetZoom, zoomSpeed);
    this.camera.currentRot = lerp(this.camera.currentRot, this.camera.targetRot, posSpeed);

    // Subtle beat bounce
    const effectiveZoom = this.camera.currentZoom + (beatIntensity * 0.02);

    // Apply hardware-accelerated 3D transform with transform-origin at (0, 0)
    this.container.style.transformOrigin = '0 0';
    this.container.style.transform = `translate3d(${this.camera.currentX.toFixed(2)}px, ${this.camera.currentY.toFixed(2)}px, 0) scale(${effectiveZoom.toFixed(3)}) rotate(${this.camera.currentRot.toFixed(2)}deg)`;
  }
}
