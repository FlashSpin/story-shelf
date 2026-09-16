import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware, requireEditorMiddleware } from "@/lib/auth/middleware";
import type { Book } from "@/lib/books.types";
import type { WishlistItem } from "@/lib/wishlist.types";

/** Catalog / external covers only — never accept data URLs on coverUrl. */
const coverUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .regex(/^https?:\/\//i, "coverUrl must be an http(s) URL")
  .optional()
  .nullable();

const draftSchema = z.object({
  title: z.string().trim().min(1).max(300),
  authors: z.string().trim().max(300).optional().default(""),
  isbn: z.string().trim().max(32).optional().nullable(),
  coverUrl: coverUrlSchema,
  publisher: z.string().trim().max(200).optional().nullable(),
  publishedYear: z.string().trim().max(12).optional().nullable(),
  pageCount: z.number().int().min(1).max(20000).optional().nullable(),
  description: z.string().trim().max(1200).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const listWishlist = createServerFn({ method: "GET" }).handler(
  async (): Promise<WishlistItem[]> => {
    const { listWishlistFromDb } = await import("./wishlist.server");
    return listWishlistFromDb();
  },
);

export type AddWishlistResult =
  | { ok: true; item: WishlistItem }
  | { ok: false; reason: "duplicate-wishlist"; existing: WishlistItem }
  | { ok: false; reason: "already-owned"; existing: Book };

export const addWishlistItem = createServerFn({ method: "POST" })
  .validator(draftSchema)
  .middleware([authMiddleware, requireEditorMiddleware])
  .handler(async ({ data }): Promise<AddWishlistResult> => {
    const { findBookByIsbn } = await import("./books.server");
    const { findWishlistByIsbn, insertWishlistItem } = await import(
      "./wishlist.server"
    );

    if (data.isbn) {
      const owned = await findBookByIsbn(data.isbn);
      if (owned) return { ok: false, reason: "already-owned", existing: owned };
      const wished = await findWishlistByIsbn(data.isbn);
      if (wished)
        return { ok: false, reason: "duplicate-wishlist", existing: wished };
    }

    const item = await insertWishlistItem(data);
    return { ok: true, item };
  });

export const removeWishlistItem = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .middleware([authMiddleware, requireEditorMiddleware])
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { deleteWishlistById } = await import("./wishlist.server");
    return { ok: await deleteWishlistById(data.id) };
  });

export type MoveWishlistFnResult =
  | { ok: true; book: Book }
  | { ok: false; reason: "missing" }
  | { ok: false; reason: "duplicate"; existing: Book };

export const moveWishlistToShelf = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .middleware([authMiddleware, requireEditorMiddleware])
  .handler(async ({ data }): Promise<MoveWishlistFnResult> => {
    const { moveWishlistItemToShelf } = await import("./wishlist.server");
    return moveWishlistItemToShelf(data.id);
  });
