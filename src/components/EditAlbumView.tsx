"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Star,
  Plus,
  Loader2,
  Save,
  AlertCircle,
  GripVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  getDirectUploadUrl,
  updateExistingAlbum,
  deletePhotoFromR2,
} from "@/app/admin/actions";

interface Photo {
  id: string;
  original_filename: string;
  width: number;
  height: number;
  aspect_ratio: number;
  urls: {
    thumb: string;
    display: string;
    original: string;
  };
  metadata?: any;
}

interface AlbumData {
  album_id: string;
  title: string;
  date: string;
  category?: string;
  cover_url: string;
  photos: Photo[];
}

interface ProcessedFile {
  uid: string;
  file: File;
  thumbBlob: Blob;
  displayBlob: Blob;
  width: number;
  height: number;
  aspectRatio: number;
  previewUrl: string;
  originalName: string;
  timestamp: number;
  metadata: any;
}

/**
 * Fast in-browser convolution filter for micro-contrast & edge sharpness.
 * Replicates Google Photos / Lightroom downsampling crispness on sports photos.
 */
function applySharpen(ctx: CanvasRenderingContext2D, width: number, height: number, amount = 0.18) {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const buff = new Uint8ClampedArray(data);

    // 3x3 Sharpen Kernel
    const kCenter = 1 + 4 * amount;
    const kEdge = -amount;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const res =
            buff[i + c] * kCenter +
            buff[i - 4 + c] * kEdge +
            buff[i + 4 + c] * kEdge +
            buff[i - width * 4 + c] * kEdge +
            buff[i + width * 4 + c] * kEdge;
          data[i + c] = res < 0 ? 0 : res > 255 ? 255 : res;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Graceful fallback if cross-origin or memory limits occur
  }
}

export default function EditAlbumView() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id;

  // Support single-level and nested catch-all subfolder routing
  const albumId = Array.isArray(rawId)
    ? rawId.map((segment) => decodeURIComponent(segment)).join("/")
    : decodeURIComponent((rawId as string) || "");

  const [album, setAlbum] = useState<AlbumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("School Sports");
  const [coverUrl, setCoverUrl] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [newPhotos, setNewPhotos] = useState<ProcessedFile[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<Photo[]>([]);

  // Drag and drop state for sequence reordering
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!albumId) return;

    async function loadAlbum() {
      setLoading(true);
      setErrorMessage(null);

      const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");
      if (!baseUrl) {
        setErrorMessage("NEXT_PUBLIC_R2_BASE_URL is not defined.");
        setLoading(false);
        return;
      }

      try {
        const encodedPath = albumId
          .split("/")
          .map((segment) => encodeURIComponent(segment))
          .join("/");

        const res = await fetch(`${baseUrl}/${encodedPath}/manifest.json`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: Album not found.`);
        const data: AlbumData = await res.json();

        setAlbum(data);
        setTitle(data.title || "");
        setDate(data.date || "");
        setCategory(data.category || "School Sports");
        setCoverUrl(data.cover_url || data.photos?.[0]?.urls?.thumb || "");
        setPhotos(data.photos || []);
      } catch (err: any) {
        setErrorMessage(err.message || "Failed to load album.");
      } finally {
        setLoading(false);
      }
    }

    loadAlbum();
  }, [albumId]);

  // Reorder Handlers for Drag and Drop
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }

    setPhotos((prev) => {
      const updated = [...prev];
      const [movedItem] = updated.splice(draggedIdx, 1);
      updated.splice(targetIndex, 0, movedItem);
      return updated;
    });

    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const movePhotoStep = (fromIndex: number, direction: "left" | "right") => {
    const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= photos.length) return;

    setPhotos((prev) => {
      const updated = [...prev];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);
      return updated;
    });
  };

  /**
   * Retina-Grade Ingestion Pipeline (Step-down scaling + High-precision Lanczos-like smoothing + Edge unsharp)
   */
  const processImage = async (file: File): Promise<ProcessedFile> => {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        const aspectRatio = Number((width / height).toFixed(4));

        // 1. Calculate Retina 3K Display Dimensions (Max 2880px for true High-DPI screens)
        const maxDisplay = 2880;
        let dWidth = width;
        let dHeight = height;
        if (dWidth > maxDisplay || dHeight > maxDisplay) {
          if (dWidth > dHeight) {
            dHeight = Math.round((dHeight * maxDisplay) / dWidth);
            dWidth = maxDisplay;
          } else {
            dWidth = Math.round((dWidth * maxDisplay) / dHeight);
            dHeight = maxDisplay;
          }
        }

        // Render Display Version with High Quality Filtering
        const displayCanvas = document.createElement("canvas");
        displayCanvas.width = dWidth;
        displayCanvas.height = dHeight;
        const dCtx = displayCanvas.getContext("2d", { willReadFrequently: true });

        if (dCtx) {
          dCtx.imageSmoothingEnabled = true;
          dCtx.imageSmoothingQuality = "high";

          // Step-down pass if scaling down by more than 2x to avoid pixel skipping
          if (width > dWidth * 2) {
            const stepCanvas = document.createElement("canvas");
            stepCanvas.width = Math.round(width / 2);
            stepCanvas.height = Math.round(height / 2);
            const sCtx = stepCanvas.getContext("2d");
            if (sCtx) {
              sCtx.imageSmoothingEnabled = true;
              sCtx.imageSmoothingQuality = "high";
              sCtx.drawImage(img, 0, 0, stepCanvas.width, stepCanvas.height);
              dCtx.drawImage(stepCanvas, 0, 0, dWidth, dHeight);
            } else {
              dCtx.drawImage(img, 0, 0, dWidth, dHeight);
            }
          } else {
            dCtx.drawImage(img, 0, 0, dWidth, dHeight);
          }

          // Apply micro-contrast sharpening
          applySharpen(dCtx, dWidth, dHeight, 0.16);
        }

        displayCanvas.toBlob(
          (displayBlob) => {
            // 2. Render Thumbnail Version (Max 800px)
            const maxThumb = 800;
            let tWidth = width;
            let tHeight = height;
            if (tWidth > maxThumb || tHeight > maxThumb) {
              if (tWidth > tHeight) {
                tHeight = Math.round((tHeight * maxThumb) / tWidth);
                tWidth = maxThumb;
              } else {
                tWidth = Math.round((tWidth * maxThumb) / tHeight);
                tHeight = maxThumb;
              }
            }

            const thumbCanvas = document.createElement("canvas");
            thumbCanvas.width = tWidth;
            thumbCanvas.height = tHeight;
            const tCtx = thumbCanvas.getContext("2d", { willReadFrequently: true });

            if (tCtx) {
              tCtx.imageSmoothingEnabled = true;
              tCtx.imageSmoothingQuality = "high";
              tCtx.drawImage(displayCanvas, 0, 0, tWidth, tHeight);
              applySharpen(tCtx, tWidth, tHeight, 0.2);
            }

            thumbCanvas.toBlob(
              (thumbBlob) => {
                resolve({
                  uid: Math.random().toString(36).substring(2, 9),
                  file,
                  thumbBlob: thumbBlob!,
                  displayBlob: displayBlob!,
                  width,
                  height,
                  aspectRatio,
                  previewUrl: objectUrl,
                  originalName: file.name,
                  timestamp: file.lastModified || Date.now(),
                  metadata: {
                    lastModified: file.lastModified,
                  },
                });
              },
              "image/webp",
              0.88
            );
          },
          "image/webp",
          0.92
        );
      };

      img.src = objectUrl;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const processed: ProcessedFile[] = [];

    for (const f of files) {
      const p = await processImage(f);
      processed.push(p);
    }

    // Auto-sort new batch chronologically by file timestamp
    processed.sort((a, b) => a.timestamp - b.timestamp);

    setNewPhotos((prev) => [...prev, ...processed]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleMarkPhotoForDeletion = (photo: Photo) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setPhotosToDelete((prev) => [...prev, photo]);
    if (coverUrl === photo.urls.thumb) {
      const remaining = photos.filter((p) => p.id !== photo.id);
      setCoverUrl(remaining[0]?.urls?.thumb || "");
    }
  };

  const handleSaveAllChanges = async () => {
    if (!album) return;
    setIsSaving(true);

    const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");

    try {
      // 1. Upload newly added photos if any exist
      const newlyUploadedPhotosData: Photo[] = [];
      const currentCount = photos.length;

      for (let i = 0; i < newPhotos.length; i++) {
        const p = newPhotos[i];
        const photoIndex = currentCount + i + 1;
        const photoId = `${album.album_id}_${String(photoIndex).padStart(3, "0")}`;
        setUploadProgressText(`Uploading high-res photo ${i + 1} of ${newPhotos.length}...`);

        const thumbKey = `${album.album_id}/thumb/${photoId}.webp`;
        const displayKey = `${album.album_id}/display/${photoId}.webp`;
        const origExt = p.originalName.substring(p.originalName.lastIndexOf("."));
        const origKey = `${album.album_id}/original/${photoId}${origExt}`;

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

        newlyUploadedPhotosData.push({
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

      // 2. Delete queued photos from R2 storage
      if (photosToDelete.length > 0) {
        setUploadProgressText("Cleaning up deleted photos from storage...");
        const keysToDelete: string[] = [];
        for (const p of photosToDelete) {
          const thumbKey = p.urls.thumb.replace(`${baseUrl}/`, "");
          const displayKey = p.urls.display.replace(`${baseUrl}/`, "");
          const origKey = p.urls.original.replace(`${baseUrl}/`, "");
          keysToDelete.push(thumbKey, displayKey, origKey);
        }
        await deletePhotoFromR2(keysToDelete);
      }

      setUploadProgressText("Saving updated album manifest...");

      // The new photos array preserves the user-defined drag-and-drop order
      const allPhotos = [...photos, ...newlyUploadedPhotosData];
      const finalCoverUrl = coverUrl || allPhotos[0]?.urls?.thumb || "";

      const updatedAlbum: AlbumData = {
        album_id: album.album_id,
        title,
        date,
        category,
        cover_url: finalCoverUrl,
        photos: allPhotos,
      };

      const res = await updateExistingAlbum(updatedAlbum);
      if (!res.success) throw new Error(res.error || "Failed to update album metadata");

      alert("Album sequence and details successfully updated!");
      router.push("/admin");
    } catch (err: any) {
      const msg = typeof err === "string" ? err : err?.message || JSON.stringify(err);
      alert(`Save failed: ${msg}`);
    } finally {
      setIsSaving(false);
      setUploadProgressText("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white gap-3">
        <Loader2 size={32} className="animate-spin text-blue-500" />
        <p className="text-sm text-neutral-400">Loading album editor...</p>
      </div>
    );
  }

  if (errorMessage || !album) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center space-y-4 text-white max-w-lg mx-auto">
        <AlertCircle size={40} className="text-red-400 mx-auto" />
        <h2 className="text-lg font-bold">Unable to Load Album</h2>
        <p className="text-neutral-400 text-xs font-mono bg-neutral-900 border border-neutral-800 p-3 rounded-lg text-left break-all">
          {errorMessage || "Album manifest not found."}
        </p>
        <Link href="/admin" className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold">
          Return to Admin Studio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-28">
      <header className="sticky top-0 z-40 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/admin" className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition">
            <ArrowLeft size={14} /> Back to Studio
          </Link>
          <div className="flex items-center gap-3">
            {uploadProgressText && (
              <span className="text-xs text-blue-400 animate-pulse font-mono">{uploadProgressText}</span>
            )}
            <button
              onClick={handleSaveAllChanges}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-lg shadow-blue-900/30 transition cursor-pointer"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Edit Album</h1>
          <p className="text-xs font-mono text-neutral-500 mt-1">ID: {album.album_id}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-neutral-900/40 p-5 rounded-xl border border-neutral-800/80">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-medium text-neutral-400">Album Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-neutral-400">Event Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-neutral-800 hover:border-neutral-700 bg-neutral-900/20 hover:bg-neutral-900/40 rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Plus size={24} className="text-neutral-500" />
          <p className="text-sm font-medium text-neutral-300">Add more photos to this album</p>
          <p className="text-xs text-neutral-500">Retina 3K processing and auto-sharpening will be applied</p>
        </div>

        {newPhotos.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
              New Photos Queued ({newPhotos.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {newPhotos.map((p, idx) => (
                <div key={p.uid} className="relative aspect-square rounded-lg overflow-hidden border border-blue-500/40 group">
                  <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setNewPhotos((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1.5 right-1.5 p-1 bg-red-600/80 hover:bg-red-600 text-white rounded-md transition cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Photos Grid with Drag-and-Drop Sequencing */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                Existing Photos ({photos.length})
              </h3>
              <p className="text-[11px] text-neutral-500">
                Drag photos to reorder sequence • Hover to use nudge arrows • Click star to set cover
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {photos.map((photo, idx) => {
              const isCover = coverUrl === photo.urls.thumb;
              const isDragged = draggedIdx === idx;
              const isDragOver = dragOverIdx === idx;

              return (
                <div
                  key={photo.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`group relative aspect-square rounded-lg overflow-hidden bg-neutral-900 border cursor-grab active:cursor-grabbing transition-all ${
                    isCover ? "border-amber-500 ring-2 ring-amber-500/30" : "border-neutral-800 hover:border-neutral-700"
                  } ${isDragged ? "opacity-25 scale-95" : "opacity-100"} ${
                    isDragOver ? "border-blue-500 ring-2 ring-blue-500/60 scale-105" : ""
                  }`}
                >
                  <img
                    src={photo.urls.thumb}
                    alt={photo.original_filename}
                    className="w-full h-full object-cover pointer-events-none select-none"
                  />

                  {/* Sequence Position Badge */}
                  <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md text-[10px] font-mono font-bold text-neutral-200 pointer-events-none">
                    #{idx + 1}
                  </div>

                  {/* Hover Grab Indicator */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    <span className="p-1 rounded-md bg-black/70 text-white backdrop-blur-sm shadow-md">
                      <GripVertical size={14} />
                    </span>
                  </div>

                  {/* Top-Right Controls: Star Cover & Delete */}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverUrl(photo.urls.thumb);
                      }}
                      className={`p-1.5 rounded-md backdrop-blur-md transition cursor-pointer ${
                        isCover ? "bg-amber-500 text-black" : "bg-black/60 text-neutral-400 hover:text-white"
                      }`}
                      title="Set as cover"
                    >
                      <Star size={12} fill={isCover ? "currentColor" : "none"} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkPhotoForDeletion(photo);
                      }}
                      className="p-1.5 rounded-md bg-black/60 text-neutral-400 hover:text-red-400 backdrop-blur-md transition cursor-pointer"
                      title="Delete photo"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {/* Bottom-Right Step Nudge Arrows */}
                  <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition z-10">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        movePhotoStep(idx, "left");
                      }}
                      className="p-1 rounded bg-black/75 hover:bg-neutral-800 disabled:opacity-30 text-white transition cursor-pointer"
                      title="Move photo earlier in sequence"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === photos.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        movePhotoStep(idx, "right");
                      }}
                      className="p-1 rounded bg-black/75 hover:bg-neutral-800 disabled:opacity-30 text-white transition cursor-pointer"
                      title="Move photo later in sequence"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
