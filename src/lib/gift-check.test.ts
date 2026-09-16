import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Book } from "./books.types.ts";
import { resolveGiftCheck } from "./gift-check.ts";
import type { WishlistItem } from "./wishlist.types.ts";

function book(partial: Partial<Book> & Pick<Book, "id" | "title">): Book {
  return {
    authors: "",
    isbn: null,
    coverUrl: null,
    hasCoverUpload: false,
    publisher: null,
    publishedYear: null,
    pageCount: null,
    description: null,
    notes: null,
    ageBand: null,
    addedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function wish(
  partial: Partial<WishlistItem> & Pick<WishlistItem, "id" | "title">,
): WishlistItem {
  return {
    authors: "",
    isbn: null,
    coverUrl: null,
    publisher: null,
    publishedYear: null,
    pageCount: null,
    description: null,
    notes: null,
    addedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("resolveGiftCheck", () => {
  it("returns null for empty query", () => {
    assert.equal(resolveGiftCheck("  ", [], []), null);
  });

  it("marks ISBN as owned", () => {
    const owned = book({ id: 1, title: "Moon", isbn: "9780140328721" });
    const result = resolveGiftCheck("9780140328721", [owned], []);
    assert.equal(result?.status, "owned");
  });

  it("marks ISBN as wishlist", () => {
    const item = wish({ id: 1, title: "Wish", isbn: "9780140328721" });
    const result = resolveGiftCheck("9780140328721", [], [item]);
    assert.equal(result?.status, "wishlist");
  });

  it("marks unknown ISBN as missing", () => {
    const result = resolveGiftCheck("9780140328721", [], []);
    assert.equal(result?.status, "missing");
  });

  it("returns ambiguous with up to 3 rows", () => {
    const books = [
      book({ id: 1, title: "Dragon Night" }),
      book({ id: 2, title: "Dragon Day" }),
    ];
    const wishlist = [wish({ id: 3, title: "Dragon Song" })];
    const result = resolveGiftCheck("Dragon", books, wishlist);
    assert.equal(result?.status, "ambiguous");
    if (result?.status === "ambiguous") {
      assert.equal(result.hits.length, 3);
    }
  });
});
