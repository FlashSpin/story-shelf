import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyHttpErrorStatus,
  throwHttpError,
} from "./throw-http.server.ts";

class FakeUnauthorized extends Error {
  readonly status = 401 as const;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

class FakeForbidden extends Error {
  readonly status = 403 as const;
  constructor() {
    super("Forbidden");
    this.name = "ForbiddenError";
  }
}

describe("applyHttpErrorStatus", () => {
  it("calls setStatus with the given code", () => {
    const calls: number[] = [];
    applyHttpErrorStatus(401, (code) => calls.push(code));
    applyHttpErrorStatus(403, (code) => calls.push(code));
    assert.deepEqual(calls, [401, 403]);
  });
});

describe("throwHttpError", () => {
  it("sets status then throws Unauthorized (401)", () => {
    const calls: number[] = [];
    const err = new FakeUnauthorized();
    assert.throws(
      () => throwHttpError(err, (code) => calls.push(code)),
      (e: unknown) => e === err && (e as FakeUnauthorized).status === 401,
    );
    assert.deepEqual(calls, [401]);
  });

  it("sets status then throws Forbidden (403)", () => {
    const calls: number[] = [];
    const err = new FakeForbidden();
    assert.throws(
      () => throwHttpError(err, (code) => calls.push(code)),
      (e: unknown) => e === err && (e as FakeForbidden).status === 403,
    );
    assert.deepEqual(calls, [403]);
  });
});
