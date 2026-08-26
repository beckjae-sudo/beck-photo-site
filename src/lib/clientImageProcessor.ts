import exifr from "exifr";

export interface ProcessedPhoto {
  uid: string;
  fingerprint: string; // size + lastModified + name
  file: File;
  previewUrl: string;
  originalName: string;
  width: number;
  height: number;
  aspectRatio: number;
  metadata: Record<string, string>;
  thumbBlob: Blob;
  displayBlob: Blob;
}

export async function processImageInBrowser(file: File): Promise<ProcessedPhoto> {
  const exif = await exifr.parse(file, [
    "Make",
    "Model",
    "ExposureTime",
    "FNumber",
    "ISO",
    "FocalLength",
    "DateTimeOriginal",
  ]);

  const metadata: Record<string, string> = {};
  if (exif?.Model) metadata.camera_model = String(exif.Model);
  if (exif?.ExposureTime) metadata.shutter_speed = String(exif.ExposureTime);
  if (exif?.FNumber) metadata.f_stop = `f/${exif.FNumber}`;
  if (exif?.ISO) metadata.iso = String(exif.ISO);
  if (exif?.FocalLength) metadata.focal_length = `${exif.FocalLength}mm`;

  const imgBitmap = await createImageBitmap(file);
  const origW = imgBitmap.width;
  const origH = imgBitmap.height;

  const resizeToBlob = (maxDim: number, quality: number): Promise<Blob> => {
    return new Promise((resolve) => {
      let w = origW;
      let h = origH;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(imgBitmap, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(blob!), "image/webp", quality);
    });
  };

  const [thumbBlob, displayBlob] = await Promise.all([
    resizeToBlob(800, 0.75),
    resizeToBlob(2048, 0.85),
  ]);

  return {
    uid: crypto.randomUUID(),
    fingerprint: `${file.name}-${file.size}-${file.lastModified}`,
    file,
    previewUrl: URL.createObjectURL(thumbBlob),
    originalName: file.name,
    width: origW,
    height: origH,
    aspectRatio: Number((origW / origH).toFixed(3)),
    metadata,
    thumbBlob,
    displayBlob,
  };
}
