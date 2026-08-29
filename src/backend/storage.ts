import { supabase } from './client';

/**
 * Profile photos.
 *
 * Until now a photo was a data URL kept in localStorage, which is fine for one
 * device and wrong for a database: a base64 image inflates the row by a third
 * over its byte size and travels with every profile read. With a backend
 * configured the file goes to Storage and the row keeps a URL.
 *
 * The path is `<user id>/avatar.jpg`, which is what the storage policy checks
 * — a user may only write inside a folder named after their own id.
 */
export async function uploadAvatar(userId: string, dataUrl: string): Promise<string | null> {
  const client = supabase();
  if (!client) return null;

  const blob = await dataUrlToBlob(dataUrl);
  if (!blob) return null;

  const path = `${userId}/avatar.jpg`;
  const { error } = await client.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) return null;

  const { data } = client.storage.from('avatars').getPublicUrl(path);
  // Cache-busted, or a replacement photo keeps showing the old one.
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function removeAvatar(userId: string): Promise<void> {
  await supabase()?.storage.from('avatars').remove([`${userId}/avatar.jpg`]);
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  try {
    const res = await fetch(dataUrl);
    return await res.blob();
  } catch {
    return null;
  }
}

/** Already a hosted URL, rather than an image still sitting in the browser. */
export function isRemotePhoto(photo: string | null): boolean {
  return Boolean(photo && !photo.startsWith('data:'));
}
