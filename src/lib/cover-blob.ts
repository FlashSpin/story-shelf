/**
 * Shared cover upload validation (client + server). Pure — no Node/Blob deps.
 * Server upload lives in cover-blob.server.ts.
 */

export const COVER_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type CoverMimeType = (typeof COVER_MIME_TYPES)[number];

/** Max decoded bytes accepted on the server (~client compresses under this). */
export const MAX_COVER_BYTES = 350_000;

/** Max data-URL string length (base64 expansion of MAX_COVER_BYTES + header). */
export const MAX_COVER_DATA_CHARS = 480_000;

const DATA_URL_RE =
  /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i;

export type ParsedCoverDataUrl = {
  contentType: CoverMimeType;
  bytes: Uint8Array;
};

export function isAllowedCoverMime(value: string): value is CoverMimeType {
  return (COVER_MIME_TYPES as readonly string[]).includes(
    value.toLowerCase(),
  );
}

export function extensionForCoverMime(mime: CoverMimeType): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

/**
 * Parse and validate a cover data URL. Rejects non-images, oversized payloads,
 * and malformed base64. Used before persisting to blob or (legacy) cover_data.
 */
export function parseCoverDataUrl(dataUrl: string): ParsedCoverDataUrl {
  const trimmed = dataUrl.trim();
  if (trimmed.length > MAX_COVER_DATA_CHARS) {
    throw new Error("That photo is too large. Try a closer crop of the cover.");
  }
  const match = DATA_URL_RE.exec(trimmed);
  if (!match) {
    throw new Error("Cover must be a JPEG, PNG, or WebP image.");
  }
  const contentType = match[1]!.toLowerCase() as CoverMimeType;
  if (!isAllowedCoverMime(contentType)) {
    throw new Error("Cover must be a JPEG, PNG, or WebP image.");
  }
  const b64 = match[2]!.replace(/\s+/g, "");
  let bytes: Uint8Array;
  try {
    const binary = atob(b64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } catch {
    throw new Error("Could not read that photo.");
  }
  if (bytes.byteLength === 0) {
    throw new Error("Could not read that photo.");
  }
  if (bytes.byteLength > MAX_COVER_BYTES) {
    throw new Error("That photo is too large. Try a closer crop of the cover.");
  }
  return { contentType, bytes };
}
