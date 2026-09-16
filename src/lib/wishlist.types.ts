export type WishlistItem = {
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
  addedAt: string;
};

export type WishlistDraft = {
  title: string;
  authors: string;
  isbn?: string | null;
  coverUrl?: string | null;
  publisher?: string | null;
  publishedYear?: string | null;
  pageCount?: number | null;
  description?: string | null;
  notes?: string | null;
};
