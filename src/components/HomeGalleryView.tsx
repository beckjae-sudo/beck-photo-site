"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Folder, Calendar, Layers, Sparkles, ArrowRight } from "lucide-react";

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

const themeStyles: Record<string, { bg: string; glow: string; pill: string }> = {
  "slate-glow": {
    bg: "bg-neutral-950",
    glow: "bg-radial from-blue-900/20 via-neutral-950/80 to-neutral-950",
    pill: "bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:border-neutral-700",
  },
  "midnight-sports": {
    bg: "bg-slate-950",
    glow: "bg-radial from-indigo-950/40 via-slate-950/90 to-slate-950",
    pill: "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700",
  },
  "deep-emerald": {
    bg: "bg-[#06140e]",
    glow: "bg-radial from-emerald-950/30 via-[#06140e]/90 to-[#06140e]",
    pill: "bg-emerald-950/40 border-emerald-900/50 text-emerald-200 hover:border-emerald-800",
  },
  "carbon-minimal": {
    bg: "bg-black",
    glow: "bg-none",
    pill: "bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700",
  },
};

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
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const coverPhotos = albums
    .filter((a) => Boolean(a.cover_url))
    .map((a) => getHighResCoverUrl(a.cover_url));

  useEffect(() => {
    if (!showSplash || coverPhotos.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentCoverIndex((prev) => (prev + 1) % coverPhotos.length);
    }, 7000);

    return () => clearInterval(interval);
  }, [showSplash, coverPhotos.length]);

  const activeTheme = themeStyles[config.theme_preset] || themeStyles["slate-glow"];
  const categories = ["All", ...(config.categories || ["School Sports", "Travel Teams", "Other Activities"])];

  const filteredAlbums =
    selectedCategory === "All"
      ? albums
      : albums.filter((album) => (album.category || "School Sports") === selectedCategory);

  return (
    <div className="relative min-h-screen bg-black text-neutral-100 overflow-x-hidden select-none">
      {/* ----------------- SPLASH SCREEN OVERLAY ----------------- */}
      {showSplash && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-8 md:p-14 bg-black overflow-hidden">
          {/* Background Rotating Images with Cross-Fade */}
          {coverPhotos.length > 0 ? (
            coverPhotos.map((url, idx) => (
              <div
                key={url}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  idx === currentCoverIndex ? "opacity-60 scale-100" : "opacity-0 scale-105"
                } transition-transform duration-[7000ms]`}
              >
                <img
                  src={url}
                  alt="Gallery Feature"
                  className="w-full h-full object-cover"
                />
              </div>
            ))
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-black to-neutral-900 opacity-90" />
          )}

          {/* Vignette & Contrast Overlays */}
          <div className="absolute inset-0 bg-radial from-transparent via-black/40 to-black/90 pointer-events-none" />
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[0.5px] pointer-events-none" />

          {/* Top Bar */}
          <div className="relative z-10 w-full flex justify-between items-center max-w-7xl mx-auto text-[11px] font-mono tracking-[0.25em] text-neutral-400 uppercase">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              ARCHIVE / VOL. 01
            </span>
            <span>{albums.length} GALLERIES</span>
          </div>

          {/* Center Brand Identity (Verge Modular Aesthetic) */}
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
              <p className="text-[11px] sm:text-xs uppercase tracking-[0.45em] text-neutral-300 font-mono font-medium">
                Action & High-Resolution Athletics
              </p>
            </div>

            {/* Apple-Style Frosted Liquid Glass Button */}
            <button
              onClick={() => setShowSplash(false)}
              className="group relative flex items-center gap-3 px-8 py-3.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-xs font-semibold tracking-widest uppercase backdrop-blur-xl border border-white/25 hover:border-white/40 shadow-[0_8px_32px_0_rgba(0,0,0,0.5),inset_0_1px_1px_0_rgba(255,255,255,0.4)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>Enter Gallery</span>
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform text-blue-400" />
            </button>
          </div>

          {/* Bottom Bar */}
          <div className="relative z-10 text-[10px] text-neutral-400 font-mono tracking-[0.2em] uppercase">
            Direct Cloudflare R2 Delivery
          </div>
        </div>
      )}

      {/* ----------------- HOME GALLERY DIRECTORY ----------------- */}
      <div className={`min-h-screen ${activeTheme.bg} relative overflow-hidden`}>
        <div className={`pointer-events-none absolute inset-0 ${activeTheme.glow}`} />

        <header className="border-b border-neutral-800/60 sticky top-0 z-30 bg-neutral-950/75 backdrop-blur-md">
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
            <span className="text-xs font-mono text-neutral-500">
              {albums.length} GALLERIES
            </span>
          </div>
        </header>

        <main className="relative max-w-7xl mx-auto px-6 py-12 md:py-16 space-y-12">
          <div className="space-y-4 max-w-2xl">
            {config.badge_text && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-900/80 border border-neutral-800 text-neutral-300">
                <Sparkles size={13} className="text-amber-400" />
                <span>{config.badge_text}</span>
              </div>
            )}
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
              {config.hero_headline || "Sports Photo Gallery"}
            </h2>
            <p className="text-neutral-400 text-sm md:text-base leading-relaxed">
              {config.hero_description || "Browse recent game albums and download high-resolution photos."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800/80 pb-4">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition border ${
                    isActive
                      ? "bg-white text-black border-white shadow-sm"
                      : `${activeTheme.pill}`
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {filteredAlbums.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-neutral-800 rounded-2xl">
              <Folder className="mx-auto text-neutral-600 mb-3" size={36} />
              <p className="text-sm font-semibold text-neutral-300">No albums found</p>
              <p className="text-xs text-neutral-500 mt-1">
                Upload photos in the Admin studio to publish your first album.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAlbums.map((album) => (
                <Link
                  key={album.id}
                  href={`/album/${album.id}`}
                  className="group relative rounded-2xl overflow-hidden border border-neutral-800/80 hover:border-neutral-600 transition bg-neutral-900/40 flex flex-col"
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
                      <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 backdrop-blur-md text-neutral-300 border border-white/10">
                        {album.category}
                      </span>
                    )}

                    <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-medium bg-black/60 backdrop-blur-md text-neutral-300 flex items-center gap-1 border border-white/10">
                      <Layers size={11} /> {album.photo_count || 0} photos
                    </span>
                  </div>

                  <div className="p-5 space-y-1.5 flex-1 flex flex-col justify-end">
                    <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition">
                      {album.title}
                    </h3>
                    {album.date && (
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                        <Calendar size={13} />
                        <span>{album.date}</span>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
