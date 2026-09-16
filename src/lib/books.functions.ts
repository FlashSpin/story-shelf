import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { Book, BookHit } from "@/lib/books.types";
import { AGE_BANDS } from "@/lib/books.types";

const ageBandSchema = z.union([z.enum(AGE_BANDS), z.literal(""), z.null()]).optional();

const coverDataSchema = z
  .string()
  .max(400_000)
  .regex(/^data:image\/(jpeg|png|webp);base64,/i)
  .optional()
  .nullable();

const draftSchema = z.object({
  title: z.string().trim().min(1).max(300),
  authors: z.string().trim().max(300).optional().default(""),
  isbn: z.string().trim().max(32).optional().nullable(),
  coverUrl: z.string().trim().max(2000).optional().nullable(),
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

export const searchCatalog = createServerFn({ method: "GET" })
  .validator(z.object({ q: z.string().trim().min(1).max(200) }))
  .handler(async ({ data }): Promise<BookHit[]> => {
    const { searchExternalCatalog } = await import("./books.server");
    return searchExternalCatalog(data.q);
  });

export const lookupIsbn = createServerFn({ method: "GET" })
  .validator(z.object({ isbn: z.string().trim().min(10).max(32) }))
  .handler(async ({ data }): Promise<BookHit | null> => {
    const { lookupIsbnExternal } = await import("./books.server");
    return lookupIsbnExternal(data.isbn);
  });

export type AddBookResult =
  | { ok: true; book: Book }
  | { ok: false; reason: "duplicate"; existing: Book };

export const addBook = createServerFn({ method: "POST" })
  .validator(draftSchema)
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<AddBookResult> => {
    const { findBookByIsbn, insertBook } = await import("./books.server");
    if (data.isbn) {
      const existing = await findBookByIsbn(data.isbn);
      if (existing) return { ok: false, reason: "duplicate", existing };
    }
    const book = await insertBook({
      ...data,
      coverUrl: data.coverData || data.coverUrl,
    });
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
  .middleware([authMiddleware])
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
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<Book | null> => {
    const { updateBookCover } = await import("./books.server");
    return updateBookCover(data.id, data.coverData);
  });

export const removeBook = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int().positive() }))
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { deleteBookById } = await import("./books.server");
    return { ok: await deleteBookById(data.id) };
  });
