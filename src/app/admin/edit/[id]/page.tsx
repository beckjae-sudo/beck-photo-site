"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Calendar, Layers, Loader2, Maximize2, X } from "lucide-react";

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

export default function AlbumViewPage() {
  const params = useParams();
  const rawId = params?.id;
  const albumId = Array.isArray(rawId) ? rawId[0] : (rawId as string) || "";

  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    if (!albumId) return;

    async function loadAlbum() {
      const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");
      try {
        const res = await fetch(`${baseUrl}/${decodeURIComponent(albumId)}/manifest.json`, {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          setAlbum(data);
        }
      } catch (err) {
        console.error("Failed to load album:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAlbum();
  }, [albumId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm text-neutral-400">Loading gallery...</p>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 text-center space-y-4 text-white">
        <p className="text-neutral-400 text-sm">Album not found or unavailable.</p>
        <Link href="/" className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20">
      {/* Top Header */}
      <header className="border-b border-neutral-800/80 sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft size={14} /> Back to Galleries
          </Link>
          <span className="text-xs font-medium text-neutral-500 flex items-center gap-1">
            <Layers size={12} /> {album.photos?.length || 0} photos
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-10 space-y-8">
        {/* Album Meta */}
        <div className="space-y-2">
          {album.category && (
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
              {album.category}
            </span>
          )}
          <h1 className="text-3xl md:text-4xl font-extrabold text-white">{album.title}</h1>
          {album.date && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-400">
              <Calendar size={13} />
              <span>{album.date}</span>
            </div>
          )}
        </div>

        {/* Public Gallery Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {album.photos?.map((photo) => (
            <div
              key={photo.id}
              className="group relative rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition aspect-4/3 cursor-pointer"
              onClick={() => setSelectedPhoto(photo)}
            >
              <img
                src={photo.urls.thumb}
                alt={photo.original_filename}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <span className="p-2 rounded-full bg-black/60 text-white backdrop-blur-md">
                  <Maximize2 size={16} />
                </span>
                <a
                  href={photo.urls.original}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 rounded-full bg-black/60 text-white hover:text-blue-400 backdrop-blur-md transition"
                  title="Download High-Res Original"
                >
                  <Download size={16} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <a
              href={selectedPhoto.urls.original}
              download
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition"
            >
              <Download size={14} /> Download Original
            </a>
            <button
              onClick={() => setSelectedPhoto(null)}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white backdrop-blur-md transition"
            >
              <X size={20} />
            </button>
          </div>

          <img
            src={selectedPhoto.urls.display}
            alt={selectedPhoto.original_filename}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
