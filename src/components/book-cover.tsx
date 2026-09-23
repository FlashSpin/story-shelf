import { useEffect, useMemo, useState } from "react";
import { displayCoverUrl } from "@/lib/cover-proxy";
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
 * Book cover tile. Avoids CSS / network pitfalls on older iOS Safari:
 * - Open Library → archive.org redirect chains → same-origin `/api/cover`
 * - `inset-0` (unsupported before Safari 14.1) → top/right/bottom/left
 * - bare `aspect-ratio` / height:0+padding abspos CB → in-flow ::before 2:3
 *   spacer on `.aspect-cover` (real content height; overlays fill it)
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
          src={src ?? undefined}
          alt=""
          width={200}
          height={300}
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
