import { notFound } from "next/navigation";
import Link from "next/link";
import GalleryGrid, { PhotoItem } from "@/components/GalleryGrid";
import { Calendar, Image as ImageIcon, ArrowLeft } from "lucide-react";

interface Manifest {
  album_id: string;
  title: string;
  date: string;
  photos: PhotoItem[];
}

async function getAlbumManifest(albumId: string): Promise<Manifest | null> {
  const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_R2_BASE_URL is not configured.");
  }

  try {
    const res = await fetch(`${baseUrl}/${albumId}/manifest.json`, {
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function AlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const album = await getAlbumManifest(id);

  if (!album) {
    notFound();
  }

  return (
    // 1. Single Outermost Container (<main>)
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-8 md:px-12 md:py-12">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* 2. Header Box inside <main> */}
        <header className="border-b border-neutral-800 pb-6 space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft size={14} />
            All Albums
          </Link>

          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
              {album.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
              <span className="flex items-center gap-1.5">
                <Calendar size={15} />
                {album.date}
              </span>
              <span className="flex items-center gap-1.5">
                <ImageIcon size={15} />
                {album.photos.length} Photos
              </span>
            </div>
          </div>
        </header>

        {/* 3. Photo Grid */}
        <GalleryGrid photos={album.photos} galleryId={`gallery-${album.album_id}`} />

      </div>
    </main>
  );
}
