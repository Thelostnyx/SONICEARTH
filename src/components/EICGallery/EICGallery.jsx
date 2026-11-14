import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import styles from "./EICGallery.module.css";

const THEMES = [
  { label: "All EIC visualizations", value: "" },
  { label: "Ocean", value: "ocean" },
  { label: "Climate", value: "climate" },
  { label: "Water", value: "water" },
  { label: "Atmosphere", value: "atmosphere" },
  { label: "Land", value: "land" },
];

export default function EICGallery({ onSelect, activeId }) {
  const [items, setItems] = useState([]);
  const [theme, setTheme] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [source, setSource] = useState("NASA SVS");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.eicVisualizations(theme || search.trim())
      .then((data) => {
        if (cancelled) return;
        setItems(data.items || []);
        setSource(data.source || "NASA SVS");
        if (!data.items?.length) setError("No matching EIC visualizations were returned. Try another topic.");
      })
      .catch((err) => {
        if (!cancelled) setError(`${err.message}. The catalog needs an internet connection.`);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [theme]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || theme) return items;
    return items.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(term));
  }, [items, search, theme]);

  function choose(item) {
    onSelect({
      id: item.id,
      title: item.title,
      mission: "NASA Earth Information Center visualization",
      organization: "NASA Goddard Space Flight Center · Scientific Visualization Studio",
      date: item.releaseDate ? new Date(item.releaseDate).toLocaleDateString() : "Publication date not supplied",
      description: item.description || "NASA Earth science visualization from the EIC collection.",
      imageUrl: item.imageUrl,
      fullUrl: item.imageUrl,
      credit: item.credit,
      sourceUrl: item.pageUrl,
      imageAlt: item.imageAlt,
      isEIC: true,
    });
  }

  return (
    <section className={styles.section} aria-labelledby="eic-heading">
      <div className={styles.intro}>
        <div>
          <div className={styles.eyebrow}>CHALLENGE-ALIGNED SOURCE · NASA SVS</div>
          <h2 id="eic-heading">Earth Information Center library</h2>
          <p>Choose a visualization from NASA’s EIC collection. EARTHSONIC scans its visual frame and sonifies the image pattern in real time.</p>
        </div>
        <a href="https://svs.gsfc.nasa.gov/search/?studio=SVS&made_for=EIC" target="_blank" rel="noreferrer">Browse NASA source ↗</a>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.searchWrap}>
          <span aria-hidden="true">⌕</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter loaded visualizations…" aria-label="Filter EIC visualizations" />
        </label>
        <label className={styles.selectWrap}>
          <span className={styles.srOnly}>Topic</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {THEMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <span className={styles.sourceBadge}>{source} · {filtered.length} items</span>
      </div>

      {loading && <div className={styles.state}>Loading NASA EIC visualizations…</div>}
      {error && !loading && <div className={styles.error} role="status">{error} <a href="https://svs.gsfc.nasa.gov/search/?studio=SVS&made_for=EIC" target="_blank" rel="noreferrer">Open NASA’s EIC collection</a></div>}

      {!loading && filtered.length > 0 && (
        <div className={styles.grid}>
          {filtered.map((item) => (
            <button type="button" key={item.id} className={`${styles.card} ${activeId === item.id ? styles.active : ""}`} onClick={() => choose(item)} aria-pressed={activeId === item.id}>
              <div className={styles.imageWrap}>
                <img
                src={api.getProxyUrl(item.imageUrl)}
                alt={item.imageAlt}
                loading="lazy"
                onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
              />
                <span className={styles.cardIndex}>NASA SVS / {item.svsId}</span>
              </div>
              <span className={styles.cardBody}>
                <strong>{item.title}</strong>
                <span>{item.description || "NASA Earth science visualization."}</span>
                <span className={styles.cardLink}>Load visualization + sonify ↗</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <p className={styles.note}>Source collection: NASA Scientific Visualization Studio items marked “made for EIC”. Images are NASA visualization frames, not necessarily raw scientific raster data. The sound mapping describes visible image features and should not be interpreted as a direct measurement of temperature, depth, emissions, or other physical quantities.</p>
    </section>
  );
}
