/**
 * Pure cover-compression planning (no DOM). Kept import-free so it can be
 * unit-tested with `node --experimental-strip-types --test`.
 *
 * Size caps, smallest first — the client cap must stay under every server cap:
 *   client COVER_MAX_DATA_CHARS   380_000 chars (≈285 KB decoded)
 *   addBook/updateCover zod max   400_000 chars   (books.functions.ts)
 *   MAX_COVER_DATA_CHARS          480_000 chars   (cover-blob.ts)
 *   MAX_COVER_BYTES               350_000 bytes   (cover-blob.ts)
 */

export const COVER_MAX_DATA_CHARS = 380_000;

export const JPEG_DATA_URL_PREFIX = "data:image/jpeg;base64,";

export type CoverEncodeStep = { maxEdge: number; quality: number };

/** Try best quality first, then step quality/size down instead of erroring. */
export const COVER_ENCODE_STEPS: readonly CoverEncodeStep[] = [
  { maxEdge: 720, quality: 0.82 },
  { maxEdge: 720, quality: 0.7 },
  { maxEdge: 600, quality: 0.7 },
  { maxEdge: 600, quality: 0.55 },
  { maxEdge: 480, quality: 0.5 },
];

/** Scale (w, h) so the longest edge is ≤ maxEdge. Never upscales; min 1px. */
export function scaledCoverSize(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  const scale = longest > 0 ? Math.min(1, maxEdge / longest) : 1;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * True for a non-blank JPEG data URL. Old iOS Safari can return "data:," (or a
 * PNG when JPEG encoding is unavailable) from canvas.toDataURL on failure.
 */
export function isUsableJpegDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(JPEG_DATA_URL_PREFIX) &&
    // A real JPEG (SOI + headers) is well over 100 base64 chars.
    value.length > JPEG_DATA_URL_PREFIX.length + 100
  );
}

export type CoverEncodeResult = { dataUrl: string; step: CoverEncodeStep };

/**
 * Run `encode` for each step until it yields a usable JPEG data URL that fits
 * `maxChars`. Encoder throws/blank output fall through to the next (smaller)
 * step. Returns null when nothing fits.
 */
export async function encodeCoverWithinLimit(
  encode: (step: CoverEncodeStep) => string | Promise<string>,
  options: {
    steps?: readonly CoverEncodeStep[];
    maxChars?: number;
    onStepFailed?: (step: CoverEncodeStep, reason: unknown) => void;
  } = {},
): Promise<CoverEncodeResult | null> {
  const steps = options.steps ?? COVER_ENCODE_STEPS;
  const maxChars = options.maxChars ?? COVER_MAX_DATA_CHARS;
  for (const step of steps) {
    let dataUrl: string;
    try {
      dataUrl = await encode(step);
    } catch (err) {
      options.onStepFailed?.(step, err);
      continue;
    }
    if (!isUsableJpegDataUrl(dataUrl)) {
      options.onStepFailed?.(step, new Error("blank or non-JPEG canvas output"));
      continue;
    }
    if (dataUrl.length > maxChars) {
      options.onStepFailed?.(
        step,
        new Error(`too large: ${dataUrl.length} > ${maxChars} chars`),
      );
      continue;
    }
    return { dataUrl, step };
  }
  return null;
}
