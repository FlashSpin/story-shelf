import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { displayCoverUrl } from "@/lib/cover-proxy";
import { cn } from "@/lib/utils";

const COVER_TONES = [
  "bg-cover-1",
  "bg-cover-2",
  "bg-cover-3",
  "bg-cover-4",
  "bg-cover-5",
] as const;

/** Explicit abspos fill — prefer top/left/width/height over inset or TRBL. */
const FILL: CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
};

function toneFor(seed: string): (typeof COVER_TONES)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COVER_TONES[Math.abs(hash) % COVER_TONES.length];
}

/**
 * Book cover tile. Avoids CSS / network pitfalls on older iOS Safari:
 * - Open Library → archive.org redirect chains → same-origin `/api/cover`
 * - `inset-0` (unsupported before Safari 14.1) → top/left + width/height 100%
 * - ::before / height:0 padding sizing → real in-DOM SVG 2:3 spacer (intrinsic
 *   ratio is reliable on old WebKit; abspos overlays use that box + z-index)
 * - never `loading="lazy"` (IntersectionObserver bugs on old iOS)
 * - explicit width/height attributes as a last-resort intrinsic size
 */
export function BookCover({
  title,
  authors,
  coverUrl,
  className,
  sizes = "(max-width: 640px) 46vw, (max-width: 1024px) 22vw, 180px",
}: {
  title: string;
  authors?: string;
  coverUrl?: string | null;
  className?: string;
  sizes?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => displayCoverUrl(coverUrl), [coverUrl]);
  const showImage = Boolean(src) && !failed;
  const tone = useMemo(() => toneFor(title), [title]);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-md bg-muted shadow-card",
        className,
      )}
    >
      {/* Real in-DOM 2:3 spacer — do not size abspos CB with ::before alone. */}
      <svg
        viewBox="0 0 2 3"
        className="block h-auto w-full"
        aria-hidden
        focusable="false"
      />
      <div
        aria-hidden={!showImage}
        className={cn(
          "flex flex-col justify-between p-3 text-primary-foreground",
          tone,
        )}
        style={{ ...FILL, zIndex: 1 }}
      >
        <p className="font-display text-sm font-medium leading-snug line-clamp-5">
          {title}
        </p>
        {authors ? (
          <p className="text-[0.65rem] font-medium tracking-wide uppercase opacity-80 line-clamp-2">
            {authors}
          </p>
        ) : null}
      </div>
      {showImage ? (
        <img
          src={src ?? undefined}
          alt=""
          width={200}
          height={300}
          sizes={sizes}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          className="border border-foreground/10"
          style={{ ...FILL, zIndex: 2, objectFit: "cover" }}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
