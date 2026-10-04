/**
 * Pure 2:3 crop-frame math for the cover crop step (no DOM). Import-free so it
 * runs under `node --experimental-strip-types --test`.
 *
 * A crop is a rectangle in source-image pixels whose aspect is always 2:3
 * (width:height) and which always stays inside the image. Zooming in shrinks
 * the rectangle; panning moves it.
 */

export const COVER_ASPECT = 2 / 3;
/** Max zoom relative to the largest 2:3 rect that fits the image. */
export const MAX_ZOOM = 4;

export type CropRect = { x: number; y: number; w: number; h: number };

/** Largest 2:3 rectangle that fits inside a w×h image. */
export function maxCropSize(imgW: number, imgH: number): { w: number; h: number } {
  if (imgW / imgH > COVER_ASPECT) return { w: imgH * COVER_ASPECT, h: imgH };
  return { w: imgW, h: imgW / COVER_ASPECT };
}

/** Keep the rect inside the image and its size within [max/MAX_ZOOM, max]. */
export function clampCrop(crop: CropRect, imgW: number, imgH: number): CropRect {
  const max = maxCropSize(imgW, imgH);
  const w = Math.min(max.w, Math.max(max.w / MAX_ZOOM, crop.w));
  const h = w / COVER_ASPECT;
  // Re-centre on the requested centre when the size changes.
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  const x = Math.min(imgW - w, Math.max(0, cx - w / 2));
  const y = Math.min(imgH - h, Math.max(0, cy - h / 2));
  return { x, y, w, h };
}

/** Default: the largest centred 2:3 crop (what the shelf tile would show). */
export function initialCrop(imgW: number, imgH: number): CropRect {
  const { w, h } = maxCropSize(imgW, imgH);
  return { x: (imgW - w) / 2, y: (imgH - h) / 2, w, h };
}

/**
 * Drag by (dx, dy) screen px inside a frame `frameW` px wide. Dragging right
 * moves the photo right, i.e. the crop window left.
 */
export function panCrop(
  crop: CropRect,
  dx: number,
  dy: number,
  frameW: number,
  imgW: number,
  imgH: number,
): CropRect {
  const k = crop.w / Math.max(1, frameW);
  return clampCrop({ ...crop, x: crop.x - dx * k, y: crop.y - dy * k }, imgW, imgH);
}

/**
 * Zoom by `factor` (>1 = zoom in) keeping the point at frame fraction
 * (fx, fy) (0..1) under the finger / cursor.
 */
export function zoomCrop(
  crop: CropRect,
  factor: number,
  imgW: number,
  imgH: number,
  fx = 0.5,
  fy = 0.5,
): CropRect {
  const max = maxCropSize(imgW, imgH);
  const w = Math.min(max.w, Math.max(max.w / MAX_ZOOM, crop.w / factor));
  const h = w / COVER_ASPECT;
  const px = crop.x + crop.w * fx;
  const py = crop.y + crop.h * fy;
  const x = Math.min(imgW - w, Math.max(0, px - w * fx));
  const y = Math.min(imgH - h, Math.max(0, py - h * fy));
  return { x, y, w, h };
}

/** Current zoom (1 = fit, MAX_ZOOM = closest). */
export function cropZoom(crop: CropRect, imgW: number, imgH: number): number {
  return maxCropSize(imgW, imgH).w / crop.w;
}

/** Set an absolute zoom level, keeping the crop centre. */
export function setCropZoom(
  crop: CropRect,
  zoom: number,
  imgW: number,
  imgH: number,
): CropRect {
  return zoomCrop(crop, zoom / cropZoom(crop, imgW, imgH), imgW, imgH);
}

/**
 * CSS placement (percent of the frame) for the full image so that `crop`
 * exactly fills a 2:3 frame. Percentages are robust to frame resizes.
 */
export function imagePlacement(
  crop: CropRect,
  imgW: number,
  imgH: number,
): { left: number; top: number; width: number; height: number } {
  return {
    left: (-crop.x / crop.w) * 100,
    top: (-crop.y / crop.h) * 100,
    width: (imgW / crop.w) * 100,
    height: (imgH / crop.h) * 100,
  };
}
