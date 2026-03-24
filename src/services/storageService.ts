import { useConvex } from 'convex/react';
import { api } from '../convex/_generated/api';

/**
 * Upload a File or Blob to Convex file storage.
 * Returns the storage ID (not a URL). Use api.storage.getImageUrl to resolve.
 */
export async function uploadToConvex(
  convex: ReturnType<typeof useConvex>,
  file: File | Blob,
  contentType = 'image/jpeg'
): Promise<string> {
  // 1. Get a short-lived upload URL from Convex
  const uploadUrl = await convex.mutation(api.storage.generateUploadUrl, {});

  // 2. PUT the file to that URL
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  const { storageId } = await res.json();
  return storageId as string;
}
