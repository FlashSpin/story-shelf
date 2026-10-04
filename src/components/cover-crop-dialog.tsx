import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MAX_ZOOM,
  cropZoom,
  imagePlacement,
  initialCrop,
  panCrop,
  setCropZoom,
  zoomCrop,
  type CropRect,
} from "@/lib/cover-crop";

/** Art's spec: primary "Use photo" action colour. */
const USE_PHOTO_PURPLE = "#7B4DFF";

/**
 * 2:3 crop step shown after picking/taking a cover photo.
 *
 * Old-iPhone-safe on purpose: touch + mouse events (no Pointer Events, which
 * are missing before iOS 13), non-passive touchmove so the page doesn't
 * scroll/zoom while dragging, an SVG spacer instead of CSS aspect-ratio
 * (iOS < 15), and a zoom slider/buttons as a fallback for pinch.
 *
 * The photo always fills the frame: the crop rect is clamped inside the image
 * and minimum zoom is "fit" (largest 2:3 rect), so there are never empty
 * edges. Output is exactly 2:3, so the shelf tile (object-fit: cover in a 2:3
 * box) shows precisely what was inside the frame.
 */
export function CoverCropDialog({
  canvas,
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  canvas: HTMLCanvasElement | null;
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (crop: CropRect) => void;
}) {
  const imgW = canvas?.width ?? 1;
  const imgH = canvas?.height ?? 1;
  const [crop, setCrop] = useState<CropRect>(() => initialCrop(imgW, imgH));
  const cropRef = useRef(crop);
  cropRef.current = crop;
  // Callback-ref state: Radix mounts portal content a render after `open`,
  // so plain refs would still be null when the effects first run.
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [holder, setHolder] = useState<HTMLDivElement | null>(null);

  // Reset to the auto-centred default whenever a new photo arrives.
  useEffect(() => {
    if (canvas) setCrop(initialCrop(canvas.width, canvas.height));
  }, [canvas]);

  // Show the working canvas itself (exactly what will be encoded).
  useEffect(() => {
    if (!open || !canvas || !holder) return;
    canvas.style.position = "absolute";
    canvas.style.maxWidth = "none";
    canvas.style.pointerEvents = "none";
    canvas.style.userSelect = "none";
    holder.appendChild(canvas);
    return () => {
      if (canvas.parentNode === holder) holder.removeChild(canvas);
    };
  }, [open, canvas, holder]);

  // Position the canvas so the crop fills the frame (percent → resize-safe).
  useEffect(() => {
    if (!canvas) return;
    const p = imagePlacement(crop, imgW, imgH);
    canvas.style.left = `${p.left}%`;
    canvas.style.top = `${p.top}%`;
    canvas.style.width = `${p.width}%`;
    canvas.style.height = `${p.height}%`;
  }, [canvas, crop, imgW, imgH]);

  // Drag / pinch / wheel. Native listeners so touchmove can be non-passive.
  useEffect(() => {
    if (!open || !frame || !canvas) return;
    const W = canvas.width;
    const H = canvas.height;
    let last: { x: number; y: number } | null = null;
    let pinch: { dist: number; mx: number; my: number } | null = null;

    const rect = () => frame.getBoundingClientRect();
    // One style write + one React render per animation frame keeps the drag
    // smooth on old phones even when touchmove fires faster than 60Hz.
    let raf = 0;
    const flush = () => {
      raf = 0;
      const next = cropRef.current;
      const p = imagePlacement(next, W, H);
      canvas.style.left = `${p.left}%`;
      canvas.style.top = `${p.top}%`;
      canvas.style.width = `${p.width}%`;
      canvas.style.height = `${p.height}%`;
      setCrop(next);
    };
    const apply = (next: CropRect) => {
      cropRef.current = next;
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const pan = (dx: number, dy: number) =>
      apply(panCrop(cropRef.current, dx, dy, rect().width, W, H));
    const zoomAt = (factor: number, clientX: number, clientY: number) => {
      const r = rect();
      const fx = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      const fy = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
      apply(zoomCrop(cropRef.current, factor, W, H, fx, fy));
    };
    const twoFinger = (t: TouchList) => {
      const a = t[0]!;
      const b = t[1]!;
      return {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
        mx: (a.clientX + b.clientX) / 2,
        my: (a.clientY + b.clientY) / 2,
      };
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length >= 2) {
        pinch = twoFinger(e.touches);
        last = null;
      } else if (e.touches.length === 1) {
        last = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
        pinch = null;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length >= 2 && pinch) {
        const now = twoFinger(e.touches);
        pan(now.mx - pinch.mx, now.my - pinch.my);
        zoomAt(now.dist / pinch.dist, now.mx, now.my);
        pinch = now;
      } else if (e.touches.length === 1 && last) {
        const t = e.touches[0]!;
        pan(t.clientX - last.x, t.clientY - last.y);
        last = { x: t.clientX, y: t.clientY };
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        last = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY };
        pinch = null;
      } else if (e.touches.length === 0) {
        last = null;
        pinch = null;
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!last) return;
      pan(e.clientX - last.x, e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
    };
    const onMouseUp = () => {
      last = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      last = { x: e.clientX, y: e.clientY };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    };

    const opts = { passive: false } as const;
    frame.addEventListener("touchstart", onTouchStart, opts);
    frame.addEventListener("touchmove", onTouchMove, opts);
    frame.addEventListener("touchend", onTouchEnd);
    frame.addEventListener("touchcancel", onTouchEnd);
    frame.addEventListener("mousedown", onMouseDown);
    frame.addEventListener("wheel", onWheel, opts);
    return () => {
      frame.removeEventListener("touchstart", onTouchStart);
      frame.removeEventListener("touchmove", onTouchMove);
      frame.removeEventListener("touchend", onTouchEnd);
      frame.removeEventListener("touchcancel", onTouchEnd);
      frame.removeEventListener("mousedown", onMouseDown);
      frame.removeEventListener("wheel", onWheel);
      onMouseUp();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [open, canvas, frame]);

  const zoom = cropZoom(crop, imgW, imgH);
  const nudgeZoom = (factor: number) =>
    setCrop((c) => zoomCrop(c, factor, imgW, imgH));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent
        className="max-w-sm gap-3 p-4 pb-0 sm:p-5 sm:pb-0"
        showClose={!busy}
        // Don't park focus on the slider (shows a focus box and can pop the
        // keyboard-less focus ring on phones); the dialog itself takes focus.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Crop the cover</DialogTitle>
          <DialogDescription>
            Drag to move, pinch to zoom. What&apos;s inside the frame is
            exactly what the shelf shows.
          </DialogDescription>
        </DialogHeader>

        {/* Stage: the photo continues outside the frame, dimmed. */}
        <div
          className="relative -mx-4 overflow-hidden bg-neutral-900 py-5 sm:-mx-5"
          style={{ touchAction: "none" }}
        >
          <div
            ref={setFrame}
            data-testid="cover-crop-frame"
            className="relative mx-auto w-52 cursor-move select-none rounded-md sm:w-60"
            style={{ touchAction: "none", WebkitUserSelect: "none" }}
            aria-label="Cover crop frame"
            role="img"
          >
            {/* In-DOM 2:3 spacer (no CSS aspect-ratio on old iOS Safari). */}
            <svg
              viewBox="0 0 2 3"
              className="block h-auto w-full"
              aria-hidden
              focusable="false"
            />
            <div
              ref={setHolder}
              className="absolute"
              style={{ top: 0, left: 0, width: "100%", height: "100%" }}
            />
            {/* Dim everything outside the frame; same rounding/border as tiles. */}
            <div
              aria-hidden
              className="pointer-events-none absolute rounded-md border border-white/70"
              style={{
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                boxShadow: "0 0 0 2000px rgba(0, 0, 0, 0.6)",
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Zoom out"
            disabled={busy || zoom <= 1.001}
            onClick={() => nudgeZoom(1 / 1.2)}
          >
            <Minus />
          </Button>
          <input
            type="range"
            aria-label="Zoom"
            className="h-11 min-w-0 flex-1"
            style={{ accentColor: USE_PHOTO_PURPLE }}
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={busy}
            onChange={(e) =>
              setCrop((c) =>
                setCropZoom(c, Number(e.target.value), imgW, imgH),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Zoom in"
            disabled={busy || zoom >= MAX_ZOOM - 0.001}
            onClick={() => nudgeZoom(1.2)}
          >
            <Plus />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Reset crop"
            disabled={busy}
            onClick={() => setCrop(initialCrop(imgW, imgH))}
          >
            <RotateCcw />
          </Button>
        </div>

        {/* Bottom action bar; clears the iPhone home indicator. */}
        <div
          className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-border bg-card px-4 pt-3 sm:-mx-5 sm:px-5"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 0px))" }}
        >
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="min-h-11 text-white hover:opacity-90"
            style={{ backgroundColor: USE_PHOTO_PURPLE }}
            disabled={busy}
            onClick={() => onConfirm(cropRef.current)}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : null}
            Use photo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
