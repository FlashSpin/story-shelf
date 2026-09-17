import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Gift, Search } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { BookDetail } from "@/components/book-detail";
import { RecentlyAddedStrip } from "@/components/recently-added";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listBooks } from "@/lib/books.functions";
import type { Book } from "@/lib/books.types";
import { canonicalIsbn, looksLikeIsbn } from "@/lib/isbn";

export const Route = createFileRoute("/share/")({
  loader: () => listBooks(),
  head: () => ({
    meta: [
      { title: "Raffy’s bookshelf · share" },
      {
        name: "description",
        content:
          "Browse Raffy’s owned books and wishlist — check before you buy a gift. Read-only family view.",
      },
    ],
  }),
  component: ShareShelf,
});

function matchesQuery(book: Book, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (looksLikeIsbn(query)) {
    const isbn = canonicalIsbn(query);
    return Boolean(isbn && book.isbn && canonicalIsbn(book.isbn) === isbn);
  }
  const hay = [book.title, book.authors, book.publisher, book.isbn, book.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function ShareShelf() {
  const books = Route.useLoaderData();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Book | null>(null);

  const filtered = useMemo(() => {
    return books.filter((book) => matchesQuery(book, query));
  }, [books, query]);

  const isbnQuery = looksLikeIsbn(query);
  const isbnOwned = isbnQuery
    ? books.find(
        (b) => b.isbn && canonicalIsbn(b.isbn) === canonicalIsbn(query),
      )
    : undefined;
  const empty = filtered.length === 0;

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                Family browse
              </p>
              <h1 className="mt-1 font-display text-4xl font-medium tracking-tight sm:text-5xl">
                Raffy’s bookshelf
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                Books already at home. Search the shelf or gift-check a title
                before you buy — so the next story is new.
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
                <Button type="button" variant="outline" size="sm" disabled>
                  Raffy’s shelf
                </Button>
                <Button type="button" variant="secondary" size="sm" asChild>
                  <Link to="/share/wishlist">Wishlist</Link>
                </Button>
              </nav>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, author, or ISBN"
                className="h-12 rounded-xl pl-11"
                aria-label="Search the shelf"
              />
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {filtered.length === books.length
                ? `${books.length} ${books.length === 1 ? "book" : "books"} on the shelf`
                : `${filtered.length} of ${books.length}`}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {!query.trim() && books.length > 0 ? (
          <RecentlyAddedStrip books={books} onSelect={setSelected} />
        ) : null}

        {isbnQuery && isbnOwned ? (
          <div className="mb-6 rounded-2xl bg-primary px-4 py-4 text-primary-foreground sm:px-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] opacity-80">
              Already owned
            </p>
            <p className="mt-1 font-display text-xl font-medium">
              {isbnOwned.title}
            </p>
            <p className="text-sm opacity-80">{isbnOwned.authors}</p>
          </div>
        ) : null}

        {empty ? (
          <EmptyShareState
            query={query}
            isbnMiss={Boolean(isbnQuery && !isbnOwned)}
          />
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((book) => (
              <li key={book.id}>
                <button
                  type="button"
                  onClick={() => setSelected(book)}
                  className="group flex w-full flex-col gap-2.5 text-left"
                >
                  <BookCover
                    title={book.title}
                    authors={book.authors}
                    coverUrl={book.coverUrl}
                    className="transition-[transform,box-shadow] duration-200 ease-out group-hover:-translate-y-1 group-hover:shadow-card-hover"
                  />
                  <span>
                    <span className="block font-medium leading-snug line-clamp-2">
                      {book.title}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted-foreground line-clamp-1">
                      {book.authors || "Unknown author"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      <BookDetail
        book={selected}
        readOnly
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

function EmptyShareState({
  query,
  isbnMiss,
}: {
  query: string;
  isbnMiss: boolean;
}) {
  const searching = query.trim().length > 0;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-primary">
        <BookOpen className="size-6" />
      </div>
      <h2 className="mt-5 font-display text-2xl font-medium">
        {isbnMiss || searching ? "Not on the shelf" : "Raffy’s shelf is empty"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isbnMiss
          ? "This ISBN is not in the family catalog — it may make a good gift."
          : searching
            ? "Nothing here matches that search. If you are shopping, this title is likely a new story."
            : "Nothing listed yet. Try the wishlist or gift check."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button type="button" asChild>
          <Link to="/check">
            <Gift />
            Gift check
          </Link>
        </Button>
        <Button type="button" variant="secondary" asChild>
          <Link to="/share/wishlist">Wishlist</Link>
        </Button>
      </div>
    </div>
  );
}
