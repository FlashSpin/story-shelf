export function normalizeIsbn(raw: string): string {
  return raw.replace(/[^0-9Xx]/g, "").toUpperCase();
}

export function looksLikeIsbn(raw: string): boolean {
  const n = normalizeIsbn(raw);
  return n.length === 10 || n.length === 13;
}

function isbn13Checksum(digits12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

export function isbn10To13(isbn10: string): string | null {
  const n = normalizeIsbn(isbn10);
  if (n.length !== 10) return null;
  const core = `978${n.slice(0, 9)}`;
  return core + isbn13Checksum(core);
}

export function canonicalIsbn(raw: string): string | null {
  const n = normalizeIsbn(raw);
  if (n.length === 13 && /^\d{13}$/.test(n)) return n;
  if (n.length === 10) return isbn10To13(n);
  return null;
}

export function formatIsbn(raw: string | null | undefined): string {
  if (!raw) return "";
  const n = canonicalIsbn(raw) ?? normalizeIsbn(raw);
  if (n.length === 13) {
    return `${n.slice(0, 3)}-${n.slice(3, 4)}-${n.slice(4, 9)}-${n.slice(9, 12)}-${n.slice(12)}`;
  }
  return n;
}

/** Loose check: pasted http(s) link or common bookshop host without scheme. */
export function looksLikeUrl(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^(www\.)?amazon\.[a-z.]+(\/|$)/i.test(t)) return true;
  if (/^(www\.)?amzn\.to(\/|$)/i.test(t)) return true;
  if (/^(www\.)?bookshop\.org(\/|$)/i.test(t)) return true;
  if (/^(www\.)?waterstones\.com(\/|$)/i.test(t)) return true;
  if (/^(www\.)?barnesandnoble\.com(\/|$)/i.test(t)) return true;
  if (/^(www\.)?blackwells\.co\.uk(\/|$)/i.test(t)) return true;
  return false;
}

function isbn10ChecksumOk(n: string): boolean {
  if (!/^\d{9}[\dX]$/.test(n)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += Number(n[i]) * (10 - i);
  }
  const check = n[9] === "X" ? 10 : Number(n[9]);
  sum += check;
  return sum % 11 === 0;
}

function isbn13ChecksumOk(n: string): boolean {
  if (!/^\d{13}$/.test(n)) return false;
  return isbn13Checksum(n.slice(0, 12)) === n[12];
}

/** Prefer ISBN-13; accept checksum-valid ISBN-10 (Amazon book ASINs). */
export function parseIsbnCandidate(raw: string): string | null {
  const n = normalizeIsbn(raw);
  if (n.length === 13 && /^97[89]\d{10}$/.test(n) && isbn13ChecksumOk(n)) {
    return n;
  }
  if (n.length === 10 && isbn10ChecksumOk(n)) {
    return isbn10To13(n);
  }
  return null;
}

function candidatesFromSearchParams(params: URLSearchParams): string[] {
  const keys = ["isbn", "ISBN", "asin", "ASIN"];
  const out: string[] = [];
  for (const key of keys) {
    const v = params.get(key);
    if (v) out.push(v);
  }
  return out;
}

function candidatesFromPath(pathname: string): string[] {
  const out: string[] = [];
  const segments = pathname.split("/").filter(Boolean);
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const lower = seg.toLowerCase();
    // /dp/ASIN, /gp/product/ASIN, /gp/aw/d/ASIN, /product/ASIN
    if (
      lower === "dp" ||
      lower === "product" ||
      lower === "d" ||
      lower === "isbn"
    ) {
      const next = segments[i + 1];
      if (next) out.push(next.split("?")[0] ?? next);
    }
    // slug-9780140328721 or ISBN-9780140328721
    const slugIsbn = seg.match(/(?:^|[-_])((?:97[89]\d{10})|(?:\d{9}[\dXx]))$/);
    if (slugIsbn?.[1]) out.push(slugIsbn[1]);
    // bare path segment that is already an ISBN
    if (/^(97[89]\d{10}|\d{9}[\dXx])$/i.test(seg)) out.push(seg);
  }
  return out;
}

function scanTextForIsbns(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/97[89][\d-]{10,17}/g)) {
    out.push(m[0]);
  }
  return out;
}

/**
 * Pull a canonical ISBN-13 from an Amazon / bookshop product URL when present.
 * Returns null when the link has no extractable ISBN (e.g. Kindle ASIN, short link).
 */
export function extractIsbnFromUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let href = trimmed;
  if (!/^https?:\/\//i.test(href)) {
    href = `https://${href.replace(/^\/+/, "")}`;
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    // Still scan the raw string for an embedded ISBN-13.
    for (const c of scanTextForIsbns(trimmed)) {
      const parsed = parseIsbnCandidate(c);
      if (parsed) return parsed;
    }
    return null;
  }

  const ordered = [
    ...candidatesFromSearchParams(url.searchParams),
    ...candidatesFromPath(url.pathname),
    ...scanTextForIsbns(`${url.pathname}${url.search}`),
  ];

  for (const c of ordered) {
    const parsed = parseIsbnCandidate(c);
    if (parsed) return parsed;
  }
  return null;
}
