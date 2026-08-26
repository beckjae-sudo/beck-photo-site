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

export async function authenticateAdmin(password: string) {
  const adminSecret = process.env.ADMIN_PASSWORD;
  if (!adminSecret || password !== adminSecret) {
    return { success: false, error: "Invalid password" };
  }

  const cookieStore = await cookies();
  cookieStore.set("admin_session", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return { success: true };
}

async function checkAuth() {
  const cookieStore = await cookies();
  return cookieStore.get("admin_session")?.value === "authenticated";
}

export async function getDirectUploadUrl(key: string, contentType: string) {
  if (!(await checkAuth())) throw new Error("Unauthorized");
  return await getPresignedUploadUrl(key, contentType);
}

export async function publishAlbumManifest(albumData: {
  album_id: string;
  title: string;
  date: string;
  category?: string;
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

  const category = albumData.category || "School Sports";

  await uploadJsonToR2(`${albumData.album_id}/manifest.json`, {
    album_id: albumData.album_id,
    title: albumData.title,
    date: albumData.date,
    category,
    photos: albumData.photos,
  });

  const existingAlbums = (await getJsonFromR2<any[]>("albums.json")) || [];
  const updatedAlbums = existingAlbums.filter((a) => a.id !== albumData.album_id);

  updatedAlbums.unshift({
    id: albumData.album_id,
    title: albumData.title,
    date: albumData.date,
    category,
    photo_count: albumData.photos.length,
    cover_url: albumData.cover_url || albumData.photos[0]?.urls.thumb || "",
  });

  updatedAlbums.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  await uploadJsonToR2("albums.json", updatedAlbums);

  return { success: true };
}

export async function getAlbumForEditing(albumId: string) {
  if (!(await checkAuth())) throw new Error("Unauthorized");
  return await getJsonFromR2<any>(`${albumId}/manifest.json`);
}

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

export async function updateExistingAlbum(albumData: {
  album_id: string;
  title: string;
  date: string;
  category?: string;
  photos: any[];
  cover_url: string;
}) {
  if (!(await checkAuth())) throw new Error("Unauthorized");

  const category = albumData.category || "School Sports";

  await uploadJsonToR2(`${albumData.album_id}/manifest.json`, {
    album_id: albumData.album_id,
    title: albumData.title,
    date: albumData.date,
    category,
    photos: albumData.photos,
  });

  const existingAlbums = (await getJsonFromR2<any[]>("albums.json")) || [];
  const updatedAlbums = existingAlbums.map((a) => {
    if (a.id === albumData.album_id) {
      return {
        ...a,
        title: albumData.title,
        date: albumData.date,
        category,
        photo_count: albumData.photos.length,
        cover_url: albumData.cover_url || a.cover_url,
      };
    }
    return a;
  });

  await uploadJsonToR2("albums.json", updatedAlbums);
  return { success: true };
}

// Site Config Read/Write
export async function getSiteConfig() {
  const config = await getJsonFromR2<any>("site_config.json");
  return (
    config || {
      site_title: "Sports Photo Gallery",
      badge_text: "Corvian Sports & Action",
      hero_headline: "Game Day Highlights",
      hero_description: "Browse recent game albums and download high-resolution photos.",
      theme_preset: "slate-glow",
      categories: ["School Sports", "Travel Teams", "Other Activities"],
    }
  );
}

export async function saveSiteConfig(newConfig: {
  site_title: string;
  badge_text: string;
  hero_headline: string;
  hero_description: string;
  theme_preset: string;
  categories: string[];
}) {
  if (!(await checkAuth())) throw new Error("Unauthorized");
  await uploadJsonToR2("site_config.json", newConfig);
  return { success: true };
}
