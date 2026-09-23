import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, Check, LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { lookupIsbn, searchCatalog } from "@/lib/books.functions";
import type { Book, BookHit } from "@/lib/books.types";
import { findDuplicateByIdentity } from "@/lib/book-identity";
import { looksLikeIsbn } from "@/lib/isbn";
import { addWishlistItem } from "@/lib/wishlist.functions";
import type { WishlistDraft, WishlistItem } from "@/lib/wishlist.types";
import { cn } from "@/lib/utils";

type Mode = "search" | "manual";

function ownedMatch(books: Book[], hit: BookHit): Book | undefined {
  return findDuplicateByIdentity(books, hit);
}

function wishMatch(items: WishlistItem[], hit: BookHit): WishlistItem | undefined {
  return findDuplicateByIdentity(items, hit);
}

function hitToDraft(hit: BookHit): WishlistDraft {
  return {
    title: hit.title,
    authors: hit.authors,
    isbn: hit.isbn,
    coverUrl: hit.coverUrl,
    publisher: hit.publisher,
    publishedYear: hit.publishedYear,
    pageCount: hit.pageCount,
    description: hit.description,
  };
}

export function AddWishlistDialog({
  open,
  onOpenChange,
  books,
  wishlist,
  onOpenOwned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: Book[];
  wishlist: WishlistItem[];
  onOpenOwned?: (book: Book) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<BookHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<WishlistDraft>({ title: "", authors: "" });
  const [pending, setPending] = useState<WishlistDraft | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setMode("search");
      setHits([]);
      setSearchError(null);
      setDraft({ title: "", authors: "" });
      setPending(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "search" || pending) return;
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = looksLikeIsbn(q)
          ? [await lookupIsbn({ data: { isbn: q } })]
          : await searchCatalog({ data: { q } });
        if (cancelled) return;
        const list = results.filter(Boolean) as BookHit[];
        setHits(list);
        setSearchError(list.length === 0 ? "No matching titles found." : null);
      } catch (err) {
        if (!cancelled) {
          setHits([]);
          if (err instanceof Error && err.message === "Unauthorized") {
            setSearchError("Sign in to search the catalog.");
            onOpenChange(false);
            void router.navigate({ to: "/login" });
          } else {
            setSearchError("Lookup failed. Try again or add the title by hand.");
          }
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open, mode, pending, onOpenChange, router]);

  async function save(next: WishlistDraft) {
    if (!next.title.trim()) return;
    setSaving(true);
    try {
      const result = await addWishlistItem({
        data: {
          title: next.title,
          authors: next.authors ?? "",
          isbn: next.isbn ?? null,
          coverUrl: next.coverUrl ?? null,
          publisher: next.publisher ?? null,
          publishedYear: next.publishedYear ?? null,
          pageCount: next.pageCount ?? null,
          description: next.description ?? null,
          notes: next.notes ?? null,
        },
      });
      if (!result.ok) {
        if (result.reason === "already-owned") {
          toast.message("Already on Raffy’s shelf", {
            description: result.existing.title,
          });
          onOpenChange(false);
          onOpenOwned?.(result.existing);
          return;
        }
        toast.message("Already on the wishlist", {
          description: result.existing.title,
        });
        onOpenChange(false);
        return;
      }
      await router.invalidate({ sync: true });
      toast.success("Added to wishlist", { description: result.item.title });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        toast.error("Sign in to edit the wishlist.");
        onOpenChange(false);
        await router.navigate({ to: "/login" });
        return;
      }
      toast.error("Could not add that title. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {pending ? "Confirm gift idea" : "Add to wishlist"}
          </DialogTitle>
          <DialogDescription>
            {pending
              ? "This title is not on Raffy's shelf yet — add it as a gift idea."
              : "Search for a book Raffy would love, or enter the details yourself."}
          </DialogDescription>
        </DialogHeader>

        {pending ? (
          <div className="grid gap-4">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setPending(null)}
            >
              <ArrowLeft className="size-4" />
              Back to search
            </button>
            <div className="flex items-center gap-3">
              <BookCover
                title={pending.title}
                authors={pending.authors}
                coverUrl={pending.coverUrl}
                className="w-16 shrink-0"
              />
              <div className="min-w-0">
                <p className="font-display text-xl font-medium leading-snug">
                  {pending.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pending.authors || "Unknown author"}
                  {pending.publishedYear ? ` · ${pending.publishedYear}` : ""}
                </p>
              </div>
            </div>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void save(pending)}
            >
              {saving ? <LoaderCircle className="animate-spin" /> : null}
              Add to wishlist
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {(
                [
                  { id: "search", label: "Search" },
                  { id: "manual", label: "Manual" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMode(tab.id)}
                  className={cn(
                    "h-10 flex-1 rounded-lg text-sm font-medium transition-[background-color,color] duration-150",
                    mode === tab.id
                      ? "bg-card text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {mode === "search" ? (
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Title, author, or ISBN"
                    className="pl-10"
                    autoFocus
                    aria-label="Search books for the wishlist"
                  />
                </div>
                {searching ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LoaderCircle className="size-4 animate-spin" />
                    Looking up titles…
                  </p>
                ) : null}
                {searchError && !searching ? (
                  <p className="text-sm text-muted-foreground">{searchError}</p>
                ) : null}
                <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
                  {hits.map((hit) => {
                    const owned = ownedMatch(books, hit);
                    const wished = wishMatch(wishlist, hit);
                    return (
                      <li key={`${hit.isbn ?? hit.title}-${hit.authors}`}>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            if (owned) {
                              toast.message("Already on Raffy’s shelf", {
                                description: owned.title,
                              });
                              onOpenChange(false);
                              onOpenOwned?.(owned);
                              return;
                            }
                            if (wished) {
                              toast.message("Already on the wishlist", {
                                description: wished.title,
                              });
                              onOpenChange(false);
                              return;
                            }
                            setPending(hitToDraft(hit));
                          }}
                          className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-muted"
                        >
                          <BookCover
                            title={hit.title}
                            authors={hit.authors}
                            coverUrl={hit.coverUrl}
                            className="w-12 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium leading-snug line-clamp-2">
                              {hit.title}
                            </span>
                            <span className="block text-sm text-muted-foreground line-clamp-1">
                              {hit.authors || "Unknown author"}
                              {hit.publishedYear
                                ? ` · ${hit.publishedYear}`
                                : ""}
                            </span>
                          </span>
                          {owned ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-primary">
                              <Check className="size-3.5" />
                              Owned
                            </span>
                          ) : wished ? (
                            <span className="text-xs font-medium text-muted-foreground">
                              Wished
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-primary">
                              Choose
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {mode === "manual" ? (
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(draft);
                }}
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="wish-title">Title</Label>
                  <Input
                    id="wish-title"
                    required
                    value={draft.title}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, title: e.target.value }))
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="wish-authors">Author</Label>
                  <Input
                    id="wish-authors"
                    value={draft.authors}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, authors: e.target.value }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="wish-isbn">ISBN</Label>
                    <Input
                      id="wish-isbn"
                      inputMode="numeric"
                      value={draft.isbn ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, isbn: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="wish-year">Year</Label>
                    <Input
                      id="wish-year"
                      inputMode="numeric"
                      value={draft.publishedYear ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          publishedYear: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <Button type="submit" disabled={saving || !draft.title.trim()}>
                  {saving ? <LoaderCircle className="animate-spin" /> : null}
                  Add to wishlist
                </Button>
              </form>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
