"use client";

import { useEffect } from "react";
import Image from "next/image";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";
import { Download, Camera } from "lucide-react";

export interface PhotoItem {
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
  metadata?: {
    camera_model?: string;
    shutter_speed?: string;
    f_stop?: string;
    iso?: string;
    focal_length?: string;
  };
}

interface GalleryProps {
  photos: PhotoItem[];
  galleryId: string;
}

export default function GalleryGrid({ photos, galleryId }: GalleryProps) {
  useEffect(() => {
    let lightbox: PhotoSwipeLightbox | null = new PhotoSwipeLightbox({
      gallery: `#${galleryId}`,
      children: "a.pswp-link",
      pswpModule: () => import("photoswipe"),
      wheelToZoom: true,
      showHideAnimationType: "zoom",
    });
    lightbox.init();

    return () => {
      lightbox?.destroy();
      lightbox = null;
    };
  }, [galleryId]);

  return (
    <div
      id={galleryId}
      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
    >
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="group relative rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800 shadow-sm transition hover:shadow-md"
        >
          {/* Lightbox Link Anchor */}
          <a
            href={photo.urls.display}
            className="pswp-link block w-full h-full"
            data-pswp-width={photo.width}
            data-pswp-height={photo.height}
            target="_blank"
            rel="noreferrer"
          >
            <div className="relative aspect-4/3 w-full overflow-hidden bg-neutral-950">
              <Image
                src={photo.urls.thumb}
                alt={photo.original_filename}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
                unoptimized
              />
            </div>
          </a>

          {/* Quick Action Overlay (Bottom Bar) */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 flex items-center justify-between text-xs text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center space-x-1.5 truncate">
              {photo.metadata?.camera_model && (
                <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                  <Camera size={13} />
                  {photo.metadata.camera_model}
                </span>
              )}
            </div>

            {/* Direct High-Res Download Button */}
            <a
              href={photo.urls.original}
              download={photo.original_filename}
              title="Download Full Resolution Original"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition"
            >
              <Download size={14} />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
