import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayCoverUrl, isProxyableCoverUrl } from "./cover-proxy.ts";

describe("isProxyableCoverUrl", () => {
  it("allows Open Library covers", () => {
    assert.equal(
      isProxyableCoverUrl("https://covers.openlibrary.org/b/id/1-L.jpg"),
      true,
    );
  });

  it("allows Google Books hosts", () => {
    assert.equal(
      isProxyableCoverUrl(
        "https://books.google.com/books/content?id=x&printsec=frontcover",
      ),
      true,
    );
    assert.equal(
      isProxyableCoverUrl("https://lh3.googleusercontent.com/books/cover"),
      true,
    );
  });

  it("rejects unrelated hosts", () => {
    assert.equal(isProxyableCoverUrl("https://evil.example/x.jpg"), false);
    assert.equal(isProxyableCoverUrl("javascript:alert(1)"), false);
  });
});

describe("displayCoverUrl", () => {
  it("proxies Open Library to /api/cover", () => {
    const src = "https://covers.openlibrary.org/b/id/8314247-L.jpg";
    assert.equal(
      displayCoverUrl(src),
      `/api/cover?url=${encodeURIComponent(src)}`,
    );
  });

  it("leaves blob URLs alone", () => {
    const blob =
      "https://abc.public.blob.vercel-storage.com/covers/x.jpg";
    assert.equal(displayCoverUrl(blob), blob);
  });

  it("is idempotent for already-proxied URLs", () => {
    const proxied = "/api/cover?url=https%3A%2F%2Fcovers.openlibrary.org%2Fx.jpg";
    assert.equal(displayCoverUrl(proxied), proxied);
  });

  it("returns null for empty", () => {
    assert.equal(displayCoverUrl(null), null);
    assert.equal(displayCoverUrl("  "), null);
  });
});
