"use server";

import { S3Client, PutObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { cookies } from "next/headers";

function getR2Client() {
  const endpoint = process.env.R2_ENDPOINT?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      `Missing Cloudflare R2 Environment Variables on Vercel. ` +
      `endpoint: ${endpoint ? "OK" : "MISSING"}, ` +
      `accessKeyId: ${accessKeyId ? "OK" : "MISSING"}, ` +
      `secretAccessKey: ${secretAccessKey ? "OK" : "MISSING"}`
    );
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });
}

const BUCKET_NAME = process.env.R2_BUCKET_NAME || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

export async function checkAdminAuth(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get("admin_session");
    return authCookie?.value === "authenticated";
  } catch {
    return false;
  }
}

export async function loginAdmin(password: string): Promise<{ success: boolean }> {
  try {
    if (password === ADMIN_PASSWORD) {
      const cookieStore = await cookies();
      cookieStore.set("admin_session", "authenticated", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      return { success: true };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}

export async function getDirectUploadUrl(
  key: string,
  contentType: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const isAuth = await checkAdminAuth();
    if (!isAuth) return { success: false, error: "Admin session expired. Please log in again." };

    if (!BUCKET_NAME) return { success: false, error: "R2_BUCKET_NAME is not set in Vercel." };

    const r2 = getR2Client();
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
    return { success: true, url };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function createAlbum(albumData: {
  album_id: string;
  title: string;
  date: string;
  category?: string;
  photos: any[];
  cover_url: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const isAuth = await checkAdminAuth();
    if (!isAuth) return { success: false, error: "Admin session expired. Please log in again." };

    const r2 = getR2Client();

    // 1. Save album manifest
    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${albumData.album_id}/manifest.json`,
        Body: JSON.stringify(albumData, null, 2),
        ContentType: "application/json",
      })
    );

    // 2. Update global albums index
    const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");
    let albums: any[] = [];
    if (baseUrl) {
      try {
        const res = await fetch(`${baseUrl}/albums.json`, { cache: "no-store" });
        if (res.ok) albums = await res.json();
      } catch {
        albums = [];
      }
    }

    const newSummary = {
      id: albumData.album_id,
      title: albumData.title,
      date: albumData.date,
      category: albumData.category || "School Sports",
      photo_count: albumData.photos.length,
      cover_url: albumData.cover_url,
    };

    const updatedAlbums = [newSummary, ...albums.filter((a) => a.id !== albumData.album_id)];

    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: "albums.json",
        Body: JSON.stringify(updatedAlbums, null, 2),
        ContentType: "application/json",
      })
    );

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function updateExistingAlbum(albumData: {
  album_id: string;
  title: string;
  date: string;
  category?: string;
  photos: any[];
  cover_url: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const isAuth = await checkAdminAuth();
    if (!isAuth) return { success: false, error: "Admin session expired." };

    const r2 = getR2Client();

    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${albumData.album_id}/manifest.json`,
        Body: JSON.stringify(albumData, null, 2),
        ContentType: "application/json",
      })
    );

    const baseUrl = process.env.NEXT_PUBLIC_R2_BASE_URL?.replace(/\/$/, "");
    let albums: any[] = [];
    if (baseUrl) {
      try {
        const res = await fetch(`${baseUrl}/albums.json`, { cache: "no-store" });
        if (res.ok) albums = await res.json();
      } catch {
        albums = [];
      }
    }

    const updatedAlbums = albums.map((a) => {
      if (a.id === albumData.album_id) {
        return {
          ...a,
          title: albumData.title,
          date: albumData.date,
          category: albumData.category || "School Sports",
          photo_count: albumData.photos.length,
          cover_url: albumData.cover_url,
        };
      }
      return a;
    });

    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: "albums.json",
        Body: JSON.stringify(updatedAlbums, null, 2),
        ContentType: "application/json",
      })
    );

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function deletePhotoFromR2(keys: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const isAuth = await checkAdminAuth();
    if (!isAuth) return { success: false, error: "Unauthorized" };
    if (keys.length === 0) return { success: true };

    const r2 = getR2Client();
    await r2.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: {
          Objects: keys.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

export async function saveSiteConfig(config: any): Promise<{ success: boolean; error?: string }> {
  try {
    const isAuth = await checkAdminAuth();
    if (!isAuth) return { success: false, error: "Unauthorized" };

    const r2 = getR2Client();
    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: "site_config.json",
        Body: JSON.stringify(config, null, 2),
        ContentType: "application/json",
      })
    );

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
