import {
  encodeCoverWithinLimit,
  scaledCoverSize,
  type CoverEncodeStep,
} from "@/lib/cover-compress";

/** Shown to editors when a picked photo can't be turned into a cover. */
export const COVER_PHOTO_FRIENDLY_ERROR =
  "Couldn't use that photo. Try another one or take a new photo.";

/**
 * Error with a user-facing message; the underlying cause (e.g. a decode
 * failure on old iOS Safari) is kept on `detail` and logged to the console.
 */
export class CoverPhotoError extends Error {
  readonly detail: unknown;
  constructor(message: string, detail?: unknown) {
    super(message);
    this.name = "CoverPhotoError";
    this.detail = detail;
  }
}

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

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

/**
 * Decode via object URL + <img>. Works on every iOS Safari (createImageBitmap
 * is missing before iOS 15 and has failed on HEIC camera photos), decodes HEIC
 * where the browser can display it, and applies EXIF orientation on modern
 * browsers.
 */
function decodeWithImageElement(file: Blob): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const release = () => URL.revokeObjectURL(url);
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        release();
        reject(new Error("Image decoded with zero size"));
        return;
      }
      resolve({ source: img, width, height, release });
    };
    img.onerror = () => {
      release();
      reject(new Error(`<img> could not decode ${file.type || "file"}`));
    };
    img.src = url;
  });
}

/** Optional fallback only — never assume createImageBitmap exists. */
async function decodeWithImageBitmap(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap !== "function") {
    throw new Error("createImageBitmap unavailable");
  }
  const bitmap = await createImageBitmap(file);
  const release = () => {
    if (typeof bitmap.close === "function") bitmap.close();
  };
  if (!bitmap.width || !bitmap.height) {
    release();
    throw new Error("ImageBitmap decoded with zero size");
  }
  return { source: bitmap, width: bitmap.width, height: bitmap.height, release };
}

async function decodeCoverImage(file: Blob): Promise<DecodedImage> {
  try {
    return await decodeWithImageElement(file);
  } catch (imgErr) {
    try {
      return await decodeWithImageBitmap(file);
    } catch (bitmapErr) {
      throw new CoverPhotoError(COVER_PHOTO_FRIENDLY_ERROR, {
        imgErr,
        bitmapErr,
      });
    }
  }
}

/** A rectangle in source pixels; null = the whole image. */
export type CoverSourceRect = { x: number; y: number; w: number; h: number };

function encodeStep(
  image: DecodedImage,
  step: CoverEncodeStep,
  rect: CoverSourceRect | null = null,
): string {
  const src = rect ?? { x: 0, y: 0, w: image.width, h: image.height };
  const { width, height } = scaledCoverSize(src.w, src.h, step.maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  // White matte so transparent PNGs don't turn black as JPEG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image.source, src.x, src.y, src.w, src.h, 0, 0, width, height);
  const dataUrl = canvas.toDataURL("image/jpeg", step.quality);
  // Free canvas backing store promptly (old iOS has a small canvas memory cap).
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl;
}

async function encodeCover(
  image: DecodedImage,
  rect: CoverSourceRect | null,
): Promise<string> {
  const result = await encodeCoverWithinLimit(
    (step) => encodeStep(image, step, rect),
    {
      onStepFailed: (step, reason) =>
        console.warn("[cover] encode step failed", step, reason),
    },
  );
  if (!result) {
    throw new CoverPhotoError(
      COVER_PHOTO_FRIENDLY_ERROR,
      new Error("No encode step produced a usable JPEG under the size cap"),
    );
  }
  return result.dataUrl;
}

function assertImageFile(file: File) {
  // Some iOS/Android pickers report an empty type; let decode decide then.
  if (file.type && !file.type.startsWith("image/")) {
    throw new CoverPhotoError("Please choose a photo of the cover.");
  }
}

/** Longest edge of the in-memory working copy used by the crop step. */
const WORKING_MAX_EDGE = 1600;

/**
 * Decode a picked photo into a downscaled canvas (≤1600px edge) for the crop
 * step. The full-size decode is released immediately so old iPhones don't hold
 * a 12MP bitmap while the editor drags the frame. The canvas is also what the
 * crop step displays, so preview and output always match.
 */
export async function loadCoverWorkingCanvas(
  file: File,
): Promise<HTMLCanvasElement> {
  assertImageFile(file);
  const image = await decodeCoverImage(file);
  try {
    const { width, height } = scaledCoverSize(
      image.width,
      image.height,
      WORKING_MAX_EDGE,
    );
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new CoverPhotoError(
        COVER_PHOTO_FRIENDLY_ERROR,
        new Error("2D canvas context unavailable"),
      );
    }
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image.source, 0, 0, width, height);
    return canvas;
  } finally {
    image.release();
  }
}

/**
 * Encode `rect` (working-canvas pixels) of a working canvas as the cover JPEG.
 * Same size steps and caps as compressCover (720px edge, ≤380k chars).
 */
export function renderCoverCrop(
  canvas: HTMLCanvasElement,
  rect: CoverSourceRect | null,
): Promise<string> {
  return encodeCover(
    {
      source: canvas,
      width: canvas.width,
      height: canvas.height,
      release: () => {},
    },
    rect,
  );
}

/**
 * Downscale a picked/captured photo to a JPEG data URL under the server caps.
 * Always JPEG — reliable on older iOS Safari (no WebP/AVIF-only uploads).
 * Steps quality/size down rather than failing when a photo is too large.
 */
export async function compressCover(file: File): Promise<string> {
  assertImageFile(file);
  const image = await decodeCoverImage(file);
  try {
    return await encodeCover(image, null);
  } finally {
    image.release();
  }
}
