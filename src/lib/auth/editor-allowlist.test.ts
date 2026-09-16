import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isShelfEditorEmail,
  parseShelfEditorEmails,
} from "./editor-allowlist.server.ts";

describe("parseShelfEditorEmails", () => {
  it("returns empty set for unset/blank (fail closed)", () => {
    assert.equal(parseShelfEditorEmails(undefined).size, 0);
    assert.equal(parseShelfEditorEmails("").size, 0);
    assert.equal(parseShelfEditorEmails("  ,  , ").size, 0);
  });

  it("trims and lowercases comma-separated emails", () => {
    const set = parseShelfEditorEmails(" Ada@Example.com , bob@test.org ");
    assert.deepEqual([...set].sort(), ["ada@example.com", "bob@test.org"]);
  });
});

describe("isShelfEditorEmail", () => {
  const allow = parseShelfEditorEmails("parent@family.com");

  it("fails closed on empty allowlist", () => {
    assert.equal(isShelfEditorEmail("parent@family.com", new Set()), false);
  });

  it("rejects null/blank email", () => {
    assert.equal(isShelfEditorEmail(null, allow), false);
    assert.equal(isShelfEditorEmail("  ", allow), false);
  });

  it("matches case-insensitively", () => {
    assert.equal(isShelfEditorEmail("Parent@Family.com", allow), true);
    assert.equal(isShelfEditorEmail("other@family.com", allow), false);
  });
});
