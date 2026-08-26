"use client";

import { useState, useMemo, useEffect } from "react";
import { authenticateAdmin, getDirectUploadUrl, publishAlbumManifest } from "./actions";
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
} from "lucide-react";
import Link from "next/link";

interface AlbumSummary {
  id: string;
  title: string;
  date: string;
  photo_count: number;
  cover_url: string;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [existingAlbums, setExistingAlbums] = useState<AlbumSummary[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [photos, setPhotos] = useState<ProcessedPhoto[]>([]);
  const [coverPhotoUid, setCoverPhotoUid] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [isDone, setIsDone] = useState(false);

  // Load existing albums whenever authenticated or after publishing
  useEffect(() => {
    if (isAuthenticated) {
      const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");
      if (baseUrl) {
        fetch(`${baseUrl}/albums.json`, { cache: "no-store" })
          .then((res) => (res.ok ? res.json() : []))
          .then((data) => setExistingAlbums(data))
          .catch(() => setExistingAlbums([]));
      }
    }
  }, [isAuthenticated, isDone]);

  // Duplicate detection
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Lock size={18} className="text-blue-500" /> Admin Studio
          </div>
          <p className="text-xs text-neutral-400">Enter your master password to manage albums.</p>
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
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12 max-w-6xl mx-auto space-y-10">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Studio</h1>
          <p className="text-xs text-neutral-400">Manage published games or create new albums.</p>
        </div>
        <Link href="/" className="text-xs text-neutral-400 hover:text-white flex items-center gap-1">
          <ArrowLeft size={14} /> Exit Admin
        </Link>
      </div>

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
                      <Calendar size={11} /> {a.date}
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

      {/* Section 2: Upload New Album */}
      <section className="space-y-6 pt-4 border-t border-neutral-900">
        <h2 className="text-sm font-bold text-neutral-300">Create New Game Album</h2>

        {/* Album Metadata Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
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
              <span className="text-xs text-neutral-500">Gold star marks the cover shot</span>
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

            {/* Publish Actions */}
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
    </main>
  );
}
