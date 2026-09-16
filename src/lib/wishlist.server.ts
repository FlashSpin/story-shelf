import { getSql } from "@/lib/db";
import { canonicalIsbn } from "@/lib/isbn";
import { publicListCoverUrl } from "@/lib/cover-image";
import type { Book } from "@/lib/books.types";
import { findBookByIsbn, insertBook } from "@/lib/books.server";
import type { WishlistDraft, WishlistItem } from "@/lib/wishlist.types";

type WishlistRow = {
  id: number;
  title: string;
  authors: string;
  isbn: string | null;
  cover_url: string | null;
  publisher: string | null;
  published_year: string | null;
  page_count: number | null;
  description: string | null;
  notes: string | null;
  added_at: string | Date;
};

function asIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function mapItem(row: WishlistRow): WishlistItem {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    isbn: row.isbn,
    coverUrl: publicListCoverUrl(row.cover_url),
    publisher: row.publisher,
    publishedYear: row.published_year,
    pageCount: row.page_count,
    description: row.description,
    notes: row.notes,
    addedAt: asIso(row.added_at),
  };
}

const SELECT = `
  id, title, authors, isbn,
  case
    when cover_url ~* '^https?://' then cover_url
    else null
  end as cover_url,
  publisher, published_year,
  page_count, description, notes, added_at
`;

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export async function listWishlistFromDb(): Promise<WishlistItem[]> {
  const sql = await getSql();
  const rows = await sql.query<WishlistRow>(
    `select ${SELECT} from wishlist_items order by added_at desc, id desc`,
  );
  return rows.map(mapItem);
}

export async function findWishlistByIsbn(
  isbn: string,
): Promise<WishlistItem | null> {
  const canon = canonicalIsbn(isbn);
  if (!canon) return null;
  const sql = await getSql();
  const rows = await sql.query<WishlistRow>(
    `select ${SELECT} from wishlist_items where isbn = $1 limit 1`,
    [canon],
  );
  return rows[0] ? mapItem(rows[0]) : null;
}

export async function findWishlistById(
  id: number,
): Promise<WishlistItem | null> {
  const sql = await getSql();
  const rows = await sql.query<WishlistRow>(
    `select ${SELECT} from wishlist_items where id = $1 limit 1`,
    [id],
  );
  return rows[0] ? mapItem(rows[0]) : null;
}

export async function insertWishlistItem(
  draft: WishlistDraft,
): Promise<WishlistItem> {
  const isbn = draft.isbn ? canonicalIsbn(draft.isbn) : null;
  const coverUrl = publicListCoverUrl(draft.coverUrl);
  const sql = await getSql();
  const rows = await sql.query<WishlistRow>(
    `insert into wishlist_items (
       title, authors, isbn, cover_url, publisher, published_year,
       page_count, description, notes
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning ${SELECT}`,
    [
      draft.title.trim(),
      (draft.authors ?? "").trim(),
      isbn,
      coverUrl,
      draft.publisher?.trim() || null,
      draft.publishedYear?.trim() || null,
      draft.pageCount ?? null,
      truncate(draft.description, 800),
      draft.notes?.trim() || null,
    ],
  );
  if (!rows[0]) throw new Error("Failed to add wishlist item");
  return mapItem(rows[0]);
}

export async function deleteWishlistById(id: number): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql.query<{ id: number }>(
    `delete from wishlist_items where id = $1 returning id`,
    [id],
  );
  return rows.length > 0;
}

/** Drop wishlist rows that match an ISBN once the title is owned. */
export async function deleteWishlistByIsbn(isbn: string): Promise<number> {
  const canon = canonicalIsbn(isbn);
  if (!canon) return 0;
  const sql = await getSql();
  const rows = await sql.query<{ id: number }>(
    `delete from wishlist_items where isbn = $1 returning id`,
    [canon],
  );
  return rows.length;
}

export type MoveWishlistResult =
  | { ok: true; book: Book }
  | { ok: false; reason: "missing" }
  | { ok: false; reason: "duplicate"; existing: Book };

/** Move a wishlist gift idea onto the owned shelf, then remove the wish. */
export async function moveWishlistItemToShelf(
  id: number,
): Promise<MoveWishlistResult> {
  const item = await findWishlistById(id);
  if (!item) return { ok: false, reason: "missing" };

  if (item.isbn) {
    const existing = await findBookByIsbn(item.isbn);
    if (existing) {
      await deleteWishlistById(id);
      return { ok: false, reason: "duplicate", existing };
    }
  }

  const book = await insertBook({
    title: item.title,
    authors: item.authors,
    isbn: item.isbn,
    coverUrl: item.coverUrl,
    publisher: item.publisher,
    publishedYear: item.publishedYear,
    pageCount: item.pageCount,
    description: item.description,
    notes: item.notes,
  });
  await deleteWishlistById(id);
  return { ok: true, book };
}
