"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  checkAdminAuth,
  loginAdmin,
  createAlbum,
  getDirectUploadUrl,
  saveSiteConfig,
  deleteAlbum,
} from "@/app/admin/actions";
import { processImageInBrowser, ProcessedPhoto } from "@/lib/clientImageProcessor";
import {
  Lock,
  Upload,
  Layers,
  Palette,
  Star,
  Trash2,
  Edit,
  Loader2,
  CheckCircle2,
  Plus,
  Image as ImageIcon,
  AlertTriangle,
} from "lucide-react";

export default function AdminStudioView() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState<"albums" | "settings">("albums");

  const [albums, setAlbums] = useState<any[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("School Sports");
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([]);
  const [coverPhotoUid, setCoverPhotoUid] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");

  const [siteConfig, setSiteConfig] = useState({
    site_title: "Sports Photo Gallery",
    badge_text: "Corvian Sports & Action",
    hero_headline: "Game Day Highlights",
    hero_description: "Browse recent game albums and download high-resolution photos.",
    theme_preset: "slate-glow",
    categories: ["School Sports", "Travel Teams", "Other Activities"],
  });
  const [newCatInput, setNewCatInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Album Deletion Confirmation State
  const [albumToDelete, setAlbumToDelete] = useState<any | null>(null);
  const [isDeletingAlbum, setIsDeletingAlbum] = useState(false);

  useEffect(() => {
    checkAdminAuth().then((auth) => {
      setIsAuthenticated(auth);
      if (auth) {
        loadData();
      }
    });
  }, []);

  async function loadData() {
    setLoadingAlbums(true);
    const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");
    try {
      const [albumsRes, configRes] = await Promise.all([
        fetch(`${baseUrl}/index.json`, { cache: "no-store" }),
        fetch(`${baseUrl}/site_config.json`, { cache: "no-store" }),
      ]);

      if (albumsRes.ok) {
        const data = await albumsRes.json();
        setAlbums(data);
      }
      if (configRes.ok) {
        const cfg = await configRes.json();
        setSiteConfig(cfg);
        if (cfg.categories?.length > 0) {
          setCategory(cfg.categories[0]);
        }
      }
    } catch (e) {
      console.error("Error loading admin data:", e);
    } finally {
      setLoadingAlbums(false);
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    const res = await loginAdmin(password);
    if (res.success) {
      setIsAuthenticated(true);
      loadData();
    } else {
      setAuthError("Incorrect password");
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadProgressText("Processing images in browser...");
    const processedList: ProcessedPhoto[] = [];

    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith("image/")) {
        const item = await processImageInBrowser(files[i]);
        processedList.push(item);
      }
    }

    setPhotos((prev) => {
      const combined = [...prev, ...processedList];
      if (!coverPhotoUid && combined.length > 0) {
        setCoverPhotoUid(combined[0].uid);
      }
      return combined;
    });
    setUploadProgressText("");
  };

  const handleCreateAlbum = async () => {
    if (!title.trim()) return alert("Please enter an Album Title.");
    if (photos.length === 0) return alert("Please select at least one photo.");

    setIsUploading(true);
    const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");

    try {
      const albumId = `${date || new Date().toISOString().split("T")[0]}-${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`;

      const uploadedPhotosData: any[] = [];

      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const photoId = `${albumId}_${String(i + 1).padStart(3, "0")}`;
        setUploadProgressText(`Uploading ${i + 1} of ${photos.length}...`);

        const thumbKey = `${albumId}/thumb/${photoId}.webp`;
        const displayKey = `${albumId}/display/${photoId}.webp`;
        const origExt = p.originalName.substring(p.originalName.lastIndexOf("."));
        const origKey = `${albumId}/original/${photoId}${origExt}`;

        const [thumbRes, displayRes, origRes] = await Promise.all([
          getDirectUploadUrl(thumbKey, "image/webp"),
          getDirectUploadUrl(displayKey, "image/webp"),
          getDirectUploadUrl(origKey, p.file.type || "image/jpeg"),
        ]);

        if (!thumbRes.success || !thumbRes.url) throw new Error(thumbRes.error || "Failed to get thumb upload URL");
        if (!displayRes.success || !displayRes.url) throw new Error(displayRes.error || "Failed to get display upload URL");
        if (!origRes.success || !origRes.url) throw new Error(origRes.error || "Failed to get original upload URL");

        await Promise.all([
          fetch(thumbRes.url, { method: "PUT", body: p.thumbBlob, headers: { "Content-Type": "image/webp" } }),
          fetch(displayRes.url, { method: "PUT", body: p.displayBlob, headers: { "Content-Type": "image/webp" } }),
          fetch(origRes.url, { method: "PUT", body: p.file, headers: { "Content-Type": p.file.type || "image/jpeg" } }),
        ]);

        uploadedPhotosData.push({
          id: photoId,
          original_filename: p.originalName,
          width: p.width,
          height: p.height,
          aspect_ratio: p.aspectRatio,
          urls: {
            thumb: `${baseUrl}/${thumbKey}`,
            display: `${baseUrl}/${displayKey}`,
            original: `${baseUrl}/${origKey}`,
          },
          metadata: p.metadata,
        });
      }

      setUploadProgressText("Finalizing manifest & gallery indices...");

      const selectedCover = photos.find((p) => p.uid === coverPhotoUid);
      const coverIndex = selectedCover ? photos.indexOf(selectedCover) : 0;
      const finalCoverUrl = uploadedPhotosData[coverIndex]?.urls?.thumb || uploadedPhotosData[0]?.urls?.thumb;

      const createRes = await createAlbum({
        album_id: albumId,
        title,
        date: date || new Date().toISOString().split("T")[0],
        category,
        photos: uploadedPhotosData,
        cover_url: finalCoverUrl,
      });

      if (!createRes.success) {
        throw new Error(createRes.error || "Failed to save album metadata.");
      }

      setTitle("");
      setDate("");
      setPhotos([]);
      setCoverPhotoUid("");
      alert("Album successfully created and published!");
      loadData();
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.message || JSON.stringify(err);
      alert(`Upload failed: ${msg}`);
    } finally {
      setIsUploading(false);
      setUploadProgressText("");
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!albumToDelete) return;
    setIsDeletingAlbum(true);
    try {
      const res = await deleteAlbum(albumToDelete.id);
      if (res.success) {
        setAlbums((prev) => prev.filter((a) => a.id !== albumToDelete.id));
        setAlbumToDelete(null);
      } else {
        alert(`Delete failed: ${res.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Delete error: ${err.message || String(err)}`);
    } finally {
      setIsDeletingAlbum(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSettingsSuccess(false);
    try {
      await saveSiteConfig(siteConfig);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const addCategory = () => {
    if (!newCatInput.trim()) return;
    if (!siteConfig.categories.includes(newCatInput.trim())) {
      setSiteConfig({
        ...siteConfig,
        categories: [...siteConfig.categories, newCatInput.trim()],
      });
    }
    setNewCatInput("");
  };

  const removeCategory = (cat: string) => {
    setSiteConfig({
      ...siteConfig,
      categories: siteConfig.categories.filter((c) => c !== cat),
    });
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="bg-neutral-900 border border-neutral-800 p-8 rounded-2xl w-full max-w-sm space-y-6 shadow-2xl"
        >
          <div className="flex items-center gap-3 text-white">
            <div className="p-2.5 rounded-xl bg-neutral-800 border border-neutral-700">
              <Lock size={20} className="text-blue-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Admin Studio</h1>
              <p className="text-xs text-neutral-400">Enter password to manage gallery</p>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="password"
              placeholder="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 transition"
              autoFocus
            />
            {authError && <p className="text-xs text-red-400">{authError}</p>}
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition"
          >
            Unlock Studio
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-24">
      <header className="border-b border-neutral-800/80 sticky top-0 z-30 bg-neutral-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-lg text-white">Admin Studio</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800">
              Authenticated
            </span>
          </div>

          <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("albums")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "albums" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Layers size={14} /> Albums & Uploads
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "settings" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Palette size={14} /> Site Design & Categories
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-8 space-y-10">
        {activeTab === "albums" ? (
          <>
            <section className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Create New Album</h2>
                  <p className="text-xs text-neutral-400">Photos are processed directly in your browser before upload</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Album Title</label>
                  <input
                    type="text"
                    placeholder="e.g. MS Baseball vs Charlotte Catholic"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Category / Group</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
                  >
                    {siteConfig.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">Event Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
                  />
                </div>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFiles(e.dataTransfer.files);
                }}
                onClick={() => document.getElementById("album-file-input")?.click()}
                className="border-2 border-dashed border-neutral-800 hover:border-neutral-600 bg-neutral-950/60 rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
              >
                <Upload size={28} className="text-neutral-500" />
                <p className="text-sm font-semibold text-neutral-300">Drag & drop game photos here, or click to browse</p>
                <p className="text-xs text-neutral-500">Supports JPEG and PNG</p>
                <input
                  id="album-file-input"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </div>

              {photos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-300">
                      Selected Photos ({photos.length}) — Click gold star to set cover image
                    </span>
                    <button
                      onClick={() => setPhotos([])}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                    {photos.map((p) => {
                      const isCover = coverPhotoUid === p.uid;
                      return (
                        <div
                          key={p.uid}
                          className={`relative aspect-4/3 rounded-lg overflow-hidden border ${
                            isCover ? "border-amber-500 ring-2 ring-amber-500/40" : "border-neutral-800"
                          } bg-neutral-900 group`}
                        >
                          <img src={p.previewUrl} alt={p.originalName} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setCoverPhotoUid(p.uid)}
                            className={`absolute top-1.5 left-1.5 p-1 rounded-md backdrop-blur-md transition ${
                              isCover ? "bg-amber-500 text-black" : "bg-black/60 text-neutral-400 hover:text-white"
                            }`}
                            title="Set as Cover"
                          >
                            <Star size={11} fill={isCover ? "currentColor" : "none"} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhotos(photos.filter((x) => x.uid !== p.uid))}
                            className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-neutral-400 hover:text-red-400 backdrop-blur-md opacity-0 group-hover:opacity-100 transition"
                            title="Remove"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-4 border-t border-neutral-800">
                {uploadProgressText && (
                  <span className="text-xs text-neutral-400 flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin text-blue-500" />
                    {uploadProgressText}
                  </span>
                )}
                <button
                  onClick={handleCreateAlbum}
                  disabled={isUploading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
                >
                  {isUploading ? "Uploading..." : "Publish Album"}
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-base font-bold text-white">Live Albums ({albums.length})</h2>
              {loadingAlbums ? (
                <div className="flex items-center gap-2 text-xs text-neutral-400 py-6">
                  <Loader2 size={16} className="animate-spin text-blue-500" /> Loading albums...
                </div>
              ) : albums.length === 0 ? (
                <p className="text-xs text-neutral-500 py-4">No albums published yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {albums.map((album) => (
                    <div
                      key={album.id}
                      className="flex items-center justify-between p-3.5 bg-neutral-900 border border-neutral-800 rounded-xl"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-neutral-950 shrink-0">
                          {album.cover_url ? (
                            <img src={album.cover_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-700">
                              <ImageIcon size={18} />
                            </div>
                          )}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-semibold text-white truncate">{album.title}</p>
                          <p className="text-[11px] text-neutral-400">{album.category || "School Sports"} • {album.photo_count} photos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link
                          href={`/admin/edit/${album.id}`}
                          className="p-2 text-neutral-400 hover:text-white rounded-lg bg-neutral-800 hover:bg-neutral-700 transition"
                          title="Edit Album"
                        >
                          <Edit size={14} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setAlbumToDelete(album)}
                          className="p-2 text-neutral-400 hover:text-red-400 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition cursor-pointer"
                          title="Delete Album"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-6 md:p-8 space-y-8 max-w-3xl">
            <div>
              <h2 className="text-lg font-bold text-white">Site Design & Categories</h2>
              <p className="text-xs text-neutral-400">Configure global hero titles, presets, and category folder tabs</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Homepage Text</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-neutral-300 font-semibold block mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={siteConfig.badge_text}
                    onChange={(e) => setSiteConfig({ ...siteConfig, badge_text: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-300 font-semibold block mb-1">Hero Headline</label>
                  <input
                    type="text"
                    value={siteConfig.hero_headline}
                    onChange={(e) => setSiteConfig({ ...siteConfig, hero_headline: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-300 font-semibold block mb-1">Hero Description</label>
                  <input
                    type="text"
                    value={siteConfig.hero_description}
                    onChange={(e) => setSiteConfig({ ...siteConfig, hero_description: e.target.value })}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Theme Atmosphere</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: "slate-glow", name: "Slate Glow", color: "bg-blue-950" },
                  { id: "midnight-sports", name: "Midnight", color: "bg-indigo-950" },
                  { id: "deep-emerald", name: "Emerald", color: "bg-emerald-950" },
                  { id: "carbon-minimal", name: "Carbon", color: "bg-neutral-950" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSiteConfig({ ...siteConfig, theme_preset: t.id })}
                    className={`p-3 rounded-xl border text-left transition ${
                      siteConfig.theme_preset === t.id
                        ? "border-blue-500 bg-neutral-800/80 ring-2 ring-blue-500/20"
                        : "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700"
                    }`}
                  >
                    <div className={`w-full h-8 rounded-md mb-2 ${t.color}`} />
                    <p className="text-xs font-semibold text-white">{t.name}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Filter Categories</h3>
              <div className="flex flex-wrap gap-2">
                {siteConfig.categories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-950 border border-neutral-800 rounded-full text-xs text-neutral-200"
                  >
                    {cat}
                    <button
                      type="button"
                      onClick={() => removeCategory(cat)}
                      className="text-neutral-500 hover:text-red-400 transition"
                    >
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 max-w-sm">
                <input
                  type="text"
                  placeholder="New category..."
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
                  className="flex-1 px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white focus:outline-none focus:border-neutral-600"
                />
                <button
                  type="button"
                  onClick={addCategory}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Plus size={13} /> Add
                </button>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-neutral-800">
              {settingsSuccess && (
                <span className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Settings Saved!
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
              >
                {savingSettings ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </section>
        )}
      </main>

      {/* ----------------- DELETE ALBUM CONFIRMATION DIALOG ----------------- */}
      {albumToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !isDeletingAlbum && setAlbumToDelete(null)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-red-950/60 border border-red-800/80 text-red-400 rounded-xl shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Delete Album</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Are you sure you want to permanently delete{" "}
                  <span className="text-white font-semibold">"{albumToDelete.title}"</span>?
                  This removes the album from the public directory.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAlbumToDelete(null)}
                disabled={isDeletingAlbum}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                disabled={isDeletingAlbum}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              >
                {isDeletingAlbum && <Loader2 size={13} className="animate-spin" />}
                {isDeletingAlbum ? "Deleting..." : "Delete Album"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
