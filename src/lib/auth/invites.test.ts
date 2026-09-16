import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashInviteToken, mintInviteToken } from "./invite-token.ts";
import {
  assertEmailPasswordEditorEmail,
  isEmailPasswordGatedPath,
} from "./email-password-gate.server.ts";

describe("invite token helpers", () => {
  it("mints unguessable tokens and hashes stably", () => {
    const a = mintInviteToken();
    const b = mintInviteToken();
    assert.notEqual(a, b);
    assert.ok(a.length >= 32);
    assert.equal(hashInviteToken(a), hashInviteToken(a));
    assert.notEqual(hashInviteToken(a), hashInviteToken(b));
    assert.match(hashInviteToken(a), /^[a-f0-9]{64}$/);
  });
});

describe("email password gate still blocks open signup", () => {
  const previous = process.env.SHELF_EDITOR_EMAILS;

  afterEach(() => {
    if (previous === undefined) delete process.env.SHELF_EDITOR_EMAILS;
    else process.env.SHELF_EDITOR_EMAILS = previous;
  });

  it("keeps gated path helpers", () => {
    assert.equal(isEmailPasswordGatedPath("/sign-up/email"), true);
  });

  it("env bootstrap still allows sync helper", () => {
    process.env.SHELF_EDITOR_EMAILS = "Mccarlton95@gmail.com";
    assert.doesNotThrow(() =>
      assertEmailPasswordEditorEmail("mccarlton95@gmail.com"),
    );
    assert.throws(() => assertEmailPasswordEditorEmail("stranger@example.com"));
  });
});
