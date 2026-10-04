import type { MouseEvent } from "react";
import { Toaster } from "sonner";

/**
 * Single app-wide toaster.
 *
 * - Top-center everywhere. On phones (≤600px, sonner's mobile breakpoint) the
 *   stack is narrower and centered (see `.app-toaster` in styles.css), so it
 *   clears the right-aligned header "Add" button and sits above the add-book
 *   dialog's actions (the dialog's "Add to shelf" button is at its bottom).
 * - Offset includes the safe-area inset (notch / status bar in standalone PWA).
 * - Swipe up/left/right or tap anywhere on a toast to dismiss it.
 */
export function AppToaster() {
  function onClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    const toastEl = target?.closest<HTMLElement>("[data-sonner-toast]");
    if (!toastEl || target?.closest("[data-button], [data-close-button]")) {
      return;
    }
    // Tap-to-dismiss: reuse sonner's own per-toast close button so the right
    // toast is dismissed (and dismissible:false toasts are respected).
    toastEl.querySelector<HTMLButtonElement>("[data-close-button]")?.click();
  }

  return (
    <div className="contents" onClick={onClick}>
      <Toaster
        className="app-toaster"
        theme="light"
        position="top-center"
        richColors={false}
        closeButton
        swipeDirections={["top", "left", "right"]}
        offset={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
        mobileOffset={{
          top: "calc(env(safe-area-inset-top, 0px) + 10px)",
          left: "16px",
          right: "16px",
        }}
        toastOptions={{
          className:
            "app-toast font-sans border-border bg-card text-foreground shadow-overlay cursor-pointer",
        }}
      />
    </div>
  );
}
