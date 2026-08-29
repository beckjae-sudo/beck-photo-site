import Link from "next/link";
import { ArrowLeft, Folder, Calendar, Layers } from "lucide-react";

interface AlbumSummary {
  id: string;
  title: string;
  date: string;
  category?: string;
  photo_count: number;
  cover_url: string;
}

export const revalidate = 0;

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");

  let albums: AlbumSummary[] = [];
  try {
    const res = await fetch(`${baseUrl}/albums.json`, { cache: "no-store" });
    if (res.ok) {
      albums = await res.json();
    }
  } catch (e) {
    console.error("Failed to load albums for category:", e);
  }

  // Match slug to sport category name (e.g. "baseball" -> "Baseball")
  const filteredAlbums = albums.filter((a) => {
    const catSlug = (a.category || "Other").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return catSlug === slug.toLowerCase();
  });

  const categoryTitle =
    filteredAlbums[0]?.category ||
    slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20 select-none">
      {/* Header */}
      <header className="border-b border-neutral-800/80 sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft size={14} /> Back to Directory
          </Link>
          <span className="text-xs font-mono text-neutral-500">
            {filteredAlbums.length} {filteredAlbums.length === 1 ? "Album" : "Albums"}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-10 space-y-8">
        <div className="space-y-2 border-b border-neutral-800/80 pb-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 font-mono block">
            Sport Category
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
            {categoryTitle}
          </h1>
        </div>

        {filteredAlbums.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-neutral-800 rounded-2xl">
            <Folder className="mx-auto text-neutral-600 mb-3" size={36} />
            <p className="text-sm font-semibold text-neutral-300">No albums found for {categoryTitle}</p>
            <p className="text-xs text-neutral-500 mt-1">
              New games and matches for this sport will appear here once published.
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

                  <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-medium bg-black/60 backdrop-blur-md text-neutral-300 flex items-center gap-1 border border-white/10 font-mono">
                    <Layers size={11} /> {album.photo_count || 0} photos
                  </span>
                </div>

                <div className="p-5 space-y-1.5 flex-1 flex flex-col justify-end">
                  <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition">
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
        )}
      </main>
    </div>
  );
}
