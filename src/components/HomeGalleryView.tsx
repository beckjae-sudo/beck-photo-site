"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Folder, Calendar, Layers, ArrowRight, Coffee, Sliders } from "lucide-react";
import SupportModal, { FundType } from "@/components/SupportModal";

export interface AlbumSummary {
  id: string;
  title: string;
  date: string;
  category?: string;
  photo_count: number;
  cover_url: string;
}

export interface SiteConfig {
  site_title: string;
  badge_text: string;
  hero_headline: string;
  hero_description: string;
  theme_preset: string;
  categories: string[];
}

const INSTAGRAM_HANDLE = "shot.by.jaden2";
const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_HANDLE}`;

function InstagramIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function getHighResCoverUrl(url: string): string {
  if (!url) return "";
  return url
    .replace(/\/thumb\//, "/display/")
    .replace(/_thumb\./, "_display.")
    .replace(/thumb/g, "display");
}

export default function HomeGalleryView({
  albums = [],
  config,
}: {
  albums: AlbumSummary[];
  config: SiteConfig;
}) {
  const [showSplash, setShowSplash] = useState(true);
  const [currentCoverIndex, setCurrentCoverIndex] = useState(0);

  // Live Backdrop Brightness / Opacity Slider State (Default: 40%)
  const [mosaicOpacity, setMosaicOpacity] = useState<number>(40);
  const [showTuner, setShowTuner] = useState(false);

  // Support Modal State
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportFund, setSupportFund] = useState<FundType>("gear");

  const coverPhotos = albums
    .filter((a) => Boolean(a.cover_url))
    .map((a) => getHighResCoverUrl(a.cover_url));

  const mosaicPhotos = useMemo(() => {
    if (coverPhotos.length === 0) return [];
    const tiles: string[] = [];
    while (tiles.length < 24) {
      tiles.push(...coverPhotos);
    }
    return tiles.slice(0, 24);
  }, [coverPhotos]);

  useEffect(() => {
    const savedOpacity = localStorage.getItem("beck_mosaic_opacity");
    if (savedOpacity) {
      setMosaicOpacity(Number(savedOpacity));
    }
  }, []);

  const handleOpacityChange = (val: number) => {
    setMosaicOpacity(val);
    localStorage.setItem("beck_mosaic_opacity", String(val));
  };

  useEffect(() => {
    if (!showSplash || coverPhotos.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentCoverIndex((prev) => (prev + 1) % coverPhotos.length);
    }, 7000);

    return () => clearInterval(interval);
  }, [showSplash, coverPhotos.length]);

  const openSupport = (fund: FundType = "gear") => {
    setSupportFund(fund);
    setIsSupportOpen(true);
  };

  const sportCategories =
    config.categories && config.categories.length > 0
      ? config.categories
      : ["Baseball", "Basketball", "Football", "Soccer"];

  const getCategoryCover = (sport: string) => {
    const match = albums.find(
      (a) => a.category?.toLowerCase() === sport.toLowerCase() && Boolean(a.cover_url)
    );
    return match ? match.cover_url : "";
  };

  return (
    <div className="relative min-h-screen bg-black text-neutral-100 overflow-x-hidden select-none">
      {/* ----------------- SPLASH SCREEN ----------------- */}
      {showSplash && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-8 md:p-14 bg-black overflow-hidden">
          {coverPhotos.length > 0 ? (
            coverPhotos.map((url, idx) => (
              <div
                key={url}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  idx === currentCoverIndex ? "opacity-80" : "opacity-0 pointer-events-none"
                }`}
              >
                <img
                  src={url}
                  alt="Gallery Feature"
                  className="w-full h-full object-cover object-center"
                  loading={idx === 0 ? "eager" : "lazy"}
                />
              </div>
            ))
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-black to-neutral-900 opacity-90" />
          )}

          <div className="absolute inset-0 bg-radial from-transparent via-black/40 to-black/90 pointer-events-none" />
          <div className="absolute inset-0 bg-black/30 pointer-events-none" />

          {/* Top Bar */}
          <div className="relative z-10 w-full flex justify-between items-center max-w-7xl mx-auto text-[11px] font-mono tracking-[0.25em] text-neutral-300 uppercase drop-shadow-md">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              ARCHIVE / VOL. 01
            </span>
            <span>{albums.length} GALLERIES</span>
          </div>

          {/* Center Brand */}
          <div className="relative z-10 text-center space-y-7 max-w-3xl mx-auto flex flex-col items-center">
            <div className="space-y-3">
              <h1 className="text-5xl sm:text-7xl md:text-8xl font-black uppercase tracking-[-0.07em] text-white flex items-center justify-center gap-2 drop-shadow-2xl">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-neutral-100 to-neutral-300">
                  BECK
                </span>
                <span className="text-blue-500 font-light tracking-normal transform -skew-x-12">
                  /
                </span>
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-neutral-100 to-neutral-400">
                  PHOTO
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs uppercase tracking-[0.45em] text-neutral-200 font-mono font-medium drop-shadow-md">
                Action & High-Resolution Athletics
              </p>
            </div>

            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => setShowSplash(false)}
                className="group relative flex items-center gap-3 px-8 py-3.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-xs font-semibold tracking-widest uppercase backdrop-blur-xl border border-white/25 hover:border-white/40 shadow-[0_8px_32px_0_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.4)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>Enter Gallery</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform text-blue-400" />
              </button>

              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 hover:border-white/35 text-[11px] text-neutral-200 hover:text-white transition-all duration-300 hover:scale-[1.02] shadow-lg group"
              >
                <InstagramIcon size={13} className="text-pink-400 group-hover:scale-110 transition-transform" />
                <span>
                  Follow more of Jaden Beck&apos;s work{" "}
                  <span className="font-semibold text-white group-hover:underline">@{INSTAGRAM_HANDLE}</span>
                </span>
              </a>
            </div>
          </div>

          <div className="relative z-10 text-[10px] text-neutral-400 font-mono tracking-[0.2em] uppercase drop-shadow-md">
            Direct Cloudflare R2 Delivery
          </div>
        </div>
      )}

      {/* ----------------- MAIN DIRECTORY VIEW WITH BRIGHTER ARTISAN MOSAIC ----------------- */}
      <div className="min-h-screen bg-neutral-950 relative flex flex-col justify-between overflow-hidden">
        {/* 1. Dynamic Photo Mosaic (Brightness driven by slider) */}
        {mosaicPhotos.length > 0 && (
          <div
            className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none transition-opacity duration-300"
            style={{ opacity: mosaicOpacity / 100 }}
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 sm:gap-3.5 p-3 -rotate-1 scale-105 filter saturate-75 contrast-110">
              {mosaicPhotos.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className={`rounded-xl overflow-hidden bg-neutral-900 border border-white/5 ${
                    idx % 3 === 0
                      ? "aspect-4/3"
                      : idx % 2 === 0
                      ? "aspect-square"
                      : "aspect-3/4"
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Tuned Radial Vignette (Preserves card contrast while showing photos) */}
        <div className="pointer-events-none fixed inset-0 z-0 bg-radial from-transparent via-neutral-950/40 to-neutral-950/90" />
        <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-t from-neutral-950 via-transparent to-neutral-950/80" />

        <div className="relative z-10">
          {/* Header */}
          <header className="border-b border-neutral-800/60 sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => setShowSplash(true)}
                className="font-black text-sm tracking-tighter uppercase text-white flex items-center gap-1 hover:opacity-80 transition cursor-pointer"
                title="Return to Splash Screen"
              >
                <span>BECK</span>
                <span className="text-blue-500 font-light">/</span>
                <span>PHOTO</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => openSupport("gear")}
                  className="flex items-center gap-1.5 text-xs font-mono text-neutral-300 hover:text-white transition py-1.5 px-3 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 cursor-pointer shadow-sm"
                  title="Sideline Support & Gear Funds"
                >
                  <Coffee size={12} className="text-amber-400" />
                  <span className="hidden sm:inline">SUPPORT // FUNDS</span>
                  <span className="sm:hidden">SUPPORT</span>
                </button>

                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:flex items-center gap-1.5 text-xs font-mono text-neutral-400 hover:text-white transition py-1.5 px-2.5 rounded-lg hover:bg-neutral-900 border border-transparent hover:border-neutral-800"
                  title="Follow Jaden Beck on Instagram"
                >
                  <InstagramIcon size={12} className="text-neutral-400" />
                  <span>@{INSTAGRAM_HANDLE}</span>
                </a>

                <span className="text-xs font-mono text-neutral-500 pl-1">
                  {albums.length} GALLERIES
                </span>
              </div>
            </div>
          </header>

          {/* Main Showcase Section */}
          <main className="relative max-w-7xl mx-auto px-6 pt-10 pb-16 space-y-14">
            {/* 1. SPORT PORTALS (2-Row Grid on Mobile / Single Row on Desktop) */}
            <div className="flex flex-col items-center">
              {/* Mobile Layout: 2 Columns */}
              <div className="grid grid-cols-2 gap-6 max-w-xs mx-auto md:hidden">
                {sportCategories.map((sport) => {
                  const coverUrl = getCategoryCover(sport);
                  const sportSlug = sport.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                  const sportAlbums = albums.filter(
                    (a) => a.category?.toLowerCase() === sport.toLowerCase()
                  );

                  return (
                    <Link
                      key={sport}
                      href={`/category/${sportSlug}`}
                      className="group flex flex-col items-center gap-2.5 transition"
                    >
                      <div className="relative w-32 h-32 rounded-full p-[2.5px] bg-gradient-to-b from-neutral-700 via-neutral-800 to-neutral-950 group-hover:from-blue-500 group-hover:to-cyan-400 transition-all duration-300 shadow-xl group-hover:scale-105">
                        <div className="w-full h-full rounded-full overflow-hidden bg-neutral-900 relative">
                          {coverUrl ? (
                            <img src={coverUrl} alt={sport} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                              <Folder size={28} />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent" />
                        </div>
                      </div>

                      <div className="text-center space-y-0.5 max-w-[120px]">
                        <span className="text-xs font-bold tracking-wider text-neutral-200 uppercase font-mono block leading-tight">
                          {sport}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono block">
                          {sportAlbums.length} {sportAlbums.length === 1 ? "Album" : "Albums"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Desktop Layout: Strictly Single Horizontal Row */}
              <div className="hidden md:flex md:flex-row md:flex-nowrap md:justify-center md:items-center md:gap-10 lg:gap-14 w-full">
                {sportCategories.map((sport) => {
                  const coverUrl = getCategoryCover(sport);
                  const sportSlug = sport.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                  const sportAlbums = albums.filter(
                    (a) => a.category?.toLowerCase() === sport.toLowerCase()
                  );

                  return (
                    <Link
                      key={sport}
                      href={`/category/${sportSlug}`}
                      className="group flex flex-col items-center gap-3 transition shrink-0"
                    >
                      <div className="relative md:w-36 md:h-36 lg:w-44 lg:h-44 rounded-full p-[3px] bg-gradient-to-b from-neutral-700 via-neutral-800 to-neutral-950 group-hover:from-blue-500 group-hover:to-cyan-400 transition-all duration-500 shadow-2xl group-hover:shadow-blue-950/60 group-hover:scale-105">
                        <div className="w-full h-full rounded-full overflow-hidden bg-neutral-900 relative">
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt={sport}
                              className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-600 bg-neutral-900">
                              <Folder size={32} />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/25 group-hover:bg-transparent transition-colors duration-300" />
                        </div>
                      </div>

                      <div className="text-center max-w-[140px] space-y-0.5">
                        <span className="text-sm md:text-base font-bold tracking-wider text-neutral-200 group-hover:text-white uppercase font-mono leading-tight block">
                          {sport}
                        </span>
                        <span className="text-xs text-neutral-500 font-mono block">
                          {sportAlbums.length} {sportAlbums.length === 1 ? "Album" : "Albums"}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* 2. RECENT 3 ALBUMS CENTERPIECE */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
                <span className="text-xs font-mono tracking-widest text-neutral-400 uppercase">
                  Featured / Recent Albums
                </span>
                <span className="text-[11px] font-mono text-neutral-500">
                  Showing {Math.min(albums.length, 3)} of {albums.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {albums.slice(0, 3).map((album) => (
                  <Link
                    key={album.id}
                    href={`/album/${album.id}`}
                    className="group relative rounded-2xl overflow-hidden border border-neutral-800/80 hover:border-blue-500/50 bg-neutral-900/70 hover:bg-neutral-900/95 backdrop-blur-sm transition-all duration-300 flex flex-col shadow-xl hover:shadow-2xl hover:shadow-blue-950/40"
                  >
                    <div className="relative aspect-4/3 overflow-hidden bg-neutral-900">
                      {album.cover_url ? (
                        <img
                          src={album.cover_url}
                          alt={album.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-700">
                          <Folder size={40} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                      {album.category && (
                        <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-black/70 backdrop-blur-md text-blue-300 border border-blue-900/40 font-mono">
                          {album.category}
                        </span>
                      )}

                      <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-medium bg-black/60 backdrop-blur-md text-neutral-300 flex items-center gap-1 border border-white/10 font-mono">
                        <Layers size={11} /> {album.photo_count || 0} photos
                      </span>
                    </div>

                    <div className="p-5 space-y-1.5 flex-1 flex flex-col justify-end">
                      <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition leading-snug">
                        {album.title}
                      </h3>
                      {album.date && (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                          <Calendar size={13} />
                          <span>{album.date}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </main>
        </div>

        {/* ----------------- LIVE BACKDROP TUNER WIDGET ----------------- */}
        <div className="fixed bottom-4 left-4 z-40">
          {showTuner ? (
            <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-neutral-900/95 border border-neutral-700 backdrop-blur-md shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Mosaic: {mosaicOpacity}%
              </span>
              <input
                type="range"
                min="0"
                max="80"
                step="5"
                value={mosaicOpacity}
                onChange={(e) => handleOpacityChange(Number(e.target.value))}
                className="w-24 accent-blue-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
              <button
                onClick={() => setShowTuner(false)}
                className="text-[10px] font-mono text-neutral-400 hover:text-white px-1"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowTuner(true)}
              className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition shadow-lg cursor-pointer"
              title="Tune Backdrop Brightness"
            >
              <Sliders size={14} />
            </button>
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-neutral-900 bg-neutral-950/80 backdrop-blur-md relative z-10">
          <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 font-mono">
            <div>
              <span>BECK / PHOTO © {new Date().getFullYear()}</span>
            </div>
            <div className="flex items-center gap-6">
              <button
                onClick={() => openSupport("gear")}
                className="hover:text-neutral-300 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Coffee size={13} className="text-amber-400" />
                <span>SUPPORT // FUNDS</span>
              </button>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-neutral-300 transition flex items-center gap-1.5"
              >
                <InstagramIcon size={13} />
                <span>@{INSTAGRAM_HANDLE}</span>
              </a>
            </div>
          </div>
        </footer>
      </div>

      <SupportModal
        isOpen={isSupportOpen}
        onClose={() => setIsSupportOpen(false)}
        defaultFund={supportFund}
      />
    </div>
  );
}
