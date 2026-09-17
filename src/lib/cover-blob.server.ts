import { put } from "@vercel/blob";
import { env } from "@/lib/env.server";
import { isCoverDataUrl, publicListCoverUrl } from "@/lib/cover-image";
import {
  extensionForCoverMime,
  parseCoverDataUrl,
} from "@/lib/cover-blob";

/**
 * True when Vercel Blob is configured for cover uploads.
 * On Vercel, create a Blob store (public access) — the dashboard injects
 * BLOB_READ_WRITE_TOKEN (and optionally BLOB_STORE_ID / OIDC).
 */
export function isCoverBlobConfigured(): boolean {
  return Boolean(env("BLOB_READ_WRITE_TOKEN"));
}

/**
 * Upload a validated cover data URL to Vercel Blob (public HTTPS URL).
 * Call only from editor-gated server functions — never expose the token.
 */
export async function uploadCoverToBlob(dataUrl: string): Promise<string> {
  const token = env("BLOB_READ_WRITE_TOKEN");
  if (!token) {
    throw new Error(
      "Cover uploads require BLOB_READ_WRITE_TOKEN. Create a Vercel Blob store and set the env var.",
    );
  }
  const { contentType, bytes } = parseCoverDataUrl(dataUrl);
  const ext = extensionForCoverMime(contentType);
  const pathname = `covers/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const blob = await put(pathname, Buffer.from(bytes), {
    access: "public",
    contentType,
    addRandomSuffix: false,
    token,
  });
  if (!blob.url || !/^https:\/\//i.test(blob.url)) {
    throw new Error("Blob upload did not return an HTTPS URL.");
  }
  return blob.url;
}

export type StoredCoverFields = {
  coverUrl: string | null;
  coverData: string | null;
};

/**
 * Resolve cover fields for insert/update:
 * - New uploads → Vercel Blob HTTPS URL in cover_url (cover_data cleared)
 * - Without blob token (local/dev) → legacy cover_data data URL fallback
 * - Catalog HTTPS covers stay in cover_url
 */
export async function resolveCoverFields(input: {
  coverUrl?: string | null;
  coverData?: string | null;
}): Promise<StoredCoverFields> {
  const catalogUrl = publicListCoverUrl(input.coverUrl);
  const upload =
    input.coverData && isCoverDataUrl(input.coverData)
      ? input.coverData
      : null;

  if (!upload) {
    return { coverUrl: catalogUrl, coverData: null };
  }

  if (isCoverBlobConfigured()) {
    const blobUrl = await uploadCoverToBlob(upload);
    return { coverUrl: blobUrl, coverData: null };
  }

  // Local / preview without Blob: keep stopgap DB storage.
  parseCoverDataUrl(upload); // validate type/size even on fallback
  return { coverUrl: catalogUrl, coverData: upload };
}

/**
 * Replace an existing book's cover with an upload (blob preferred).
 * When using blob, overwrites cover_url and clears cover_data.
 * Legacy fallback only updates cover_data and leaves catalog cover_url.
 */
export async function resolveCoverUpdate(
  coverData: string,
): Promise<StoredCoverFields> {
  if (!isCoverDataUrl(coverData)) {
    throw new Error("Cover must be a JPEG, PNG, or WebP image.");
  }
  if (isCoverBlobConfigured()) {
    const blobUrl = await uploadCoverToBlob(coverData);
    return { coverUrl: blobUrl, coverData: null };
  }
  parseCoverDataUrl(coverData);
  // coverUrl null ⇒ caller leaves existing cover_url untouched (catalog fallback).
  return { coverUrl: null, coverData: coverData };
}
