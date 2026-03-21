import { supabase } from '../supabase';

const BUCKET_NAME = import.meta.env.VITE_SUPABASE_BUCKET || 'pothole-images';

export async function uploadPotholeImage(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return publicUrl;
}

export async function uploadPotholeImageFromBlob(blob: Blob, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, blob, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/jpeg'
    });

  if (error) {
    console.error('Supabase blob upload error:', error);
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return publicUrl;
}
