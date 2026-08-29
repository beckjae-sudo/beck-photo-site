import CategoryGalleryView, { AlbumSummary } from "@/components/CategoryGalleryView";

export const revalidate = 0;

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const rawSlug = resolvedParams?.slug || "";
  const slug = decodeURIComponent(rawSlug).toLowerCase().trim();

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

  // Multi-tier sport matching
  const sportAlbums = albums.filter((a) => {
    const cat = (a.category || "").toLowerCase();
    const title = (a.title || "").toLowerCase();
    const catSlug = cat.replace(/[^a-z0-9]+/g, "-");

    if (catSlug === slug) return true;
    if (slug === "basketball" && (cat.includes("basketball") || title.includes("basketball") || title.includes("hoops"))) return true;
    if (slug === "baseball" && (cat.includes("baseball") || title.includes("baseball") || title.includes("diamond"))) return true;
    if (slug === "football" && (cat.includes("football") || title.includes("football") || title.includes("gridiron"))) return true;
    if (slug === "soccer" && (cat.includes("soccer") || title.includes("soccer") || title.includes("fc"))) return true;

    return cat.includes(slug) || title.includes(slug);
  });

  // Fetch album manifests in parallel to pool all individual game photos
  const enrichedAlbums = await Promise.all(
    sportAlbums.map(async (album) => {
      try {
        const manifestRes = await fetch(`${baseUrl}/${album.id}/manifest.json`, { cache: "no-store" });
        if (manifestRes.ok) {
          const manifestData = await manifestRes.json();
          const photoUrls = (manifestData.photos || []).map(
            (p: any) => p.urls?.display || p.urls?.thumb
          );
          return {
            ...album,
            photos_pool: photoUrls,
          };
        }
      } catch (e) {
        console.error(`Failed to load manifest for album ${album.id}:`, e);
      }
      return {
        ...album,
        photos_pool: album.cover_url ? [album.cover_url] : [],
      };
    })
  );

  const sportTitle =
    slug === "baseball"
      ? "Baseball"
      : slug === "basketball"
      ? "Basketball"
      : slug === "football"
      ? "Football"
      : slug === "soccer"
      ? "Soccer"
      : sportAlbums[0]?.category ||
        slug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

  return (
    <CategoryGalleryView
      sportSlug={slug}
      sportTitle={sportTitle}
      albums={enrichedAlbums}
    />
  );
}
