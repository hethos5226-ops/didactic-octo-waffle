/**
 * Profile photos are stored inline on the profile as a data URL, which means
 * they share the browser's localStorage budget with everything else. A phone
 * camera shot is several megabytes and would blow that instantly, so every
 * picked image is cropped square and downscaled before it is ever stored.
 */

const MAX_EDGE = 320;
const QUALITY = 0.82;

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export class PhotoError extends Error {}

/** Read, square-crop and downscale a picked file into a small JPEG data URL. */
export async function photoFromFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new PhotoError("That doesn't look like an image");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new PhotoError('That image is too big — try another one');
  }

  const source = await loadImage(file);
  // Centre-crop to a square so a portrait and a landscape shot both fill the
  // circle the same way, rather than one of them squashing.
  const edge = Math.min(source.width, source.height);
  const sx = (source.width - edge) / 2;
  const sy = (source.height - edge) / 2;
  const size = Math.min(MAX_EDGE, edge);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new PhotoError("Couldn't read that image");
  ctx.drawImage(source, sx, sy, edge, edge, 0, 0, size, size);

  if ('close' in source && typeof source.close === 'function') source.close();
  return canvas.toDataURL('image/jpeg', QUALITY);
}

type Drawable = (ImageBitmap | HTMLImageElement) & { close?: () => void };

async function loadImage(file: File): Promise<Drawable> {
  // createImageBitmap handles EXIF orientation on the platforms that have it,
  // so a photo taken sideways on a phone comes out the right way up.
  if (typeof createImageBitmap === 'function') {
    try {
      return (await createImageBitmap(file, {
        imageOrientation: 'from-image',
      })) as Drawable;
    } catch {
      /* Fall through to the <img> path below. */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise<Drawable>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img as Drawable);
      img.onerror = () => reject(new PhotoError("Couldn't read that image"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
