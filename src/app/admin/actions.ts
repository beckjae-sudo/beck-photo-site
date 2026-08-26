"use server";

import { cookies } from "next/headers";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  s3,
  BUCKET_NAME,
  getPresignedUploadUrl,
  uploadJsonToR2,
  getJsonFromR2,
} from "@/lib/r2";

// 1. Password Verification
export async function authenticateAdmin(password: string) {
  const adminSecret = process.env.ADMIN_PASSWORD;
  if (!adminSecret || password !== adminSecret) {
    return { success: false, error: "Invalid password" };
  }

  const cookieStore = await cookies();
  cookieStore.set("admin_session", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return { success: true };
}

// 2. Auth Check Helper
async function checkAuth() {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value === "authenticated";
}

// 3. Generate Direct R2 Upload URL
export async function getDirectUploadUrl(key: string, contentType: string) {
  if (!(await checkAuth())) throw new Error("Unauthorized");
  return await getPresignedUploadUrl(key, contentType);
}

// 4. Save Final Manifest and Update Global Index
export async function publishAlbumManifest(albumData: {
  album_id: string;
  title: string;
  date: string;
  photos: Array<{
    id: string;
    original_filename: string;
    width: number;
    height: number;
    aspect_ratio: number;
    urls: { thumb: string; display: string; original: string };
    metadata?: Record<string, string>;
  }>;
  cover_url: string;
}) {
  if (!(await checkAuth())) throw new Error("Unauthorized");

  // Save album manifest
  await uploadJsonToR2(`${albumData.album_id}/manifest.json`, {
    album_id: albumData.album_id,
    title: albumData.title,
    date: albumData.date,
    photos: albumData.photos,
  });

  // Update albums.json
  const existingAlbums = (await getJsonFromR2<any[]>("albums.json")) || [];
  const updatedAlbums = existingAlbums.filter((a) => a.id !== albumData.album_id);

  updatedAlbums.unshift({
    id: albumData.album_id,
    title: albumData.title,
    date: albumData.date,
    photo_count: albumData.photos.length,
    cover_url: albumData.cover_url || albumData.photos[0]?.urls.thumb || "",
  });

  updatedAlbums.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  await uploadJsonToR2("albums.json", updatedAlbums);

  return { success: true };
}

// 5. Fetch Single Album Manifest (For the Edit Page)
export async function getAlbumForEditing(albumId: string) {
  if (!(await checkAuth())) throw new Error("Unauthorized");
  return await getJsonFromR2<any>(`${albumId}/manifest.json`);
}

// 6. Delete Photos from R2 Storage
export async function deletePhotoFromR2(photoKeys: string[]) {
  if (!(await checkAuth())) throw new Error("Unauthorized");

  for (const key of photoKeys) {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
        })
      );
    } catch (err) {
      console.error(`Failed to delete ${key}:`, err);
    }
  }
  return { success: true };
}

// 7. Update an Existing Album (Edits, Reorders, New Photos)
export async function updateExistingAlbum(albumData: {
  album_id: string;
  title: string;
  date: string;
  photos: any[];
  cover_url: string;
}) {
  if (!(await checkAuth())) throw new Error("Unauthorized");

  // Overwrite the existing manifest.json in R2
  await uploadJsonToR2(`${albumData.album_id}/manifest.json`, {
    album_id: albumData.album_id,
    title: albumData.title,
    date: albumData.date,
    photos: albumData.photos,
  });

  // Update the album's entry in albums.json
  const existingAlbums = (await getJsonFromR2<any[]>("albums.json")) || [];
  const updatedAlbums = existingAlbums.map((a) => {
    if (a.id === albumData.album_id) {
      return {
        ...a,
        title: albumData.title,
        date: albumData.date,
        photo_count: albumData.photos.length,
        cover_url: albumData.cover_url || a.cover_url,
      };
    }
    return a;
  });

  await uploadJsonToR2("albums.json", updatedAlbums);
  return { success: true };
}
