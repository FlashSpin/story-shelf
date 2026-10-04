import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COVER_ASPECT,
  MAX_ZOOM,
  clampCrop,
  cropZoom,
  imagePlacement,
  initialCrop,
  maxCropSize,
  panCrop,
  setCropZoom,
  zoomCrop,
  type CropRect,
} from "./cover-crop.ts";

const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const inside = (c: CropRect, w: number, h: number) => {
  assert.ok(c.x >= -1e-9 && c.y >= -1e-9, "origin inside");
  assert.ok(c.x + c.w <= w + 1e-9 && c.y + c.h <= h + 1e-9, "extent inside");
  near(c.w / c.h, COVER_ASPECT);
};

describe("cover crop math", () => {
  it("initial crop is the largest centred 2:3 rect", () => {
    // 4:3 landscape photo
    const c = initialCrop(4000, 3000);
    near(c.h, 3000);
    near(c.w, 2000);
    near(c.x, 1000);
    near(c.y, 0);
    // 3:4 portrait (taller than wide but wider than 2:3)
    const p = initialCrop(540, 720);
    near(p.w, 480);
    near(p.x, 30);
    // very tall
    const t = initialCrop(500, 1500);
    near(t.w, 500);
    near(t.y, 375);
    inside(t, 500, 1500);
  });

  it("pan moves the photo with the finger and stays inside", () => {
    const c = initialCrop(4000, 3000); // frame shows 2000px wide
    const moved = panCrop(c, 100, 0, 200, 4000, 3000); // 100 frame px = 1000 src px
    near(moved.x, 0);
    const clamped = panCrop(c, 1000, 1000, 200, 4000, 3000);
    near(clamped.x, 0);
    near(clamped.y, 0);
    inside(panCrop(c, -5000, -5000, 200, 4000, 3000), 4000, 3000);
  });

  it("zoom keeps the focal point and respects limits", () => {
    const c = initialCrop(4000, 3000);
    const z = zoomCrop(c, 2, 4000, 3000, 0.5, 0.5);
    near(z.w, 1000);
    near(z.x + z.w / 2, 2000);
    near(z.y + z.h / 2, 1500);
    near(cropZoom(z, 4000, 3000), 2);
    const tooFar = zoomCrop(c, 100, 4000, 3000);
    near(cropZoom(tooFar, 4000, 3000), MAX_ZOOM);
    const out = zoomCrop(z, 0.01, 4000, 3000);
    near(out.w, maxCropSize(4000, 3000).w);
    inside(out, 4000, 3000);
    // focal at top-left corner stays put
    const tl = zoomCrop(c, 2, 4000, 3000, 0, 0);
    near(tl.x, c.x);
    near(tl.y, c.y);
  });

  it("setCropZoom and clampCrop", () => {
    const c = initialCrop(1200, 900);
    near(cropZoom(setCropZoom(c, 3, 1200, 900), 1200, 900), 3);
    inside(clampCrop({ x: -50, y: 800, w: 10_000, h: 1 }, 1200, 900), 1200, 900);
  });

  it("image placement maps the crop onto the frame", () => {
    const c = { x: 1000, y: 0, w: 2000, h: 3000 };
    const p = imagePlacement(c, 4000, 3000);
    near(p.left, -50);
    near(p.top, 0);
    near(p.width, 200);
    near(p.height, 100);
  });
});
