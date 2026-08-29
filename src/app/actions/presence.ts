"use server";

import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

interface VisitorRecord {
  id: string;
  name: string;
  emoji: string;
  color: string;
  isCustomName: boolean;
  lastSeen: number;
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.R2_BUCKET_NAME || "";

export async function logAlbumPresence(
  albumId: string,
  visitor: { id: string; name: string; emoji: string; color: string; isCustomName: boolean }
) {
  if (!BUCKET || !process.env.R2_ACCOUNT_ID) {
    return { success: false, visitors: [] };
  }

  const key = `${albumId}/visitors.json`;
  let list: VisitorRecord[] = [];

  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const data = await res.Body?.transformToString();
    if (data) list = JSON.parse(data);
  } catch {
    list = [];
  }

  // Update or append visitor record
  const now = Date.now();
  const existingIdx = list.findIndex((v) => v.id === visitor.id);

  if (existingIdx >= 0) {
    list[existingIdx] = {
      ...list[existingIdx],
      name: visitor.name,
      emoji: visitor.emoji,
      color: visitor.color,
      isCustomName: visitor.isCustomName,
      lastSeen: now,
    };
  } else {
    list.unshift({
      id: visitor.id,
      name: visitor.name,
      emoji: visitor.emoji,
      color: visitor.color,
      isCustomName: visitor.isCustomName,
      lastSeen: now,
    });
  }

  // Keep the most recent 30 visitors
  list = list.sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 30);

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: JSON.stringify(list),
        ContentType: "application/json",
        CacheControl: "no-cache",
      })
    );
    return { success: true, visitors: list };
  } catch (err) {
    return { success: false, visitors: list };
  }
}

export async function getAlbumPresence(albumId: string) {
  if (!BUCKET || !process.env.R2_ACCOUNT_ID) return { visitors: [] };

  const key = `${albumId}/visitors.json`;
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const data = await res.Body?.transformToString();
    return { visitors: data ? JSON.parse(data) : [] };
  } catch {
    return { visitors: [] };
  }
}
