"use client";

import { useState, useMemo, useEffect } from "react";
import {
  authenticateAdmin,
  getDirectUploadUrl,
  publishAlbumManifest,
  getSiteConfig,
  saveSiteConfig,
} from "./actions";
import { processImageInBrowser, ProcessedPhoto } from "@/lib/clientImageProcessor";
import {
  Upload,
  Star,
  Trash2,
  CheckCircle2,
  Lock,
  Loader2,
  ArrowLeft,
  AlertTriangle,
  Edit3,
  Calendar,
  Images,
  Palette,
  FolderPlus,
  Save,
  Tag,
} from "lucide-react";
import Link from "next/link";

interface AlbumSummary {
  id: string;
  title: string;
  date: string;
  photo_count: number;
  cover_url: string;
  category?: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState<"albums" | "settings">("albums");

  // Album state
  const [existingAlbums, setExistingAlbums] = useState<AlbumSummary[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [category, setCategory] = useState("School Sports");
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([]);
  const [coverPhotoUid, setCoverPhotoUid] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [isDone, setIsDone] = useState(false);

  // Site Config state
  const [badgeText, setBadgeText] = useState("Corvian Sports & Action");
  const [heroHeadline, setHeroHeadline] = useState("Game Day Highlights");
  const [heroDescription, setHeroDescription] = useState("Browse recent game albums and download high-resolution photos.");
  const [themePreset, setThemePreset] = useState("slate-glow");
  const [categoriesStr, setCategoriesStr] = useState("School Sports, Travel Teams, Other Activities");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSuccess, setConfigSuccess] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");
      if (baseUrl) {
        fetch(`${baseUrl}/albums.json`, { cache: "no-store" })
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => setExistingAlbums(data))
          .catch(() => setExistingAlbums([]));
      }

      getSiteConfig().then((cfg) => {
        if (cfg) {
          setBadgeText(cfg.badge_text || "");
          setHeroHeadline(cfg.hero_headline || "");
          setHeroDescription(cfg.hero_description || "");
          setThemePreset(cfg.theme_preset || "slate-glow");
          setCategoriesStr((cfg.categories || ["School Sports", "Travel Teams", "Other Activities"]).join(", "));
        }
      });
    }
  }, [isAuthenticated, isDone]);

  const categoryList = useMemo(() => {
    return categoriesStr
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }, [categoriesStr]);

  const duplicateUids = useMemo(() => {
    const counts = new Map<string, string[]>();
    photos.forEach((p) => {
      const existing = counts.get(p.fingerprint) || [];
      counts.set(p.fingerprint, [...existing, p.uid]);
    });

    const dupes = new Set<string>();
    counts.forEach((uids) => {
      if (uids.length > 1) {
        uids.slice(1).forEach((id) => dupes.add(id));
      }
    });
    return dupes;
  }, [photos]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await authenticateAdmin(password);
    if (res.success) {
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError(res.error || "Access Denied");
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);
    setUploadProgress("Analyzing photos & metadata...");

    const processed: ProcessedPhoto[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith("image/")) {
        const item = await processImageInBrowser(files[i]);
        processed.push(item);
      }
    }

    setPhotos((prev) => {
      const next = [...prev, ...processed];
      if (!coverPhotoUid && next.length > 0) {
        setCoverPhotoUid(next[0].uid);
      }
      return next;
    });

    setIsProcessing(false);
    setUploadProgress("");
  };

  const removeAllDuplicates = () => {
    setPhotos((prev) => prev.filter((p) => !duplicateUids.has(p.uid)));
  };

  const handlePublish = async () => {
    if (!title.trim()) return alert("Please enter an Album Title.");
    if (photos.length === 0) return alert("Please add at least one photo.");

    setIsProcessing(true);
    const slug = `${date}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");

    try {
      const uploadedPhotosList = [];
      let finalCoverUrl = "";

      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const photoId = `${slug}_${String(i + 1).padStart(3, "0")}`;
        setUploadProgress(`Uploading photo ${i + 1} of ${photos.length}...`);

        const thumbKey = `${slug}/thumb/${photoId}.webp`;
        const displayKey = `${slug}/display/${photoId}.webp`;
        const origExt = p.originalName.substring(p.originalName.lastIndexOf("."));
        const origKey = `${slug}/original/${photoId}${origExt}`;

        const [thumbUrl, displayUrl, origUrl] = await Promise.all([
          getDirectUploadUrl(thumbKey, "image/webp"),
          getDirectUploadUrl(displayKey, "image/webp"),
          getDirectUploadUrl(origKey, p.file.type),
        ]);

        await Promise.all([
          fetch(thumbUrl, { method: "PUT", body: p.thumbBlob, headers: { "Content-Type": "image/webp" } }),
          fetch(displayUrl, { method: "PUT", body: p.displayBlob, headers: { "Content-Type": "image/webp" } }),
          fetch(origUrl, { method: "PUT", body: p.file, headers: { "Content-Type": p.file.type } }),
        ]);

        const photoThumbPublicUrl = `${baseUrl}/${thumbKey}`;
        if (p.uid === coverPhotoUid || (!finalCoverUrl && i === 0)) {
          finalCoverUrl = photoThumbPublicUrl;
        }

        uploadedPhotosList.push({
          id: photoId,
          original_filename: p.originalName,
          width: p.width,
          height: p.height,
          aspect_ratio: p.aspectRatio,
          urls: {
            thumb: photoThumbPublicUrl,
            display: `${baseUrl}/${displayKey}`,
            original: `${baseUrl}/${origKey}`,
          },
          metadata: p.metadata,
        });
      }

      setUploadProgress("Finalizing album manifest...");

      await publishAlbumManifest({
        album_id: slug,
        title,
        date,
        category,
        photos: uploadedPhotosList,
        cover_url: finalCoverUrl,
      });

      setIsDone(true);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setUploadProgress("");
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingConfig(true);
    setConfigSuccess(false);

    try {
      await saveSiteConfig({
        site_title: "Sports Photo Gallery",
        badge_text: badgeText,
        hero_headline: heroHeadline,
        hero_description: heroDescription,
        theme_preset: themePreset,
        categories: categoryList,
      });
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Lock size={18} className="text-blue-500" /> Admin Studio
          </div>
          <p className="text-xs text-neutral-400">Enter your master password to manage albums and design settings.</p>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
          />
          {authError && <p className="text-xs text-red-400">{authError}</p>}
          <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition">
            Unlock Studio
          </button>
        </form>
      </div>
    );
  }

  if (isDone) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 text-center space-y-4">
        <CheckCircle2 size={48} className="text-emerald-500" />
        <h1 className="text-2xl font-bold text-white">Album Published!</h1>
        <p className="text-neutral-400 text-sm">Your game has been processed, uploaded to R2, and indexed.</p>
        <div className="flex gap-4">
          <button
            onClick={() => {
              setIsDone(false);
              setPhotos([]);
              setTitle("");
              setCoverPhotoUid(null);
            }}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm"
          >
            Upload Another
          </button>
          <Link href="/" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold">
            View Live Gallery
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12 max-w-6xl mx-auto space-y-8">
      {/* Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Studio</h1>
          <p className="text-xs text-neutral-400">Manage albums, categories, and homepage styling.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800">
            <button
              onClick={() => setActiveTab("albums")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "albums" ? "bg-blue-600 text-white shadow-sm" : "text-neutral-400 hover:text-white"
              }`}
            >
              <FolderPlus size={14} /> Albums & Uploads
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "settings" ? "bg-blue-600 text-white shadow-sm" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Palette size={14} /> Site Design & Categories
            </button>
          </div>

          <Link href="/" className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 pl-2">
            <ArrowLeft size={14} /> Exit
          </Link>
        </div>
      </div>

      {/* TAB 1: ALBUMS & UPLOADS */}
      {activeTab === "albums" && (
        <div className="space-y-10">
          {/* Section 1: Manage Existing Albums */}
          {existingAlbums.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-neutral-300">Published Albums ({existingAlbums.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {existingAlbums.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 transition"
                  >
                    <div className="truncate pr-3 space-y-0.5">
                      <p className="text-xs font-semibold text-white truncate">{a.title}</p>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Tag size={10} className="text-blue-400" /> {a.category || "School Sports"}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Images size={11} /> {a.photo_count}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/admin/edit/${a.id}`}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition shrink-0"
                    >
                      <Edit3 size={13} /> Edit
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 2: Create New Game Album */}
          <section className="space-y-6 pt-4 border-t border-neutral-900">
            <h2 className="text-sm font-bold text-neutral-300">Create New Game Album</h2>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-xs font-semibold text-neutral-300">Album Title</label>
                <input
                  type="text"
                  placeholder="e.g. Corvian vs Pine Lake Prep"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-300">Category / Page</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
                >
                  {categoryList.map((cat) => (
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
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
                />
              </div>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
              className="border-2 border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-900/50 rounded-2xl p-8 text-center transition flex flex-col items-center justify-center gap-3 cursor-pointer"
              onClick={() => document.getElementById("photo-input")?.click()}
            >
              <Upload size={32} className="text-neutral-500" />
              <div>
                <p className="text-sm font-semibold text-white">Drag & drop game photos here, or click to browse</p>
                <p className="text-xs text-neutral-500 mt-1">Accepts standard JPEG & PNG exports</p>
              </div>
              <input
                id="photo-input"
                type="file"
                multiple
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>

            {/* Duplicate Banner */}
            {duplicateUids.size > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl gap-3">
                <div className="flex items-center gap-2.5 text-amber-300 text-sm">
                  <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                  <span>
                    Found <strong>{duplicateUids.size}</strong> duplicate photo{duplicateUids.size > 1 ? "s" : ""}.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeAllDuplicates}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-lg transition"
                >
                  Remove All Duplicates
                </button>
              </div>
            )}

            {/* Selected Photos Grid */}
            {photos.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-neutral-300">Selected Photos ({photos.length})</h3>
                  <span className="text-xs text-neutral-500">Gold star marks cover shot</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {photos.map((p) => {
                    const isCover = coverPhotoUid === p.uid;
                    const isDuplicate = duplicateUids.has(p.uid);

                    return (
                      <div
                        key={p.uid}
                        className={`group relative rounded-xl overflow-hidden border ${
                          isCover
                            ? "border-amber-500 ring-2 ring-amber-500/40"
                            : isDuplicate
                            ? "border-red-500/60 ring-1 ring-red-500/30"
                            : "border-neutral-800"
                        } bg-neutral-900 flex flex-col justify-between`}
                      >
                        <div className="relative aspect-4/3 w-full bg-neutral-950 overflow-hidden">
                          <img src={p.previewUrl} alt={p.originalName} className="w-full h-full object-cover" />

                          <button
                            type="button"
                            onClick={() => setCoverPhotoUid(p.uid)}
                            className={`absolute top-2 left-2 p-1.5 rounded-lg backdrop-blur-md transition ${
                              isCover ? "bg-amber-500 text-black" : "bg-black/60 text-neutral-400 hover:text-white"
                            }`}
                            title={isCover ? "Cover Photo" : "Set as Cover"}
                          >
                            <Star size={13} fill={isCover ? "currentColor" : "none"} />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const updated = photos.filter((x) => x.uid !== p.uid);
                              setPhotos(updated);
                              if (isCover && updated.length > 0) {
                                setCoverPhotoUid(updated[0].uid);
                              }
                            }}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-neutral-400 hover:text-red-400 backdrop-blur-md opacity-0 group-hover:opacity-100 transition"
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>

                          {isDuplicate && (
                            <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-red-500/90 text-[10px] font-semibold text-white">
                              Duplicate
                            </div>
                          )}
                        </div>

                        <div className="p-2 text-[11px] text-neutral-400 truncate border-t border-neutral-800/60">
                          {p.originalName}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 flex items-center justify-end gap-4 border-t border-neutral-800">
                  {uploadProgress && (
                    <span className="text-xs text-neutral-400 flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-blue-500" />
                      {uploadProgress}
                    </span>
                  )}
                  <button
                    onClick={handlePublish}
                    disabled={isProcessing}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
                  >
                    {isProcessing ? "Uploading to Cloud..." : "Publish Album"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: SITE DESIGN & CATEGORIES */}
      {activeTab === "settings" && (
        <div className="space-y-8 max-w-3xl">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">Homepage Content & Design Settings</h2>
            <p className="text-xs text-neutral-400">Edit text fields, add categories/pages, and choose ambient background themes.</p>
          </div>

          <div className="space-y-6 bg-neutral-900/60 border border-neutral-800 p-6 rounded-2xl">
            {/* Badge Pill Text */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Top Pill Badge Text</label>
              <input
                type="text"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
              />
            </div>

            {/* Main Headline */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Hero Headline</label>
              <input
                type="text"
                value={heroHeadline}
                onChange={(e) => setHeroHeadline(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
              />
            </div>

            {/* Subheadline Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Hero Subtitle Description</label>
              <textarea
                rows={3}
                value={heroDescription}
                onChange={(e) => setHeroDescription(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
              />
            </div>

            {/* Categories / Pages List */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">Categories / Navigation Pages</label>
              <p className="text-[11px] text-neutral-500">Comma-separated list of categories shown on the homepage filter tabs.</p>
              <input
                type="text"
                value={categoriesStr}
                onChange={(e) => setCategoriesStr(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
              />
            </div>

            {/* Visual Theme Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-300">Background Aesthetic Theme</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: "slate-glow", name: "Slate Glow", color: "bg-blue-600/30" },
                  { id: "midnight-sports", name: "Midnight Sports", color: "bg-sky-600/30" },
                  { id: "deep-emerald", name: "Deep Emerald", color: "bg-emerald-600/30" },
                  { id: "carbon-minimal", name: "Carbon Minimal", color: "bg-neutral-600/30" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setThemePreset(t.id)}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 ${
                      themePreset === t.id
                        ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/30"
                        : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
                    }`}
                  >
                    <div className={`w-full h-8 rounded-lg ${t.color} border border-white/10`} />
                    <span className="text-xs font-semibold text-white">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Save Settings Bar */}
            <div className="pt-4 flex items-center justify-between border-t border-neutral-800">
              {configSuccess ? (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Settings Saved!
                </span>
              ) : (
                <span className="text-xs text-neutral-500">Changes update the public site immediately.</span>
              )}

              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={isSavingConfig}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition shadow-md"
              >
                <Save size={15} />
                {isSavingConfig ? "Saving Settings..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
