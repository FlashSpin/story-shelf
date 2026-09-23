/**
 * Same-origin cover proxy helpers.
 *
 * Open Library cover URLs redirect twice onto archive.org
 * (`…/view_archive.php?…`). Old mobile Safari often fails that chain
 * (blank <img>, onError → placeholder). Serving through /api/cover keeps the
 * browser on our origin with a single 200 image/jpeg response.
 */

/** Hosts we are willing to fetch server-side for /api/cover. */
export const COVER_PROXY_HOSTS = new Set([
  "covers.openlibrary.org",
  "books.google.com",
  "books.googleusercontent.com",
]);

const MAX_URL_LEN = 2000;

export function isProxyableCoverUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.href.length > MAX_URL_LEN) return false;
    const host = u.hostname.toLowerCase();
    if (COVER_PROXY_HOSTS.has(host)) return true;
    // Google Books often serves via numbered googleusercontent hosts.
    if (host.endsWith(".googleusercontent.com")) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Rewrite catalog cover URLs to our same-origin proxy. Blob / already-proxied
 * URLs pass through unchanged.
 */
export function displayCoverUrl(
  coverUrl: string | null | undefined,
): string | null {
  if (!coverUrl) return null;
  const trimmed = coverUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/api/cover?")) return trimmed;
  if (!isProxyableCoverUrl(trimmed)) return trimmed;
  const https = trimmed.replace(/^http:\/\//i, "https://");
  return `/api/cover?url=${encodeURIComponent(https)}`;
}
