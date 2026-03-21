import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export async function uploadPotholeImage(file: File, path: string): Promise<string> {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Firebase Storage upload error:', error);
    throw error;
  }
}

export async function uploadPotholeImageFromBlob(blob: Blob, path: string): Promise<string> {
  try {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    console.error('Firebase Storage blob upload error:', error);
    throw error;
  }
}
