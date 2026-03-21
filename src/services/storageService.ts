import { supabase } from '../supabase';

const BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'pothole-images';

export async function uploadPotholeImage(file: File, path: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        upsert: true,
        contentType: file.type
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Supabase upload error:', error);
    throw error;
  }
}

export async function uploadPotholeImageFromBlob(blob: Blob, path: string): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, {
        upsert: true,
        contentType: 'image/jpeg'
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(data.path);

    return publicUrl;
  } catch (error) {
    console.error('Supabase blob upload error:', error);
    throw error;
  }
}
