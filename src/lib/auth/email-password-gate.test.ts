import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assertEmailPasswordEditorEmail,
  isEmailPasswordGatedPath,
} from "./email-password-gate.server.ts";
import { parseShelfEditorEmails } from "./editor-allowlist.server.ts";

describe("isEmailPasswordGatedPath", () => {
  it("matches sign-up, sign-in, and password-reset email paths", () => {
    assert.equal(isEmailPasswordGatedPath("/sign-up/email"), true);
    assert.equal(isEmailPasswordGatedPath("/sign-in/email"), true);
    assert.equal(isEmailPasswordGatedPath("/request-password-reset"), true);
    assert.equal(isEmailPasswordGatedPath("/get-session"), false);
    assert.equal(isEmailPasswordGatedPath(undefined), false);
  });
});

describe("assertEmailPasswordEditorEmail", () => {
  const previous = process.env.SHELF_EDITOR_EMAILS;

  afterEach(() => {
    if (previous === undefined) delete process.env.SHELF_EDITOR_EMAILS;
    else process.env.SHELF_EDITOR_EMAILS = previous;
  });

  it("rejects when allowlist is empty (fail closed)", () => {
    process.env.SHELF_EDITOR_EMAILS = "";
    assert.throws(
      () => assertEmailPasswordEditorEmail("anyone@example.com"),
      (err: unknown) =>
        err instanceof Error &&
        /limited to shelf editors/i.test(err.message),
    );
  });

  it("allows only allowlisted emails (case-insensitive)", () => {
    process.env.SHELF_EDITOR_EMAILS = "Mccarlton95@gmail.com";
    assert.doesNotThrow(() =>
      assertEmailPasswordEditorEmail("mccarlton95@gmail.com"),
    );
    assert.throws(() => assertEmailPasswordEditorEmail("stranger@example.com"));
  });

  it("parse helper still matches the allowlist used by mutations", () => {
    const set = parseShelfEditorEmails("Mccarlton95@gmail.com");
    assert.equal(set.has("mccarlton95@gmail.com"), true);
  });
});
