/**
 * EARTHSONIC — NASA Earth Satellite Image & Sonification API
 * Port: 3001
 *
 * Routes:
 *   GET /api/health            → health check
 *   GET /api/nasa/presets      → curated NASA satellite imagery
 *   GET /api/nasa/epic         → live NASA DSCOVR EPIC satellite imagery
 *   GET /api/nasa/eic          → NASA SVS Earth Information Center catalogue
 *   GET /api/nasa/proxy-image  → allow-listed CORS proxy for canvas pixel reading
 */

import express from "express";
import cors from "cors";
import morgan from "morgan";
import nasaRouter from "./routes/nasa.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "earthsonic-nasa-satellite-api",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  });
});

app.use("/api/nasa", nasaRouter);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("[error]", err);
  res.status(500).json({ error: "Internal server error", message: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌍 EARTHSONIC NASA Satellite Sonifier API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health`);
  console.log(`   NASA Presets: http://localhost:${PORT}/api/nasa/presets`);
  console.log(`   NASA EPIC:    http://localhost:${PORT}/api/nasa/epic`);
  console.log(`   NASA EIC:     http://localhost:${PORT}/api/nasa/eic`);
  console.log(`   Image Proxy:  http://localhost:${PORT}/api/nasa/proxy-image?url=...\n`);
});
