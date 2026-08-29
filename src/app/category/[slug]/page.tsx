import CategoryGalleryView, { AlbumSummary } from "@/components/CategoryGalleryView";

export const revalidate = 0;

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  // 1. Safely resolve async params (Prevents Next.js 15 SSR crash)
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

  // 2. Smart Multi-Tier Matcher (Matches exact category, broad sport, or title keyword)
  const sportAlbums = albums.filter((a) => {
    const cat = (a.category || "").toLowerCase();
    const title = (a.title || "").toLowerCase();
    const catSlug = cat.replace(/[^a-z0-9]+/g, "-");

    // Exact slug match (e.g., "corvian-hs-basketball")
    if (catSlug === slug) return true;

    // Broad sport match (e.g. slug is "basketball" and category or title mentions basketball)
    if (slug === "basketball" && (cat.includes("basketball") || title.includes("basketball") || title.includes("hoops"))) return true;
    if (slug === "baseball" && (cat.includes("baseball") || title.includes("baseball") || title.includes("diamond"))) return true;
    if (slug === "football" && (cat.includes("football") || title.includes("football") || title.includes("gridiron"))) return true;
    if (slug === "soccer" && (cat.includes("soccer") || title.includes("soccer") || title.includes("fc"))) return true;

    // General substring match
    return cat.includes(slug) || title.includes(slug);
  });

  // Determine Display Title
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
      albums={sportAlbums}
    />
  );
}
