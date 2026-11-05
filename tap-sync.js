/* ==========================================================================
   CodeLyrics Studio - Interactive Tap-to-Sync Tool
   Tap Spacebar or Click to record exact lyrics-to-beat timestamps
   ========================================================================== */

class TapSyncManager {
  constructor(audioPlayer, onComplete) {
    this.audioPlayer = audioPlayer;
    this.onComplete = onComplete;
    this.isRecording = false;
    this.currentLineIndex = 0;
    this.rawLines = [];
    this.recordedLines = [];
  }

  start(lines) {
    if (!lines || lines.length === 0) return;
    this.rawLines = lines;
    this.recordedLines = [];
    this.currentLineIndex = 0;
    this.isRecording = true;

    // Reset and play audio
    this.audioPlayer.seek(0);
    this.audioPlayer.play();
  }

  tap() {
    if (!this.isRecording) return null;

    const currentTime = parseFloat(this.audioPlayer.getCurrentTime().toFixed(2));
    
    // Close previous line if open
    if (this.currentLineIndex > 0 && this.recordedLines.length > 0) {
      const prev = this.recordedLines[this.recordedLines.length - 1];
      prev.timeEnd = Math.max(prev.timeStart + 0.5, currentTime - 0.05);
    }

    // If there are more lines to record
    if (this.currentLineIndex < this.rawLines.length) {
      const lineData = this.rawLines[this.currentLineIndex];
      this.recordedLines.push({
        ...lineData,
        id: this.currentLineIndex + 1,
        timeStart: currentTime,
        timeEnd: currentTime + 2.0, // placeholder until next tap
        lineNum: String(this.currentLineIndex + 1).padStart(2, '0')
      });

      this.currentLineIndex++;

      return {
        finished: false,
        lineIndex: this.currentLineIndex,
        currentLine: this.rawLines[this.currentLineIndex - 1],
        nextLine: this.rawLines[this.currentLineIndex] || null,
        total: this.rawLines.length
      };
    } else {
      // Done
      this.finish();
      return {
        finished: true,
        recordedLines: this.recordedLines
      };
    }
  }

  finish() {
    this.isRecording = false;
    // Ensure last line has a sensible timeEnd
    if (this.recordedLines.length > 0) {
      const last = this.recordedLines[this.recordedLines.length - 1];
      last.timeEnd = parseFloat((last.timeStart + 2.5).toFixed(2));
    }

    if (this.onComplete) {
      this.onComplete(this.recordedLines);
    }
  }

  cancel() {
    this.isRecording = false;
  }
}
