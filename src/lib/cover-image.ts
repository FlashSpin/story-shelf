const MAX_EDGE = 720;
const JPEG_QUALITY = 0.82;
const MAX_DATA_CHARS = 380_000;

export function isCoverDataUrl(value: string): boolean {
  return /^data:image\/(jpeg|png|webp);base64,/i.test(value);
}

/** True for http(s) cover URLs safe to keep on the list/display path. */
export function isHttpsCoverUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/**
 * List/display cover: keep HTTPS catalog URLs; drop data URLs and other junk
 * so shelf payloads stay small.
 */
export function publicListCoverUrl(
  coverUrl: string | null | undefined,
): string | null {
  if (!coverUrl) return null;
  const trimmed = coverUrl.trim();
  if (!trimmed || isCoverDataUrl(trimmed) || !isHttpsCoverUrl(trimmed)) {
    return null;
  }
  return trimmed.replace(/^http:\/\//i, "https://");
}

/** Always JPEG — reliable on older iOS Safari (no WebP/AVIF-only uploads). */
export async function compressCover(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose a photo of the cover.");
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  if (dataUrl.length > MAX_DATA_CHARS) {
    throw new Error("That photo is too large. Try a closer crop of the cover.");
  }
  return dataUrl;
}
