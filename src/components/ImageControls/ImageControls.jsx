import React from "react";
import styles from "./ImageControls.module.css";

const SPEEDS = [0.5, 1, 2];
const SOUND_MODES = [
  { id: "celestial", label: "🌌 Harmonic", desc: "Consonant scale for image patterns" },
  { id: "ambient", label: "🌊 Ambient", desc: "Sustained low-frequency texture" },
  { id: "raw", label: "📡 Direct Bands", desc: "Less-constrained 24-band synthesis" },
];

export default function ImageControls({
  isPlaying,
  hasImage = true,
  scanProgress,
  speed,
  soundMode,
  isLooping,
  volume,
  onPlay,
  onPause,
  onRestart,
  onSeek,
  onSpeedChange,
  onSoundModeChange,
  onLoopToggle,
  onVolumeChange,
}) {
  return (
    <div className={styles.controlsContainer} role="region" aria-label="Satellite sonification controls">
      {/* 1. Timeline Scrubber */}
      <div className={styles.scrubberRow}>
        <span className={styles.timeTag}>0% (WEST / LEFT)</span>
        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={(scanProgress * 100).toFixed(1)}
          disabled={!hasImage}
          onChange={(e) => onSeek(parseFloat(e.target.value) / 100)}
          className={styles.scrubber}
          aria-label="Image scan progress"
        />
        <span className={styles.timeTag}>100% (EAST / RIGHT)</span>
      </div>

      {/* 2. Main Control Bar */}
      <div className={styles.mainBar}>
        {/* Left: Playback buttons */}
        <div className={styles.buttonGroup}>
          <button
            onClick={onRestart}
            disabled={!hasImage}
            className={styles.iconBtn}
            title="Rewind to beginning"
            aria-label="Rewind"
          >
            ⏮
          </button>

          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={!hasImage}
            className={`${styles.playBtn} ${isPlaying ? styles.pauseActive : ""}`}
            aria-label={isPlaying ? "Pause sonification" : "Play sonification"}
          >
            {isPlaying ? "⏸ PAUSE" : "▶ PLAY SONIFICATION"}
          </button>

          <button
            onClick={onLoopToggle}
            disabled={!hasImage}
            className={`${styles.iconBtn} ${isLooping ? styles.activeOption : ""}`}
            title={isLooping ? "Loop enabled" : "Loop disabled"}
            aria-label="Toggle loop"
          >
            🔁 {isLooping ? "ON" : "OFF"}
          </button>
        </div>

        {/* Center: Sound Profile Selector */}
        <div className={styles.modeSelector}>
          <label htmlFor="sound-mode" className={styles.controlLabel}>Audio Profile:</label>
          <select
            id="sound-mode"
            value={soundMode}
            onChange={(e) => onSoundModeChange(e.target.value)}
            disabled={!hasImage}
            className={styles.modeDropdown}
          >
            {SOUND_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Speed & Volume */}
        <div className={styles.rightGroup}>
          {/* Speed */}
          <div className={styles.speedGroup}>
            <span className={styles.controlLabel}>Speed:</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                disabled={!hasImage}
                className={`${styles.speedBtn} ${speed === s ? styles.speedActive : ""}`}
              >
                {s}×
              </button>
            ))}
          </div>

          {/* Volume */}
          <div className={styles.volumeGroup}>
            <span aria-hidden="true">🔊</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              disabled={!hasImage}
              className={styles.volumeSlider}
              aria-label="Master volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
