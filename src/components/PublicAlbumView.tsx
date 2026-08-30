"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import JSZip from "jszip";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Calendar,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  X,
  AlertCircle,
  Coffee,
  ArrowRight,
  Share2,
  Heart,
  CheckSquare,
  Square,
  Package,
} from "lucide-react";
import SupportModal, { FundType } from "@/components/SupportModal";
import ShareModal from "@/components/ShareModal";
import ViewerPresenceBadge from "@/components/ViewerPresenceBadge";

interface Photo {
  id: string;
  original_filename: string;
  width: number;
  height: number;
  aspect_ratio: number;
  urls: {
    thumb: string;
    display: string;
    original: string;
  };
}

interface AlbumData {
  album_id: string;
  title: string;
  date: string;
  category?: string;
  photos: Photo[];
}

export default function PublicAlbumView() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = params?.id;
  const albumId = Array.isArray(rawId) ? rawId[0] : (rawId as string) || "";

  const viewerName = searchParams?.get("v");

  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Favorites & Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState({ current: 0, total: 0, percent: 0 });

  // Fullscreen, Touch & Swipe Gesture State
  const [isImmersive, setIsImmersive] = useState(false);
  const [navCue, setNavCue] = useState<"both" | "left" | "right" | "none">("none");
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState<boolean>(false);

  const [zoomScale, setZoomScale] = useState(1);
  const initialPinchDistance = useRef<number | null>(null);
  const lastTapTime = useRef<number>(0);

  // Reset zoom when navigating between photos or exiting
  useEffect(() => {
    setZoomScale(1);
  }, [selectedIndex]);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const cueTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const exitPromptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Distance helper for pinch calculations
  const getTouchDistance = (e: React.TouchEvent) => {
    if (e.touches.length < 2) return null;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // 1. Two-finger pinch start
    if (e.touches.length === 2) {
      initialPinchDistance.current = getTouchDistance(e);
      setIsSwiping(false);
      setDragOffset(0);
      return;
    }

    // 2. Double-tap to zoom toggle (1x <-> 2x)
    const now = Date.now();
    if (now - lastTapTime.current < 300 && e.touches.length === 1) {
      setZoomScale((prev) => (prev > 1 ? 1 : 2));
      lastTapTime.current = 0;
      return;
    }
    lastTapTime.current = now;

    // 3. Single-finger swipe start (only when unzoomed)
    if (zoomScale === 1) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      setIsSwiping(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Handle 2-finger active pinch zoom
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      const currentDist = getTouchDistance(e);
      if (currentDist) {
        const factor = currentDist / initialPinchDistance.current;
        setZoomScale(Math.min(Math.max(factor, 1), 3.5));
      }
      return;
    }

    // Handle 1-finger horizontal photo swipe (only when unzoomed)
    if (!isSwiping || zoomScale > 1 || touchStartX.current === null || touchStartY.current === null) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDragOffset(deltaX * 0.75);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    initialPinchDistance.current = null;
    setIsSwiping(false);
    setDragOffset(0);

    // Snap back to 1x if pinch ended smaller than 1.05x
    if (zoomScale < 1.05) {
      setZoomScale(1);
    }

    if (zoomScale > 1) return; // Don't navigate while zoomed
    if (touchStartX.current === null || touchStartY.current === null) return;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = endX - touchStartX.current;
    const deltaY = endY - touchStartY.current;

    touchStartX.current = null;
    touchStartY.current = null;

    // Horizontal Swipe (Next / Prev)
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (deltaX < 0) {
        showNext();
        if (isImmersive) triggerCue("right", 500);
      } else {
        showPrev();
        if (isImmersive) triggerCue("left", 500);
      }
      return;
    }

    // Swipe Down (Exit)
    if (deltaY > 55 && Math.abs(deltaY) > Math.abs(deltaX) * 1.4) {
      if (isImmersive) {
        setShowExitPrompt(true);
        if (exitPromptTimeoutRef.current) clearTimeout(exitPromptTimeoutRef.current);
        exitPromptTimeoutRef.current = setTimeout(() => setShowExitPrompt(false), 4000);
      } else {
        exitLightbox();
      }
    }
  };

  // Modals & Toast State
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportFund, setSupportFund] = useState<FundType>("gear");
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [showDownloadToast, setShowDownloadToast] = useState(false);

  useEffect(() => {
    if (!albumId) return;

    async function loadAlbum() {
      setLoading(true);
      setErrorMessage(null);

      const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");

      if (!baseUrl) {
        setErrorMessage("NEXT_PUBLIC_R2_BASE_URL environment variable is missing or empty.");
        setLoading(false);
        return;
      }

      const decodedId = decodeURIComponent(albumId);
      const manifestUrl = `${baseUrl}/${decodedId}/manifest.json`;

      try {
        const res = await fetch(manifestUrl, { cache: "no-store" });
        if (!res.ok) {
          setFailedUrl(manifestUrl);
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data = await res.json();
        setAlbum(data);
      } catch (err: any) {
        console.error("Failed to load album:", err);
        setFailedUrl(manifestUrl);
        setErrorMessage(err.message || "Failed to load album data.");
      } finally {
        setLoading(false);
      }
    }

    loadAlbum();
  }, [albumId]);

  // Sync native browser fullscreen changes
  useEffect(() => {
    function onFullscreenChange() {
      if (!document.fullscreenElement) {
        setIsImmersive(false);
        setShowExitPrompt(false);
        setNavCue("none");
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!showDownloadToast) return;
    const timer = setTimeout(() => {
      setShowDownloadToast(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [showDownloadToast]);

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!album) return;
    if (selectedIds.size === album.photos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(album.photos.map((p) => p.id)));
    }
  };

  // Batch ZIP Export Generator (Concurrent chunks with progress tracking)
  const handleDownloadBatch = async (photosToDownload?: Photo[]) => {
    if (!album) return;
    const targetPhotos = photosToDownload || album.photos.filter((p) => selectedIds.has(p.id));
    if (targetPhotos.length === 0) return;

    setIsZipping(true);
    setZipProgress({ current: 0, total: targetPhotos.length, percent: 0 });

    try {
      const zip = new JSZip();
      const folderName = `${album.title.replace(/[^a-z0-9_-]/gi, "_")}_HighRes`;
      const folder = zip.folder(folderName) || zip;

      const CONCURRENCY = 3;
      let completed = 0;

      for (let i = 0; i < targetPhotos.length; i += CONCURRENCY) {
        const chunk = targetPhotos.slice(i, i + CONCURRENCY);
        await Promise.all(
          chunk.map(async (photo, chunkIndex) => {
            const indexNumber = i + chunkIndex + 1;
            const ext = photo.original_filename.includes(".")
              ? photo.original_filename.substring(photo.original_filename.lastIndexOf("."))
              : ".jpg";
            const fileName = `${String(indexNumber).padStart(3, "0")}_${photo.original_filename || `photo_${photo.id}${ext}`}`;

            try {
              const res = await fetch(photo.urls.original);
              if (!res.ok) throw new Error("Failed to fetch original");
              const blob = await res.blob();
              folder.file(fileName, blob);
            } catch {
              // Fallback to display version if original fetch is blocked
              const fallbackRes = await fetch(photo.urls.display);
              const fallbackBlob = await fallbackRes.blob();
              folder.file(fileName.replace(/\.[^.]+$/, ".webp"), fallbackBlob);
            }

            completed++;
            const percent = Math.round((completed / targetPhotos.length) * 100);
            setZipProgress({ current: completed, total: targetPhotos.length, percent });
          })
        );
      }

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "STORE", // Already compressed JPEGs/WebP; store saves browser CPU time
      });

      const blobUrl = window.URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${folderName}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      setShowDownloadToast(true);
    } catch (err: any) {
      alert(`Download failed: ${err.message || "Network error"}`);
    } finally {
      setIsZipping(false);
      setZipProgress({ current: 0, total: 0, percent: 0 });
    }
  };

  const triggerCue = (type: "both" | "left" | "right", duration: number) => {
    if (cueTimeoutRef.current) clearTimeout(cueTimeoutRef.current);
    setNavCue(type);
    cueTimeoutRef.current = setTimeout(() => {
      setNavCue("none");
    }, duration);
  };

  const enterFullscreen = async () => {
    setIsImmersive(true);
    setShowExitPrompt(false);
    triggerCue("both", 1000);

    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {}
  };

  const exitFullscreen = async () => {
    setIsImmersive(false);
    setShowExitPrompt(false);
    setNavCue("none");

    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {}
  };

  const exitLightbox = async () => {
    await exitFullscreen();
    setSelectedIndex(null);
  };

  const handleDownload = async (e: React.MouseEvent, url: string, filename: string) => {
    e.stopPropagation();
    setShowDownloadToast(true);

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename || "photo.jpg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.download = filename || "photo.jpg";
      link.click();
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: album?.title || "Beck Photo Gallery",
          text: `Check out high-resolution game shots from "${album?.title}":`,
          url: window.location.href,
        });
        return;
      } catch {}
    }
    setIsShareOpen(true);
  };

  const openSupport = (fund: FundType = "gear") => {
    setSupportFund(fund);
    setIsSupportOpen(true);
  };

  const photos = album?.photos || [];
  const selectedPhoto = selectedIndex !== null ? photos[selectedIndex] : null;

  // Background Image Preloader
  useEffect(() => {
    if (selectedIndex === null || photos.length === 0) return;
    const indicesToPreload = [
      (selectedIndex + 1) % photos.length,
      (selectedIndex + 2) % photos.length,
      (selectedIndex - 1 + photos.length) % photos.length,
    ];
    indicesToPreload.forEach((idx) => {
      if (photos[idx]?.urls?.display) {
        const img = new Image();
        img.src = photos[idx].urls.display;
      }
    });
  }, [selectedIndex, photos]);

  const showNext = useCallback(() => {
    if (selectedIndex === null || photos.length === 0) return;
    setSelectedIndex((prev) => (prev !== null && prev < photos.length - 1 ? prev + 1 : 0));
  }, [selectedIndex, photos.length]);

  const showPrev = useCallback(() => {
    if (selectedIndex === null || photos.length === 0) return;
    setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : photos.length - 1));
  }, [selectedIndex, photos.length]);

  const handleFullscreenPrev = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    showPrev();
    triggerCue("left", 500);
  };

  const handleFullscreenNext = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    showNext();
    triggerCue("right", 500);
  };

  useEffect(() => {
    if (selectedIndex === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        showNext();
        if (isImmersive) triggerCue("right", 500);
      }
      if (e.key === "ArrowLeft") {
        showPrev();
        if (isImmersive) triggerCue("left", 500);
      }
      if (e.key === "Escape") {
        if (isImmersive) {
          exitFullscreen();
        } else {
          setSelectedIndex(null);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, showNext, showPrev, isImmersive]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm text-neutral-400 font-mono">Loading gallery archive...</p>
      </div>
    );
  }

  if (errorMessage || !album) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center space-y-4 text-white max-w-lg mx-auto">
        <AlertCircle size={40} className="text-red-400 mx-auto" />
        <h2 className="text-lg font-bold">Unable to Load Album</h2>
        <p className="text-neutral-400 text-xs font-mono bg-neutral-900 border border-neutral-800 p-3 rounded-lg text-left break-all">
          <strong>Error:</strong> {errorMessage || "Album not found"}<br />
          {failedUrl && <><strong>Target:</strong> {failedUrl}</>}
        </p>
        <Link href="/" className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold">
          Return to Galleries
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-28 relative select-none">
      <header className="border-b border-neutral-800/80 sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft size={14} /> Back to Galleries
          </Link>

          <div className="flex items-center gap-2.5">
            {/* Download Full Album Button */}
            <button
              onClick={() => handleDownloadBatch(album.photos)}
              disabled={isZipping}
              className="hidden sm:flex items-center gap-1.5 text-xs font-mono text-neutral-300 hover:text-white transition py-1.5 px-3 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 cursor-pointer shadow-sm"
              title="Download entire album as ZIP"
            >
              <Package size={12} className="text-emerald-400" />
              <span>DOWNLOAD ALBUM (.ZIP)</span>
            </button>

            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-xs font-mono text-neutral-300 hover:text-white transition py-1.5 px-3 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 cursor-pointer shadow-sm"
              title="Share this album"
            >
              <Share2 size={12} className="text-blue-400" />
              <span>SHARE</span>
            </button>

            <button
              onClick={() => openSupport("gear")}
              className="flex items-center gap-1.5 text-xs font-mono text-neutral-300 hover:text-white transition py-1.5 px-3 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 cursor-pointer shadow-sm"
              title="Sideline Support & Gear Funds"
            >
              <Coffee size={12} className="text-amber-400" />
              <span className="hidden sm:inline">SUPPORT</span>
            </button>

            <span className="text-xs font-mono text-neutral-500 flex items-center gap-1 pl-1">
              <Layers size={12} /> {photos.length} photos
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-10 space-y-8">
        <div className="space-y-3">
          {viewerName && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-blue-950/60 border border-blue-800/80 text-blue-300">
              <span>👋 Welcome, {viewerName}!</span>
            </div>
          )}

          {album.category && (
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 font-mono block">
              {album.category}
            </span>
          )}
          <h1 className="text-3xl md:text-4xl font-extrabold text-white">{album.title}</h1>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-b border-neutral-800/60 pb-4">
            <div className="flex items-center gap-4">
              {album.date && (
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                  <Calendar size={13} />
                  <span>{album.date}</span>
                </div>
              )}
              {/* Quick Select All Toggle in Subheader */}
              <button
                onClick={handleSelectAll}
                className="text-xs font-mono text-neutral-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                {selectedIds.size === photos.length ? (
                  <CheckSquare size={13} className="text-pink-400" />
                ) : (
                  <Square size={13} />
                )}
                <span>
                  {selectedIds.size === photos.length ? "Deselect All" : "Select All for Download"}
                </span>
              </button>
            </div>

            <ViewerPresenceBadge albumId={albumId} />
          </div>
        </div>

        {/* Dynamic Aspect Ratio Masonry Grid with Favorite Hearts */}
        <div className="columns-2 sm:columns-3 md:columns-4 gap-4">
          {photos.map((photo, idx) => {
            const isFav = selectedIds.has(photo.id);
            return (
              <div
                key={photo.id}
                className="break-inside-avoid mb-4 group relative rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800/90 hover:border-neutral-700 transition cursor-pointer"
                onClick={() => setSelectedIndex(idx)}
              >
                <img
                  src={photo.urls.thumb}
                  alt={photo.original_filename}
                  className="w-full h-auto block object-cover group-hover:scale-[1.02] transition duration-300"
                  loading="lazy"
                  style={photo.aspect_ratio ? { aspectRatio: `${photo.aspect_ratio}` } : undefined}
                />

                {/* Persistent / Hover Heart Icon */}
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(e, photo.id)}
                  className={`absolute top-2 left-2 p-2 rounded-full backdrop-blur-md transition-all duration-200 z-10 cursor-pointer ${
                    isFav
                      ? "bg-pink-600 text-white shadow-lg shadow-pink-950/50 opacity-100 scale-100"
                      : "bg-black/60 text-white/70 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                  }`}
                  title={isFav ? "Remove from selected" : "Add to favorites / batch download"}
                >
                  <Heart size={14} fill={isFav ? "currentColor" : "none"} />
                </button>

                {/* Desktop Hover Overlay */}
                <div className="hidden sm:flex absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 items-center justify-center gap-2 pointer-events-none">
                  <span className="p-2 rounded-full bg-black/60 text-white backdrop-blur-md">
                    <Maximize2 size={16} />
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDownload(e, photo.urls.original, photo.original_filename)}
                    className="p-2 rounded-full bg-black/60 text-white hover:text-blue-400 backdrop-blur-md transition cursor-pointer pointer-events-auto"
                    title="Download High-Res Original"
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* ----------------- FLOATING BATCH ACTIONS TRAY ----------------- */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[92vw] z-40 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-neutral-900/95 border border-neutral-700/80 shadow-2xl backdrop-blur-xl text-white">
            <div className="flex items-center gap-2 pr-2 border-r border-neutral-700">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-pink-600 text-xs font-bold font-mono">
                {selectedIds.size}
              </span>
              <span className="text-xs font-medium hidden sm:inline">Selected</span>
            </div>

            <button
              onClick={() => handleDownloadBatch()}
              disabled={isZipping}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-blue-950/40 transition cursor-pointer"
            >
              <Download size={14} />
              <span>Download Selected (.ZIP)</span>
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ----------------- LIGHTBOX MODAL (STANDARD & FULLSCREEN) ----------------- */}
      {selectedPhoto !== null && selectedIndex !== null && (
        <div
          className={`fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden touch-none ${
            isImmersive ? "w-screen h-[100dvh]" : "bg-black/95 backdrop-blur-md"
          }`}
          onClick={exitLightbox}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {!isImmersive && (
            <>
              {/* Lightbox Controls */}
              <div className="absolute top-4 right-4 flex items-center gap-2.5 z-50">
                <span className="text-xs font-mono font-medium text-neutral-400 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10">
                  {selectedIndex + 1} / {photos.length}
                </span>

                {/* Favorite Toggle in Lightbox */}
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(e, selectedPhoto.id)}
                  className={`p-1.5 rounded-lg backdrop-blur-md transition cursor-pointer ${
                    selectedIds.has(selectedPhoto.id)
                      ? "bg-pink-600 text-white"
                      : "bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white"
                  }`}
                  title="Favorite / Add to selection"
                >
                  <Heart size={16} fill={selectedIds.has(selectedPhoto.id) ? "currentColor" : "none"} />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    enterFullscreen();
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-950/40 transition cursor-pointer"
                  title="Full Screen View"
                >
                  <Maximize2 size={13} />
                  <span>Full Screen</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => handleDownload(e, selectedPhoto.urls.original, selectedPhoto.original_filename)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition cursor-pointer"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Download</span>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exitLightbox();
                  }}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white backdrop-blur-md transition cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Desktop Prev/Next Buttons */}
              {photos.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showPrev();
                    }}
                    className="hidden sm:block absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition z-50 cursor-pointer"
                    title="Previous Photo (Left Arrow)"
                  >
                    <ChevronLeft size={28} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showNext();
                    }}
                    className="hidden sm:block absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition z-50 cursor-pointer"
                    title="Next Photo (Right Arrow)"
                  >
                    <ChevronRight size={28} />
                  </button>
                </>
              )}

              {/* Standard Photo Display with Swipe Tracking */}
              <div
                className="max-h-[85vh] max-w-[85vw] flex items-center justify-center transition-transform ease-out duration-100"
                style={{
                  transform: `translateX(${dragOffset}px) scale(${zoomScale})`,
                  touchAction: "none",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={selectedPhoto.urls.display}
                  alt={selectedPhoto.original_filename}
                  className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg shadow-2xl pointer-events-none"
                />
              </div>
            </>
          )}

          {/* Fullscreen Mode */}
          {isImmersive && (
            <div
              className="relative w-full h-full flex items-center justify-center transition-transform ease-out duration-150"
              style={{
                transform: `translateX(${dragOffset}px)`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedPhoto.urls.display}
                alt={selectedPhoto.original_filename}
                className="w-full h-full object-contain pointer-events-none select-none"
              />

              <div
                className={`pointer-events-none absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 transition-opacity duration-300 z-30 ${
                  navCue === "both" || navCue === "left" ? "opacity-35" : "opacity-0"
                }`}
              >
                <ChevronLeft className="w-12 h-12 sm:w-16 sm:h-16 text-white stroke-[2.5]" />
              </div>

              <div
                className={`pointer-events-none absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 transition-opacity duration-300 z-30 ${
                  navCue === "both" || navCue === "right" ? "opacity-35" : "opacity-0"
                }`}
              >
                <ChevronRight className="w-12 h-12 sm:w-16 sm:h-16 text-white stroke-[2.5]" />
              </div>

              {showExitPrompt && (
                <div className="absolute top-6 inset-x-0 mx-auto w-fit z-40 animate-in fade-in slide-in-from-top-3 duration-200">
                  <button
                    onClick={exitFullscreen}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-white border border-neutral-700 shadow-2xl backdrop-blur-xl text-xs font-semibold cursor-pointer"
                  >
                    <Minimize2 size={13} className="text-blue-400" />
                    <span>Exit Full Screen</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ----------------- ZIP GENERATION PROGRESS MODAL ----------------- */}
      {isZipping && (
        <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
          <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-2xl max-w-sm w-full space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-blue-950/80 border border-blue-800/80 text-blue-400 flex items-center justify-center mx-auto">
              <Package size={24} className="animate-bounce" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Packaging High-Res ZIP
              </h3>
              <p className="text-xs text-neutral-400 font-mono">
                Photo {zipProgress.current} of {zipProgress.total} ({zipProgress.percent}%)
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden border border-neutral-800">
              <div
                className="bg-blue-600 h-full transition-all duration-200 rounded-full"
                style={{ width: `${zipProgress.percent}%` }}
              />
            </div>
            <p className="text-[11px] text-neutral-500">
              Packing full-resolution originals in memory...
            </p>
          </div>
        </div>
      )}

      {/* Post-Download Toast */}
      {showDownloadToast && (
        <div className="fixed bottom-6 right-6 z-[70] max-w-sm w-[calc(100vw-3rem)] p-4 rounded-xl bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 text-white shadow-2xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-200">
                Full-Res Download Complete
              </span>
            </div>
            <button
              onClick={() => setShowDownloadToast(false)}
              className="text-neutral-400 hover:text-white transition p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed font-sans">
            Downloaded high-res! Love the shots? Consider supporting the gear &amp; storage fund.
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setShowDownloadToast(false);
                openSupport("gear");
              }}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-md shadow-blue-950/40 cursor-pointer"
            >
              <span>View Gear Fund</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        albumTitle={album.title}
        albumId={albumId}
      />

      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        defaultFund={supportFund}
      />
    </div>
  );
}
