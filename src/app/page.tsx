import Link from "next/link";
import { Calendar, Images, ArrowRight } from "lucide-react";

interface AlbumSummary {
  id: string;
  title: string;
  date: string;
  photo_count: number;
  cover_url: string;
}

async function getAlbums(): Promise<AlbumSummary[]> {
  const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL;
  if (!baseUrl) return [];

  try {
    const res = await fetch(`${baseUrl}/albums.json`, {
      next: { revalidate: 30 }, // Re-checks R2 for new games every 30 seconds
    });

    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch albums:", error);
    return [];
  }
}

export default async function HomePage() {
  const albums = await getAlbums();

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-10 md:px-12 md:py-16">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* Header Title & Subtitle */}
        <header className="space-y-3">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wide bg-neutral-800 text-neutral-300 border border-neutral-700">
            Sports Photo Gallery
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Game Day Highlights
          </h1>
          <p className="text-neutral-400 max-w-xl text-base">
            Select a game or tournament below to browse the photo gallery and download full-resolution originals.
          </p>
        </header>

        {/* Albums Grid */}
        {albums.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-neutral-800 rounded-2xl">
            <Images className="mx-auto text-neutral-600 mb-3" size={40} />
            <p className="text-neutral-400 font-medium">No albums published yet.</p>
            <p className="text-neutral-600 text-sm mt-1">Upload an album using your Python script to see it here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {albums.map((album) => (
              <Link
                key={album.id}
                href={`/album/${album.id}`}
                className="group flex flex-col overflow-hidden rounded-xl bg-neutral-900 border border-neutral-800/80 transition-all duration-300 hover:border-neutral-700 hover:shadow-xl hover:-translate-y-1"
              >
                {/* Cover Image Container */}
                <div className="relative aspect-16/10 w-full overflow-hidden bg-neutral-950">
                  {album.cover_url ? (
                    <img
                      src={album.cover_url}
                      alt={album.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-700">
                      <Images size={32} />
                    </div>
                  )}

                  {/* Photo count badge */}
                  <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-medium text-neutral-200 flex items-center gap-1.5 border border-white/10">
                    <Images size={13} />
                    {album.photo_count}
                  </div>
                </div>

                {/* Album Card Body */}
                <div className="p-5 flex flex-col flex-1 justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <Calendar size={13} />
                      {album.date}
                    </div>
                    <h2 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                      {album.title}
                    </h2>
                  </div>

                  <div className="flex items-center text-xs font-semibold text-neutral-400 group-hover:text-white pt-2 border-t border-neutral-800/50">
                    <span>View Gallery</span>
                    <ArrowRight size={14} className="ml-1.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
