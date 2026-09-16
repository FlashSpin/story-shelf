import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Gift, Plus } from "lucide-react";
import { toast } from "sonner";
import { AddWishlistDialog } from "@/components/add-wishlist";
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
import { UserButton } from "@/lib/auth/gates";
import { useShelfEditorAccess } from "@/lib/auth/use-shelf-editor";
import { listBooks } from "@/lib/books.functions";
import type { Book } from "@/lib/books.types";
import {
  listWishlist,
  moveWishlistToShelf,
  removeWishlistItem,
} from "@/lib/wishlist.functions";
import type { WishlistItem } from "@/lib/wishlist.types";
import { formatIsbn } from "@/lib/isbn";

export const Route = createFileRoute("/wishlist")({
  loader: async () => {
    const [wishlist, books] = await Promise.all([listWishlist(), listBooks()]);
    return { wishlist, books };
  },
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlist, books } = Route.useLoaderData();
  const router = useRouter();
  const { user, canEdit, isPending } = useShelfEditorAccess();
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<WishlistItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const empty = wishlist.length === 0;

  async function moveToShelf(item: WishlistItem) {
    setBusy(true);
    try {
      const result = await moveWishlistToShelf({ data: { id: item.id } });
      await router.invalidate({ sync: true });
      setSelected(null);
      if (!result.ok) {
        if (result.reason === "duplicate") {
          toast.message("Already on the shelf", {
            description: result.existing.title,
          });
          return;
        }
        toast.error("That gift idea is gone.");
        return;
      }
      toast.success("Moved to the shelf", { description: result.book.title });
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        toast.error("Sign in to edit the wishlist.");
        await router.navigate({ to: "/login" });
        return;
      }
      toast.error("Could not move that title. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item: WishlistItem) {
    setBusy(true);
    try {
      await removeWishlistItem({ data: { id: item.id } });
      await router.invalidate({ sync: true });
      setSelected(null);
      setConfirmRemove(false);
      toast.success("Removed from wishlist");
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        toast.error("Sign in to edit the wishlist.");
        await router.navigate({ to: "/login" });
        return;
      }
      toast.error("Could not remove that title.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-border/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
                Gift ideas
              </p>
              <h1 className="mt-1 font-display text-4xl font-medium tracking-tight sm:text-5xl">
                Wishlist
              </h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
                {empty
                  ? "Nothing here yet. Add books Raffy would love but doesn't own."
                  : "Great gift ideas — not on the shelf yet."}
              </p>
              <nav className="mt-4 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" asChild>
                  <Link to="/">Raffy's shelf</Link>
                </Button>
                <Button type="button" variant="outline" size="sm" disabled>
                  Wishlist
                </Button>
              </nav>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {isPending ? (
                <div className="h-11 w-36 animate-pulse rounded-lg bg-muted" />
              ) : canEdit ? (
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <Button type="button" onClick={() => setAddOpen(true)}>
                    <Plus />
                    <span className="hidden sm:inline">Add to wishlist</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                  <UserButton />
                </div>
              ) : user ? (
                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <p className="text-xs text-muted-foreground">Browse only</p>
                  <UserButton />
                </div>
              ) : (
                <Button type="button" variant="secondary" asChild>
                  <Link to="/login">Sign in to help</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {empty ? (
          <EmptyWishlist
            canEdit={canEdit}
            isPending={isPending}
            onAdd={() => setAddOpen(true)}
          />
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

      <AddWishlistDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        books={books}
        wishlist={wishlist}
        onOpenOwned={(_book: Book) => {
          void router.navigate({ to: "/" });
        }}
      />

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
              {isPending ? null : canEdit ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void moveToShelf(selected)}
                  >
                    Move to shelf
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setConfirmRemove(true)}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from wishlist?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected
                ? `“${selected.title}” will leave the gift list. You can add it again later.`
                : "This gift idea will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || !selected}
              onClick={(e) => {
                e.preventDefault();
                if (selected) void removeItem(selected);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyWishlist({
  canEdit,
  isPending,
  onAdd,
}: {
  canEdit: boolean;
  isPending: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-primary">
        <Gift className="size-6" />
      </div>
      <h2 className="mt-5 font-display text-2xl font-medium">Wishlist</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Nothing here yet. Add books Raffy would love but doesn't own.
      </p>
      {isPending ? null : canEdit ? (
        <Button type="button" className="mt-6" onClick={onAdd}>
          <Plus />
          Add to wishlist
        </Button>
      ) : (
        <Button type="button" className="mt-6" variant="secondary" asChild>
          <Link to="/login">Sign in to add</Link>
        </Button>
      )}
    </div>
  );
}
