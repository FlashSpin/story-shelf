import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { CoverUpload } from "@/components/cover-upload";
import { BookCover } from "@/components/book-cover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useShelfEditorAccess } from "@/lib/auth/use-shelf-editor";
import { getBookCover, removeBook, updateBook, updateCover } from "@/lib/books.functions";
import { parseAgeBand, type Book } from "@/lib/books.types";
import { formatIsbn } from "@/lib/isbn";

export function BookDetail({
  book,
  onOpenChange,
  onBookChange,
}: {
  book: Book | null;
  onOpenChange: (open: boolean) => void;
  onBookChange?: (book: Book) => void;
}) {
  const router = useRouter();
  const { canEdit, isPending } = useShelfEditorAccess();
  const [notes, setNotes] = useState(book?.notes ?? "");
  const [localCover, setLocalCover] = useState<string | null>(null);
  const [uploadedCover, setUploadedCover] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    setNotes(book?.notes ?? "");
  }, [book]);

  useEffect(() => {
    setLocalCover(null);
    setUploadedCover(null);
  }, [book?.id]);

  // List payloads omit uploaded cover bytes; fetch them when opening detail.
  useEffect(() => {
    if (!book?.hasCoverUpload) return;
    let cancelled = false;
    void getBookCover({ data: { id: book.id } }).then((dataUrl) => {
      if (!cancelled) setUploadedCover(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [book?.id, book?.hasCoverUpload]);

  const dirty = Boolean(book) && notes !== (book?.notes ?? "");

  async function save() {
    if (!book) return;
    setSaving(true);
    try {
      const updated = await updateBook({
        data: {
          id: book.id,
          notes: notes.trim() ? notes : null,
          ageBand: parseAgeBand(book.ageBand),
        },
      });
      await router.invalidate({ sync: true });
      if (updated) onBookChange?.(updated);
      toast.success("Shelf notes saved");
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        toast.error("Sign in to make changes.");
        await router.navigate({ to: "/login" });
        return;
      }
      toast.error("Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function onUploadCover(coverData: string) {
    if (!book) return;
    setLocalCover(coverData);
    try {
      const updated = await updateCover({
        data: { id: book.id, coverData },
      });
      await router.invalidate({ sync: true });
      if (updated) {
        setUploadedCover(coverData);
        onBookChange?.(updated);
      }
      toast.success("Cover photo saved");
    } catch (err) {
      setLocalCover(null);
      if (err instanceof Error && err.message === "Unauthorized") {
        toast.error("Sign in to upload a cover.");
        await router.navigate({ to: "/login" });
        return;
      }
      toast.error("Could not save that photo.");
    }
  }

  async function onRemove() {
    if (!book) return;
    try {
      await removeBook({ data: { id: book.id } });
      await router.invalidate({ sync: true });
      toast.success("Removed from the shelf", { description: book.title });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        toast.error("Sign in to remove books.");
        await router.navigate({ to: "/login" });
        return;
      }
      toast.error("Could not remove that book.");
    }
  }

  return (
    <>
      <Dialog open={Boolean(book)} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl sm:p-6">
          {book ? (
            <>
              <DialogHeader>
                <DialogTitle className="pr-4">{book.title}</DialogTitle>
                <DialogDescription>{book.authors || "Unknown author"}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-5 sm:grid-cols-[9.5rem_1fr]">
                {canEdit ? (
                  <CoverUpload
                    title={book.title}
                    authors={book.authors}
                    coverUrl={localCover ?? uploadedCover ?? book.coverUrl}
                    onChange={(dataUrl) => void onUploadCover(dataUrl)}
                  />
                ) : (
                  <BookCover
                    title={book.title}
                    authors={book.authors}
                    coverUrl={uploadedCover ?? book.coverUrl}
                    className="mx-auto w-36 sm:w-full"
                  />
                )}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap gap-2">
                    {book.publishedYear ? (
                      <Badge variant="muted">{book.publishedYear}</Badge>
                    ) : null}
                    {book.pageCount ? (
                      <Badge variant="muted">{book.pageCount} pages</Badge>
                    ) : null}
                  </div>
                  <dl className="grid gap-1 text-sm">
                    {book.publisher ? (
                      <div className="flex gap-2">
                        <dt className="w-20 shrink-0 text-muted-foreground">Publisher</dt>
                        <dd>{book.publisher}</dd>
                      </div>
                    ) : null}
                    {book.isbn ? (
                      <div className="flex gap-2">
                        <dt className="w-20 shrink-0 text-muted-foreground">ISBN</dt>
                        <dd className="font-mono text-xs tracking-wide">
                          {formatIsbn(book.isbn)}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  {book.description ? (
                    <p className="text-sm text-muted-foreground line-clamp-5">
                      {book.description}
                    </p>
                  ) : null}
                  {canEdit ? (
                    <>
                      <div className="grid gap-1.5">
                        <Label htmlFor="detail-notes">Shelf note</Label>
                        <Textarea
                          id="detail-notes"
                          maxLength={500}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Edition, location, or a reminder for the next gift"
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                        <Button
                          type="button"
                          variant="outline"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setConfirmRemove(true)}
                        >
                          Remove
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void save()}
                          disabled={!dirty || saving}
                        >
                          Save changes
                        </Button>
                      </div>
                    </>
                  ) : !isPending ? (
                    <p className="text-sm text-muted-foreground">
                      Sign in to upload a cover photo or edit this book.
                    </p>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this book?</AlertDialogTitle>
            <AlertDialogDescription>
              {book
                ? `${book.title} will leave the family catalog. This cannot be undone.`
                : "This book will leave the family catalog."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void onRemove()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
