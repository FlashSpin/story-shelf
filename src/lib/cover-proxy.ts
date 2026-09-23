/**
 * Same-origin cover proxy helpers.
 *
 * Open Library cover URLs redirect twice onto archive.org
 * (`…/view_archive.php?…`). Old mobile Safari often fails that chain
 * (blank <img>, onError → placeholder). Serving through /api/cover keeps the
 * browser on our origin with a single 200 image/jpeg (or PNG) response.
 *
 * Security model:
 * - Clients may only *request* catalog hosts (Open Library / Google Books).
 * - Redirect hops may additionally land on archive.org (where OL stores covers).
 * - Every hop’s final URL (scheme + host) is re-checked; we never blindly
 *   `redirect: "follow"`.
 * - Responses must be image/jpeg or image/png (reject WebP/GIF — old Safari).
 */

/** Hosts clients may pass as `?url=` (catalog entry points). */
export const COVER_PROXY_HOSTS = new Set([
  "covers.openlibrary.org",
  "books.google.com",
  "books.googleusercontent.com",
]);

const MAX_URL_LEN = 2000;
export const MAX_COVER_PROXY_BYTES = 2_000_000;
export const COVER_PROXY_FETCH_TIMEOUT_MS = 12_000;
export const COVER_PROXY_MAX_REDIRECTS = 5;

/** Outbound Content-Types we will serve (JPEG/PNG only — no WebP/GIF). */
export const ALLOWED_COVER_PROXY_TYPES = ["image/jpeg", "image/png"] as const;
export type AllowedCoverProxyType = (typeof ALLOWED_COVER_PROXY_TYPES)[number];

function isGoogleUserContentHost(host: string): boolean {
  return host.endsWith(".googleusercontent.com");
}

/** archive.org + iaNNNN.us.archive.org (Open Library CDN redirect targets). */
function isArchiveOrgHost(host: string): boolean {
  return host === "archive.org" || host.endsWith(".archive.org");
}

/** Block obvious SSRF targets even if somehow allowlisted later. */
export function isBlockedCoverProxyHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  // IPv4 / IPv6 literals — never fetch by raw IP for covers.
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

/**
 * @param kind `request` = client-supplied URL; `redirect` = Location hop / final URL
 *   (may include archive.org for Open Library).
 */
export function isAllowedCoverProxyHostname(
  hostname: string,
  kind: "request" | "redirect",
): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (isBlockedCoverProxyHostname(host)) return false;
  if (COVER_PROXY_HOSTS.has(host)) return true;
  if (isGoogleUserContentHost(host)) return true;
  if (kind === "redirect" && isArchiveOrgHost(host)) return true;
  return false;
}

function parseCoverProxyUrl(
  value: string,
  kind: "request" | "redirect",
): URL | null {
  try {
    const u = new URL(value.trim());
    if (u.href.length > MAX_URL_LEN) return null;
    if (u.username || u.password) return null;
    if (u.protocol === "http:") u.protocol = "https:";
    if (u.protocol !== "https:") return null;
    if (!isAllowedCoverProxyHostname(u.hostname, kind)) return null;
    return u;
  } catch {
    return null;
  }
}

/** True when a client may ask `/api/cover?url=` for this URL. */
export function isProxyableCoverUrl(value: string): boolean {
  return parseCoverProxyUrl(value, "request") !== null;
}

/**
 * Resolve and validate a redirect Location against the redirect allowlist.
 * Relative Locations are resolved against `from`.
 */
export function resolveAllowedRedirectUrl(
  from: URL,
  locationHeader: string | null,
): URL | null {
  if (!locationHeader) return null;
  try {
    const next = new URL(locationHeader, from);
    return parseCoverProxyUrl(next.href, "redirect");
  } catch {
    return null;
  }
}

/**
 * Map upstream Content-Type to jpeg/png, or null to reject (WebP/GIF/other).
 */
export function allowedCoverProxyContentType(
  contentType: string | null | undefined,
): AllowedCoverProxyType | null {
  if (!contentType) return null;
  const lower = contentType.toLowerCase().split(";")[0]!.trim();
  if (lower === "image/jpeg" || lower === "image/jpg") return "image/jpeg";
  if (lower === "image/png") return "image/png";
  return null;
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

export type CoverProxyFetchOk = {
  ok: true;
  body: Uint8Array;
  contentType: AllowedCoverProxyType;
};

export type CoverProxyFetchErr = {
  ok: false;
  /** HTTP status to return to the client */
  status: number;
  message: string;
  /** When true, use Cache-Control: no-store (client/input errors). */
  noStore?: boolean;
};

export type CoverProxyFetchResult = CoverProxyFetchOk | CoverProxyFetchErr;

export type CoverProxyFetchOptions = {
  fetchImpl?: typeof fetch;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
};

/**
 * Fetch a catalog cover with manual redirect following and host re-validation
 * on every hop. Only returns JPEG or PNG bodies.
 */
export async function fetchProxiedCover(
  requestUrl: string,
  options: CoverProxyFetchOptions = {},
): Promise<CoverProxyFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxBytes = options.maxBytes ?? MAX_COVER_PROXY_BYTES;
  const timeoutMs = options.timeoutMs ?? COVER_PROXY_FETCH_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? COVER_PROXY_MAX_REDIRECTS;

  let current = parseCoverProxyUrl(requestUrl, "request");
  if (!current) {
    return {
      ok: false,
      status: 400,
      message: "Host not allowed",
      noStore: true,
    };
  }

  let redirects = 0;
  while (true) {
    let upstream: Response;
    try {
      upstream = await fetchImpl(current.href, {
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          // Prefer formats old Safari can decode; never ask for WebP first.
          Accept: "image/jpeg,image/png,image/*;q=0.1",
          Referer: "",
          "User-Agent": "StoryShelfCoverProxy/1.0 (family book catalog)",
        },
      });
    } catch {
      return { ok: false, status: 502, message: "Cover unavailable" };
    }

    // Manual redirect hop — re-check host before following.
    if (
      upstream.status >= 300 &&
      upstream.status < 400 &&
      upstream.headers.has("location")
    ) {
      if (redirects >= maxRedirects) {
        return {
          ok: false,
          status: 502,
          message: "Too many redirects",
        };
      }
      const next = resolveAllowedRedirectUrl(
        current,
        upstream.headers.get("location"),
      );
      if (!next) {
        return {
          ok: false,
          status: 400,
          message: "Redirect host not allowed",
          noStore: true,
        };
      }
      current = next;
      redirects += 1;
      continue;
    }

    if (!upstream.ok) {
      const status =
        upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502;
      return { ok: false, status, message: "Cover unavailable" };
    }

    // Defense in depth: if the runtime still exposes a final URL, re-check it.
    if (upstream.url) {
      const finalParsed = parseCoverProxyUrl(upstream.url, "redirect");
      if (!finalParsed) {
        return {
          ok: false,
          status: 400,
          message: "Final host not allowed",
          noStore: true,
        };
      }
    }

    const contentType = allowedCoverProxyContentType(
      upstream.headers.get("content-type"),
    );
    if (!contentType) {
      return {
        ok: false,
        status: 400,
        message: "Cover must be JPEG or PNG",
        noStore: true,
      };
    }

    const buf = new Uint8Array(await upstream.arrayBuffer());
    if (buf.byteLength === 0) {
      return { ok: false, status: 502, message: "Cover unavailable" };
    }
    if (buf.byteLength > maxBytes) {
      return {
        ok: false,
        status: 400,
        message: "Image too large",
        noStore: true,
      };
    }

    return { ok: true, body: buf, contentType };
  }
}
