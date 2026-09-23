import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowedCoverProxyContentType,
  displayCoverUrl,
  fetchProxiedCover,
  isAllowedCoverProxyHostname,
  isBlockedCoverProxyHostname,
  isProxyableCoverUrl,
  resolveAllowedRedirectUrl,
} from "./cover-proxy.ts";

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

  it("rejects unrelated hosts and archive.org as a *request* URL", () => {
    assert.equal(isProxyableCoverUrl("https://evil.example/x.jpg"), false);
    assert.equal(isProxyableCoverUrl("javascript:alert(1)"), false);
    // Clients must not ask for archive.org directly — only via OL redirects.
    assert.equal(
      isProxyableCoverUrl(
        "https://archive.org/download/l_covers_0008/file.jpg",
      ),
      false,
    );
    assert.equal(
      isProxyableCoverUrl(
        "https://ia802809.us.archive.org/view_archive.php?file=x.jpg",
      ),
      false,
    );
  });

  it("rejects credentials and IP literals", () => {
    assert.equal(
      isProxyableCoverUrl("https://user:pass@covers.openlibrary.org/x.jpg"),
      false,
    );
    assert.equal(isProxyableCoverUrl("https://127.0.0.1/x.jpg"), false);
    assert.equal(isProxyableCoverUrl("https://169.254.169.254/latest"), false);
  });
});

describe("redirect / final host allowlist", () => {
  it("allows archive.org only for redirect hops", () => {
    assert.equal(
      isAllowedCoverProxyHostname("archive.org", "redirect"),
      true,
    );
    assert.equal(
      isAllowedCoverProxyHostname("ia802809.us.archive.org", "redirect"),
      true,
    );
    assert.equal(isAllowedCoverProxyHostname("archive.org", "request"), false);
    assert.equal(
      isAllowedCoverProxyHostname("evil.example", "redirect"),
      false,
    );
  });

  it("blocks localhost and raw IPs", () => {
    assert.equal(isBlockedCoverProxyHostname("localhost"), true);
    assert.equal(isBlockedCoverProxyHostname("10.0.0.1"), true);
    assert.equal(isBlockedCoverProxyHostname("::1"), true);
    assert.equal(
      isBlockedCoverProxyHostname("covers.openlibrary.org"),
      false,
    );
  });

  it("resolves relative Location against the current URL", () => {
    const from = new URL("https://covers.openlibrary.org/b/id/1-L.jpg");
    // Relative path would stay on openlibrary — allowed as redirect (= request host).
    const rel = resolveAllowedRedirectUrl(from, "/b/id/2-L.jpg");
    assert.ok(rel);
    assert.equal(rel.hostname, "covers.openlibrary.org");

    const toArchive = resolveAllowedRedirectUrl(
      from,
      "https://archive.org/download/l_covers_0008/x.jpg",
    );
    assert.ok(toArchive);
    assert.equal(toArchive.hostname, "archive.org");

    const evil = resolveAllowedRedirectUrl(
      from,
      "https://evil.example/steal",
    );
    assert.equal(evil, null);

    const meta = resolveAllowedRedirectUrl(
      from,
      "http://169.254.169.254/latest/meta-data/",
    );
    assert.equal(meta, null);
  });
});

describe("allowedCoverProxyContentType", () => {
  it("accepts jpeg/png only", () => {
    assert.equal(allowedCoverProxyContentType("image/jpeg"), "image/jpeg");
    assert.equal(
      allowedCoverProxyContentType("image/jpeg; charset=binary"),
      "image/jpeg",
    );
    assert.equal(allowedCoverProxyContentType("image/jpg"), "image/jpeg");
    assert.equal(allowedCoverProxyContentType("image/png"), "image/png");
    assert.equal(allowedCoverProxyContentType("image/webp"), null);
    assert.equal(allowedCoverProxyContentType("image/gif"), null);
    assert.equal(allowedCoverProxyContentType("image/avif"), null);
    assert.equal(allowedCoverProxyContentType("text/html"), null);
    assert.equal(allowedCoverProxyContentType(null), null);
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
    const proxied =
      "/api/cover?url=https%3A%2F%2Fcovers.openlibrary.org%2Fx.jpg";
    assert.equal(displayCoverUrl(proxied), proxied);
  });

  it("returns null for empty", () => {
    assert.equal(displayCoverUrl(null), null);
    assert.equal(displayCoverUrl("  "), null);
  });
});

describe("fetchProxiedCover", () => {
  it("follows allowlisted redirects and returns jpeg", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("covers.openlibrary.org")) {
        return new Response(null, {
          status: 302,
          headers: {
            Location:
              "https://archive.org/download/l_covers_0008/0008314247-L.jpg",
          },
        });
      }
      if (url.includes("archive.org/download")) {
        return new Response(null, {
          status: 302,
          headers: {
            Location:
              "https://ia802809.us.archive.org/view_archive.php?file=x.jpg",
          },
        });
      }
      return new Response(jpeg, {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      });
    };

    const result = await fetchProxiedCover(
      "https://covers.openlibrary.org/b/id/8314247-L.jpg",
      { fetchImpl },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.contentType, "image/jpeg");
      assert.equal(result.body.byteLength, 4);
    }
    assert.equal(calls.length, 3);
  });

  it("rejects redirect to a non-allowlisted host", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://evil.example/cover.jpg" },
      });

    const result = await fetchProxiedCover(
      "https://covers.openlibrary.org/b/id/1-L.jpg",
      { fetchImpl },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.match(result.message, /Redirect host not allowed/);
    }
  });

  it("rejects WebP upstream with a clear error", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/webp" },
      });

    const result = await fetchProxiedCover(
      "https://covers.openlibrary.org/b/id/1-L.jpg",
      { fetchImpl },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.equal(result.message, "Cover must be JPEG or PNG");
    }
  });

  it("rejects GIF upstream", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/gif" },
      });

    const result = await fetchProxiedCover(
      "https://books.google.com/books/content?id=x",
      { fetchImpl },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, "Cover must be JPEG or PNG");
    }
  });

  it("rejects client request for archive.org directly", async () => {
    const result = await fetchProxiedCover(
      "https://archive.org/download/x.jpg",
      {
        fetchImpl: async () => {
          throw new Error("should not fetch");
        },
      },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, 400);
      assert.equal(result.message, "Host not allowed");
    }
  });
});
