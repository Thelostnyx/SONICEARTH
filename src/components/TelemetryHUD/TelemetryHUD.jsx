import React from "react";
import styles from "./TelemetryHUD.module.css";

export default function TelemetryHUD({ telemetry, currentImage }) {
  if (!telemetry) return null;
  const { meanR = 0, meanG = 0, meanB = 0, meanL = 0, brightPixelRatio = 0, dominantFreq = 440 } = telemetry;
  return (
    <aside className={styles.hudPanel} aria-label="Image analysis and sonification telemetry">
      <div className={styles.hudHeader}>
        <span className={styles.hudTitle}>◉ FRAME ANALYSIS</span>
        <span className={styles.liveTag}>LIVE SCAN</span>
      </div>
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}><span className={styles.metricLabel}>Dominant tone</span><span className={styles.metricValue}>{dominantFreq} Hz</span><span className={styles.metricSub}>Current visual band</span></div>
        <div className={styles.metricCard}><span className={styles.metricLabel}>Bright pixels</span><span className={styles.metricValue}>{Math.round(brightPixelRatio * 100)}%</span><span className={styles.metricSub}>High-luminance fraction</span></div>
        <div className={styles.metricCard}><span className={styles.metricLabel}>Mean luminance</span><span className={styles.metricValue}>{meanL} / 255</span><span className={styles.metricSub}>Image brightness</span></div>
      </div>
      <div className={styles.spectrumSection}>
        <span className={styles.sectionHeading}>RGB image-channel balance</span>
        {[["Red channel", meanR, "#ef7777"], ["Green channel", meanG, "#79c98b"], ["Blue channel", meanB, "#68aef5"]].map(([label, value, color]) => (
          <div className={styles.barItem} key={label}>
            <div className={styles.barHeader}><span style={{ color }}>{label}</span><span className={styles.barVal}>{Math.round(value)}</span></div>
            <div className={styles.barTrack}><div className={styles.barFill} style={{ width: `${Math.max(0, Math.min(100, value / 255 * 100))}%`, background: color }} /></div>
          </div>
        ))}
      </div>
      <div className={styles.mappingRuleBox}>
        <h4 className={styles.ruleTitle}>Sonification mapping</h4>
        <ul className={styles.ruleList}>
          <li><strong>Horizontal position:</strong> determines scan time and stereo position.</li>
          <li><strong>Vertical image bands:</strong> map to 24 musical frequency bands.</li>
          <li><strong>Brightness:</strong> controls relative tone energy.</li>
          <li><strong>RGB balance:</strong> subtly changes synthesis tone colour.</li>
        </ul>
        <p className={styles.citation}>Source: <strong>{currentImage?.mission || "NASA EIC visualization"}</strong>. Image-derived features only; not physical measurement values.</p>
      </div>
      {currentImage?.sourceUrl && <a className={styles.sourceLink} href={currentImage.sourceUrl} target="_blank" rel="noreferrer">View NASA source record ↗</a>}
    </aside>
  );
}
