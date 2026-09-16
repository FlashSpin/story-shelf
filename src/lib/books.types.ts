export const AGE_BANDS = [
  "Board book",
  "Picture book",
  "Early reader",
  "Chapter book",
  "Middle grade",
  "Young adult",
] as const;

export type AgeBand = (typeof AGE_BANDS)[number];

export function parseAgeBand(value: string | null | undefined): AgeBand | null {
  return AGE_BANDS.includes(value as AgeBand) ? (value as AgeBand) : null;
}

export type Book = {
  id: number;
  title: string;
  authors: string;
  isbn: string | null;
  coverUrl: string | null;
  publisher: string | null;
  publishedYear: string | null;
  pageCount: number | null;
  description: string | null;
  notes: string | null;
  ageBand: string | null;
  addedAt: string;
};

export type BookHit = {
  title: string;
  authors: string;
  isbn: string | null;
  coverUrl: string | null;
  publisher: string | null;
  publishedYear: string | null;
  pageCount: number | null;
  description: string | null;
  source: "open-library" | "google";
};

export type BookDraft = {
  title: string;
  authors: string;
  isbn?: string | null;
  coverUrl?: string | null;
  coverData?: string | null;
  publisher?: string | null;
  publishedYear?: string | null;
  pageCount?: number | null;
  description?: string | null;
  notes?: string | null;
  ageBand?: string | null;
};
