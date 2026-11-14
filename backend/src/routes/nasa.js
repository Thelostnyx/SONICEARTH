/**
 * EARTHSONIC NASA routes
 *
 * GET /api/nasa/presets
 * GET /api/nasa/epic
 * GET /api/nasa/eic?q=ocean
 * GET /api/nasa/proxy-image?url=https%3A...
 */

import { Router } from "express";
import { NASA_PRESETS } from "../data/nasaPresets.js";

const router = Router();
const NASA_SVS = "https://svs.gsfc.nasa.gov";
const REQUEST_TIMEOUT_MS = 15000;
const EIC_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_PROXY_BYTES = 30 * 1024 * 1024;

let epicCache = { timestamp: 0, data: [] };
const eicCache = new Map();

const allowedHosts = [
  "nasa.gov",
  "gsfc.nasa.gov",
  "eoimages.gsfc.nasa.gov",
  "images-assets.nasa.gov",
  "epic.gsfc.nasa.gov",
  "earthobservatory.nasa.gov",
  "noaa.gov",
  "usgs.gov",
  "wikimedia.org",
  "upload.wikimedia.org",
];

function isAllowedHost(hostname) {
  return allowedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

function normalizeNasaUrl(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const url = new URL(value, NASA_SVS);
    if (url.protocol === "http:") url.protocol = "https:";
    if (url.protocol !== "https:" || !isAllowedHost(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "EARTHSONIC-SpaceApps/1.0 (NASA SVS educational sonification prototype)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`NASA returned HTTP ${response.status} for ${url}`);
  return response.json();
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function findImage(detail, searchItem) {
  const candidates = [
    detail?.main_image,
    searchItem?.main_image,
    ...(detail?.media_groups || []).flatMap((group) => group?.items || []),
  ];

  for (const candidate of candidates) {
    const media = candidate?.media || candidate?.instance || candidate;
    const url = media?.url || media?.image_url || media?.src;
    if (url && (!media.media_type || /image/i.test(media.media_type))) {
      const normalized = normalizeNasaUrl(url);
      if (normalized) return { ...media, url: normalized };
    }
  }
  return null;
}

// Curated offline-friendly starter imagery.
router.get("/presets", (_req, res) => {
  res.json({ count: NASA_PRESETS.length, presets: NASA_PRESETS });
});

// Latest natural-colour DSCOVR EPIC imagery.
router.get("/epic", async (_req, res) => {
  try {
    const now = Date.now();
    if (epicCache.data.length && now - epicCache.timestamp < EIC_CACHE_TTL_MS) {
      return res.json({ source: "cache", count: epicCache.data.length, images: epicCache.data });
    }

    const response = await fetch("https://epic.gsfc.nasa.gov/api/natural", {
      headers: { "User-Agent": "EARTHSONIC-NASA-Sonifier/2.0", Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`NASA EPIC returned HTTP ${response.status}`);

    const rawList = await response.json();
    const images = rawList.slice(0, 10).map((item) => {
      const [year, month, day] = item.date.split(" ")[0].split("-");
      const base = `https://epic.gsfc.nasa.gov/archive/natural/${year}/${month}/${day}`;
      const position = item.dscovr_j2000_position;
      return {
        id: item.identifier,
        caption: item.caption,
        date: item.date,
        image: item.image,
        thumbUrl: `${base}/thumbs/${item.image}.jpg`,
        fullUrl: `${base}/jpg/${item.image}.jpg`,
        coords: item.centroid_coordinates,
        satellite: "DSCOVR (Deep Space Climate Observatory)",
        camera: "EPIC (Earth Polychromatic Imaging Camera)",
        distanceKm: position
          ? Math.round(Math.hypot(position.x, position.y, position.z))
          : 1500000,
      };
    });

    epicCache = { timestamp: now, data: images };
    return res.json({ source: "live", count: images.length, images });
  } catch (error) {
    console.error("[NASA EPIC API]", error.message);
    if (epicCache.data.length) {
      return res.json({ source: "stale-cache", count: epicCache.data.length, images: epicCache.data, warning: error.message });
    }
    return res.status(502).json({ error: "Could not fetch live NASA EPIC images", message: error.message });
  }
});

// CORS-safe image proxy. Only HTTPS URLs on known science/public-media domains are accepted.
router.get("/proxy-image", async (req, res) => {
  const target = req.query.url;
  if (typeof target !== "string" || !target) {
    return res.status(400).json({ error: "Missing 'url' query parameter" });
  }

  try {
    const parsed = new URL(target);
    if (parsed.protocol !== "https:") {
      return res.status(400).json({ error: "Only HTTPS image URLs are allowed." });
    }
    if (!isAllowedHost(parsed.hostname)) {
      return res.status(403).json({ error: "Image host is not on the EARTHSONIC allowlist." });
    }

    const imageResponse = await fetch(parsed, {
      headers: { "User-Agent": "EARTHSONIC-SpaceApps/1.0", Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "error",
    });
    if (!imageResponse.ok) {
      return res.status(imageResponse.status).json({ error: `Remote image returned HTTP ${imageResponse.status}` });
    }

    const contentType = imageResponse.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      return res.status(415).json({ error: "The remote resource did not return an image." });
    }
    const declaredLength = Number(imageResponse.headers.get("content-length") || 0);
    if (declaredLength > MAX_PROXY_BYTES) {
      return res.status(413).json({ error: "Image exceeds the 30 MB proxy limit." });
    }

    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    if (bytes.length > MAX_PROXY_BYTES) {
      return res.status(413).json({ error: "Image exceeds the 30 MB proxy limit." });
    }

    res.set({
      "Content-Type": contentType,
      "Content-Length": String(bytes.length),
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    });
    return res.send(bytes);
  } catch (error) {
    console.error("[NASA image proxy]", error.message);
    return res.status(502).json({ error: "Failed to retrieve the remote image", message: error.message });
  }
});

// NASA SVS EIC catalogue. Search API supplies result metadata; Page API supplies full image metadata.
router.get("/eic", async (req, res) => {
  const query = String(req.query.q || "").trim().slice(0, 80);
  const cacheKey = query.toLowerCase();
  const cached = eicCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < EIC_CACHE_TTL_MS) {
    return res.json({ source: "NASA SVS cache", count: cached.items.length, items: cached.items });
  }

  try {
    const params = new URLSearchParams({ studio: "SVS", made_for: "EIC", limit: "24" });
    if (query) params.set("search", query);

    const searchPayload = await fetchJson(`${NASA_SVS}/api/search/?${params.toString()}`);
    const searchResults = Array.isArray(searchPayload.results) ? searchPayload.results : [];

    const mapped = await mapWithConcurrency(searchResults, 6, async (item) => {
      try {
        const id = String(item.id ?? item.page_id ?? "").trim();
        if (!id) return null;

        let detail = {};
        try {
          detail = await fetchJson(`${NASA_SVS}/api/${encodeURIComponent(id)}/`);
        } catch (error) {
          console.warn(`[NASA EIC] Detail ${id} unavailable: ${error.message}`);
        }

        const image = findImage(detail, item);
        if (!image?.url) return null;

        const pageUrl = normalizeNasaUrl(detail.url || item.url || `${NASA_SVS}/${id}/`)
          || `${NASA_SVS}/${encodeURIComponent(id)}/`;

        return {
          id: `svs-${id}`,
          svsId: id,
          title: detail.title || item.title || `NASA Earth visualization ${id}`,
          description: String(detail.description || item.description || "")
            .replace(/\s*\|\|\s*/g, " ")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim(),
          releaseDate: detail.release_date || item.release_date || null,
          pageUrl,
          imageUrl: image.url,
          imageAlt: image.alt_text || detail.title || item.title || "NASA Earth science visualization",
          width: image.width || null,
          height: image.height || null,
          source: "NASA Scientific Visualization Studio · Earth Information Center",
          credit: detail.credit || "NASA / NASA GSFC Scientific Visualization Studio",
          mediaType: image.media_type || "Image",
        };
      } catch (error) {
        console.warn(`[NASA EIC] Item failed: ${error.message}`);
        return null;
      }
    });

    const items = mapped.filter(Boolean);
    eicCache.set(cacheKey, { timestamp: now, items });
    console.log(`[NASA EIC] ${items.length}/${searchResults.length} image records ready${query ? ` for “${query}”` : ""}`);

    return res.json({
      source: "NASA Scientific Visualization Studio",
      count: items.length,
      totalResults: searchPayload.count ?? searchResults.length,
      items,
    });
  } catch (error) {
    console.error("[NASA EIC catalogue]", error.message);
    const stale = eicCache.get(cacheKey);
    if (stale?.items?.length) {
      return res.json({ source: "NASA SVS stale cache", count: stale.items.length, items: stale.items, warning: error.message });
    }
    return res.status(502).json({
      error: "Could not load NASA Earth Information Center visualizations",
      message: error.message,
      sourceUrl: "https://svs.gsfc.nasa.gov/search/?studio=SVS&made_for=EIC",
    });
  }
});

export default router;
