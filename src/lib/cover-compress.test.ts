import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COVER_ENCODE_STEPS,
  COVER_MAX_DATA_CHARS,
  JPEG_DATA_URL_PREFIX,
  encodeCoverWithinLimit,
  isUsableJpegDataUrl,
  scaledCoverSize,
  type CoverEncodeStep,
} from "./cover-compress.ts";
import { MAX_COVER_BYTES, MAX_COVER_DATA_CHARS } from "./cover-blob.ts";

const jpeg = (chars: number) =>
  JPEG_DATA_URL_PREFIX + "A".repeat(Math.max(0, chars - JPEG_DATA_URL_PREFIX.length));

describe("cover-compress caps", () => {
  it("client cap stays under every server cap", () => {
    const zodMax = 400_000; // addBook / updateCover in books.functions.ts
    assert.ok(COVER_MAX_DATA_CHARS < zodMax);
    assert.ok(COVER_MAX_DATA_CHARS < MAX_COVER_DATA_CHARS);
    const maxDecodedBytes = Math.ceil(
      ((COVER_MAX_DATA_CHARS - JPEG_DATA_URL_PREFIX.length) * 3) / 4,
    );
    assert.ok(maxDecodedBytes < MAX_COVER_BYTES);
  });

  it("starts at 720px / 0.82 and only steps down", () => {
    assert.deepEqual(COVER_ENCODE_STEPS[0], { maxEdge: 720, quality: 0.82 });
    for (let i = 1; i < COVER_ENCODE_STEPS.length; i++) {
      const prev = COVER_ENCODE_STEPS[i - 1]!;
      const cur = COVER_ENCODE_STEPS[i]!;
      assert.ok(cur.maxEdge <= prev.maxEdge && cur.quality <= prev.quality);
      assert.ok(cur.maxEdge < prev.maxEdge || cur.quality < prev.quality);
    }
  });
});

describe("scaledCoverSize", () => {
  it("downscales the longest edge", () => {
    assert.deepEqual(scaledCoverSize(3024, 4032, 720), { width: 540, height: 720 });
    assert.deepEqual(scaledCoverSize(4032, 3024, 600), { width: 600, height: 450 });
  });
  it("never upscales and never returns 0", () => {
    assert.deepEqual(scaledCoverSize(300, 200, 720), { width: 300, height: 200 });
    assert.deepEqual(scaledCoverSize(10000, 1, 720), { width: 720, height: 1 });
    assert.deepEqual(scaledCoverSize(0, 0, 720), { width: 1, height: 1 });
  });
});

describe("isUsableJpegDataUrl", () => {
  it("rejects blank / png / tiny canvas output", () => {
    assert.equal(isUsableJpegDataUrl("data:,"), false);
    assert.equal(isUsableJpegDataUrl(""), false);
    assert.equal(isUsableJpegDataUrl(undefined), false);
    assert.equal(isUsableJpegDataUrl("data:image/png;base64," + "A".repeat(500)), false);
    assert.equal(isUsableJpegDataUrl(JPEG_DATA_URL_PREFIX + "AAAA"), false);
    assert.equal(isUsableJpegDataUrl(jpeg(5000)), true);
  });
});

describe("encodeCoverWithinLimit", () => {
  it("returns the first step when it fits", async () => {
    const seen: CoverEncodeStep[] = [];
    const r = await encodeCoverWithinLimit((s) => {
      seen.push(s);
      return jpeg(1000);
    });
    assert.deepEqual(r?.step, { maxEdge: 720, quality: 0.82 });
    assert.equal(seen.length, 1);
  });

  it("steps quality then size down until under the cap", async () => {
    const sizes = new Map<string, number>([
      ["720@0.82", 500_000],
      ["720@0.7", 420_000],
      ["600@0.7", 300_000],
    ]);
    const failed: CoverEncodeStep[] = [];
    const r = await encodeCoverWithinLimit(
      (s) => jpeg(sizes.get(`${s.maxEdge}@${s.quality}`) ?? 1000),
      { onStepFailed: (s) => failed.push(s) },
    );
    assert.deepEqual(r?.step, { maxEdge: 600, quality: 0.7 });
    assert.ok(r!.dataUrl.length <= COVER_MAX_DATA_CHARS);
    assert.equal(failed.length, 2);
  });

  it("falls through encoder throws and blank output", async () => {
    let n = 0;
    const r = await encodeCoverWithinLimit(() => {
      n++;
      if (n === 1) throw new Error("canvas too big");
      if (n === 2) return "data:,";
      return jpeg(2000);
    });
    assert.deepEqual(r?.step, COVER_ENCODE_STEPS[2]);
  });

  it("returns null (not throw) when nothing fits", async () => {
    const r = await encodeCoverWithinLimit(() => jpeg(COVER_MAX_DATA_CHARS + 1));
    assert.equal(r, null);
  });
});
