import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const STORAGE_BUCKET = "media";

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const SUPABASE_MAX = 45 * 1024 * 1024;
console.log(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME);
const LS_KEY = "adkiosk_cache";

function readCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(items, settings, version) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ items, settings, version }));
  } catch (e) {
    console.warn("localStorage write failed:", e);
  }
}

let supabase = null;
try {
  if (SUPABASE_URL !== "https://TU_PROYECTO.supabase.co") {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) { }

// ── Cloudinary: subir ──────────────────────────────────────
async function uploadToCloudinary(file, onProgress) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  formData.append("resource_type", "video");

  const xhr = new XMLHttpRequest();
  return new Promise((resolve, reject) => {
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText);
      if (data.secure_url) resolve(data.secure_url);
      else reject(new Error(data.error?.message || "Error en Cloudinary"));
    };
    xhr.onerror = () => reject(new Error("Error de red"));
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/video/upload`);
    xhr.send(formData);
  });
}

// ── Cloudinary: extraer public_id de la URL ────────────────
function extractCloudinaryPublicId(url) {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    return match ? match[1] : null;
  } catch { return null; }
}

// ── Cloudinary: borrar via Edge Function de Supabase ───────
async function deleteFromCloudinary(url) {
  const public_id = extractCloudinaryPublicId(url);
  if (!public_id || !supabase) return;

  await supabase.functions.invoke("delete-cloudinary", {
    body: { public_id },
  });
}

const style = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { overflow-x: hidden; max-width: 100%; }
  :root {
    --bg: #0a0a0f; --surface: #13131a; --surface2: #1c1c28;
    --border: #2a2a3d; --accent: #6c63ff; --accent2: #ff6584;
    --text: #e8e8f0; --text-dim: #7070a0; --success: #43d9a0;
    --warning: #ffb347; --danger: #ff5f7e;
  }
  .swr-badge { font-size: 10px; background: var(--surface2); border: 1px solid rgba(255,179,71,0.4); border-radius: 20px; padding: 4px 12px; color: var(--warning); font-family: 'Space Mono', monospace; display: flex; align-items: center; gap: 6px; animation: fadeIn 0.3s ease; }
  .swr-spinner { width: 8px; height: 8px; border: 1.5px solid rgba(255,179,71,0.3); border-top-color: var(--warning); border-radius: 50%; animation: spin 0.8s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); }
  .app { min-height: 100vh; display: flex; flex-direction: column; width: 100%; overflow-x: hidden; }
  .nav { display: flex; align-items: center; justify-content: space-between; padding: 0 28px; height: 60px; background: var(--surface); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; width: 100%; box-sizing: border-box; }
  .nav-logo { font-family: 'Space Mono', monospace; font-size: 15px; color: var(--accent); letter-spacing: 2px; white-space: nowrap; }
  .nav-screens { display: flex; align-items: center; gap: 10px; flex-shrink: 1; min-width: 0; flex-wrap: wrap; justify-content: flex-end; }
  .screen-badge { font-size: 10px; background: var(--surface2); border: 1px solid var(--border); border-radius: 20px; padding: 4px 12px; color: var(--text-dim); font-family: 'Space Mono', monospace; white-space: nowrap; }
  .screen-badge span { color: var(--success); }
  .admin { display: grid; grid-template-columns: 1fr 380px; gap: 24px; padding: 28px; max-width: 1400px; width: 100%; margin: 0 auto; box-sizing: border-box; }
  .panel { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 24px; box-sizing: border-box; width: 100%; }
  .panel-title { font-size: 13px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-dim); margin-bottom: 20px; }
  .upload-zone { border: 2px dashed var(--border); border-radius: 12px; padding: 40px 24px; text-align: center; cursor: pointer; transition: all 0.2s; position: relative; }
  .upload-zone:hover, .upload-zone.drag { border-color: var(--accent); background: rgba(108,99,255,0.05); }
  .upload-zone.uploading-active { border-color: var(--accent); background: rgba(108,99,255,0.05); cursor: default; pointer-events: none; }
  .upload-icon { font-size: 36px; margin-bottom: 12px; }
  .upload-text { font-size: 15px; color: var(--text); margin-bottom: 4px; font-weight: 500; }
  .upload-sub { font-size: 12px; color: var(--text-dim); }
  .upload-bar { height: 6px; background: var(--border); border-radius: 4px; margin-top: 16px; overflow: hidden; }
  .upload-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 4px; transition: width 0.4s ease; }
  .upload-status { margin-top: 12px; display: flex; align-items: center; justify-content: center; gap: 10px; }
  .upload-status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: uploadPulse 1s infinite; flex-shrink: 0; }
  @keyframes uploadPulse { 0%,100% { transform: scale(1); opacity:1; } 50% { transform: scale(1.4); opacity:0.6; } }
  .upload-filename { font-size: 12px; color: var(--text-dim); font-family: 'Space Mono', monospace; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .upload-percent { font-size: 13px; font-family: 'Space Mono', monospace; color: var(--accent); font-weight: 700; flex-shrink: 0; }
  .media-list { display: flex; flex-direction: column; gap: 12px; margin-top: 8px; }
  .media-item { display: flex; align-items: center; gap: 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; cursor: grab; transition: all 0.25s ease; position: relative; box-sizing: border-box; width: 100%; min-width: 0; }
  .media-item:hover { border-color: var(--accent); }
  .media-item.dragging { opacity: 0.4; }
  .media-item.drag-over { border-color: var(--accent2); background: rgba(255,101,132,0.05); }
  .drag-handle { color: var(--text-dim); font-size: 20px; cursor: grab; flex-shrink: 0; padding: 4px 6px; }
  .item-num { font-family: 'Space Mono', monospace; font-size: 11px; color: var(--text-dim); min-width: 18px; flex-shrink: 0; }
  .media-thumb { width: 64px; height: 48px; border-radius: 10px; object-fit: cover; flex-shrink: 0; background: var(--surface2); }
  .media-thumb-video { width: 64px; height: 48px; border-radius: 10px; flex-shrink: 0; background: var(--surface2); display: flex; align-items: center; justify-content: center; font-size: 22px; }
  .media-right { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .media-info { min-width: 0; }
  .media-name { font-size: 14.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .media-type { font-size: 11.5px; color: var(--text-dim); font-family: 'Space Mono', monospace; margin-top: 2px; }
  .media-source { font-size: 10px; color: var(--accent); font-family: 'Space Mono', monospace; margin-top: 1px; }
  .media-duration { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .dur-btn { width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
  .dur-btn:hover { border-color: var(--accent); color: var(--accent); }
  .dur-val { font-family: 'Space Mono', monospace; font-size: 14.5px; min-width: 42px; text-align: center; }
  .del-btn { width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; color: var(--text-dim); cursor: pointer; font-size: 18px; transition: all 0.2s; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .del-btn:hover { background: rgba(255,95,126,0.15); color: var(--danger); }
  .setting-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border); gap: 12px; }
  .setting-row:last-child { border-bottom: none; }
  .setting-label { font-size: 14px; }
  .setting-sub { font-size: 11px; color: var(--text-dim); margin-top: 2px; }
  .toggle { width: 44px; height: 24px; background: var(--border); border-radius: 12px; cursor: pointer; position: relative; transition: background 0.2s; border: none; flex-shrink: 0; }
  .toggle.on { background: var(--accent); }
  .toggle::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: white; transition: left 0.2s; }
  .toggle.on::after { left: 23px; }
  .num-input { width: 70px; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: 'Space Mono', monospace; font-size: 13px; padding: 6px 10px; text-align: center; flex-shrink: 0; }
  .btn-primary { width: 100%; padding: 13px; border-radius: 10px; border: none; background: linear-gradient(135deg, var(--accent), #8b5cf6); color: white; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 16px; box-sizing: border-box; }
  .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(108,99,255,0.3); }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .kiosk-wrap { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; background: #000 !important; z-index: 99999 !important; overflow: hidden !important; display: flex !important; align-items: center !important; justify-content: center !important; }
  .kiosk-wrap img, .kiosk-wrap video { display: block !important; max-width: 100vw !important; max-height: 100vh !important; width: auto !important; height: auto !important; flex-shrink: 1 !important; }
  .toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 20px; font-size: 14px; z-index: 999999; display: flex; align-items: center; gap: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); animation: slideUp 0.3s ease; white-space: nowrap; }
  @keyframes slideUp { from { transform: translateX(-50%) translateY(20px); opacity: 0; } to { transform: translateX(-50%) translateY(0); opacity: 1; } }
  .empty { text-align: center; padding: 40px 20px; color: var(--text-dim); }
  .empty-icon { font-size: 40px; margin-bottom: 12px; }
  .demo-banner { background: rgba(255,179,71,0.1); border: 1px solid rgba(255,179,71,0.3); border-radius: 10px; padding: 10px 16px; margin-bottom: 20px; font-size: 13px; color: var(--warning); display: flex; align-items: center; gap: 8px; }
  .shortcut-item { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
  .shortcut-item:last-child { border-bottom: none; }
  .key { font-family: 'Space Mono', monospace; background: var(--surface2); border: 1px solid var(--border); border-radius: 5px; padding: 2px 8px; font-size: 11px; color: var(--accent); white-space: nowrap; }
  .realtime-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 8px var(--success); display: inline-block; margin-right: 6px; animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

  @media (max-width: 1024px) {
    .admin { grid-template-columns: 1fr; padding: 16px 12px; gap: 16px; }
  }
  @media (max-width: 768px) {
    .nav { padding: 8px 12px; height: auto; min-height: 52px; flex-wrap: wrap; gap: 6px; }
    .nav-logo { font-size: 13px; }
    .nav-screens { gap: 5px; max-width: calc(100vw - 150px); }
    .screen-badge { font-size: 9px; padding: 3px 7px; }
    .swr-badge { font-size: 9px; padding: 3px 7px; }
    .admin { padding: 10px; gap: 12px; }
    .panel { padding: 14px 12px; border-radius: 14px; }
    .panel-title { font-size: 11px; margin-bottom: 12px; }
    .upload-zone { padding: 22px 12px; }
    .upload-icon { font-size: 26px; margin-bottom: 8px; }
    .upload-text { font-size: 13px; }
    .upload-sub { font-size: 10px; }
    .media-list { gap: 8px; }
    .media-item { padding: 10px 36px 10px 8px; gap: 7px; }
    .drag-handle { font-size: 15px; padding: 2px; }
    .item-num { font-size: 10px; min-width: 12px; }
    .media-thumb, .media-thumb-video { width: 50px; height: 50px; border-radius: 9px; font-size: 18px; }
    .media-right { gap: 5px; }
    .media-name { font-size: 12px; }
    .media-type { font-size: 9px; }
    .media-duration { gap: 5px; }
    .dur-btn { width: 28px; height: 28px; font-size: 13px; border-radius: 6px; }
    .dur-val { font-size: 12px; min-width: 28px; }
    .del-btn { position: absolute; top: 50%; right: 8px; transform: translateY(-50%); width: 24px; height: 24px; font-size: 13px; }
    .setting-row { padding: 10px 0; }
    .setting-label { font-size: 13px; }
    .setting-sub { font-size: 10px; }
    .num-input { width: 54px; font-size: 12px; padding: 5px 6px; }
    .shortcut-item { font-size: 11px; padding: 6px 0; gap: 8px; }
    .key { font-size: 10px; padding: 2px 5px; }
    .btn-primary { font-size: 14px; padding: 11px; margin-top: 12px; }
  }
  @media (max-width: 900px) and (orientation: landscape) {
    .admin { grid-template-columns: 1fr 1fr; padding: 8px; gap: 8px; }
    .nav { min-height: 44px; padding: 6px 12px; }
  }
  @media (max-width: 550px) {
    .admin { padding: 12px 8px; gap: 16px; grid-template-columns: 1fr; }
    .panel { padding: 16px 12px; border-radius: 12px; }
    .nav { padding: 0 16px; height: 56px; }
    .nav-logo { font-size: 13px; letter-spacing: 1px; }
    .media-item { flex-wrap: wrap; padding: 12px; padding-right: 44px; gap: 8px; align-items: flex-start; }
    .media-thumb, .media-thumb-video { width: 48px; height: 48px; border-radius: 8px; }
    .media-right { flex: 1; min-width: 140px; }
    .media-name { font-size: 13px; white-space: normal; word-break: break-all; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .media-duration { width: 100%; margin-top: 6px; justify-content: flex-start; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); }
    .dur-btn { width: 30px; height: 30px; font-size: 14px; }
    .dur-val { font-size: 12px; min-width: 36px; }
    .setting-row { gap: 10px; }
    .setting-label { font-size: 13px; }
    .num-input { width: 55px; padding: 6px 4px; font-size: 12px; }
    .btn-primary { padding: 14px; font-size: 14px; }
    .toast { width: calc(100% - 32px); text-align: center; justify-content: center; }
  }
  @media (max-width: 380px) {
    .media-item { padding-right: 10px; }
    .del-btn { position: static; margin-left: auto; transform: none; }
    .media-duration { justify-content: space-between; }
  }
`;

function Toast({ msg, icon = "✓" }) {
  return <div className="toast"><span>{icon}</span>{msg}</div>;
}

function generateId() {
  return Date.now() + Math.random().toString(36).slice(2);
}

const CACHE_NAME = "adkiosk-media-v1";

async function getCachedUrl(remoteUrl) {
  if (!remoteUrl || !remoteUrl.startsWith("http")) return remoteUrl;
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(remoteUrl);
    if (cached) {
      const blob = await cached.blob();
      return URL.createObjectURL(blob);
    }
    const response = await fetch(remoteUrl);
    if (response.ok) {
      await cache.put(remoteUrl, response.clone());
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    console.warn("Cache error, usando URL remota:", e);
  }
  return remoteUrl;
}

async function removeCachedUrl(remoteUrl) {
  if (!remoteUrl) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(remoteUrl);
  } catch (e) { }
}

async function syncCache(newItems, oldItems = []) {
  const newUrls = new Set(newItems.map(i => i.url));
  for (const old of oldItems) {
    if (!newUrls.has(old.url)) await removeCachedUrl(old.url);
  }
  for (const item of newItems) {
    if (item.url?.startsWith("http")) getCachedUrl(item.url).catch(() => { });
  }
}

function KioskView({ items, onExit }) {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [cachedUrls, setCachedUrls] = useState({});
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [speed2x, setSpeed2x] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const videoRef = useRef(null);
  const imgRef = useRef(null);
  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedAtRef = useRef(0);
  const blobUrlsRef = useRef([]);

  const current = items[idx];
  const isVideo = current?.type === "video";

  const resolveUrl = (item) => {
    if (!item) return "";
    return cachedUrls[item.url] || item.url || "";
  };

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      const result = {};
      for (const item of items) {
        if (cancelled) break;
        if (item.url?.startsWith("http")) {
          const local = await getCachedUrl(item.url);
          if (local !== item.url) blobUrlsRef.current.push(local);
          result[item.url] = local;
        }
      }
      if (!cancelled) setCachedUrls(result);
    };
    loadAll();
    return () => { cancelled = true; };
  }, [items]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { } });
    };
  }, []);

  const forceSize = useCallback((el) => {
    if (!el) return;
    el.removeAttribute("width");
    el.removeAttribute("height");
    el.style.cssText = `
      position: absolute !important;
      top: 0 !important; left: 0 !important;
      width: ${window.innerWidth}px !important;
      height: ${window.innerHeight}px !important;
      object-fit: contain !important;
      background: #000 !important;
      margin: 0 !important; padding: 0 !important;
      display: block !important;
      max-width: none !important;
      max-height: none !important;
    `;
  }, []);

  useEffect(() => {
    const el = isVideo ? videoRef.current : imgRef.current;
    if (el) forceSize(el);
  }, [idx, isVideo, forceSize]);

  const onMediaLoad = useCallback((e) => {
    forceSize(e.target);
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      setIsLoading(false);
    }
  }, [forceSize]);

  useEffect(() => {
    const onResize = () => {
      const el = isVideo ? videoRef.current : imgRef.current;
      if (el) forceSize(el);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isVideo, forceSize]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const enterFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => { });
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.();
  }, []);

  const goTo = useCallback((i) => {
    setPaused(false);
    setShowControls(false);
    setSpeed2x(false);
    setIdx(((i % items.length) + items.length) % items.length);
    setProgress(0);
    startTimeRef.current = Date.now();
    pausedAtRef.current = 0;
  }, [items.length]);

  const next = useCallback(() => goTo(idx + 1), [idx, goTo]);
  const prev = useCallback(() => goTo(idx - 1), [idx, goTo]);
  const goFirst = useCallback(() => goTo(0), [goTo]);

  const nextRef = useRef(null);
  useEffect(() => { nextRef.current = next; }, [next]);

  useEffect(() => {
    if (!current || isVideo) return;
    clearTimeout(timerRef.current);
    clearInterval(progressRef.current);
    if (paused) return;

    const totalDur = (current.duration || 5) * 1000;
    const effectiveDur = speed2x ? totalDur * 0.5 : totalDur;
    const elapsed = pausedAtRef.current;
    const remaining = Math.max(effectiveDur - elapsed, 200);

    startTimeRef.current = Date.now() - elapsed;

    progressRef.current = setInterval(() => {
      const e = Date.now() - startTimeRef.current;
      setProgress(Math.min((e / totalDur) * 100, 100));
    }, 100);

    timerRef.current = setTimeout(() => {
      pausedAtRef.current = 0;
      nextRef.current?.();
    }, remaining);

    return () => {
      clearTimeout(timerRef.current);
      clearInterval(progressRef.current);
    };
  }, [idx, isVideo, paused, speed2x]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVideo) return;
    v.playbackRate = speed2x ? 2 : 1;
  }, [speed2x, idx, isVideo]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isVideo) return;
    const onEnd = () => { setSpeed2x(false); nextRef.current?.(); };
    const onTime = () => { if (v.duration) setProgress((v.currentTime / v.duration) * 100); };
    v.addEventListener("ended", onEnd);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("ended", onEnd);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [idx, isVideo]);

  const seekTo = (pct) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    v.currentTime = v.duration * pct;
    setProgress(pct * 100);
  };

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; document.documentElement.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.style.touchAction = "none";
    el.style.overscrollBehavior = "none";
    el.style.userSelect = "none";
    return () => { el.style.touchAction = ""; el.style.overscrollBehavior = ""; el.style.userSelect = ""; };
  }, []);

  useEffect(() => {
    const block = (e) => e.preventDefault();
    window.addEventListener("contextmenu", block);
    return () => window.removeEventListener("contextmenu", block);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      switch (e.key) {
        case "Escape":
          if (showControls) { setShowControls(false); setPaused(false); }
          else onExit();
          break;
        case "f": case "F": isFullscreen ? exitFullscreen() : enterFullscreen(); break;
        case "l": case "L": goFirst(); break;
        case "ArrowRight": next(); break;
        case "ArrowLeft": prev(); break;
        case " ":
          if (isVideo) { videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause(); }
          break;
        default: break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, goFirst, onExit, isFullscreen, showControls, isVideo]);

  useEffect(() => {
    let gestureStartTouches = [];
    let doubleTapTimer = null;
    let tapCount = 0;
    let tapZone = null;
    let longPressTimer = null;
    let speed2xActive = false;
    let gestureStartDist = null;

    const getZone = (touches) => {
      const W = window.innerWidth;
      const avgX = Array.from(touches).reduce((s, t) => s + t.clientX, 0) / touches.length;
      if (avgX < W * 0.30) return "left";
      if (avgX > W * 0.70) return "right";
      return "center";
    };

    const dist2 = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const avgDist4 = (touches) => {
      const pts = Array.from(touches).slice(0, 4);
      let total = 0, count = 0;
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) { total += dist2(pts[i], pts[j]); count++; }
      return total / count;
    };

    const onTouchStart = (e) => {
      e.preventDefault();
      const n = e.touches.length;
      gestureStartTouches = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
      if (n === 4) { clearTimeout(longPressTimer); gestureStartDist = avgDist4(e.touches); return; }
      gestureStartDist = null;
      if (n === 2) {
        const zone = getZone(e.touches);
        longPressTimer = setTimeout(() => { speed2xActive = true; setSpeed2x(true); navigator.vibrate?.(60); }, 600);
        tapCount++;
        tapZone = zone;
        if (doubleTapTimer) clearTimeout(doubleTapTimer);
        doubleTapTimer = setTimeout(() => { tapCount = 0; tapZone = null; }, 400);
        if (tapCount === 2 && tapZone === zone) {
          tapCount = 0;
          clearTimeout(doubleTapTimer);
          clearTimeout(longPressTimer);
          if (zone === "left") { prev(); navigator.vibrate?.(15); }
          else if (zone === "right") { next(); navigator.vibrate?.(15); }
          else {
            if (isVideo) { const v = videoRef.current; if (v) { v.paused ? v.play() : v.pause(); } }
            setPaused(p => !p);
            setShowControls(p => !p);
            navigator.vibrate?.([20, 30, 20]);
          }
        }
        return;
      }
      clearTimeout(longPressTimer);
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 4 && gestureStartDist !== null) {
        const currentDist = avgDist4(e.touches);
        const ratio = currentDist / gestureStartDist;
        if (ratio > 1.25) { enterFullscreen(); gestureStartDist = currentDist; navigator.vibrate?.(30); }
        else if (ratio < 0.75) { exitFullscreen(); gestureStartDist = currentDist; navigator.vibrate?.(30); }
      }
      if (e.touches.length === 2) {
        const cur = Array.from(e.touches);
        const moved = cur.some((t, i) => { const s = gestureStartTouches[i]; return s && Math.hypot(t.clientX - s.x, t.clientY - s.y) > 12; });
        if (moved) clearTimeout(longPressTimer);
      }
    };

    const onTouchEnd = (e) => {
      e.preventDefault();
      if (speed2xActive && e.touches.length < 2) { speed2xActive = false; setSpeed2x(false); navigator.vibrate?.(20); }
      if (e.touches.length < 2) clearTimeout(longPressTimer);
      if (e.touches.length < 4) gestureStartDist = null;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: false });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      clearTimeout(longPressTimer);
      clearTimeout(doubleTapTimer);
    };
  }, [idx, isVideo, isFullscreen]);

  if (!items.length) return (
    <div style={{ position: "fixed", inset: 0, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, zIndex: 99999 }}>
      <div style={{ fontSize: 48 }}>📺</div>
      <div style={{ color: "white", fontSize: 24 }}>No hay contenido configurado</div>
      <button onClick={onExit} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "white", padding: "10px 24px", borderRadius: 8, cursor: "pointer", marginTop: 8 }}>
        Volver al Admin
      </button>
    </div>
  );

  const currentUrl = resolveUrl(current);

  return (
    <div style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", background: "#000", zIndex: 99999, overflow: "hidden", margin: 0, padding: 0 }}>
      {isVideo ? (
        <video
          key={currentUrl}
          ref={(el) => { videoRef.current = el; forceSize(el); }}
          src={currentUrl}
          autoPlay
          playsInline
          preload="auto"
          onLoadedMetadata={onMediaLoad}
          onCanPlay={() => { if (!initialLoadDone.current) { initialLoadDone.current = true; setIsLoading(false); } }}
        />
      ) : (
        <img
          key={currentUrl}
          ref={(el) => { imgRef.current = el; forceSize(el); }}
          src={currentUrl}
          alt={current.title}
          draggable={false}
          onLoad={onMediaLoad}
        />
      )}

      {isLoading && (
        <div style={{ position: "absolute", inset: 0, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, zIndex: 50, pointerEvents: "none" }}>
          <div style={{ width: 56, height: 56, border: "4px solid rgba(108,99,255,0.25)", borderTopColor: "#6c63ff", borderRadius: "50%", animation: "kioskSpin 0.9s linear infinite" }} />
          <div style={{ color: "rgba(255,255,255,0.85)", fontFamily: "'Space Mono', monospace", fontSize: 15, letterSpacing: "0.08em" }}>Cargando presentación…</div>
          <style>{`@keyframes kioskSpin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {speed2x && (
        <div style={{ position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(108,99,255,0.85)", color: "#fff", borderRadius: 10, padding: "8px 20px", fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, zIndex: 10, pointerEvents: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>⚡ ×2</div>
      )}

      {showControls && (
        <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "rgba(10,10,20,0.85)", border: "1px solid rgba(108,99,255,0.4)", borderRadius: 16, padding: "16px 24px", zIndex: 20, display: "flex", flexDirection: "column", gap: 14, width: "min(480px, 90vw)", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          <div
            style={{ height: 8, background: "rgba(255,255,255,0.15)", borderRadius: 4, cursor: "pointer", position: "relative" }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              if (isVideo) seekTo(Math.max(0, Math.min(1, pct)));
              else { const dur = (current.duration || 5) * 1000; pausedAtRef.current = dur * Math.max(0, Math.min(1, pct)); setProgress(pct * 100); }
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              const touch = e.changedTouches[0];
              const pct = (touch.clientX - rect.left) / rect.width;
              if (isVideo) seekTo(Math.max(0, Math.min(1, pct)));
            }}
          >
            <div style={{ height: "100%", width: progress + "%", background: "linear-gradient(90deg,#6c63ff,#ff6584)", borderRadius: 4, transition: "width 0.1s linear" }} />
            <div style={{ position: "absolute", top: "50%", left: progress + "%", transform: "translate(-50%,-50%)", width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 0 8px rgba(108,99,255,0.8)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20 }}>
            <button onClick={(e) => { e.stopPropagation(); if (isVideo && videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10); }} style={ctrlBtn}>⏪ 10s</button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isVideo) { const v = videoRef.current; if (v) { v.paused ? v.play() : v.pause(); } }
                setPaused(p => !p);
              }}
              style={{ ...ctrlBtn, fontSize: 22, width: 52, height: 52, borderRadius: "50%", background: "rgba(108,99,255,0.3)" }}
            >{paused ? "▶" : "⏸"}</button>
            <button onClick={(e) => { e.stopPropagation(); if (isVideo && videoRef.current) videoRef.current.currentTime = Math.min(videoRef.current.duration, videoRef.current.currentTime + 10); }} style={ctrlBtn}>10s ⏩</button>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setShowControls(false); setPaused(false); if (isVideo) videoRef.current?.play(); }} style={{ ...ctrlBtn, fontSize: 11, opacity: 0.6, alignSelf: "center" }}>✕ Cerrar</button>
        </div>
      )}

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.12)", zIndex: 10, pointerEvents: "none" }}>
        <div style={{ height: "100%", background: "#6c63ff", width: progress + "%", transition: "width 0.1s linear" }} />
      </div>
    </div>
  );
}

const ctrlBtn = {
  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
  color: "#fff", borderRadius: 10, padding: "8px 16px", fontSize: 14, cursor: "pointer",
  fontFamily: "'DM Sans', sans-serif", fontWeight: 500, width: 80, height: 44,
  display: "flex", alignItems: "center", justifyContent: "center",
};

function AdminPanel({ items, setItems, settings, setSettings, onLaunch, saving }) {
  const [drag, setDrag] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState("");
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const fileInputRef = useRef(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, icon) => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFiles = async (files) => {
    if (!files.length) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      if (!isImage && !isVideo) continue;

      setUploadingFile(file.name);
      setUploadProgress(0);
      let url = URL.createObjectURL(file);

      // ── Video grande → Cloudinary ──────────────────────────
      if (isVideo && supabase && file.size > SUPABASE_MAX) {
        try {
          showToast("Video grande detectado, subiendo a Cloudinary...", "☁️");
          url = await uploadToCloudinary(file, (pct) => setUploadProgress(pct));
          setUploadProgress(100);
          showToast("Video subido correctamente a Cloudinary", "✅");
        } catch (err) {
          showToast(`Error Cloudinary: ${err.message}`, "❌");
          setUploading(false);
          continue;
        }
        setItems(prev => [...prev, {
          id: generateId(), type: "video", url,
          title: file.name, duration: settings.defaultDuration || 5,
          order: prev.length, storage: "cloudinary",
        }]);
        continue;
      }

      // ── Todo lo demás → Supabase ───────────────────────────
      if (supabase) {
        try {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${generateId()}_${safeName}`;
          let fakeProgress = 0;
          const progressInterval = setInterval(() => {
            fakeProgress = Math.min(fakeProgress + Math.random() * 8, 90);
            setUploadProgress(Math.round(fakeProgress));
          }, 300);
          const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(
            path, file, { upsert: false, contentType: file.type }
          );
          clearInterval(progressInterval);
          if (error) {
            showToast(`Error Supabase: ${error.message}`, "❌");
          } else {
            setUploadProgress(100);
            const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
            url = pub.publicUrl;
          }
        } catch (err) {
          showToast(`Error: ${err.message}`, "❌");
        }
      } else {
        for (let p = 0; p <= 100; p += 20) {
          setUploadProgress(p);
          await new Promise(r => setTimeout(r, 80));
        }
      }

      setItems(prev => [...prev, {
        id: generateId(), type: isImage ? "image" : "video",
        url, title: file.name, duration: settings.defaultDuration || 5,
        order: prev.length, storage: "supabase",
      }]);
    }

    setUploading(false);
    setUploadProgress(0);
    setUploadingFile("");
  };

  const updateDuration = (id, delta) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, duration: Math.max(1, (it.duration || 5) + delta) } : it));
  };

  const removeItem = async (id) => {
    const item = items.find(it => it.id === id);

    // Borrar de Supabase Storage
    if (supabase && item?.url?.includes(SUPABASE_URL)) {
      try {
        const parts = item.url.split(`/storage/v1/object/public/${STORAGE_BUCKET}/`);
        if (parts[1]) await supabase.storage.from(STORAGE_BUCKET).remove([parts[1]]);
      } catch (err) {
        console.error("Error eliminando de Supabase:", err);
      }
    }

    // Borrar de Cloudinary via Edge Function
    if (item?.url?.includes("cloudinary.com")) {
      try {
        await deleteFromCloudinary(item.url);
      } catch (err) {
        console.error("Error eliminando de Cloudinary:", err);
      }
    }

    // Borrar del caché local
    await removeCachedUrl(item?.url);

    setItems(prev => prev.filter(it => it.id !== id));
    showToast("Eliminado", "🗑");
  };

  const onDragStart = (i) => setDraggingIdx(i);
  const onDragOver = (e, i) => { e.preventDefault(); setDragOverIdx(i); };
  const onDrop = (i) => {
    if (draggingIdx === null || draggingIdx === i) return;
    const arr = [...items];
    const [moved] = arr.splice(draggingIdx, 1);
    arr.splice(i, 0, moved);
    setItems(arr.map((it, idx) => ({ ...it, order: idx })));
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="admin">
      <div>
        {!supabase && (
          <div className="demo-banner">⚠️ Modo demo — configura tus credenciales de Supabase para guardar en la nube</div>
        )}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-title">📂 Subir Contenido</div>
          <div
            className={`upload-zone ${drag ? "drag" : ""} ${uploading ? "uploading-active" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles([...e.dataTransfer.files]); }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{ position: "relative" }}
          >
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple style={{ display: "none" }} onChange={(e) => handleFiles([...e.target.files])} />
            {uploading ? (
              <>
                <div className="upload-icon">{uploadingFile.match(/\.(mp4|mov|avi|webm)$/i) ? "🎬" : "🖼️"}</div>
                <div className="upload-text">Subiendo archivo...</div>
                <div className="upload-bar" style={{ marginTop: 12 }}>
                  <div className="upload-bar-fill" style={{ width: uploadProgress + "%" }} />
                </div>
                <div className="upload-status">
                  <div className="upload-status-dot" />
                  <div className="upload-filename">{uploadingFile}</div>
                  <div className="upload-percent">{uploadProgress}%</div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 8 }}>Por favor espera, no cierres esta ventana</div>
              </>
            ) : (
              <>
                <div className="upload-icon">🖼️</div>
                <div className="upload-text">Arrastra imágenes o videos aquí</div>
                <div className="upload-sub">O haz clic para seleccionar • JPG, PNG, GIF, MP4, MOV</div>
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>🗂 Orden del Carrusel</span>
            <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{items.length} elemento(s)</span>
          </div>
          {items.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📭</div>
              <div>No hay contenido aún</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Sube imágenes o videos arriba</div>
            </div>
          ) : (
            <div className="media-list">
              {items.map((item, i) => (
                <div
                  key={item.id}
                  className={`media-item ${draggingIdx === i ? "dragging" : ""} ${dragOverIdx === i ? "drag-over" : ""}`}
                  draggable
                  onDragStart={() => onDragStart(i)}
                  onDragOver={(e) => onDragOver(e, i)}
                  onDrop={() => onDrop(i)}
                  onDragEnd={() => { setDraggingIdx(null); setDragOverIdx(null); }}
                >
                  <span className="drag-handle">⋮⋮</span>
                  <span className="item-num">{i + 1}</span>
                  {item.type === "image" ? (
                    <img className="media-thumb" src={item.url} alt={item.title} />
                  ) : (
                    <div className="media-thumb-video">🎬</div>
                  )}
                  <div className="media-right">
                    <div className="media-info">
                      <div className="media-name">{item.title}</div>
                      <div className="media-type">{item.type === "image" ? "IMAGEN" : "VIDEO"}</div>
                      {/* Indicador de origen */}
                      {item.storage === "cloudinary" && (
                        <div className="media-source">☁️ Cloudinary</div>
                      )}
                    </div>
                    {item.type === "image" && (
                      <div className="media-duration">
                        <button className="dur-btn" onClick={(e) => { e.stopPropagation(); updateDuration(item.id, -1); }}>−</button>
                        <span className="dur-val">{item.duration || 5}s</span>
                        <button className="dur-btn" onClick={(e) => { e.stopPropagation(); updateDuration(item.id, 1); }}>+</button>
                      </div>
                    )}
                  </div>
                  <button className="del-btn" onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="panel">
          <div className="panel-title">⚙️ Configuración</div>
          <div className="setting-row">
            <div><div className="setting-label">Loop infinito</div><div className="setting-sub">Repite el carrusel automáticamente</div></div>
            <button className={`toggle ${settings.loop ? "on" : ""}`} onClick={() => setSettings(s => ({ ...s, loop: !s.loop }))} />
          </div>
          <div className="setting-row">
            <div><div className="setting-label">Transición suave</div><div className="setting-sub">Fade entre elementos</div></div>
            <button className={`toggle ${settings.fade ? "on" : ""}`} onClick={() => setSettings(s => ({ ...s, fade: !s.fade }))} />
          </div>
          <div className="setting-row">
            <div><div className="setting-label">Duración por defecto</div><div className="setting-sub">Para nuevas imágenes (seg.)</div></div>
            <input className="num-input" type="number" min={1} max={60} value={settings.defaultDuration} onChange={(e) => setSettings(s => ({ ...s, defaultDuration: parseInt(e.target.value) || 5 }))} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">⌨️ Atajos de Teclado</div>
          {[["L", "Ir al primer elemento"], ["→ ←", "Siguiente / Anterior"], ["F", "Pantalla completa"], ["ESC", "Salir del kiosk"]].map(([key, desc]) => (
            <div key={key} className="shortcut-item">
              <span className="key">{key}</span>
              <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{desc}</span>
            </div>
          ))}
        </div>

        <button className="btn-primary" onClick={onLaunch} disabled={items.length === 0}>
          {items.length === 0 ? "Agrega contenido primero" : "▶ Lanzar Vista"}
        </button>

        {saving && (
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--success)" }}>
            <span className="realtime-dot" />Guardando...
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} icon={toast.icon} />}
    </div>
  );
}

export default function App() {
  const [view, setView] = useState(() => window.location.hash === "#kiosk" ? "kiosk" : "admin");

  const changeView = (v) => {
    window.location.hash = v === "kiosk" ? "kiosk" : "";
    setView(v);
  };

  useEffect(() => {
    const handleOrientation = async () => {
      if (screen.orientation && screen.orientation.lock) {
        try {
          if (window.location.hash === '#kiosk') await screen.orientation.lock('landscape');
          else await screen.orientation.lock('portrait');
        } catch (error) {
          console.warn("Bloqueo de orientación no compatible:", error);
        }
      }
    };
    handleOrientation();
    window.addEventListener('hashchange', handleOrientation);
    return () => window.removeEventListener('hashchange', handleOrientation);
  }, []);

  const cachedData = readCache();
  const [items, setItems] = useState(cachedData?.items ?? []);
  const [settings, setSettings] = useState(cachedData?.settings ?? {
    loop: true, fade: true, defaultDuration: 5, activeScreens: [0],
  });
  const [loaded, setLoaded] = useState(!!cachedData);
  const [revalidating, setRevalidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const userChangedRef = useRef(false);
  const localVersionRef = useRef(cachedData?.version ?? null);
  const pendingSaveRef = useRef(null);
  const isSavingRef = useRef(false);
  const itemsRef = useRef(items);
  const settingsRef = useRef(settings);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    if (!loaded) return;
    writeCache(items, settings, localVersionRef.current);
  }, [items, settings, loaded]);

  useEffect(() => {
    if (!supabase) { setLoaded(true); setTimeout(() => { userChangedRef.current = true; }, 500); return; }
    const revalidate = async () => {
      setRevalidating(true);
      try {
        const { data, error } = await supabase
          .from("ad_playlists").select("id, updated_at, items, settings").eq("id", "main").single();
        if (error || !data) return;
        const serverVersion = data.updated_at ?? null;
        const myVersion = localVersionRef.current;
        const serverIsNewer = !myVersion || (serverVersion && new Date(serverVersion) > new Date(myVersion));
        if (serverIsNewer) {
          if (data.items) setItems(data.items);
          if (data.settings) setSettings(data.settings);
          localVersionRef.current = serverVersion;
        }
      } catch (e) {
        console.warn("SWR revalidation failed, usando caché:", e);
      } finally {
        setRevalidating(false);
        setLoaded(true);
        setTimeout(() => { userChangedRef.current = true; }, 500);
      }
    };
    revalidate();
  }, []);

  useEffect(() => {
    if (!supabase || !loaded) return;
    if (items.length === 0 && !localVersionRef.current) return;
    if (!userChangedRef.current) return;
    setSaving(true);
    if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current);
    pendingSaveRef.current = setTimeout(async () => {
      isSavingRef.current = true;
      const now = new Date().toISOString();
      const { error } = await supabase.from("ad_playlists").upsert({
        id: "main", items: itemsRef.current, settings: settingsRef.current, updated_at: now,
      });
      if (!error) { localVersionRef.current = now; writeCache(itemsRef.current, settingsRef.current, now); }
      setSaving(false);
      setTimeout(() => { isSavingRef.current = false; }, 3000);
    }, 800);
    return () => { if (pendingSaveRef.current) clearTimeout(pendingSaveRef.current); };
  }, [items, settings, loaded]);

  useEffect(() => {
    if (!supabase) return;
    let channel = null, reconnectTimer = null, isUnmounted = false;
    const subscribe = () => {
      if (channel) { supabase.removeChannel(channel); channel = null; }
      channel = supabase
        .channel(`playlist-changes-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "ad_playlists", filter: "id=eq.main" }, (payload) => {
          if (!payload.new || isSavingRef.current) return;
          const serverVersion = payload.new.updated_at;
          const myVersion = localVersionRef.current;
          if (myVersion && serverVersion <= myVersion) return;
          setItems(prev => { syncCache(payload.new.items || [], prev); return payload.new.items || []; });
          setSettings(payload.new.settings || {});
          localVersionRef.current = serverVersion;
        })
        .subscribe((status) => {
          if (isUnmounted) return;
          if (status === "SUBSCRIBED") { if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; } }
          if (["CLOSED", "CHANNEL_ERROR", "TIMED_OUT"].includes(status)) {
            reconnectTimer = setTimeout(() => { if (!isUnmounted) subscribe(); }, 3000);
          }
        });
    };
    subscribe();
    const handleOnline = () => subscribe();
    const handleVisibility = () => { if (document.visibilityState === "visible") subscribe(); };
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (channel) supabase.removeChannel(channel);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  if (view === "kiosk") {
    return (
      <>
        <style>{style}</style>
        <KioskView items={[...items].sort((a, b) => a.order - b.order)} onExit={() => changeView("admin")} />
      </>
    );
  }

  return (
    <div className="app">
      <style>{style}</style>
      <nav className="nav">
        <div className="nav-logo">San Francisco</div>
        <div className="nav-screens">
          {revalidating && (
            <div className="swr-badge">
              <div className="swr-spinner" />
              Sincronizando…
            </div>
          )}
          {supabase ? (
            <div className="screen-badge"><span>Realtime activo</span></div>
          ) : (
            <div className="screen-badge">Sin Supabase</div>
          )}
          <div className="screen-badge">{items.length} elementos</div>
        </div>
      </nav>
      <AdminPanel
        items={items} setItems={setItems}
        settings={settings} setSettings={setSettings}
        onLaunch={() => changeView("kiosk")} saving={saving}
      />
    </div>
  );
}