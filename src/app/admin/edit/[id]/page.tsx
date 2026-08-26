"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  updateExistingAlbum,
  deletePhotoFromR2,
  getDirectUploadUrl,
} from "@/app/admin/actions";
import { processImageInBrowser, ProcessedPhoto } from "@/lib/clientImageProcessor";
import { Star, Trash2, ArrowLeft, Loader2, Upload, Save, CheckCircle2 } from "lucide-react";

export default function EditAlbumPage() {
  const params = useParams();
  const router = useRouter();

  const rawId = params?.id;
  const albumId = Array.isArray(rawId) ? rawId[0] : (rawId as string) || "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("School Sports");
  const [availableCategories, setAvailableCategories] = useState<string[]>([
    "School Sports",
    "Travel Teams",
    "Other Activities",
  ]);
  const [existingPhotos, setExistingPhotos] = useState<any[]>([]);
  const [newPhotos, setNewPhotos] = useState<ProcessedPhoto[]>([]);
  const [coverUrl, setCoverUrl] = useState("");
  const [deletedPhotoKeys, setDeletedPhotoKeys] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!albumId) return;

    async function loadData() {
      setLoading(true);
      setLoadError("");
      const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");

      try {
        const [albumRes, configRes] = await Promise.all([
          fetch(`${baseUrl}/${decodeURIComponent(albumId)}/manifest.json`, { cache: "no-store" }),
          fetch(`${baseUrl}/site_config.json`, { cache: "no-store" }),
        ]);

        if (!albumRes.ok) {
          throw new Error(`Failed to load album (HTTP ${albumRes.status})`);
        }

        const albumData = await albumRes.json();
        setTitle(albumData.title || "");
        setDate(albumData.date || "");
        setCategory(albumData.category || "School Sports");
        setExistingPhotos(albumData.photos || []);
        setCoverUrl(albumData.cover_url || albumData.photos?.[0]?.urls?.thumb || "");

        if (configRes.ok) {
          const configData = await configRes.json();
          if (Array.isArray(configData.categories) && configData.categories.length > 0) {
            setAvailableCategories(configData.categories);
          }
        }
      } catch (err: any) {
        console.error("Error loading album:", err);
        setLoadError(err.message || "Failed to load album manifest.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [albumId]);

  const handleNewFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSaveStatus("Reading new photos...");
    const processed: ProcessedPhoto[] = [];
    for (let i = 0; i < files.length; i++) {
      if (files[i].type.startsWith("image/")) {
        const item = await processImageInBrowser(files[i]);
        processed.push(item);
      }
    }
    setNewPhotos((prev) => [...prev, ...processed]);
    setSaveStatus("");
  };

  const removeExistingPhoto = (photo: any) => {
    const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "") || "";
    const thumbKey = photo.urls.thumb.replace(`${baseUrl}/`, "");
    const displayKey = photo.urls.display.replace(`${baseUrl}/`, "");
    const origKey = photo.urls.original.replace(`${baseUrl}/`, "");

    setDeletedPhotoKeys((prev) => [...prev, thumbKey, displayKey, origKey]);
    const updated = existingPhotos.filter((p) => p.id !== photo.id);
    setExistingPhotos(updated);

    if (coverUrl === photo.urls.thumb && updated.length > 0) {
      setCoverUrl(updated[0].urls.thumb);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return alert("Album Title cannot be empty.");
    setIsSaving(true);
    const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");

    try {
      if (deletedPhotoKeys.length > 0) {
        setSaveStatus("Removing deleted photos from storage...");
        await deletePhotoFromR2(deletedPhotoKeys);
      }

      const newlyUploadedList: any[] = [];
      for (let i = 0; i < newPhotos.length; i++) {
        const p = newPhotos[i];
        const nextIndex = existingPhotos.length + i + 1;
        const photoId = `${albumId}_${String(nextIndex).padStart(3, "0")}`;
        setSaveStatus(`Uploading new photo ${i + 1} of ${newPhotos.length}...`);

        const thumbKey = `${albumId}/thumb/${photoId}.webp`;
        const displayKey = `${albumId}/display/${photoId}.webp`;
        const origExt = p.originalName.substring(p.originalName.lastIndexOf("."));
        const origKey = `${albumId}/original/${photoId}${origExt}`;

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

        newlyUploadedList.push({
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

      setSaveStatus("Saving changes...");
      const finalPhotosList = [...existingPhotos, ...newlyUploadedList];
      const finalCoverUrl = coverUrl || finalPhotosList[0]?.urls?.thumb || "";

      await updateExistingAlbum({
        album_id: albumId,
        title,
        date,
        category,
        photos: finalPhotosList,
        cover_url: finalCoverUrl,
      });

      setSaveSuccess(true);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
      setSaveStatus("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm text-neutral-400">Loading album details...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 text-center space-y-4">
        <p className="text-red-400 text-sm font-semibold">{loadError}</p>
        <Link href="/admin" className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs">
          Back to Admin Studio
        </Link>
      </div>
    );
  }

  if (saveSuccess) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 text-center space-y-4">
        <CheckCircle2 size={48} className="text-emerald-500" />
        <h1 className="text-2xl font-bold text-white">Album Updated!</h1>
        <p className="text-neutral-400 text-sm">Category and album details saved successfully.</p>
        <div className="flex gap-4">
          <Link href="/admin" className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm">
            Back to Admin
          </Link>
          <Link href={`/album/${albumId}`} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold">
            View Live Album
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Edit Album</h1>
          <p className="text-xs text-neutral-400">ID: {albumId}</p>
        </div>
        <Link href="/admin" className="text-xs text-neutral-400 hover:text-white flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Studio
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">Album Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-300">Category / Parent Folder</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white text-sm focus:outline-none focus:border-neutral-600"
          >
            {availableCategories.map((cat) => (
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

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleNewFiles(e.dataTransfer.files);
        }}
        className="border-2 border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-900/40 rounded-xl p-6 text-center transition flex flex-col items-center justify-center gap-2 cursor-pointer"
        onClick={() => document.getElementById("add-photos-input")?.click()}
      >
        <Upload size={24} className="text-neutral-500" />
        <p className="text-xs font-semibold text-neutral-300">Add more photos to this album</p>
        <input
          id="add-photos-input"
          type="file"
          multiple
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => handleNewFiles(e.target.files)}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-300">
            Photos ({existingPhotos.length + newPhotos.length})
          </h2>
          <span className="text-xs text-neutral-500">Gold star marks the current cover</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {existingPhotos.map((photo) => {
            const isCover = coverUrl === photo.urls.thumb;
            return (
              <div
                key={photo.id}
                className={`group relative rounded-xl overflow-hidden border ${
                  isCover ? "border-amber-500 ring-2 ring-amber-500/40" : "border-neutral-800"
                } bg-neutral-900 aspect-4/3`}
              >
                <img src={photo.urls.thumb} alt={photo.original_filename} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCoverUrl(photo.urls.thumb)}
                  className={`absolute top-2 left-2 p-1.5 rounded-lg backdrop-blur-md transition ${
                    isCover ? "bg-amber-500 text-black" : "bg-black/60 text-neutral-400 hover:text-white"
                  }`}
                  title="Set as Cover"
                >
                  <Star size={13} fill={isCover ? "currentColor" : "none"} />
                </button>
                <button
                  type="button"
                  onClick={() => removeExistingPhoto(photo)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-neutral-400 hover:text-red-400 backdrop-blur-md opacity-0 group-hover:opacity-100 transition"
                  title="Delete from Album"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}

          {newPhotos.map((p) => (
            <div key={p.uid} className="relative rounded-xl overflow-hidden border border-blue-500/50 bg-neutral-900 aspect-4/3">
              <img src={p.previewUrl} alt={p.originalName} className="w-full h-full object-cover" />
              <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-blue-600/90 text-[10px] font-semibold text-white backdrop-blur-sm">
                New
              </div>
              <button
                type="button"
                onClick={() => setNewPhotos(newPhotos.filter((x) => x.uid !== p.uid))}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-neutral-400 hover:text-red-400 backdrop-blur-md transition"
                title="Cancel Add"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="pt-6 flex items-center justify-end gap-4 border-t border-neutral-800">
          {saveStatus && (
            <span className="text-xs text-neutral-400 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-blue-500" />
              {saveStatus}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
          >
            <Save size={15} />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </main>
  );
}
