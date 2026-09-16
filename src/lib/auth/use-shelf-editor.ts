import { useEffect, useState } from "react";
import { getShelfEditorStatus } from "@/lib/books.functions";
import { useCurrentUserState } from "./use-current-user";

/**
 * Whether the current visitor may mutate the shelf.
 * Guests and signed-in users not on `SHELF_EDITOR_EMAILS` are read-only.
 * Auth-off DEV_USER is treated as an editor (local PGLite).
 */
export function useShelfEditorAccess(): {
  canEdit: boolean;
  isPending: boolean;
  user: ReturnType<typeof useCurrentUserState>["user"];
} {
  const { user, isPending: authPending } = useCurrentUserState();
  const [isEditor, setIsEditor] = useState(false);
  const [statusPending, setStatusPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (authPending) return;

    if (!user) {
      setIsEditor(false);
      setStatusPending(false);
      return;
    }

    if (user.isDevFallback) {
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
  }, [user, authPending]);

  return {
    canEdit: isEditor,
    isPending: authPending || statusPending,
    user,
  };
}
