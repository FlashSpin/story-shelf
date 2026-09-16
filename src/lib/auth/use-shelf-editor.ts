import { useEffect, useState } from "react";
import { getShelfEditorStatus } from "@/lib/books.functions";
import { useCurrentUserState } from "./use-current-user";

/**
 * Whether the current visitor may mutate the shelf.
 * Guests and signed-in users not on `SHELF_EDITOR_EMAILS` are read-only.
 * Auth-off DEV_USER is treated as an editor (local PGLite).
 *
 * Effect deps must be primitives (`user.id` / `user.primaryEmail`), not the
 * `user` object — `useCurrentUserState` allocates a new object every render,
 * which would re-fire this effect, flip `statusPending` forever, and leave the
 * Add book control stuck on the grey pulse.
 */
export function useShelfEditorAccess(): {
  canEdit: boolean;
  isPending: boolean;
  user: ReturnType<typeof useCurrentUserState>["user"];
} {
  const { user, isPending: authPending } = useCurrentUserState();
  const [isEditor, setIsEditor] = useState(false);
  const [statusPending, setStatusPending] = useState(true);

  const userId = user?.id;
  const userEmail = user?.primaryEmail;
  const isDevFallback = user?.isDevFallback ?? false;

  useEffect(() => {
    let cancelled = false;
    if (authPending) return;

    if (!userId) {
      setIsEditor(false);
      setStatusPending(false);
      return;
    }

    if (isDevFallback) {
      setIsEditor(true);
      setStatusPending(false);
      return;
    }

    setStatusPending(true);
    void getShelfEditorStatus()
      .then((status) => {
        if (!cancelled) setIsEditor(status.isEditor);
      })
      .catch(() => {
        if (!cancelled) setIsEditor(false);
      })
      .finally(() => {
        if (!cancelled) setStatusPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, userEmail, isDevFallback, authPending]);

  return {
    canEdit: isEditor,
    isPending: authPending || statusPending,
    user,
  };
}
