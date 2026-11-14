import React, { useState, useEffect } from "react";
import styles from "./NASAGallery.module.css";
import { api } from "../../api/client";

export default function NASAGallery({ onSelectImage, currentImageId, customImages = [] }) {
  const [activeTab, setActiveTab] = useState("presets"); // "presets" | "epic" | "custom"
  const [presets, setPresets] = useState([]);
  const [epicImages, setEpicImages] = useState([]);
  const [loadingEpic, setLoadingEpic] = useState(false);
  const [epicError, setEpicError] = useState(null);

  // Load curated NASA presets
  useEffect(() => {
    api.nasaPresets()
      .then((data) => setPresets(data.presets || []))
      .catch((err) => console.error("Failed to load presets", err));
  }, []);

  // Load live NASA EPIC feed when tab is clicked
  useEffect(() => {
    if (activeTab === "epic" && epicImages.length === 0) {
      setLoadingEpic(true);
      setEpicError(null);
      api.nasaEpic()
        .then((res) => {
          setEpicImages(res.images || []);
        })
        .catch((err) => {
          setEpicError(err.message || "Failed to contact NASA EPIC satellite feed.");
        })
        .finally(() => setLoadingEpic(false));
    }
  }, [activeTab, epicImages.length]);

  return (
    <section className={styles.gallerySection} aria-label="NASA satellite image gallery">
      {/* Category Tabs */}
      <div className={styles.tabNav} role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "presets"}
          className={`${styles.tabBtn} ${activeTab === "presets" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("presets")}
        >
          🛰️ NASA Presets ({presets.length})
        </button>

        <button
          role="tab"
          aria-selected={activeTab === "epic"}
          className={`${styles.tabBtn} ${activeTab === "epic" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("epic")}
        >
          🔴 Live NASA DSCOVR Satellite {epicImages.length > 0 && `(${epicImages.length})`}
        </button>

        {customImages.length > 0 && (
          <button
            role="tab"
            aria-selected={activeTab === "custom"}
            className={`${styles.tabBtn} ${activeTab === "custom" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("custom")}
          >
            📂 My Dropped Images ({customImages.length})
          </button>
        )}
      </div>

      {/* 1. Curated Presets Grid */}
      {activeTab === "presets" && (
        <div className={styles.cardGrid}>
          {presets.map((item) => (
            <div
              key={item.id}
              className={`${styles.card} ${currentImageId === item.id ? styles.selectedCard : ""}`}
              onClick={() => onSelectImage(item)}
              role="button"
              tabIndex={0}
            >
              <div className={styles.thumbWrapper}>
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className={styles.thumbnail}
                  loading="lazy"
                />
                <span className={styles.missionTag}>{item.mission.split("/")[0]}</span>
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardDesc}>{item.description}</p>
                <div className={styles.tagRow}>
                  {item.tags?.map((t) => (
                    <span key={t} className={styles.pillTag}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Live NASA DSCOVR EPIC Satellite Grid */}
      {activeTab === "epic" && (
        <div>
          <div className={styles.liveBanner}>
            <span className={styles.livePulse} />
            <span>
              Real-time images of Planet Earth taken from 1 million miles away at Lagrange Point 1 by NASA's DSCOVR EPIC camera.
            </span>
          </div>

          {loadingEpic && (
            <div className={styles.loadingFeed}>
              <div className={styles.spinner} />
              <span>Fetching live daily photography from NASA Goddard Space Flight Center…</span>
            </div>
          )}

          {epicError && (
            <div className={styles.errorNotice}>
              <p>⚠ {epicError}</p>
            </div>
          )}

          <div className={styles.cardGrid}>
            {epicImages.map((epic) => (
              <div
                key={epic.id}
                className={`${styles.card} ${currentImageId === epic.id ? styles.selectedCard : ""}`}
                onClick={() =>
                  onSelectImage({
                    id: epic.id,
                    title: `Earth from Space (${epic.date.split(" ")[0]})`,
                    mission: epic.satellite,
                    organization: "NASA GSFC / NOAA",
                    date: epic.date,
                    description: `Live photograph taken by NASA's Earth Polychromatic Imaging Camera (EPIC) onboard NOAA's DSCOVR satellite located 1.5 million kilometers from Earth.`,
                    imageUrl: epic.fullUrl,
                    fullUrl: epic.fullUrl,
                    credit: "NASA DSCOVR / EPIC Team",
                  })
                }
                role="button"
                tabIndex={0}
              >
                <div className={styles.thumbWrapper}>
                  <img
                    src={epic.thumbUrl}
                    alt={epic.caption}
                    className={styles.thumbnail}
                    loading="lazy"
                  />
                  <span className={styles.livePill}>LIVE SATELLITE</span>
                </div>
                <div className={styles.cardBody}>
                  <h3 className={styles.cardTitle}>{epic.date}</h3>
                  <p className={styles.cardDesc}>{epic.caption}</p>
                  <span className={styles.distanceBadge}>
                    📍 Distance: {epic.distanceKm?.toLocaleString()} km
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Custom Uploads Grid */}
      {activeTab === "custom" && (
        <div className={styles.cardGrid}>
          {customImages.map((item) => (
            <div
              key={item.id}
              className={`${styles.card} ${currentImageId === item.id ? styles.selectedCard : ""}`}
              onClick={() => onSelectImage(item)}
              role="button"
              tabIndex={0}
            >
              <div className={styles.thumbWrapper}>
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className={styles.thumbnail}
                />
                <span className={styles.userTag}>USER DROP</span>
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <p className={styles.cardDesc}>{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
