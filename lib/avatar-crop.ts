/** Square crop helpers for ERP profile avatars. */

export const AVATAR_OUTPUT_SIZE = 512;
export const AVATAR_OUTPUT_TYPE = 'image/jpeg';
export const AVATAR_OUTPUT_QUALITY = 0.9;
export const AVATAR_OUTPUT_EXT = 'jpg';
/** Source file may be larger; cropped JPEG is typically well under this. */
export const AVATAR_SOURCE_MAX_BYTES = 8 * 1024 * 1024;

export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (e) => reject(e));
    image.crossOrigin = 'anonymous';
    image.src = src;
  });
}

/**
 * Draw the pixel crop into a square canvas and export as a JPEG File.
 */
export async function getCroppedAvatarFile(
  imageSrc: string,
  pixelCrop: PixelCrop,
  fileName = 'avatar.jpg'
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not create canvas context');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    AVATAR_OUTPUT_SIZE,
    AVATAR_OUTPUT_SIZE
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to export cropped image'))),
      AVATAR_OUTPUT_TYPE,
      AVATAR_OUTPUT_QUALITY
    );
  });

  const base = fileName.replace(/\.[^.]+$/, '') || 'avatar';
  return new File([blob], `${base}.${AVATAR_OUTPUT_EXT}`, {
    type: AVATAR_OUTPUT_TYPE,
    lastModified: Date.now(),
  });
}
