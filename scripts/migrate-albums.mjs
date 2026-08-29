import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import exifr from "exifr";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicBaseUrl = (process.env.NEXT_PUBLIC_R2_BASE_URL || "").replace(/\/$/, "");

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error("❌ Missing required R2 environment variables in .env.local");
  console.error({
    R2_ACCOUNT_ID: Boolean(accountId),
    R2_ACCESS_KEY_ID: Boolean(accessKeyId),
    R2_SECRET_ACCESS_KEY: Boolean(secretAccessKey),
    R2_BUCKET_NAME: Boolean(bucketName),
  });
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function getObjectBuffer(key) {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
    const byteArray = await res.Body.transformToByteArray();
    return Buffer.from(byteArray);
  } catch (err) {
    throw new Error(`Failed to fetch s3://${bucketName}/${key}: ${err.message}`);
  }
}

async function putObject(key, body, contentType, cacheControl = "public, max-age=31536000, immutable") {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
  );
}

async function runMigration() {
  console.log("🚀 Starting R2 Album Sweep & Retina 3K Upgrade...\n");

  // 1. Fetch Master Album Index
  let albums = [];
  try {
    const albumsBuffer = await getObjectBuffer("albums.json");
    albums = JSON.parse(albumsBuffer.toString("utf-8"));
  } catch (err) {
    console.error("❌ Failed to load albums.json from R2:", err.message);
    process.exit(1);
  }

  console.log(`📂 Found ${albums.length} album(s) to inspect.\n`);

  for (let aIdx = 0; aIdx < albums.length; aIdx++) {
    const summary = albums[aIdx];
    const albumId = summary.id;
    const manifestKey = `${albumId}/manifest.json`;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[${aIdx + 1}/${albums.length}] Processing Album: "${summary.title}" (${albumId})`);

    let manifest;
    try {
      const manifestBuffer = await getObjectBuffer(manifestKey);
      manifest = JSON.parse(manifestBuffer.toString("utf-8"));
    } catch (err) {
      console.warn(`⚠️ Could not load manifest for ${albumId}, skipping.`);
      continue;
    }

    const photos = manifest.photos || [];
    console.log(`📸 Found ${photos.length} photo(s) to process.`);

    const upgradedPhotos = [];

    for (let pIdx = 0; pIdx < photos.length; pIdx++) {
      const photo = photos[pIdx];
      const photoId = photo.id;

      // Extract original file path
      const origKey = photo.urls.original.replace(`${publicBaseUrl}/`, "").replace(/^\//, "");
      process.stdout.write(`  ├─ [${pIdx + 1}/${photos.length}] ${photo.original_filename || photoId}... `);

      try {
        const origBuffer = await getObjectBuffer(origKey);

        // 1. Parse EXIF Timestamp
        let timestamp = Date.now();
        try {
          const exifData = await exifr.parse(origBuffer, ["DateTimeOriginal", "CreateDate", "ModifyDate"]);
          if (exifData?.DateTimeOriginal) {
            timestamp = new Date(exifData.DateTimeOriginal).getTime();
          } else if (exifData?.CreateDate) {
            timestamp = new Date(exifData.CreateDate).getTime();
          } else if (photo.metadata?.lastModified) {
            timestamp = photo.metadata.lastModified;
          }
        } catch {
          if (photo.metadata?.lastModified) {
            timestamp = photo.metadata.lastModified;
          }
        }

        // 2. Generate Retina 3K Display Preview (Max 2880px, Lanczos3 + Sharpen)
        const displayBuffer = await sharp(origBuffer)
          .rotate() // Auto-orient via EXIF
          .resize({
            width: 2880,
            height: 2880,
            fit: "inside",
            withoutEnlargement: true,
            kernel: "lanczos3",
          })
          .sharpen({
            sigma: 1.0,
            m1: 0.5,
            m2: 0.5,
          })
          .webp({ quality: 92, effort: 4 })
          .toBuffer();

        // 3. Generate High-Density Thumbnail (Max 800px, Lanczos3 + Sharpen)
        const thumbBuffer = await sharp(origBuffer)
          .rotate()
          .resize({
            width: 800,
            height: 800,
            fit: "inside",
            withoutEnlargement: true,
            kernel: "lanczos3",
          })
          .sharpen({
            sigma: 0.8,
            m1: 0.6,
            m2: 0.6,
          })
          .webp({ quality: 88, effort: 4 })
          .toBuffer();

        // 4. Calculate accurate aspect ratio from the rotated output
        const meta = await sharp(displayBuffer).metadata();
        const width = meta.width || photo.width || 2880;
        const height = meta.height || photo.height || 1920;
        const aspectRatio = Number((width / height).toFixed(4));

        // 5. Upload New Previews to R2
        const displayKey = `${albumId}/display/${photoId}.webp`;
        const thumbKey = `${albumId}/thumb/${photoId}.webp`;

        await Promise.all([
          putObject(displayKey, displayBuffer, "image/webp"),
          putObject(thumbKey, thumbBuffer, "image/webp"),
        ]);

        upgradedPhotos.push({
          ...photo,
          width,
          height,
          aspect_ratio: aspectRatio,
          timestamp,
          urls: {
            thumb: `${publicBaseUrl}/${thumbKey}`,
            display: `${publicBaseUrl}/${displayKey}`,
            original: photo.urls.original,
          },
        });

        console.log(`✅ Done (Timestamp: ${new Date(timestamp).toLocaleTimeString()})`);
      } catch (err) {
        console.log(`❌ Failed: ${err.message}`);
        upgradedPhotos.push(photo); // Keep existing record if one image fails
      }
    }

    // 6. Chronological Sort: Re-order all photos by capture timestamp
    upgradedPhotos.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // 7. Update Cover URL if needed
    const currentCoverThumb = manifest.cover_url || "";
    const isCoverStillPresent = upgradedPhotos.some((p) => p.urls.thumb === currentCoverThumb);
    const finalCoverUrl = isCoverStillPresent ? currentCoverThumb : upgradedPhotos[0]?.urls?.thumb || "";

    // 8. Upload Updated Manifest
    manifest.photos = upgradedPhotos;
    manifest.cover_url = finalCoverUrl;
    manifest.photo_count = upgradedPhotos.length;

    await putObject(
      manifestKey,
      Buffer.from(JSON.stringify(manifest, null, 2)),
      "application/json",
      "no-cache"
    );

    // Update master summary object in memory
    summary.cover_url = finalCoverUrl;
    summary.photo_count = upgradedPhotos.length;

    console.log(`✨ Album "${summary.title}" updated and sorted chronologically.`);
  }

  // 9. Upload Updated Master albums.json
  console.log(`\n💾 Saving updated albums.json master index...`);
  await putObject(
    "albums.json",
    Buffer.from(JSON.stringify(albums, null, 2)),
    "application/json",
    "no-cache"
  );

  console.log(`\n🎉 Migration Complete! All existing albums upgraded to Retina 3K and sorted chronologically.`);
}

runMigration().catch((err) => {
  console.error("Migration failed with fatal error:", err);
  process.exit(1);
});
