import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Gift, Search, Sparkles } from "lucide-react";
import { BarcodeScanner, scannerSupported } from "@/components/barcode-scanner";
import { BookCover } from "@/components/book-cover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { listBooks } from "@/lib/books.functions";
import { formatIsbn } from "@/lib/isbn";
import {
  resolveGiftCheck,
  type GiftCheckHit,
  type GiftCheckResult,
  type RankedHit,
} from "@/lib/gift-check";
import { listWishlist } from "@/lib/wishlist.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/check")({
  loader: async () => {
    const [books, wishlist] = await Promise.all([listBooks(), listWishlist()]);
    return { books, wishlist };
  },
  pendingComponent: GiftCheckPending,
  head: () => ({
    meta: [
      { title: "Already on Raffy’s shelf?" },
      {
        name: "description",
        content:
          "Search or type an ISBN before you buy — check Raffy’s shelf and wishlist in one place.",
      },
    ],
  }),
  component: GiftCheckPage,
});

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-6">
        {children}
      </div>
    </div>
  );
}

function GiftCheckPending() {
  return (
    <Shell>
      <HeaderBlock />
      <div className="mt-6 animate-pulse rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="mt-3 h-7 w-48 rounded bg-muted" />
        <div className="mt-5 flex gap-4">
          <div className="aspect-cover w-20 shrink-0 rounded-md bg-muted" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
        </div>
      </div>
      <FooterLinks />
    </Shell>
  );
}

function HeaderBlock() {
  return (
    <div>
      <h1 className="font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        Already on Raffy’s shelf?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">
        Search or type an ISBN before you buy
      </p>
    </div>
  );
}

function FooterLinks() {
  return (
    <footer className="mt-10 text-center text-sm text-muted-foreground">
      <Link
        to="/"
        className="underline-offset-4 hover:text-foreground hover:underline"
      >
        Raffy’s shelf
      </Link>
      <span className="mx-2" aria-hidden>
        ·
      </span>
      <Link
        to="/wishlist"
        className="underline-offset-4 hover:text-foreground hover:underline"
      >
        Wishlist
      </Link>
    </footer>
  );
}

function GiftCheckPage() {
  const { books, wishlist } = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const canScan = useMemo(() => scannerSupported(), []);

  const result = useMemo(
    () => resolveGiftCheck(query, books, wishlist),
    [query, books, wishlist],
  );

  return (
    <Shell>
      <HeaderBlock />

      <form
        className="mt-6 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title, author, or ISBN"
            className="h-14 rounded-2xl border-transparent bg-muted pl-12 text-base shadow-none focus-visible:border-primary/30 focus-visible:ring-primary/20"
            aria-label="Search shelf or wishlist"
            autoFocus
            inputMode="search"
            autoComplete="off"
          />
        </div>
        {canScan ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-11 shrink-0 rounded-xl bg-muted shadow-none"
            aria-label="Scan barcode"
            title="Scan barcode"
            onClick={() => setScanOpen(true)}
          >
            <Camera className="size-4" />
          </Button>
        ) : null}
      </form>

      <div className="mt-6 min-h-[8rem]">
        {result ? <ResultPanel result={result} /> : null}
      </div>

      <FooterLinks />

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="max-w-md sm:p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-medium">
              Scan barcode
            </DialogTitle>
            <DialogDescription>
              Point the camera at the ISBN barcode on the back of the book.
            </DialogDescription>
          </DialogHeader>
          <BarcodeScanner
            onDetect={(isbn) => {
              setQuery(isbn);
              setScanOpen(false);
            }}
            onCancel={() => setScanOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

function ResultPanel({ result }: { result: GiftCheckResult }) {
  if (result.status === "ambiguous") {
    return <AmbiguousList hits={result.hits} />;
  }
  if (result.status === "missing") {
    return (
      <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="bg-muted/80 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Not on the shelf
          </p>
          <p className="mt-1 font-display text-xl font-medium">
            Great gift idea
          </p>
        </div>
        <div className="flex items-start gap-3 px-4 py-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
            <Sparkles className="size-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            Nothing matches “{result.query}” on the shelf or wishlist. A new
            story for Raffy.
          </p>
        </div>
      </article>
    );
  }
  if (result.status === "owned") {
    return (
      <StatusCard
        tone="owned"
        eyebrow="Already owned"
        headline="Skip the gift"
        detail="This one’s already on Raffy’s shelf."
        hit={result.hit}
      />
    );
  }
  return (
    <StatusCard
      tone="wishlist"
      eyebrow="On the wishlist"
      headline="Sweet gift idea"
      detail="Raffy doesn’t own this yet — it’s on the wish list."
      hit={result.hit}
    />
  );
}

function AmbiguousList({ hits }: { hits: RankedHit[] }) {
  return (
    <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-card divide-y divide-border">
      {hits.map((row) => (
        <li key={`${row.status}-${row.hit.isbn ?? row.hit.title}`}>
          <CompactRow status={row.status} hit={row.hit} />
        </li>
      ))}
    </ul>
  );
}

function CompactRow({
  status,
  hit,
}: {
  status: "owned" | "wishlist";
  hit: GiftCheckHit;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <BookCover
        title={hit.title}
        authors={hit.authors}
        coverUrl={hit.coverUrl}
        className="w-10 shrink-0 rounded"
        sizes="40px"
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug line-clamp-1">{hit.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {hit.authors || "Unknown author"}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide",
          status === "owned"
            ? "bg-emerald-100 text-emerald-800"
            : "bg-primary/15 text-primary",
        )}
      >
        {status === "owned" ? "Owned" : "Wishlist"}
      </span>
    </div>
  );
}

function StatusCard({
  tone,
  eyebrow,
  headline,
  detail,
  hit,
}: {
  tone: "owned" | "wishlist";
  eyebrow: string;
  headline: string;
  detail: string;
  hit: GiftCheckHit;
}) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border shadow-card",
        tone === "owned"
          ? "border-emerald-200/90 bg-card"
          : "border-primary/30 bg-card",
      )}
    >
      <div
        className={cn(
          "px-4 py-3",
          tone === "owned" ? "bg-emerald-50" : "bg-primary/10",
        )}
      >
        <p
          className={cn(
            "text-xs font-medium uppercase tracking-[0.16em]",
            tone === "owned" ? "text-emerald-800/80" : "text-primary",
          )}
        >
          {eyebrow}
        </p>
        <p
          className={cn(
            "mt-1 font-display text-xl font-medium",
            tone === "owned" ? "text-emerald-950" : "text-foreground",
          )}
        >
          {headline}
        </p>
      </div>
      <div className="flex gap-4 px-4 py-4">
        <BookCover
          title={hit.title}
          authors={hit.authors}
          coverUrl={hit.coverUrl}
          className="w-20 shrink-0"
          sizes="80px"
        />
        <div className="min-w-0 space-y-1.5">
          <h2 className="font-display text-lg font-medium leading-snug">
            {hit.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {hit.authors || "Unknown author"}
          </p>
          {hit.isbn ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              ISBN {formatIsbn(hit.isbn)}
            </p>
          ) : null}
          <p className="pt-1 text-sm text-muted-foreground">{detail}</p>
          {tone === "wishlist" ? (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Gift className="size-3.5" />
              Wishlist
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
