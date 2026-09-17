import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SHARE_PATH,
  SHARE_WISHLIST_PATH,
  absoluteShareUrl,
} from "./share-url.ts";

describe("share-url", () => {
  it("exposes stable share paths", () => {
    assert.equal(SHARE_PATH, "/share");
    assert.equal(SHARE_WISHLIST_PATH, "/share/wishlist");
  });

  it("falls back to production origin without window", () => {
    assert.equal(
      absoluteShareUrl(),
      "https://story-shelf-six.vercel.app/share",
    );
    assert.equal(
      absoluteShareUrl("/share/wishlist"),
      "https://story-shelf-six.vercel.app/share/wishlist",
    );
  });
});
