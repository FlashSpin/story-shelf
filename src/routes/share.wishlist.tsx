import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gift } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatIsbn } from "@/lib/isbn";
import { listWishlist } from "@/lib/wishlist.functions";
import type { WishlistItem } from "@/lib/wishlist.types";

export const Route = createFileRoute("/share/wishlist")({
  loader: () => listWishlist(),
  head: () => ({
    meta: [
      { title: "Wishlist · Raffy’s bookshelf" },
      {
        name: "description",
        content:
          "Gift ideas for Raffy that are not on the owned shelf yet. Read-only family view.",
      },
    ],
  }),
  component: ShareWishlist,
});

function ShareWishlist() {
  const wishlist = Route.useLoaderData();
  const [selected, setSelected] = useState<WishlistItem | null>(null);
  const empty = wishlist.length === 0;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
              Gift ideas
            </p>
            <h1 className="mt-1 font-display text-4xl font-medium tracking-tight sm:text-5xl">
              Wishlist
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              {empty
                ? "Nothing here yet — try gift-check or browse the owned shelf."
                : "Great gift ideas — not on the shelf yet."}
            </p>
            <p className="mt-3">
              <Button type="button" size="sm" asChild>
                <Link to="/check">
                  <Gift />
                  Check before you buy
                </Link>
              </Button>
            </p>
            <nav className="mt-4 flex flex-wrap gap-2" aria-label="Share views">
              <Button type="button" variant="secondary" size="sm" asChild>
                <Link to="/share">Raffy’s shelf</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" disabled>
                Wishlist
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {empty ? (
          <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-primary">
              <Gift className="size-6" />
            </div>
            <h2 className="mt-5 font-display text-2xl font-medium">Wishlist</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Nothing here yet. Browse the shelf or gift-check a title before
              you buy.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button type="button" asChild>
                <Link to="/check">
                  <Gift />
                  Gift check
                </Link>
              </Button>
              <Button type="button" variant="secondary" asChild>
                <Link to="/share">Raffy’s shelf</Link>
              </Button>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {wishlist.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  className="group flex w-full flex-col gap-2.5 text-left"
                >
                  <BookCover
                    title={item.title}
                    authors={item.authors}
                    coverUrl={item.coverUrl}
                    className="transition-[transform,box-shadow] duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-card-hover"
                  />
                  <span>
                    <span className="block font-medium leading-snug line-clamp-2">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground line-clamp-1">
                      {item.authors || "Unknown author"}
                    </span>
                    <Badge variant="muted" className="mt-2">
                      Not owned
                    </Badge>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-lg sm:p-6">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl font-medium leading-snug">
                  {selected.title}
                </DialogTitle>
                <DialogDescription>
                  {selected.authors || "Unknown author"}
                  {selected.publishedYear ? ` · ${selected.publishedYear}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-[7.5rem_1fr] sm:items-start">
                <BookCover
                  title={selected.title}
                  authors={selected.authors}
                  coverUrl={selected.coverUrl}
                  className="w-28 sm:w-full"
                />
                <div className="space-y-3">
                  <Badge variant="muted">Not owned</Badge>
                  {selected.isbn ? (
                    <p className="text-sm text-muted-foreground">
                      ISBN {formatIsbn(selected.isbn)}
                    </p>
                  ) : null}
                  {selected.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-6">
                      {selected.description}
                    </p>
                  ) : null}
                  {selected.notes ? (
                    <p className="text-sm">
                      <span className="font-medium">Note: </span>
                      {selected.notes}
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
