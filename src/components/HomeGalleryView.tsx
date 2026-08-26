"use client";

import { useState } from "react";
import Link from "next/link";
import { Folder, Calendar, Layers, Sparkles } from "lucide-react";

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

export default function HomeGalleryView({
  albums = [],
  config,
}: {
  albums: AlbumSummary[];
  config: SiteConfig;
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const activeTheme = themeStyles[config.theme_preset] || themeStyles["slate-glow"];
  const categories = ["All", ...(config.categories || ["School Sports", "Travel Teams", "Other Activities"])];

  const filteredAlbums =
    selectedCategory === "All"
      ? albums
      : albums.filter((album) => (album.category || "School Sports") === selectedCategory);

  return (
    <div className={`min-h-screen ${activeTheme.bg} text-neutral-100 relative overflow-hidden`}>
      {/* Ambient background glow */}
      <div className={`pointer-events-none absolute inset-0 ${activeTheme.glow}`} />

      <main className="relative max-w-7xl mx-auto px-6 py-16 md:py-24 space-y-12">
        {/* Hero Section */}
        <div className="space-y-4 max-w-2xl">
          {config.badge_text && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-900/80 border border-neutral-800 text-neutral-300">
              <Sparkles size={13} className="text-amber-400" />
              <span>{config.badge_text}</span>
            </div>
          )}
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            {config.hero_headline || "Sports Photo Gallery"}
          </h1>
          <p className="text-neutral-400 text-base leading-relaxed">
            {config.hero_description || "Browse recent game albums and download high-resolution photos."}
          </p>
        </div>

        {/* Category Filter Navigation */}
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

        {/* Album Cards Grid */}
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
                  <h2 className="text-base font-bold text-white group-hover:text-blue-400 transition">
                    {album.title}
                  </h2>
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
  );
}
