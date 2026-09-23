import { canonicalIsbn } from "./isbn.ts";

/** Trim, collapse internal whitespace, lowercase — duplicate title/author key. */
export function normalizeBookField(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function sameTitleAuthors(
  a: { title: string; authors: string },
  b: { title: string; authors: string },
): boolean {
  return (
    normalizeBookField(a.title) === normalizeBookField(b.title) &&
    normalizeBookField(a.authors) === normalizeBookField(b.authors)
  );
}

export type BookIdentityFields = {
  title: string;
  authors: string;
  isbn?: string | null;
};

/**
 * Duplicate key for the owned shelf / wishlist:
 * - Prefer canonical ISBN when the draft has a valid one
 * - Else match normalized title + authors
 *
 * When the draft has a valid ISBN that is not on the list, it is not treated as
 * a duplicate even if title+authors match (different edition).
 */
export function findDuplicateByIdentity<T extends BookIdentityFields>(
  items: T[],
  draft: BookIdentityFields,
): T | undefined {
  const rawIsbn = draft.isbn?.trim();
  if (rawIsbn) {
    const canon = canonicalIsbn(rawIsbn);
    if (canon) {
      return items.find((item) => {
        if (!item.isbn) return false;
        return canonicalIsbn(item.isbn) === canon;
      });
    }
  }

  return items.find((item) => sameTitleAuthors(item, draft));
}
