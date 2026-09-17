import type { Book } from "./books.types.ts";
import {
  canonicalIsbn,
  extractIsbnFromUrl,
  looksLikeIsbn,
  looksLikeUrl,
} from "./isbn.ts";
import type { WishlistItem } from "./wishlist.types.ts";

export type GiftCheckHit = {
  title: string;
  authors: string;
  isbn: string | null;
  coverUrl: string | null;
};

export type RankedHit = {
  status: "owned" | "wishlist";
  hit: GiftCheckHit;
  score: number;
};

export type GiftCheckResult =
  | { status: "owned"; hit: GiftCheckHit }
  | { status: "wishlist"; hit: GiftCheckHit }
  | { status: "missing"; query: string }
  | { status: "no-isbn"; query: string }
  | { status: "ambiguous"; hits: RankedHit[] };

function bookToHit(book: Book): GiftCheckHit {
  return {
    title: book.title,
    authors: book.authors,
    isbn: book.isbn,
    coverUrl: book.coverUrl,
  };
}

function wishToHit(item: WishlistItem): GiftCheckHit {
  return {
    title: item.title,
    authors: item.authors,
    isbn: item.isbn,
    coverUrl: item.coverUrl,
  };
}

function isbnEquals(a: string | null | undefined, raw: string): boolean {
  if (!a) return false;
  const left = canonicalIsbn(a);
  const right = canonicalIsbn(raw);
  return Boolean(left && right && left === right);
}

function scoreTitleMatch(
  title: string,
  authors: string,
  query: string,
): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = title.trim().toLowerCase();
  const a = authors.trim().toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  if (`${t} ${a}`.includes(q)) return 40;
  return 0;
}

function collectTitleHits(
  books: Book[],
  wishlist: WishlistItem[],
  query: string,
): RankedHit[] {
  const ranked: RankedHit[] = [];
  for (const book of books) {
    const score = scoreTitleMatch(book.title, book.authors, query);
    if (score > 0) {
      ranked.push({ status: "owned", hit: bookToHit(book), score });
    }
  }
  for (const item of wishlist) {
    const score = scoreTitleMatch(item.title, item.authors, query);
    if (score > 0) {
      ranked.push({ status: "wishlist", hit: wishToHit(item), score });
    }
  }
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.status !== b.status) return a.status === "owned" ? -1 : 1;
    return a.hit.title.localeCompare(b.hit.title);
  });
  return ranked;
}

function resolveByIsbn(
  isbn: string,
  books: Book[],
  wishlist: WishlistItem[],
  displayQuery: string,
): GiftCheckResult {
  const owned = books.find((b) => isbnEquals(b.isbn, isbn));
  if (owned) return { status: "owned", hit: bookToHit(owned) };
  const wished = wishlist.find((w) => isbnEquals(w.isbn, isbn));
  if (wished) return { status: "wishlist", hit: wishToHit(wished) };
  return { status: "missing", query: displayQuery };
}

/** Resolve gift-check: empty → null; URL/ISBN clear; title may be ambiguous (≤3). */
export function resolveGiftCheck(
  query: string,
  books: Book[],
  wishlist: WishlistItem[],
): GiftCheckResult | null {
  const q = query.trim();
  if (!q) return null;

  if (looksLikeUrl(q)) {
    const isbn = extractIsbnFromUrl(q);
    if (!isbn) return { status: "no-isbn", query: q };
    return resolveByIsbn(isbn, books, wishlist, isbn);
  }

  if (looksLikeIsbn(q)) {
    return resolveByIsbn(q, books, wishlist, q);
  }

  const ranked = collectTitleHits(books, wishlist, q);
  if (ranked.length === 0) return { status: "missing", query: q };
  if (ranked.length === 1) {
    const only = ranked[0];
    return { status: only.status, hit: only.hit };
  }
  return { status: "ambiguous", hits: ranked.slice(0, 3) };
}
