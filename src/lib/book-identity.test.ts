import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findDuplicateByIdentity,
  normalizeBookField,
  sameTitleAuthors,
} from "./book-identity.ts";

describe("normalizeBookField", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    assert.equal(normalizeBookField("  The   Gruffalo  "), "the gruffalo");
    assert.equal(normalizeBookField("Julia\tDonaldson"), "julia donaldson");
  });
});

describe("sameTitleAuthors", () => {
  it("matches case-insensitively with collapsed whitespace", () => {
    assert.equal(
      sameTitleAuthors(
        { title: "The Gruffalo", authors: "Julia Donaldson" },
        { title: "  the   gruffalo ", authors: "julia  donaldson" },
      ),
      true,
    );
  });

  it("rejects different authors", () => {
    assert.equal(
      sameTitleAuthors(
        { title: "Matilda", authors: "Roald Dahl" },
        { title: "Matilda", authors: "Someone Else" },
      ),
      false,
    );
  });
});

describe("findDuplicateByIdentity", () => {
  const shelf = [
    {
      id: 1,
      title: "The Very Hungry Caterpillar",
      authors: "Eric Carle",
      isbn: "9780399226908",
    },
    {
      id: 2,
      title: "Handmade Story",
      authors: "Local Author",
      isbn: null as string | null,
    },
  ];

  it("detects duplicate by canonical ISBN (ISBN-10 → 13)", () => {
    // 0399226907 is ISBN-10 for 9780399226908
    const hit = findDuplicateByIdentity(shelf, {
      title: "Other Title",
      authors: "Other",
      isbn: "0399226907",
    });
    assert.equal(hit?.id, 1);
  });

  it("detects duplicate by title + authors when no ISBN", () => {
    const hit = findDuplicateByIdentity(shelf, {
      title: "  handmade   story ",
      authors: "local  author",
      isbn: null,
    });
    assert.equal(hit?.id, 2);
  });

  it("does not treat matching title as duplicate when draft ISBN differs", () => {
    const hit = findDuplicateByIdentity(shelf, {
      title: "The Very Hungry Caterpillar",
      authors: "Eric Carle",
      isbn: "9780142403877",
    });
    assert.equal(hit, undefined);
  });

  it("falls through to title+authors when ISBN is present but invalid", () => {
    const hit = findDuplicateByIdentity(shelf, {
      title: "Handmade Story",
      authors: "Local Author",
      isbn: "not-an-isbn",
    });
    assert.equal(hit?.id, 2);
  });

  it("returns undefined when nothing matches", () => {
    const hit = findDuplicateByIdentity(shelf, {
      title: "Brand New Book",
      authors: "Someone",
      isbn: null,
    });
    assert.equal(hit, undefined);
  });
});
