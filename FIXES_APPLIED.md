# EARTHSONIC repair notes

This package updates the uploaded EARTHSONIC source project.

## Fixed

- Added the missing `api.eicVisualizations()` frontend API method. The EIC gallery previously called a method that did not exist, which crashed React and produced a blank screen.
- Reworked the NASA SVS EIC route to query the EIC collection and resolve representative image URLs from the NASA SVS Page API. Detail lookups are concurrency-limited and cached.
- Normalized NASA SVS image URLs to HTTPS. The reported `400 Only HTTPS image URLs are allowed` failure was caused by SVS returning an `http://` image URL.
- Kept the image proxy restricted to an allow-list of NASA and public science-media hosts, added request timeouts and a 30 MB image-size limit, and rejected non-image responses.
- Routed EIC thumbnails, selected NASA images, and remote image URLs through the CORS-safe proxy so browser canvas pixel sampling can work.
- Hardened viewer image loading, canvas pixel bounds, and pixel-read error handling.
- Prevented playback controls from becoming active until an image has been decoded for sonification.
- Kept local image uploads as local data URLs, while remote URLs use the backend proxy.
- Changed npm scripts to invoke Vite and concurrently through Node directly, avoiding executable-bit issues with `.bin` launchers on some Linux setups.
- Updated backend route logging and README notes.

## Checks performed in the build environment

- `npm run check:api` passed.
- `node --check src/api/client.js` passed.
- TypeScript's JS/JSX parser successfully parsed all 14 JavaScript and JSX source files.

## Checks not performed here

The build environment could not reach the npm registry, so dependencies could not be installed in this environment. Consequently, a Vite production build and live NASA network/API requests could not be executed here. Install dependencies on a network-connected machine and run the verification commands in the README before presenting the demo.
