# EARTHSONIC — Earth Information Jukebox

EARTHSONIC is an independent prototype for the NASA Space Apps Challenge 2026 challenge **“The Earth Information Jukebox.”** It pairs visualizations from NASA’s Earth Information Center (EIC) collection with a real-time, image-derived sonification experience.

> **Important scientific distinction:** the current engine sonifies visual properties of an EIC image frame (pixel brightness, vertical distribution, RGB balance, and horizontal position). It does not decode the underlying scientific raster values, and it must not be described as directly measuring ocean temperature, sea level, carbon emissions, cloud amount, or other physical quantities. Use the linked NASA SVS page for the visualization’s actual scientific context, data source, units, and caveats.

## What it does

- Loads visualizations from NASA Goddard Scientific Visualization Studio’s EIC collection (`studio=SVS&made_for=EIC`).
- Displays a selected NASA visualization frame with source title, description, release date, and link to its NASA source record.
- Samples the frame across 24 vertical bands while a scanline moves horizontally.
- Converts the image pattern into a continuously changing Web Audio sonification:
  - horizontal position → scan time and stereo position;
  - vertical image bands → 24 musical frequency bands;
  - brightness → relative tone energy;
  - RGB balance → synthesis timbre.
- Includes play/pause, restart, seek, speed, loop, and volume controls.
- Provides an image-analysis panel and an explicit explanation of the mapping.
- Supports keyboard activation for the main frame and keyboard-operable native controls.
- Retains the original NASA EPIC feed, curated imagery, and local image upload as secondary exploration options. These are not substitutes for the EIC collection.

## Run locally (Ubuntu / macOS / Windows)

Requirements: Node.js 22.12+ (Node 22 LTS recommended) and npm.

```bash
# 1. Extract the ZIP and enter the project directory
cd earthsonic

# 2. Install frontend dependencies, including platform-specific optional packages
npm install --include=optional

# 3. Install backend dependencies
cd backend
npm install
cd ..

# 4. Start the frontend and API together
npm run dev
```

Open **http://localhost:5173**. Keep the terminal running.

The API runs on **http://localhost:3001**:
- `/api/health`
- `/api/nasa/eic`
- `/api/nasa/presets`
- `/api/nasa/epic`
- `/api/nasa/proxy-image?url=...`

If npm reports a missing Rolldown native binding, stop the server and run:

```bash
rm -rf node_modules
npm install --include=optional
```

Do not use `sudo npm install`.

## Production build

```bash
npm run build
npm run preview
```

The frontend build is produced in `dist/`. The Express API is a separate process and must also be deployed or hosted for NASA SVS catalog/proxy routes to work. The EIC catalogue uses NASA SVS Search API results plus the SVS Page API to resolve representative image URLs. Remote images are normalized to HTTPS and loaded through the allow-listed backend proxy so the browser can safely sample canvas pixels for sonification. Set `VITE_API_URL` at build time to the deployed API origin if it is not served from the same host.

## Project structure

```text
earthsonic/
├── backend/
│   └── src/
│       ├── data/nasaPresets.js
│       ├── routes/nasa.js       # EIC SVS catalog, EPIC feed, image proxy
│       └── server.js
├── public/images/               # Offline fallback Earth imagery
├── src/
│   ├── api/client.js
│   ├── components/
│   │   ├── EICGallery/          # Challenge-aligned NASA EIC catalog
│   │   ├── SatelliteViewer/     # Image frame, scanline and spectrum
│   │   ├── ImageControls/
│   │   ├── TelemetryHUD/
│   │   ├── NASAGallery/         # Secondary non-EIC imagery
│   │   └── Dropzone/
│   ├── sonification/
│   │   └── satelliteImageSonifier.js
│   ├── App.jsx
│   └── styles/global.css
└── package.json
```

## Data source and attribution

- NASA SVS Search API: `https://svs.gsfc.nasa.gov/api/search/`
- EIC collection query: `studio=SVS&made_for=EIC`
- NASA SVS help/API documentation: `https://svs.gsfc.nasa.gov/help/`
- NASA Space Apps challenge brief: `https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/`

NASA SVS documents its publicly available APIs and explains that visualizations may include images, videos, and frame sequences. Check each selected visualization’s page for its individual source datasets, credits, licensing notes, and interpretation. NASA content is not an endorsement of EARTHSONIC.

## Known limitations / honest scope

1. The current prototype sonifies the selected representative image (`main_image`) from an EIC visualization record. It does not yet automatically extract and synchronize every frame from a NASA video sequence.
2. Image-derived sonification is an accessible perceptual layer, not a scientifically calibrated audio encoding of the underlying dataset.
3. The EIC catalog and remote imagery require an internet connection. The original local image fallback is retained for offline UI testing.
4. Browser support for image formats varies. The uploader accepts PNG, JPEG, and WebP; GeoTIFF/EXR scientific rasters are not decoded by the browser uploader.
5. Screen-reader users should receive a meaningful verbal description of each visualization. The NASA source description is shown in the interface, but a future iteration should add a dedicated narration mode and user testing with blind/low-vision participants.

## Suggested demo flow

1. Open EARTHSONIC and wait for the NASA EIC library to load.
2. Select a visualization card from the EIC collection.
3. Read the visualization description and open its NASA source record if you need the dataset details.
4. Press **Play sonification**. Explain that the scanline traverses the displayed image and that image features are mapped to musical parameters.
5. Seek to another position, change speed, pause, and use keyboard controls.
6. Explain the accessibility goal and the difference between visual-image sonification and direct scientific-data sonification.

## Project status

Prototype / hackathon demonstration. EARTHSONIC is not an official NASA product.
