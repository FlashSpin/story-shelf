import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractIsbnFromUrl,
  looksLikeUrl,
  parseIsbnCandidate,
} from "./isbn.ts";

describe("looksLikeUrl", () => {
  it("detects http(s) and bare amazon hosts", () => {
    assert.equal(looksLikeUrl("https://www.amazon.com/dp/0399226907"), true);
    assert.equal(looksLikeUrl("amazon.co.uk/dp/0399226907"), true);
    assert.equal(looksLikeUrl("9780399226908"), false);
    assert.equal(looksLikeUrl("The Hungry Caterpillar"), false);
  });
});

describe("extractIsbnFromUrl", () => {
  it("extracts ISBN-10 from Amazon /dp/", () => {
    assert.equal(
      extractIsbnFromUrl(
        "https://www.amazon.com/Very-Hungry-Caterpillar/dp/0399226907?psc=1",
      ),
      "9780399226908",
    );
  });

  it("extracts ISBN-13 from /gp/product/", () => {
    assert.equal(
      extractIsbnFromUrl(
        "https://www.amazon.com/gp/product/9780064431781/ref=xx",
      ),
      "9780064431781",
    );
  });

  it("extracts ISBN from bookshop.org path", () => {
    assert.equal(
      extractIsbnFromUrl(
        "https://bookshop.org/p/books/the-very-hungry-caterpillar/9780399226908",
      ),
      "9780399226908",
    );
  });

  it("extracts ISBN from waterstones-style trailing segment", () => {
    assert.equal(
      extractIsbnFromUrl(
        "https://www.waterstones.com/book/the-tiger-who-came-to-tea/9780007215997",
      ),
      "9780007215997",
    );
  });

  it("returns null for Kindle ASINs", () => {
    assert.equal(
      extractIsbnFromUrl("https://www.amazon.com/dp/B08N5WRWNW"),
      null,
    );
  });

  it("returns null for amzn.to short links", () => {
    assert.equal(extractIsbnFromUrl("https://amzn.to/3abcXYZ"), null);
  });
});

describe("parseIsbnCandidate", () => {
  it("accepts checksum-valid ISBN-10/13", () => {
    assert.equal(parseIsbnCandidate("0399226907"), "9780399226908");
    assert.equal(parseIsbnCandidate("9780399226908"), "9780399226908");
  });

  it("rejects invalid checksums", () => {
    assert.equal(parseIsbnCandidate("0399226908"), null);
  });
});
