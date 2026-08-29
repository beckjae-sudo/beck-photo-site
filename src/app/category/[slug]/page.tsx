import CategoryGalleryView, { AlbumSummary } from "@/components/CategoryGalleryView";

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

  // Filter albums belonging to this broad sport slug
  const sportAlbums = albums.filter((a) => {
    const catSlug = (a.category || "Other").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return catSlug === slug.toLowerCase();
  });

  const sportTitle =
    sportAlbums[0]?.category ||
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
