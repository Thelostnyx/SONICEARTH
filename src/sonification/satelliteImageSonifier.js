/**
 * EARTHSONIC — NASA Satellite Image Sonification Engine
 *
 * Implements multi-frequency additive spectral sonification:
 * - A scanning playhead sweeps across the satellite photo (X-axis = Time).
 * - Y-axis is divided into 24 harmonic frequency bands (Top = Treble, Bottom = Deep Sub-Bass).
 * - Pixel brightness at each vertical band controls that oscillator's volume.
 * - Color spectral analysis:
 *     * Red image channel -> low-pass filter tone colour
 *     * Green image channel -> harmonic resonance
 *     * Blue image channel -> subtle low-frequency balance
 *     * High-luminance pixels -> soft airy noise texture
 */

// Celestial minor/pentatonic frequencies (from 65 Hz up to 1864 Hz) across 24 bands
const FREQ_BANDS = [
  65.41,   // C2 (sub bass)
  77.78,   // Eb2
  87.31,   // F2
  98.00,   // G2
  116.54,  // Bb2
  130.81,  // C3
  155.56,  // Eb3
  174.61,  // F3
  196.00,  // G3
  233.08,  // Bb3
  261.63,  // C4 (middle C)
  311.13,  // Eb4
  349.23,  // F4
  392.00,  // G4
  466.16,  // Bb4
  523.25,  // C5
  622.25,  // Eb5
  698.46,  // F5
  783.99,  // G5
  932.33,  // Bb5
  1046.50, // C6
  1244.51, // Eb6
  1396.91, // F6
  1567.98  // G6
];

export function createSatelliteSonifier() {
  let ctx = null;
  let isRunning = false;
  let masterGain = null;
  let filterNode = null;
  let analyserNode = null;
  let pannerNode = null;
  let noiseNode = null;
  let noiseGain = null;

  // 24 band oscillators & individual gain nodes
  const bands = [];

  function initContext() {
    if (ctx && ctx.state !== "closed") return ctx;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioContextClass();

    // Master Analyser for UI visualizer
    analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;
    analyserNode.smoothingTimeConstant = 0.85;

    // Master Gain
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.5, ctx.currentTime);

    // Dynamic Filter (modulated by Red/Land color temperature)
    filterNode = ctx.createBiquadFilter();
    filterNode.type = "lowpass";
    filterNode.frequency.setValueAtTime(2400, ctx.currentTime);
    filterNode.Q.setValueAtTime(1.8, ctx.currentTime);

    // Stereo Panner
    if (ctx.createStereoPanner) {
      pannerNode = ctx.createStereoPanner();
      pannerNode.pan.setValueAtTime(0, ctx.currentTime);
    }

    // Connect master chain: filter -> masterGain -> analyser -> panner -> destination
    filterNode.connect(masterGain);
    masterGain.connect(analyserNode);

    if (pannerNode) {
      analyserNode.connect(pannerNode);
      pannerNode.connect(ctx.destination);
    } else {
      analyserNode.connect(ctx.destination);
    }

    // Initialize the 24 band oscillators
    bands.length = 0;
    FREQ_BANDS.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      // Waveform: alternate sine and soft triangle for lush organic texture
      osc.type = idx % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);

      osc.connect(gain);
      gain.connect(filterNode);
      osc.start();

      bands.push({ osc, gain, freq });
    });

    // Cloud / Albedo pink noise generator
    try {
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        output[i] = (b0 + b1 + b2) * 0.1;
      }

      noiseNode = ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(1800, ctx.currentTime);
      noiseFilter.Q.setValueAtTime(2.0, ctx.currentTime);

      noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, ctx.currentTime);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(masterGain);
      noiseNode.start();
    } catch (_) {
      // Noise fallback if buffer creation fails
    }

    return ctx;
  }

  /**
   * Scan one column of pixel data and update oscillator harmonics
   *
   * @param {Uint8ClampedArray} pixels - RGBA pixel array of the column or image
   * @param {number} colX - current column index
   * @param {number} width - total image width
   * @param {number} height - total image height
   * @param {string} soundMode - "celestial" | "raw" | "ambient"
   */
  function sonifyColumn(pixels, colX, width, height, soundMode = "celestial") {
    if (!ctx) initContext();
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const rampTime = 0.04; // smooth ramp without clicks

    const numBands = bands.length;
    const bandHeight = Math.max(1, Math.floor(height / numBands));

    let totalR = 0;
    let totalG = 0;
    let totalB = 0;
    let totalL = 0;
    let brightPixels = 0;
    const bandEnergies = new Float32Array(numBands);

    // Compute luminance and color energy for each of the 24 vertical bands
    for (let b = 0; b < numBands; b++) {
      // Note: Band 0 is top of image (highest frequency in music), band 23 is bottom
      const startY = (numBands - 1 - b) * bandHeight;
      const endY = Math.min(height, startY + bandHeight);

      let bandR = 0, bandG = 0, bandB = 0, count = 0;

      for (let y = startY; y < endY; y += 2) { // sample every 2 pixels for performance
        const pixelIdx = (y * width + colX) * 4;
        const r = pixels[pixelIdx];
        const g = pixels[pixelIdx + 1];
        const bCol = pixels[pixelIdx + 2];

        bandR += r;
        bandG += g;
        bandB += bCol;
        count++;

        // Count high-luminance pixels; this is a visual threshold, not cloud classification.
        if (r > 190 && g > 190 && bCol > 190) {
          brightPixels++;
        }
      }

      if (count > 0) {
        const avgR = bandR / count;
        const avgG = bandG / count;
        const avgB = bandB / count;
        const lum = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;

        totalR += avgR;
        totalG += avgG;
        totalB += avgB;
        totalL += lum;

        bandEnergies[b] = Math.min(1.0, lum / 255);
      }
    }

    const meanL = totalL / numBands;
    const meanR = totalR / numBands;
    const meanG = totalG / numBands;
    const meanB = totalB / numBands;
    const brightPixelRatio = Math.min(1.0, brightPixels / ((height / 2) || 1));

    // Image-channel balance shapes synthesis timbre; it is not a physical measurement.
    if (filterNode) {
      const targetCutoff = Math.max(400, Math.min(4800, 800 + (meanR / 255) * 3200 + (meanL / 255) * 800));
      filterNode.frequency.setTargetAtTime(targetCutoff, now, rampTime);
      filterNode.Q.setTargetAtTime(1.0 + (meanG / 255) * 3.5, now, rampTime);
    }

    // Stereo Panning follows horizontal scan position (-0.7 on left to +0.7 on right)
    if (pannerNode && width > 0) {
      const pan = Math.max(-0.7, Math.min(0.7, (colX / width - 0.5) * 1.4));
      pannerNode.pan.setTargetAtTime(pan, now, rampTime);
    }

    // High-luminance texture swell (not a cloud detector)
    if (noiseGain) {
      const targetNoise = brightPixelRatio > 0.15 ? Math.min(0.12, brightPixelRatio * 0.15) : 0.0001;
      noiseGain.gain.setTargetAtTime(targetNoise, now, rampTime * 2);
    }

    // Apply gains to each of the 24 frequency oscillators
    const modeMultiplier = soundMode === "ambient" ? 0.6 : soundMode === "raw" ? 1.0 : 0.8;

    bands.forEach((band, idx) => {
      let energy = bandEnergies[idx];

      // Non-linear perceptual scaling (square root or squared depending on mode)
      if (soundMode === "celestial") {
        energy = Math.pow(energy, 1.6);
      } else if (soundMode === "ambient") {
        // Boost low frequencies for majestic space drone
        const bassBoost = idx < 8 ? 1.5 : 0.7;
        energy = Math.pow(energy, 1.8) * bassBoost;
      }

      // Individual band volume cap to avoid clipping
      const targetBandGain = Math.max(0.0001, Math.min(0.22, (energy / numBands) * 3.5 * modeMultiplier));
      band.gain.gain.setTargetAtTime(targetBandGain, now, rampTime);
    });

    return {
      meanL: Math.round(meanL),
      meanR: Math.round(meanR),
      meanG: Math.round(meanG),
      meanB: Math.round(meanB),
      brightPixelRatio: parseFloat(brightPixelRatio.toFixed(2)),
      dominantBand: bandEnergies.indexOf(Math.max(...bandEnergies)),
      dominantFreq: bands[bandEnergies.indexOf(Math.max(...bandEnergies))]?.freq || 440,
    };
  }

  /**
   * Play a single localized chord when the user clicks or hovers on a pixel
   */
  function inspectPixel(r, g, b, normY) {
    if (!ctx) initContext();
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Map Y to base frequency
    const bandIdx = Math.max(0, Math.min(FREQ_BANDS.length - 1, Math.floor((1 - normY) * FREQ_BANDS.length)));
    const baseFreq = FREQ_BANDS[bandIdx];

    // Create a momentary celestial bell tone
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, now);

    // Harmony fifth
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(baseFreq * 1.5, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.25 * (0.3 + lum * 0.7), now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(filterNode || ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.65);
    osc2.stop(now + 0.65);

    return {
      freq: Math.round(baseFreq),
      r, g, b,
      lum: Math.round(lum * 100)
    };
  }

  function silenceAll() {
    if (!ctx) return;
    const now = ctx.currentTime;
    bands.forEach((b) => {
      b.gain.gain.setTargetAtTime(0.0001, now, 0.05);
    });
    if (noiseGain) noiseGain.gain.setTargetAtTime(0.0001, now, 0.05);
  }

  function setMasterVolume(vol) {
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)), ctx.currentTime, 0.05);
    }
  }

  function getVisualizerData(array) {
    if (analyserNode) {
      analyserNode.getByteFrequencyData(array);
    }
  }

  function destroy() {
    silenceAll();
    if (ctx && ctx.state !== "closed") {
      ctx.close().catch(() => {});
    }
    ctx = null;
    bands.length = 0;
  }

  return {
    initContext,
    sonifyColumn,
    inspectPixel,
    silenceAll,
    setMasterVolume,
    getVisualizerData,
    destroy,
    getAudioContext: () => ctx,
  };
}
