import HomeGalleryView, { AlbumSummary, SiteConfig } from "@/components/HomeGalleryView";

export const dynamic = "force-dynamic";

async function getHomePageData(): Promise<{ albums: AlbumSummary[]; config: SiteConfig }> {
  const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");

  const defaultConfig: SiteConfig = {
    site_title: "Sports Photo Gallery",
    badge_text: "Corvian Sports & Action",
    hero_headline: "Game Day Highlights",
    hero_description: "Browse recent game albums and download high-resolution photos.",
    theme_preset: "slate-glow",
    categories: ["School Sports", "Travel Teams", "Other Activities"],
  };

  if (!baseUrl) return { albums: [], config: defaultConfig };

  try {
    const [albumsRes, configRes] = await Promise.all([
      fetch(`${baseUrl}/albums.json`, { cache: "no-store" }),
      fetch(`${baseUrl}/site_config.json`, { cache: "no-store" }),
    ]);

    const albums = albumsRes.ok ? await albumsRes.json() : [];
    const config = configRes.ok ? await configRes.json() : defaultConfig;

    return { albums, config };
  } catch (err) {
    console.error("Failed to load home page data:", err);
    return { albums: [], config: defaultConfig };
  }
}

export default async function Page() {
  const { albums, config } = await getHomePageData();
  return <HomeGalleryView albums={albums} config={config} />;
}
