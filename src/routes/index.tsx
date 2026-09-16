import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Plus, Search } from "lucide-react";
import { AddBookDialog } from "@/components/add-book";
import { BookCover } from "@/components/book-cover";
import { BookDetail } from "@/components/book-detail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listBooks } from "@/lib/books.functions";
import { AGE_BANDS, type Book } from "@/lib/books.types";
import { canonicalIsbn, looksLikeIsbn } from "@/lib/isbn";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  loader: () => listBooks(),
  component: Home,
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

function Home() {
  const books = Route.useLoaderData();
  const { user, isPending } = useCurrentUserState();
  const canEdit = Boolean(user);
  const [query, setQuery] = useState("");
  const [band, setBand] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Book | null>(null);

  const filtered = useMemo(() => {
    return books.filter((book) => {
      if (band !== "all" && book.ageBand !== band) return false;
      return matchesQuery(book, query);
    });
  }, [books, band, query]);

  const isbnQuery = looksLikeIsbn(query);
  const isbnOwned = isbnQuery
    ? books.find(
        (b) => b.isbn && canonicalIsbn(b.isbn) === canonicalIsbn(query),
      )
    : undefined;
  const empty = filtered.length === 0;
  const usedBands = AGE_BANDS.filter((item) =>
    books.some((book) => book.ageBand === item),
  );

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                Family library
              </p>
              <h1 className="mt-1 font-display text-4xl font-medium tracking-tight sm:text-5xl">
                Story Shelf
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                A shared catalog of books already at home. Search before you buy
                so the next gift is a new story, not a duplicate.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {isPending ? (
                <div className="h-11 w-36 animate-pulse rounded-lg bg-muted" />
              ) : canEdit ? (
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <Button type="button" onClick={() => setAddOpen(true)}>
                    <Plus />
                    <span className="hidden sm:inline">Add book</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                  <UserButton />
                </div>
              ) : (
                <Button type="button" variant="secondary" asChild>
                  <Link to="/login">Sign in to edit</Link>
                </Button>
              )}
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
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground tabular-nums">
                {filtered.length === books.length
                  ? `${books.length} ${books.length === 1 ? "book" : "books"} on the shelf`
                  : `${filtered.length} of ${books.length}`}
              </p>
            </div>
            {usedBands.length > 0 ? (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                <FilterChip
                  active={band === "all"}
                  onClick={() => setBand("all")}
                  label="All"
                />
                {usedBands.map((item) => (
                  <FilterChip
                    key={item}
                    active={band === item}
                    onClick={() => setBand(item)}
                    label={item}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {isbnQuery && isbnOwned ? (
          <div className="mb-6 rounded-2xl bg-primary px-4 py-4 text-primary-foreground sm:px-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] opacity-80">
              Already owned
            </p>
            <p className="mt-1 font-display text-xl font-medium">{isbnOwned.title}</p>
            <p className="text-sm opacity-80">{isbnOwned.authors}</p>
          </div>
        ) : null}

        {empty ? (
          <EmptyState
            query={query}
            isbnMiss={Boolean(isbnQuery && !isbnOwned)}
            canEdit={canEdit}
            isPending={isPending}
            onAdd={() => setAddOpen(true)}
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

      <AddBookDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        books={books}
        initialQuery={empty && query ? query : ""}
        onOpenExisting={(book) => setSelected(book)}
      />
      <BookDetail
        book={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onBookChange={setSelected}
      />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 shrink-0 rounded-full px-3.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-150",
        active
          ? "bg-primary text-primary-foreground shadow-card"
          : "bg-card text-foreground shadow-card hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}

function EmptyState({
  query,
  isbnMiss,
  canEdit,
  isPending,
  onAdd,
}: {
  query: string;
  isbnMiss: boolean;
  canEdit: boolean;
  isPending: boolean;
  onAdd: () => void;
}) {
  const searching = query.trim().length > 0;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-primary">
        <BookOpen className="size-6" />
      </div>
      <h2 className="mt-5 font-display text-2xl font-medium">
        {isbnMiss || searching ? "Not on the shelf" : "The shelf is empty"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isbnMiss
          ? "This ISBN is not in the family catalog. It may make a good gift — or add it if you just brought it home."
          : searching
            ? "Nothing here matches that search. If you are shopping, this title is likely a new story."
            : "Add the books already at home so family can check before they buy."}
      </p>
      {isPending ? null : canEdit ? (
        <Button type="button" className="mt-6" onClick={onAdd}>
          <Plus />
          Add a book
        </Button>
      ) : (
        <Button type="button" className="mt-6" variant="secondary" asChild>
          <Link to="/login">Sign in to add</Link>
        </Button>
      )}
    </div>
  );
}
