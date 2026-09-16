import { getSql } from "@/lib/db";
import { canonicalIsbn } from "@/lib/isbn";
import type { Book, BookDraft, BookHit } from "@/lib/books.types";
import { isCoverDataUrl, publicListCoverUrl } from "@/lib/cover-image";

type BookRow = {
  id: number;
  title: string;
  authors: string;
  isbn: string | null;
  cover_url: string | null;
  has_cover_data?: boolean;
  publisher: string | null;
  published_year: string | null;
  page_count: number | null;
  description: string | null;
  notes: string | null;
  age_band: string | null;
  added_at: string | Date;
};

function asIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function mapBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    isbn: row.isbn,
    coverUrl: publicListCoverUrl(row.cover_url),
    hasCoverUpload: Boolean(row.has_cover_data),
    publisher: row.publisher,
    publishedYear: row.published_year,
    pageCount: row.page_count,
    description: row.description,
    notes: row.notes,
    ageBand: row.age_band,
    addedAt: asIso(row.added_at),
  };
}

/**
 * List/detail SELECT: never pulls `cover_data` bytes. HTTPS covers stay in
 * `cover_url`; uploads live in `cover_data` and surface only as `has_cover_data`.
 */
const SELECT = `
  id, title, authors, isbn,
  case
    when cover_url ~* '^https?://' then cover_url
    else null
  end as cover_url,
  (cover_data is not null) as has_cover_data,
  publisher, published_year,
  page_count, description, notes, age_band, added_at
`;

export async function listBooksFromDb(): Promise<Book[]> {
  const sql = await getSql();
  const rows = await sql.query<BookRow>(
    `select ${SELECT} from books order by added_at desc, id desc`,
  );
  return rows.map(mapBook);
}

export async function findBookByIsbn(isbn: string): Promise<Book | null> {
  const canon = canonicalIsbn(isbn);
  if (!canon) return null;
  const sql = await getSql();
  const rows = await sql.query<BookRow>(
    `select ${SELECT} from books where isbn = $1 limit 1`,
    [canon],
  );
  return rows[0] ? mapBook(rows[0]) : null;
}

export async function findBookById(id: number): Promise<Book | null> {
  const sql = await getSql();
  const rows = await sql.query<BookRow>(
    `select ${SELECT} from books where id = $1 limit 1`,
    [id],
  );
  return rows[0] ? mapBook(rows[0]) : null;
}

/** Uploaded cover data-URL for detail display (not included in list payloads). */
export async function getBookCoverData(id: number): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql.query<{ cover_data: string | null }>(
    `select cover_data from books where id = $1 limit 1`,
    [id],
  );
  const value = rows[0]?.cover_data ?? null;
  return value && isCoverDataUrl(value) ? value : null;
}

function splitCoverFields(draft: BookDraft): {
  coverUrl: string | null;
  coverData: string | null;
} {
  const coverData =
    draft.coverData && isCoverDataUrl(draft.coverData) ? draft.coverData : null;
  // Prefer explicit HTTPS catalog URL; never persist data URLs in cover_url.
  const coverUrl = publicListCoverUrl(draft.coverUrl);
  return { coverUrl, coverData };
}

export async function insertBook(draft: BookDraft): Promise<Book> {
  const isbn = draft.isbn ? canonicalIsbn(draft.isbn) : null;
  const { coverUrl, coverData } = splitCoverFields(draft);
  const sql = await getSql();
  const rows = await sql.query<BookRow>(
    `insert into books (
       title, authors, isbn, cover_url, cover_data, publisher, published_year,
       page_count, description, notes, age_band
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     returning ${SELECT}`,
    [
      draft.title.trim(),
      (draft.authors ?? "").trim(),
      isbn,
      coverUrl,
      coverData,
      draft.publisher?.trim() || null,
      draft.publishedYear?.trim() || null,
      draft.pageCount ?? null,
      truncate(draft.description, 800),
      draft.notes?.trim() || null,
      draft.ageBand?.trim() || null,
    ],
  );
  if (!rows[0]) throw new Error("Failed to add book");
  return mapBook(rows[0]);
}

export async function updateBookNotes(
  id: number,
  notes: string | null,
  ageBand: string | null,
): Promise<Book | null> {
  const sql = await getSql();
  const rows = await sql.query<BookRow>(
    `update books
        set notes = $2, age_band = $3
      where id = $1
      returning ${SELECT}`,
    [id, notes?.trim() || null, ageBand?.trim() || null],
  );
  return rows[0] ? mapBook(rows[0]) : null;
}

export async function updateBookCover(
  id: number,
  coverData: string,
): Promise<Book | null> {
  if (!isCoverDataUrl(coverData)) return null;
  const sql = await getSql();
  // Store uploads in cover_data; leave HTTPS cover_url as list/grid fallback.
  const rows = await sql.query<BookRow>(
    `update books set cover_data = $2 where id = $1 returning ${SELECT}`,
    [id, coverData],
  );
  return rows[0] ? mapBook(rows[0]) : null;
}

export async function deleteBookById(id: number): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql.query<{ id: number }>(
    `delete from books where id = $1 returning id`,
    [id],
  );
  return rows.length > 0;
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function httpsUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\//i, "https://");
}

function googleCover(url: string | null | undefined): string | null {
  if (!url) return null;
  return httpsUrl(url)
    ?.replace("&edge=curl", "")
    .replace("zoom=1", "zoom=2") ?? null;
}

function olCoverFromIsbn(isbn: string | null): string | null {
  const canon = isbn ? canonicalIsbn(isbn) : null;
  return canon ? `https://covers.openlibrary.org/b/isbn/${canon}-L.jpg` : null;
}

const FETCH_INIT: RequestInit = {
  headers: {
    Accept: "application/json",
    "User-Agent": "StoryShelf/1.0 (family book catalog)",
  },
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...FETCH_INIT,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type OlSearchDoc = {
  title?: string;
  author_name?: string[];
  isbn?: string[];
  cover_i?: number;
  publisher?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
};

type OlSearchResponse = { docs?: OlSearchDoc[] };

type GBooksResponse = {
  items?: Array<{
    volumeInfo?: {
      title?: string;
      authors?: string[];
      publisher?: string;
      publishedDate?: string;
      pageCount?: number;
      description?: string;
      imageLinks?: { thumbnail?: string; smallThumbnail?: string };
      industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
    };
  }>;
};

function pickIsbn(ids: string[] | undefined): string | null {
  if (!ids?.length) return null;
  for (const id of ids) {
    const canon = canonicalIsbn(id);
    if (canon) return canon;
  }
  return null;
}

function fromOlDoc(doc: OlSearchDoc): BookHit | null {
  const title = doc.title?.trim();
  if (!title) return null;
  const isbn = pickIsbn(doc.isbn);
  const coverUrl = doc.cover_i
    ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
    : olCoverFromIsbn(isbn);
  return {
    title,
    authors: (doc.author_name ?? []).join(", "),
    isbn,
    coverUrl,
    publisher: doc.publisher?.[0] ?? null,
    publishedYear: doc.first_publish_year ? String(doc.first_publish_year) : null,
    pageCount: doc.number_of_pages_median ?? null,
    description: null,
    source: "open-library",
  };
}

function fromGoogleItem(
  item: NonNullable<GBooksResponse["items"]>[number],
): BookHit | null {
  const info = item.volumeInfo;
  const title = info?.title?.trim();
  if (!title) return null;
  const isbn13 = info?.industryIdentifiers?.find((i) => i.type === "ISBN_13")
    ?.identifier;
  const isbn10 = info?.industryIdentifiers?.find((i) => i.type === "ISBN_10")
    ?.identifier;
  const isbn = pickIsbn([isbn13, isbn10].filter(Boolean) as string[]);
  const year = info?.publishedDate?.slice(0, 4) ?? null;
  return {
    title,
    authors: (info?.authors ?? []).join(", "),
    isbn,
    coverUrl:
      googleCover(info?.imageLinks?.thumbnail) ??
      googleCover(info?.imageLinks?.smallThumbnail) ??
      olCoverFromIsbn(isbn),
    publisher: info?.publisher ?? null,
    publishedYear: year,
    pageCount: info?.pageCount ?? null,
    description: truncate(info?.description, 800),
    source: "google",
  };
}

function hitKey(hit: BookHit): string {
  if (hit.isbn) return `isbn:${hit.isbn}`;
  return `t:${hit.title.toLowerCase()}|${hit.authors.toLowerCase()}`;
}

function mergeHits(groups: BookHit[][]): BookHit[] {
  const map = new Map<string, BookHit>();
  for (const group of groups) {
    for (const hit of group) {
      const key = hitKey(hit);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, hit);
        continue;
      }
      map.set(key, {
        ...existing,
        coverUrl: existing.coverUrl ?? hit.coverUrl,
        publisher: existing.publisher ?? hit.publisher,
        publishedYear: existing.publishedYear ?? hit.publishedYear,
        pageCount: existing.pageCount ?? hit.pageCount,
        description: existing.description ?? hit.description,
        isbn: existing.isbn ?? hit.isbn,
      });
    }
  }
  return [...map.values()];
}

export async function searchExternalCatalog(query: string): Promise<BookHit[]> {
  const q = query.trim();
  if (!q) return [];
  const isbn = canonicalIsbn(q);
  if (isbn) {
    const hit = await lookupIsbnExternal(isbn);
    return hit ? [hit] : [];
  }

  const encoded = encodeURIComponent(q);
  const [ol, gb] = await Promise.all([
    fetchJson<OlSearchResponse>(
      `https://openlibrary.org/search.json?q=${encoded}&limit=12`,
    ),
    fetchJson<GBooksResponse>(
      `https://www.googleapis.com/books/v1/volumes?q=${encoded}&maxResults=12`,
    ),
  ]);

  const olHits = (ol?.docs ?? [])
    .map(fromOlDoc)
    .filter((h): h is BookHit => Boolean(h));
  const gbHits = (gb?.items ?? [])
    .map(fromGoogleItem)
    .filter((h): h is BookHit => Boolean(h));
  return mergeHits([gbHits, olHits]).slice(0, 12);
}

type OlIsbnResponse = Record<
  string,
  {
    title?: string;
    authors?: Array<{ name?: string }>;
    publishers?: Array<{ name?: string }>;
    publish_date?: string;
    number_of_pages?: number;
    cover?: { large?: string; medium?: string };
    identifiers?: { isbn_13?: string[]; isbn_10?: string[] };
  }
>;

export async function lookupIsbnExternal(raw: string): Promise<BookHit | null> {
  const isbn = canonicalIsbn(raw);
  if (!isbn) return null;

  const [ol, gb] = await Promise.all([
    fetchJson<OlIsbnResponse>(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    ),
    fetchJson<GBooksResponse>(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`,
    ),
  ]);

  const olBook = ol?.[`ISBN:${isbn}`];
  const olHit: BookHit | null = olBook?.title
    ? {
        title: olBook.title,
        authors: (olBook.authors ?? []).map((a) => a.name ?? "").filter(Boolean).join(", "),
        isbn,
        coverUrl:
          httpsUrl(olBook.cover?.large) ??
          httpsUrl(olBook.cover?.medium) ??
          olCoverFromIsbn(isbn),
        publisher: olBook.publishers?.[0]?.name ?? null,
        publishedYear: olBook.publish_date?.match(/\d{4}/)?.[0] ?? null,
        pageCount: olBook.number_of_pages ?? null,
        description: null,
        source: "open-library",
      }
    : null;

  const gbHit = gb?.items?.[0] ? fromGoogleItem(gb.items[0]) : null;
  if (gbHit && !gbHit.isbn) gbHit.isbn = isbn;

  const merged = mergeHits([[olHit, gbHit].filter((h): h is BookHit => Boolean(h))]);
  return merged[0] ?? null;
}
