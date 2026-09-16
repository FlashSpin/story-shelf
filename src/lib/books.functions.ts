import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware, requireEditorMiddleware } from "@/lib/auth/middleware";
import type { Book, BookHit } from "@/lib/books.types";
import { AGE_BANDS } from "@/lib/books.types";

const ageBandSchema = z.union([z.enum(AGE_BANDS), z.literal(""), z.null()]).optional();

const coverDataSchema = z
  .string()
  .max(400_000)
  .regex(/^data:image\/(jpeg|png|webp);base64,/i)
  .optional()
  .nullable();

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
  coverData: coverDataSchema,
  publisher: z.string().trim().max(200).optional().nullable(),
  publishedYear: z.string().trim().max(12).optional().nullable(),
  pageCount: z.number().int().min(1).max(20000).optional().nullable(),
  description: z.string().trim().max(1200).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  ageBand: ageBandSchema,
});

export const listBooks = createServerFn({ method: "GET" }).handler(
  async (): Promise<Book[]> => {
    const { listBooksFromDb } = await import("./books.server");
    return listBooksFromDb();
  },
);

/** Fetch uploaded cover bytes for detail view (omitted from list payloads). */
export const getBookCover = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }): Promise<string | null> => {
    const { getBookCoverData } = await import("./books.server");
    return getBookCoverData(data.id);
  });

/** Whether the current session may mutate the shelf (env/DB editors / auth-off). */
export const getShelfEditorStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ isEditor: boolean }> => {
    const { authConfigured } = await import("@/lib/auth/verify.server");
    const { gateIdentityEnabled } = await import("@/lib/auth/gate-identity.server");
    const { isShelfEditor } = await import("@/lib/auth/shelf-editors.server");
    // Local auth-off + PGLite: shared DEV_USER may mutate.
    if (!authConfigured && !gateIdentityEnabled()) {
      return { isEditor: true };
    }
    // authMiddleware forwards the preview bearer token and verifies the session
    // (cookie when deployed). Without it, getSessionUser() saw no session and
    // canEdit stayed false for signed-in editors.
    return { isEditor: await isShelfEditor(context.userEmail) };
  });

export const searchCatalog = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string().trim().min(1).max(200) }))
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<BookHit[]> => {
    const { searchExternalCatalog } = await import("./books.server");
    return searchExternalCatalog(data.q);
  });

export const lookupIsbn = createServerFn({ method: "GET" })
  .validator(z.object({ isbn: z.string().trim().min(10).max(32) }))
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<BookHit | null> => {
    const { lookupIsbnExternal } = await import("./books.server");
    return lookupIsbnExternal(data.isbn);
  });

export type AddBookResult =
  | { ok: true; book: Book }
  | { ok: false; reason: "duplicate"; existing: Book };

export const addBook = createServerFn({ method: "POST" })
  .validator(draftSchema)
  .middleware([authMiddleware, requireEditorMiddleware])
  .handler(async ({ data }): Promise<AddBookResult> => {
    const { findBookByIsbn, insertBook } = await import("./books.server");
    if (data.isbn) {
      const existing = await findBookByIsbn(data.isbn);
      if (existing) return { ok: false, reason: "duplicate", existing };
    }
    // Keep HTTPS catalog covers in coverUrl; uploaded data URLs stay in coverData.
    const book = await insertBook({
      ...data,
      coverUrl: data.coverUrl,
      coverData: data.coverData,
    });
    // Gift idea fulfilled — drop matching wishlist ISBN if present.
    if (book.isbn) {
      const { deleteWishlistByIsbn } = await import("./wishlist.server");
      await deleteWishlistByIsbn(book.isbn);
    }
    return { ok: true, book };
  });

export const updateBook = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.number().int().positive(),
      notes: z.string().trim().max(500).nullable(),
      ageBand: ageBandSchema,
    }),
  )
  .middleware([authMiddleware, requireEditorMiddleware])
  .handler(async ({ data }): Promise<Book | null> => {
    const { updateBookNotes } = await import("./books.server");
    return updateBookNotes(data.id, data.notes, data.ageBand ?? null);
  });

export const updateCover = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id: z.number().int().positive(),
      coverData: z
        .string()
        .min(32)
        .max(400_000)
        .regex(/^data:image\/(jpeg|png|webp);base64,/i),
    }),
  )
  .middleware([authMiddleware, requireEditorMiddleware])
  .handler(async ({ data }): Promise<Book | null> => {
    const { updateBookCover } = await import("./books.server");
    return updateBookCover(data.id, data.coverData);
  });

export const removeBook = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .middleware([authMiddleware, requireEditorMiddleware])
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { deleteBookById } = await import("./books.server");
    return { ok: await deleteBookById(data.id) };
  });
