import React, { useState, useEffect, useRef, useCallback } from "react";
import SatelliteDropzone from "./components/Dropzone/SatelliteDropzone";
import SatelliteViewer from "./components/SatelliteViewer/SatelliteViewer";
import ImageControls from "./components/ImageControls/ImageControls";
import NASAGallery from "./components/NASAGallery/NASAGallery";
import TelemetryHUD from "./components/TelemetryHUD/TelemetryHUD";
import EICGallery from "./components/EICGallery/EICGallery";
import { createSatelliteSonifier } from "./sonification/satelliteImageSonifier";
import { api } from "./api/client";
import styles from "./App.module.css";

export default function App() {
  const [currentImage, setCurrentImage] = useState(null);
  const [customImages, setCustomImages] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scanProgress, setScanProgress] = useState(0); // 0.0 to 1.0
  const [speed, setSpeed] = useState(1);
  const [soundMode, setSoundMode] = useState("celestial"); // "celestial" | "ambient" | "raw"
  const [isLooping, setIsLooping] = useState(true);
  const [volume, setVolume] = useState(0.7);
  const [telemetry, setTelemetry] = useState(null);
  const [apiStatus, setApiStatus] = useState("checking");
  const [pixelsReady, setPixelsReady] = useState(false);

  // Sonification Engine instance
  const sonifierRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const offscreenPixelsRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(0);
  const isPlayingRef = useRef(false);
  const scanProgressRef = useRef(0);

  // Keep refs in sync for the animation loop
  isPlayingRef.current = isPlaying;
  scanProgressRef.current = scanProgress;

  // Initialize sonifier on mount
  useEffect(() => {
    sonifierRef.current = createSatelliteSonifier();

    // Check backend health
    api.health()
      .then(() => setApiStatus("ok"))
      .catch(() => setApiStatus("offline"));

    return () => {
      sonifierRef.current?.destroy();
    };
  }, []);

  // Pre-decode image pixels into offscreen canvas for instantaneous 60fps sampling
  useEffect(() => {
    let cancelled = false;
    offscreenPixelsRef.current = null;
    setPixelsReady(false);
    if (!currentImage?.imageUrl) return undefined;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    const isLocalImage = currentImage.isUserDrop && /^(data:|blob:)/i.test(currentImage.imageUrl);
    const src = isLocalImage ? currentImage.imageUrl : api.getProxyUrl(currentImage.imageUrl);

    img.onload = () => {
      if (cancelled) return;
      const canvas = offscreenCanvasRef.current || document.createElement("canvas");
      offscreenCanvasRef.current = canvas;
      canvas.width = 600;
      canvas.height = 360;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      try {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        offscreenPixelsRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setPixelsReady(true);
      } catch (error) {
        console.warn("Could not prepare image pixels for sonification:", error);
        offscreenPixelsRef.current = null;
        setPixelsReady(false);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        offscreenPixelsRef.current = null;
        setPixelsReady(false);
        console.error("Image pixel preparation failed. Check the image proxy and selected source URL.");
      }
    };
    img.src = src;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [currentImage]);

  // Main Sonification & Scan Playback Loop
  const tick = useCallback((time) => {
    if (!isPlayingRef.current) return;

    if (!lastTimeRef.current) lastTimeRef.current = time;
    const delta = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    // A full sweep takes 20 seconds at 1x speed
    const sweepDuration = 20 / speed;
    let nextProgress = scanProgressRef.current + delta / sweepDuration;

    if (nextProgress >= 1.0) {
      if (isLooping) {
        nextProgress = 0;
      } else {
        nextProgress = 1.0;
        isPlayingRef.current = false;
        setIsPlaying(false);
        sonifierRef.current?.silenceAll();
        return;
      }
    }

    scanProgressRef.current = nextProgress;
    setScanProgress(nextProgress);

    // Sonify current column from pre-decoded pixels
    const pixelsObj = offscreenPixelsRef.current;
    if (pixelsObj && sonifierRef.current) {
      const colX = Math.floor(nextProgress * (pixelsObj.width - 1));
      const tel = sonifierRef.current.sonifyColumn(
        pixelsObj.data,
        colX,
        pixelsObj.width,
        pixelsObj.height,
        soundMode
      );
      if (tel) setTelemetry(tel);
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }, [speed, isLooping, soundMode]);

  // Start / Pause
  const handlePlay = useCallback(() => {
    if (!currentImage?.imageUrl || !offscreenPixelsRef.current) return;
    const audioContext = sonifierRef.current?.initContext();
    if (audioContext?.state === "suspended") audioContext.resume().catch(() => {});
    sonifierRef.current?.setMasterVolume(volume);
    lastTimeRef.current = 0;
    isPlayingRef.current = true;
    setIsPlaying(true);
    animFrameRef.current = requestAnimationFrame(tick);
  }, [tick, currentImage, volume]);

  const handlePause = useCallback(() => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    sonifierRef.current?.silenceAll();
    cancelAnimationFrame(animFrameRef.current);
  }, []);

  const handleRestart = useCallback(() => {
    setScanProgress(0);
    scanProgressRef.current = 0;
    if (isPlaying) {
      lastTimeRef.current = 0;
    }
  }, [isPlaying]);

  const handleSeek = useCallback((normX) => {
    setScanProgress(normX);
    scanProgressRef.current = normX;

    // Immediately trigger sound at seek location
    const pixelsObj = offscreenPixelsRef.current;
    if (pixelsObj && sonifierRef.current) {
      const colX = Math.floor(normX * (pixelsObj.width - 1));
      const tel = sonifierRef.current.sonifyColumn(
        pixelsObj.data,
        colX,
        pixelsObj.width,
        pixelsObj.height,
        soundMode
      );
      if (tel) setTelemetry(tel);
    }
  }, [soundMode]);

  // Interactive Click on Pixel
  const handleInspectPixel = useCallback((r, g, b, normY) => {
    sonifierRef.current?.inspectPixel(r, g, b, normY);
  }, []);

  // Handle Image Drop / Upload
  function handleImageLoaded(newImg) {
    handlePause();
    setCurrentImage(newImg);
    setTelemetry(null);
    setScanProgress(0);
    scanProgressRef.current = 0;
    if (newImg.isUserDrop) {
      setCustomImages((prev) => [newImg, ...prev.filter((i) => i.id !== newImg.id)]);
    }
  }

  // Handle Volume change
  function handleVolumeChange(val) {
    setVolume(val);
    sonifierRef.current?.setMasterVolume(val);
  }

  return (
    <div className={styles.appContainer}>
      {/* ── Top Header ── */}
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brand}>
            <span className={styles.brandIcon} aria-hidden="true">🛰️</span>
            <div>
              <h1 className={styles.brandTitle}>EARTHSONIC</h1>
              <p className={styles.brandSubtitle}>NASA EARTH INFORMATION · SONIFICATION</p>
            </div>
          </div>

          <div className={styles.headerRight}>
            <span
              className={`${styles.apiPill} ${
                apiStatus === "ok" ? styles.apiLive : styles.apiOff
              }`}
              title="Backend NASA image proxy status"
            >
              <span className={styles.apiDot} />
              {apiStatus === "ok" ? "BACKEND ONLINE" : "BACKEND OFFLINE"}
            </span>

            <a
              href="https://epic.gsfc.nasa.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.nasaLink}
            >
              NASA DSCOVR EPIC →
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className={styles.main}>
        {/* Drag & Drop Satellite Image Zone */}
        <SatelliteDropzone
          onImageLoaded={handleImageLoaded}
          currentImageName={currentImage?.title}
        />

        {/* Core Experience: Viewer + Telemetry HUD */}
        <div className={styles.coreGrid}>
          {/* Left Column: Image Canvas & Controls */}
          <div className={styles.leftColumn}>
            <SatelliteViewer
              imageObj={currentImage}
              scanProgress={scanProgress}
              isPlaying={isPlaying}
              onSeek={handleSeek}
              onInspectPixel={handleInspectPixel}
              sonifier={sonifierRef.current}
            />

            <ImageControls
              isPlaying={isPlaying}
              hasImage={Boolean(currentImage?.imageUrl) && pixelsReady}
              scanProgress={scanProgress}
              speed={speed}
              soundMode={soundMode}
              isLooping={isLooping}
              volume={volume}
              onPlay={handlePlay}
              onPause={handlePause}
              onRestart={handleRestart}
              onSeek={handleSeek}
              onSpeedChange={setSpeed}
              onSoundModeChange={setSoundMode}
              onLoopToggle={() => setIsLooping(!isLooping)}
              onVolumeChange={handleVolumeChange}
            />
          </div>

          {/* Right Column: Telemetry & NASA Sonification Rules */}
          <div className={styles.rightColumn}>
            <TelemetryHUD
              telemetry={telemetry}
              currentImage={currentImage}
            />
          </div>
        </div>

        {/* NASA Satellite Imagery Explorer (Curated Presets & Live DSCOVR EPIC Feed) */}
        <section className={styles.storyPanel} aria-label="How Earthsonic works">
          <div className={styles.storyEyebrow}>FROM VISUAL FRAME TO SOUND</div>
          <h2>Listen to the patterns in a changing planet.</h2>
          <p>Choose an official NASA Earth Information Center visualization, then play the scan. Each vertical slice is sampled and translated into a changing set of tones. The sound is a perceptual guide to patterns in the displayed frame, not a substitute for the source dataset or a direct reading of physical units.</p>
          <div className={styles.mappingGrid}>
            <div><strong>01 · Position</strong><span>The scan moves from the left edge of the selected frame to the right.</span></div>
            <div><strong>02 · Vertical structure</strong><span>Image intensity across 24 horizontal bands controls the relative energy of musical tones.</span></div>
            <div><strong>03 · Visual texture</strong><span>Average brightness and RGB balance shape timbre and tone colour. These are image properties, not measurements such as temperature or depth.</span></div>
          </div>
          <p className={styles.accessNote}><strong>Accessibility:</strong> Playback controls are keyboard-operable, and the selected NASA visualization includes descriptive text and a source link. Use the controls to pause, restart, seek, and adjust volume.</p>
        </section>

        <div className={styles.galleryWrapper}>
          <EICGallery onSelect={handleImageLoaded} activeId={currentImage?.id} />
        </div>
        <details className={styles.secondaryGallery}>
          <summary>Other NASA imagery (not part of the EIC source collection)</summary>
          <NASAGallery onSelectImage={handleImageLoaded} currentImageId={currentImage?.id} customImages={customImages} />
        </details>
      </main>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <p>
          Selected source: <strong>{currentImage?.mission || "NASA Earth Information Center"}</strong> · {currentImage?.credit || "NASA / NASA GSFC"}
        </p>
        {currentImage?.sourceUrl && <p><a href={currentImage.sourceUrl} target="_blank" rel="noreferrer">Open selected NASA SVS visualization ↗</a></p>}
        <p className={styles.disclaimer}>
          EARTHSONIC is an independent sonification experiment. It is not a NASA product or endorsement. Sound is mapped from visible image properties; consult the linked NASA source for scientific measurements, units, and interpretation.
        </p>
      </footer>
    </div>
  );
}
