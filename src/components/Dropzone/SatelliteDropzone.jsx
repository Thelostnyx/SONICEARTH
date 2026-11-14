import React, { useState, useRef } from "react";
import styles from "./SatelliteDropzone.module.css";
import { api } from "../../api/client";

export default function SatelliteDropzone({ onImageLoaded, currentImageName }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef(null);

  function handleFile(file) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMsg("Please choose a browser-supported image (JPG, PNG, or WebP).");
      return;
    }
    setErrorMsg("");

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        onImageLoaded({
          id: `custom-${Date.now()}`,
          title: file.name.replace(/\.[^/.]+$/, ""),
          mission: "User Satellite Image / NASA Upload",
          organization: "Custom Satellite Observation",
          date: new Date(file.lastModified).toISOString().split("T")[0],
          description: `User-imported satellite image (${img.naturalWidth} × ${img.naturalHeight} px, ${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
          imageUrl: e.target.result,
          fullUrl: e.target.result,
          credit: "Uploaded Satellite Image",
          width: img.naturalWidth,
          height: img.naturalHeight,
          isUserDrop: true,
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleUrlSubmit(e) {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setErrorMsg("");

    let remoteUrl;
    try {
      remoteUrl = new URL(urlInput.trim());
      if (!["http:", "https:"].includes(remoteUrl.protocol)) throw new Error("Unsupported protocol");
      remoteUrl.protocol = "https:";
    } catch {
      setErrorMsg("Enter a valid HTTPS direct image URL from a supported NASA or Earth-science source.");
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      onImageLoaded({
        id: `url-${Date.now()}`,
        title: "NASA Remote Satellite Image",
        mission: "Direct NASA URL Stream",
        organization: "NASA Observation",
        date: new Date().toISOString().split("T")[0],
        description: `Direct NASA satellite image stream from URL.`,
        imageUrl: remoteUrl.toString(),
        fullUrl: remoteUrl.toString(),
        credit: "NASA Satellite URL Stream",
        width: img.naturalWidth,
        height: img.naturalHeight,
        isUserDrop: false,
      });
      setUrlInput("");
    };
    img.onerror = () => {
      setErrorMsg("Could not load image from this URL. Make sure it's a direct link to an image file.");
    };
    img.src = api.getProxyUrl(remoteUrl.toString());
  }

  return (
    <div className={styles.wrapper}>
      {/* Drop Zone Box */}
      <div
        className={`${styles.dropzone} ${isDragOver ? styles.dragOver : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
        role="button"
        tabIndex={0}
        aria-label="Drag and drop NASA satellite image"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.hiddenInput}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <div className={styles.iconCircle}>
          <span className={styles.icon} aria-hidden="true">🛰️</span>
        </div>

        <div className={styles.dropText}>
          <p className={styles.primaryText}>
            <strong>Drop an Earth image here</strong> or <span className={styles.browseLink}>Browse files</span>
          </p>
          <p className={styles.subText}>
            Add a supported image (PNG, JPG, WebP). For this challenge, start with an official NASA EIC visualization below.
          </p>
        </div>

        {currentImageName && (
          <div className={styles.currentBadge}>
            <span className={styles.badgeDot} />
            <span>Active: <strong>{currentImageName}</strong></span>
          </div>
        )}
      </div>

      {/* Or Paste NASA Image URL */}
      <form onSubmit={handleUrlSubmit} className={styles.urlForm}>
        <input
          type="url"
          placeholder="Or paste direct NASA image URL (e.g. https://.../image.jpg)"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          className={styles.urlInput}
        />
        <button type="submit" className={styles.urlBtn}>
          Load URL
        </button>
      </form>

      {errorMsg && <p className={styles.error} role="alert">{errorMsg}</p>}
    </div>
  );
}
