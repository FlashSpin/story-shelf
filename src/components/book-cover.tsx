import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const COVER_TONES = [
  "bg-cover-1",
  "bg-cover-2",
  "bg-cover-3",
  "bg-cover-4",
  "bg-cover-5",
] as const;

function toneFor(seed: string): (typeof COVER_TONES)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COVER_TONES[Math.abs(hash) % COVER_TONES.length];
}

/**
 * Book cover tile. Avoids CSS that breaks on older iOS Safari:
 * - `inset-0` (unsupported before Safari 14.1) → explicit top/right/bottom/left
 * - `aspect-ratio` alone (unsupported before Safari 15) → padding-bottom fallback
 *   via `.aspect-cover` in styles.css
 * - never `loading="lazy"` (IntersectionObserver bugs on old iOS)
 * - JPEG/PNG sources preferred; referrerPolicy helps hotlinked Open Library covers
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
  const showImage = Boolean(coverUrl) && !failed;
  const tone = useMemo(() => toneFor(title), [title]);

  useEffect(() => {
    setFailed(false);
  }, [coverUrl]);

  return (
    <div
      className={cn(
        "relative aspect-cover overflow-hidden rounded-md bg-muted shadow-card",
        className,
      )}
    >
      <div
        aria-hidden={!showImage}
        className={cn(
          "absolute top-0 right-0 bottom-0 left-0 flex flex-col justify-between p-3 text-primary-foreground",
          tone,
        )}
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
          src={coverUrl ?? undefined}
          alt=""
          sizes={sizes}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          // Explicit top/right/bottom/left: old Safari ignores `inset`.
          // height/width 100% beats preflight `img { height: auto }` quirks.
          className="absolute top-0 right-0 bottom-0 left-0 h-full w-full object-cover border border-foreground/10"
          style={{ height: "100%", width: "100%", objectFit: "cover" }}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
