"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import SupportModal, { FundType } from "@/components/SupportModal";
import ShareModal from "@/components/ShareModal";

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

  // Fullscreen Immersive State
  const [isImmersive, setIsImmersive] = useState(false);
  const [showImmersiveControls, setShowImmersiveControls] = useState(true);
  const immersiveTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    if (!showDownloadToast) return;
    const timer = setTimeout(() => {
      setShowDownloadToast(false);
    }, 6000);
    return () => clearTimeout(timer);
  }, [showDownloadToast]);

  // Immersive controls auto-fade timer
  const resetImmersiveTimer = useCallback(() => {
    setShowImmersiveControls(true);
    if (immersiveTimerRef.current) clearTimeout(immersiveTimerRef.current);
    immersiveTimerRef.current = setTimeout(() => {
      setShowImmersiveControls(false);
    }, 3500);
  }, []);

  const toggleImmersive = async () => {
    if (!isImmersive) {
      setIsImmersive(true);
      resetImmersiveTimer();
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fallback for browsers without native document fullscreen
      }
    } else {
      setIsImmersive(false);
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch {
        // Safe catch
      }
    }
  };

  const exitLightbox = async () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      try {
        await document.exitFullscreen();
      } catch {}
    }
    setIsImmersive(false);
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

  const showNext = useCallback(() => {
    if (selectedIndex === null || photos.length === 0) return;
    setSelectedIndex((prev) => (prev !== null && prev < photos.length - 1 ? prev + 1 : 0));
    if (isImmersive) resetImmersiveTimer();
  }, [selectedIndex, photos.length, isImmersive, resetImmersiveTimer]);

  const showPrev = useCallback(() => {
    if (selectedIndex === null || photos.length === 0) return;
    setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : photos.length - 1));
    if (isImmersive) resetImmersiveTimer();
  }, [selectedIndex, photos.length, isImmersive, resetImmersiveTimer]);

  useEffect(() => {
    if (selectedIndex === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") showNext();
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "Escape") {
        if (isImmersive) {
          setIsImmersive(false);
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20 relative select-none">
      <header className="border-b border-neutral-800/80 sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft size={14} /> Back to Galleries
          </Link>

          <div className="flex items-center gap-2.5">
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
        <div className="space-y-2">
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
          {album.date && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
              <Calendar size={13} />
              <span>{album.date}</span>
            </div>
          )}
        </div>

        {/* Dynamic Aspect Ratio Masonry Grid */}
        <div className="columns-2 sm:columns-3 md:columns-4 gap-4">
          {photos.map((photo, idx) => (
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
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                <span className="p-2 rounded-full bg-black/60 text-white backdrop-blur-md">
                  <Maximize2 size={16} />
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDownload(e, photo.urls.original, photo.original_filename)}
                  className="p-2 rounded-full bg-black/60 text-white hover:text-blue-400 backdrop-blur-md transition cursor-pointer"
                  title="Download High-Res Original"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ----------------- LIGHTBOX MODAL (STANDARD & IMMERSIVE) ----------------- */}
      {selectedPhoto !== null && selectedIndex !== null && (
        <div
          className={`fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden ${
            isImmersive ? "w-screen h-[100dvh]" : "bg-black/95 backdrop-blur-md"
          }`}
          onClick={exitLightbox}
        >
          {/* Top Control Bar (Standard Mode) */}
          {!isImmersive && (
            <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
              <span className="text-xs font-mono font-medium text-neutral-400 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/10">
                {selectedIndex + 1} / {photos.length}
              </span>

              {/* Enter Fullscreen Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleImmersive();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition cursor-pointer"
                title="Full Screen Immersive View"
              >
                <Maximize2 size={13} />
                <span className="hidden sm:inline">Full Screen</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleDownload(e, selectedPhoto.urls.original, selectedPhoto.original_filename)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition cursor-pointer"
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
          )}

          {/* Desktop Arrow Buttons (Standard Mode) */}
          {!isImmersive && photos.length > 1 && (
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

          {/* ----------------- IMMERSIVE TAP ZONES & FLOATING HUD ----------------- */}
          {isImmersive ? (
            <div
              className="relative w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left 35% Tap Zone -> Previous */}
              <div
                className="absolute left-0 top-0 bottom-0 w-[35%] z-20 cursor-w-resize"
                onClick={showPrev}
              />

              {/* Right 35% Tap Zone -> Next */}
              <div
                className="absolute right-0 top-0 bottom-0 w-[35%] z-20 cursor-e-resize"
                onClick={showNext}
              />

              {/* Center 30% Tap Zone -> Toggle Controls HUD */}
              <div
                className="absolute left-[35%] right-[35%] top-0 bottom-0 z-20 cursor-pointer"
                onClick={resetImmersiveTimer}
              />

              {/* Immersive Photo (100% Screen Fitted) */}
              <img
                src={selectedPhoto.urls.display}
                alt={selectedPhoto.original_filename}
                className="w-full h-full object-contain pointer-events-none select-none"
              />

              {/* Floating Minimal HUD Bar */}
              <div
                className={`absolute top-5 inset-x-0 mx-auto w-fit z-30 flex items-center gap-2 p-1.5 bg-black/75 backdrop-blur-xl border border-white/20 rounded-full shadow-2xl transition-all duration-300 ${
                  showImmersiveControls
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 -translate-y-4 pointer-events-none"
                }`}
              >
                <span className="text-[11px] font-mono text-neutral-300 px-3">
                  {selectedIndex + 1} / {photos.length}
                </span>

                <button
                  onClick={(e) => handleDownload(e, selectedPhoto.urls.original, selectedPhoto.original_filename)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition cursor-pointer"
                  title="Download Original"
                >
                  <Download size={14} />
                </button>

                <button
                  onClick={toggleImmersive}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-950/40 transition cursor-pointer"
                >
                  <Minimize2 size={13} />
                  <span>Exit Full Screen</span>
                </button>
              </div>
            </div>
          ) : (
            /* Standard Lightbox View Photo */
            <img
              src={selectedPhoto.urls.display}
              alt={selectedPhoto.original_filename}
              className="max-h-[85vh] max-w-[85vw] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {/* Gentle Post-Download Toast */}
      {showDownloadToast && (
        <div className="fixed bottom-6 right-6 z-[70] max-w-sm w-[calc(100vw-3rem)] p-4 rounded-xl bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 text-white shadow-2xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold font-mono uppercase tracking-wider text-neutral-200">
                Full-Res Download
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

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        albumTitle={album.title}
        albumId={albumId}
      />

      {/* Support Modal */}
      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        defaultFund={supportFund}
      />
    </div>
  );
}
