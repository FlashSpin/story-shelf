import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeft, Camera, Check, LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { BarcodeScanner, scannerSupported } from "@/components/barcode-scanner";
import { BookCover } from "@/components/book-cover";
import { CoverUpload } from "@/components/cover-upload";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { addBook, lookupIsbn, searchCatalog } from "@/lib/books.functions";
import { AGE_BANDS, parseAgeBand, type Book, type BookDraft, type BookHit } from "@/lib/books.types";
import { canonicalIsbn, looksLikeIsbn } from "@/lib/isbn";
import { cn } from "@/lib/utils";

type Mode = "search" | "scan" | "manual";

function ownedMatch(books: Book[], hit: BookHit): Book | undefined {
  if (hit.isbn) {
    const isbn = canonicalIsbn(hit.isbn);
    const byIsbn = books.find((b) => b.isbn && canonicalIsbn(b.isbn) === isbn);
    if (byIsbn) return byIsbn;
  }
  const t = hit.title.trim().toLowerCase();
  const a = hit.authors.trim().toLowerCase();
  return books.find(
    (b) => b.title.trim().toLowerCase() === t && b.authors.trim().toLowerCase() === a,
  );
}

function hitToDraft(hit: BookHit): BookDraft {
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

export function AddBookDialog({
  open,
  onOpenChange,
  books,
  onOpenExisting,
  initialQuery = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: Book[];
  onOpenExisting: (book: Book) => void;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<BookHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<BookDraft>({ title: "", authors: "" });
  const [pending, setPending] = useState<BookDraft | null>(null);
  const canScan = useMemo(() => scannerSupported(), []);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setMode("search");
      setHits([]);
      setSearchError(null);
      setDraft({ title: "", authors: "" });
      setPending(null);
    }
  }, [open, initialQuery]);

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
      } catch {
        if (!cancelled) {
          setHits([]);
          setSearchError("Lookup failed. Try again or add the book by hand.");
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open, mode, pending]);

  async function save(next: BookDraft) {
    if (!next.title.trim()) return;
    setSaving(true);
    try {
      const result = await addBook({
        data: {
          title: next.title,
          authors: next.authors ?? "",
          isbn: next.isbn ?? null,
          coverUrl: next.coverData ? null : (next.coverUrl ?? null),
          coverData: next.coverData ?? null,
          publisher: next.publisher ?? null,
          publishedYear: next.publishedYear ?? null,
          pageCount: next.pageCount ?? null,
          description: next.description ?? null,
          notes: next.notes ?? null,
          ageBand: parseAgeBand(next.ageBand),
        },
      });
      if (!result.ok) {
        toast.message("Already on the shelf", {
          description: result.existing.title,
        });
        onOpenChange(false);
        onOpenExisting(result.existing);
        return;
      }
      await router.invalidate({ sync: true });
      toast.success("Added to the shelf", { description: result.book.title });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        toast.error("Sign in to add books.");
        onOpenChange(false);
        await router.navigate({ to: "/login" });
        return;
      }
      toast.error("Could not add that book. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleScan(isbn: string) {
    setMode("search");
    setQuery(isbn);
    setSearching(true);
    try {
      const hit = await lookupIsbn({ data: { isbn } });
      if (hit) {
        const existing = ownedMatch(books, hit);
        if (existing) {
          toast.message("Already on the shelf", { description: existing.title });
          onOpenChange(false);
          onOpenExisting(existing);
          return;
        }
        setPending(hitToDraft(hit));
        setSearchError(null);
      } else {
        setHits([]);
        setDraft((d) => ({ ...d, isbn }));
        setMode("manual");
        setSearchError(null);
      }
    } catch {
      setDraft((d) => ({ ...d, isbn }));
      setMode("manual");
    } finally {
      setSearching(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle>{pending ? "Confirm and add" : "Add a book"}</DialogTitle>
          <DialogDescription>
            {pending
              ? "Upload a photo of the cover if you have the book in hand, then add it to the shelf."
              : "Search, scan the barcode, or enter the details yourself. You can photograph the cover before saving."}
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
            <div className="grid gap-4 sm:grid-cols-[7.5rem_1fr] sm:items-start">
              <CoverUpload
                title={pending.title}
                authors={pending.authors}
                coverUrl={pending.coverData || pending.coverUrl}
                onChange={(coverData) =>
                  setPending((d) => (d ? { ...d, coverData } : d))
                }
                disabled={saving}
              />
              <div>
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
              Add to shelf
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-1 rounded-xl bg-muted p-1">
              {(
                [
                  { id: "search", label: "Search" },
                  { id: "scan", label: "Scan" },
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
                    aria-label="Search books to add"
                  />
                </div>
                {canScan ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMode("scan")}
                  >
                    <Camera />
                    Scan barcode
                  </Button>
                ) : null}
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
                    return (
                      <li key={`${hit.isbn ?? hit.title}-${hit.authors}`}>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            if (owned) {
                              toast.message("Already on the shelf", {
                                description: owned.title,
                              });
                              onOpenChange(false);
                              onOpenExisting(owned);
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
                              {hit.publishedYear ? ` · ${hit.publishedYear}` : ""}
                            </span>
                          </span>
                          {owned ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-primary">
                              <Check className="size-3.5" />
                              Owned
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

            {mode === "scan" ? (
              canScan ? (
                <BarcodeScanner
                  onDetect={handleScan}
                  onCancel={() => setMode("search")}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Barcode scanning is not available in this browser. Search by title
                  or type the ISBN instead.
                </p>
              )
            ) : null}

            {mode === "manual" ? (
              <form
                className="grid gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(draft);
                }}
              >
                <div className="grid gap-4 sm:grid-cols-[7.5rem_1fr] sm:items-start">
                  <CoverUpload
                    title={draft.title}
                    authors={draft.authors}
                    coverUrl={draft.coverData || draft.coverUrl}
                    onChange={(coverData) => setDraft((d) => ({ ...d, coverData }))}
                    disabled={saving}
                  />
                  <div className="grid gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="book-title">Title</Label>
                      <Input
                        id="book-title"
                        required
                        value={draft.title}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, title: e.target.value }))
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="book-authors">Author</Label>
                      <Input
                        id="book-authors"
                        value={draft.authors}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, authors: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="book-isbn">ISBN</Label>
                    <Input
                      id="book-isbn"
                      inputMode="numeric"
                      value={draft.isbn ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, isbn: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="book-year">Year</Label>
                    <Input
                      id="book-year"
                      inputMode="numeric"
                      value={draft.publishedYear ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, publishedYear: e.target.value }))
                      }
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Reading level</Label>
                  <Select
                    value={draft.ageBand ?? "none"}
                    onValueChange={(value) =>
                      setDraft((d) => ({
                        ...d,
                        ageBand: value === "none" ? null : value,
                      }))
                    }
                  >
                    <SelectTrigger aria-label="Reading level">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unspecified</SelectItem>
                      {AGE_BANDS.map((band) => (
                        <SelectItem key={band} value={band}>
                          {band}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="book-notes">Shelf note</Label>
                  <Textarea
                    id="book-notes"
                    maxLength={500}
                    placeholder="Edition, where it lives, anything useful"
                    value={draft.notes ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  />
                </div>
                <Button type="submit" disabled={saving || !draft.title.trim()}>
                  {saving ? <LoaderCircle className="animate-spin" /> : null}
                  Add to shelf
                </Button>
              </form>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
