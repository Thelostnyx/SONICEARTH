/**
 * EARTHSONIC API client.
 * All remote image URLs are routed through the backend so the canvas remains
 * readable for pixel sampling and sonification.
 */

const BASE = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, "");

async function apiFetch(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || body.error || `API request failed (${response.status})`);
  }

  return response.json();
}

function getProxyUrl(source) {
  if (!source || /^(data:|blob:)/i.test(source) || source.startsWith("/")) return source;

  let normalized;
  try {
    const url = new URL(source);
    if (url.protocol === "http:") url.protocol = "https:";
    if (url.protocol !== "https:") return source;
    normalized = url.toString();
  } catch {
    return source;
  }

  return `${BASE}/api/nasa/proxy-image?url=${encodeURIComponent(normalized)}`;
}

export const api = {
  health: () => apiFetch("/api/health"),
  nasaPresets: () => apiFetch("/api/nasa/presets"),
  nasaEpic: () => apiFetch("/api/nasa/epic"),
  eicVisualizations: (query = "") => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    return apiFetch(`/api/nasa/eic${params.size ? `?${params}` : ""}`);
  },
  getProxyUrl,
};
