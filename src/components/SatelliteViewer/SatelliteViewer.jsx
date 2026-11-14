import React, { useRef, useEffect, useState, useCallback } from "react";
import styles from "./SatelliteViewer.module.css";
import { api } from "../../api/client";

export default function SatelliteViewer({
  imageObj,
  scanProgress, // 0.0 to 1.0
  isPlaying,
  onSeek,
  onInspectPixel,
  sonifier,
}) {
  const canvasRef = useRef(null);
  const visualizerRef = useRef(null);
  const imageElementRef = useRef(null);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Load the selected frame through the CORS-safe proxy unless it is a local upload.
  useEffect(() => {
    let cancelled = false;
    imageElementRef.current = null;
    setImageLoaded(false);
    setLoadError(null);

    if (!imageObj?.imageUrl) return undefined;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      if (cancelled) return;
      imageElementRef.current = img;
      setImageLoaded(true);
    };

    img.onerror = () => {
      if (cancelled) return;
      imageElementRef.current = null;
      setImageLoaded(false);
      setLoadError("NASA image could not be loaded. Check the API connection or choose another visualization.");
    };

    const isLocalImage = imageObj.isUserDrop && /^(data:|blob:)/i.test(imageObj.imageUrl);
    img.src = isLocalImage ? imageObj.imageUrl : api.getProxyUrl(imageObj.imageUrl);

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [imageObj]);

  // Main Canvas Render loop: Satellite Image + Radiant Scanline
  const drawMainCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageElementRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;

    // Draw the satellite image scaled to fit
    ctx.clearRect(0, 0, width, height);
    try {
      ctx.drawImage(img, 0, 0, width, height);
    } catch (error) {
      console.error("Could not draw selected NASA image:", error);
      setLoadError("The selected image could not be drawn. Please choose another NASA visualization.");
      return;
    }

    // Calculate current scanline X position
    const scanX = Math.round(scanProgress * width);

    // 1. Draw darkening scrim for unscanned area or scanner glow
    const glowGrad = ctx.createLinearGradient(scanX - 40, 0, scanX + 2, 0);
    glowGrad.addColorStop(0, "rgba(0, 184, 212, 0)");
    glowGrad.addColorStop(1, "rgba(0, 184, 212, 0.25)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(Math.max(0, scanX - 40), 0, 42, height);

    // 2. Radiant NASA Laser Scanline
    ctx.beginPath();
    ctx.moveTo(scanX, 0);
    ctx.lineTo(scanX, height);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#00e5ff";
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    // 3. Scanline tracker head (top & bottom glowing nodes)
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(scanX, 6, 4, 0, Math.PI * 2);
    ctx.arc(scanX, height - 6, 4, 0, Math.PI * 2);
    ctx.fill();
  }, [scanProgress, imageLoaded]);

  // Redraw when progress changes
  useEffect(() => {
    drawMainCanvas();
  }, [drawMainCanvas]);

  // Audio Spectrum Visualizer beneath canvas
  useEffect(() => {
    const canvas = visualizerRef.current;
    if (!canvas || !sonifier) return;

    const ctx = canvas.getContext("2d");
    const bufferLength = 64;
    const dataArray = new Uint8Array(bufferLength);
    let animId;

    function renderVisualizer() {
      animId = requestAnimationFrame(renderVisualizer);
      sonifier.getVisualizerData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        const hue = 180 + (i / bufferLength) * 50; // Cyan to Deep Electric Blue
        ctx.fillStyle = isPlaying ? `hsl(${hue}, 95%, 55%)` : "rgba(255,255,255,0.1)";
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

        x += barWidth;
      }
    }

    renderVisualizer();
    return () => cancelAnimationFrame(animId);
  }, [sonifier, isPlaying]);

  // Handle canvas click to seek or inspect
  function handleCanvasClick(e) {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, clickX / rect.width));
    const normY = Math.max(0, Math.min(1, clickY / rect.height));

    // Seek the scanline
    onSeek(normX);

    // Inspect pixel audio
    const ctx = canvas.getContext("2d");
    const pixelX = Math.max(0, Math.min(canvas.width - 1, Math.floor(clickX * (canvas.width / rect.width))));
    const pixelY = Math.max(0, Math.min(canvas.height - 1, Math.floor(clickY * (canvas.height / rect.height))));
    let pixel;
    try {
      pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
    } catch (error) {
      console.warn("Canvas pixel inspection unavailable:", error);
      return;
    }
    if (onInspectPixel) {
      onInspectPixel(pixel[0], pixel[1], pixel[2], normY, normX);
    }
  }

  function handleCanvasKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!imageLoaded) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;
      const pixel = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data;
      onSeek(0.5);
      onInspectPixel?.(pixel[0], pixel[1], pixel[2], 0.5);
    }
  }

  // Handle mouse move to show pixel coordinate HUD
  function handleMouseMove(e) {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const ctx = canvas.getContext("2d");
    const pixelX = Math.max(0, Math.min(canvas.width - 1, Math.floor(x * (canvas.width / rect.width))));
    const pixelY = Math.max(0, Math.min(canvas.height - 1, Math.floor(y * (canvas.height / rect.height))));
    let pixel;
    try {
      pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;
    } catch (error) {
      console.warn("Canvas hover sampling unavailable:", error);
      setHoverInfo(null);
      return;
    }

    setHoverInfo({
      x: Math.round(x),
      y: Math.round(y),
      r: pixel[0],
      g: pixel[1],
      b: pixel[2],
    });
  }

  return (
    <div className={styles.viewerContainer}>
      {/* Satellite Header Info */}
      <div className={styles.metaHeader}>
        <div>
          <h2 className={styles.imageTitle}>{imageObj?.title || "NASA Satellite Observation"}</h2>
          <p className={styles.missionText}>
            {imageObj?.mission} · {imageObj?.date} · {imageObj?.organization}
          </p>
          {imageObj?.description && <p className={styles.missionText}>{imageObj.description.slice(0, 260)}{imageObj.description.length > 260 ? "…" : ""}</p>}
        </div>
        <div className={styles.coordsBadge}>
          {hoverInfo ? (
            <span>
              [X:{hoverInfo.x} Y:{hoverInfo.y}] RGB({hoverInfo.r}, {hoverInfo.g}, {hoverInfo.b})
            </span>
          ) : (
            <span>Click anywhere to inspect sound & coordinate</span>
          )}
        </div>
      </div>

      {/* Main Canvas Frame */}
      <div className={styles.canvasFrame}>
        {loadError && (
          <div className={styles.errorOverlay}>
            <p>{loadError}</p>
          </div>
        )}

        {!imageObj?.imageUrl && !loadError && (
          <div className={styles.loadingOverlay}>
            <p>Choose a visualization from the NASA EIC library below to begin.</p>
          </div>
        )}
        {imageObj?.imageUrl && !imageLoaded && !loadError && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner} />
            <p>Loading NASA visualization frame…</p>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          className={styles.mainCanvas}
          role="button"
          tabIndex={0}
          aria-label={`Interactive visualization frame: ${imageObj?.imageAlt || imageObj?.title || "NASA Earth visualization"}. Press Enter or Space to sonify the center point; use the timeline slider to scan.`}
          onKeyDown={handleCanvasKeyDown}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
          title="Click to seek scanline or inspect coordinate sound"
        />

        {/* Scan Status Badge */}
        <div className={styles.scanBadge}>
          <span className={`${styles.statusDot} ${isPlaying ? styles.liveDot : ""}`} />
          <span>{isPlaying ? "SCANNING NASA PIXELS" : "READY"}</span>
          <span className={styles.percentage}>{Math.round(scanProgress * 100)}%</span>
        </div>
      </div>

      {/* Real-time Spectrum Visualizer Bar */}
      <div className={styles.spectrumWrapper}>
        <canvas
          ref={visualizerRef}
          width={800}
          height={38}
          className={styles.spectrumCanvas}
        />
        <div className={styles.spectrumLabels}>
          <span>65 Hz (Sub-Bass)</span>
          <span>AUDIO FREQUENCY SPECTRUM (24 BANDS)</span>
          <span>2.4 kHz (Treble)</span>
        </div>
      </div>
    </div>
  );
}
