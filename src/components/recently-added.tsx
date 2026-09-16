import { BookCover } from "@/components/book-cover";
import type { Book } from "@/lib/books.types";

const RECENT_LIMIT = 10;

export function RecentlyAddedStrip({
  books,
  onSelect,
}: {
  books: Book[];
  onSelect: (book: Book) => void;
}) {
  const recent = books.slice(0, RECENT_LIMIT);
  if (recent.length === 0) return null;

  return (
    <section className="mb-8" aria-labelledby="recently-added-heading">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2
          id="recently-added-heading"
          className="font-display text-xl font-medium tracking-tight sm:text-2xl"
        >
          Recently added
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          Newest on the shelf
        </p>
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        <ul className="flex gap-3 sm:gap-4">
          {recent.map((book) => (
            <li key={book.id} className="w-[6.75rem] shrink-0 sm:w-28">
              <button
                type="button"
                onClick={() => onSelect(book)}
                className="group flex w-full flex-col gap-2 text-left"
              >
                <BookCover
                  title={book.title}
                  authors={book.authors}
                  coverUrl={book.coverUrl}
                  sizes="112px"
                  className="transition-[transform,box-shadow] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:shadow-card-hover"
                />
                <span className="block text-xs font-medium leading-snug line-clamp-2">
                  {book.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
