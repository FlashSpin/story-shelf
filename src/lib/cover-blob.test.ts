import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_COVER_BYTES,
  extensionForCoverMime,
  isAllowedCoverMime,
  parseCoverDataUrl,
} from "./cover-blob.ts";

function jpegDataUrl(byteLength: number): string {
  // Minimal valid-looking JPEG SOI + padding (we only validate mime/size/base64).
  const bytes = Buffer.alloc(byteLength, 0);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

describe("cover-blob validation", () => {
  it("accepts jpeg/png/webp mime types", () => {
    assert.equal(isAllowedCoverMime("image/jpeg"), true);
    assert.equal(isAllowedCoverMime("image/png"), true);
    assert.equal(isAllowedCoverMime("image/webp"), true);
    assert.equal(isAllowedCoverMime("image/gif"), false);
    assert.equal(isAllowedCoverMime("application/pdf"), false);
  });

  it("maps mime to file extension", () => {
    assert.equal(extensionForCoverMime("image/jpeg"), "jpg");
    assert.equal(extensionForCoverMime("image/png"), "png");
    assert.equal(extensionForCoverMime("image/webp"), "webp");
  });

  it("parses a small jpeg data URL", () => {
    const parsed = parseCoverDataUrl(jpegDataUrl(64));
    assert.equal(parsed.contentType, "image/jpeg");
    assert.equal(parsed.bytes.byteLength, 64);
    assert.equal(parsed.bytes[0], 0xff);
  });

  it("rejects non-image data URLs", () => {
    assert.throws(
      () => parseCoverDataUrl("data:text/plain;base64,aGVsbG8="),
      /JPEG, PNG, or WebP/,
    );
  });

  it("rejects gif data URLs", () => {
    assert.throws(
      () => parseCoverDataUrl("data:image/gif;base64,R0lGODdh"),
      /JPEG, PNG, or WebP/,
    );
  });

  it("rejects oversized decoded payloads", () => {
    assert.throws(
      () => parseCoverDataUrl(jpegDataUrl(MAX_COVER_BYTES + 1)),
      /too large/,
    );
  });

  it("rejects empty base64 payload", () => {
    assert.throws(
      () => parseCoverDataUrl("data:image/jpeg;base64,"),
      /JPEG, PNG, or WebP|Could not read/,
    );
  });
});
