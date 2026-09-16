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
