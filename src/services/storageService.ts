import { supabase } from '../supabase';

const BUCKET_NAME = import.meta.env.VITE_SUPABASE_BUCKET || 'pothole-images';

export async function uploadPotholeImage(file: File, path: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file, {
        upsert: true,
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Supabase Storage upload error:', error);
    throw error;
  }
}

export async function uploadPotholeImageFromBlob(blob: Blob, path: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Supabase Storage blob upload error:', error);
    throw error;
  }
}
