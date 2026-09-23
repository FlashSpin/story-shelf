/**
 * Soft GitHub-style “install as app” banner for relatives.
 *
 * - Hidden when already running as an installed PWA.
 * - Chrome / Edge / Android: beforeinstallprompt → Install button.
 * - iOS: Share → Add to Home Screen instructions (no BIP).
 * - Dismiss remembered in localStorage for ~14 days.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type BeforeInstallPromptEventLike,
  isIosDevice,
  isInstallPromptDismissed,
  isRunningAsInstalledPwa,
  shouldPreferInstallPrompt,
  writeInstallDismissed,
} from "@/lib/pwa-install";
import { cn } from "@/lib/utils";

type Mode = "hidden" | "bip" | "ios";

export function InstallAppBanner() {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });
  const preferred = shouldPreferInstallPrompt(pathname);

  const [mode, setMode] = useState<Mode>("hidden");
  const [deferred, setDeferred] =
    useState<BeforeInstallPromptEventLike | null>(null);
  const [installing, setInstalling] = useState(false);
  const [iosStepsOpen, setIosStepsOpen] = useState(false);

  useEffect(() => {
    if (!preferred) {
      setMode("hidden");
      return;
    }
    if (typeof window === "undefined") return;
    if (isRunningAsInstalledPwa()) {
      setMode("hidden");
      return;
    }
    try {
      if (isInstallPromptDismissed(window.localStorage)) {
        setMode("hidden");
        return;
      }
    } catch {
      /* private mode / blocked storage — still allow a one-shot show */
    }

    const ios = isIosDevice(
      window.navigator.userAgent,
      window.navigator.maxTouchPoints ?? 0,
    );
    if (ios) {
      setMode("ios");
      return;
    }

    // Chromium: wait for beforeinstallprompt; stay hidden until then.
    setMode("hidden");

    const onBip = (event: Event) => {
      event.preventDefault();
      const bip = event as BeforeInstallPromptEventLike;
      setDeferred(bip);
      setMode("bip");
    };

    window.addEventListener("beforeinstallprompt", onBip);

    const onInstalled = () => {
      setDeferred(null);
      setMode("hidden");
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [preferred]);

  const dismiss = useCallback(() => {
    try {
      writeInstallDismissed(window.localStorage);
    } catch {
      /* ignore */
    }
    setDeferred(null);
    setMode("hidden");
    setIosStepsOpen(false);
  }, []);

  const onInstall = useCallback(async () => {
    if (!deferred) return;
    setInstalling(true);
    try {
      await deferred.prompt();
      await deferred.userChoice.catch(() => undefined);
    } catch {
      /* user closed the native sheet */
    } finally {
      setDeferred(null);
      setInstalling(false);
      // Either installed (appinstalled hides) or declined — soft-dismiss either way.
      dismiss();
    }
  }, [deferred, dismiss]);

  if (mode === "hidden") return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 sm:p-4"
      role="region"
      aria-label="Install Raffy's bookshelf"
    >
      <div
        className={cn(
          "pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-overlay",
          "animate-in fade-in slide-in-from-bottom-2 duration-300",
        )}
      >
        <div className="flex gap-3 p-3.5 sm:p-4">
          <img
            src="/icon-192.png"
            alt=""
            width={44}
            height={44}
            className="mt-0.5 size-11 shrink-0 rounded-xl border border-border bg-muted object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
              Keep it handy
            </p>
            <p className="mt-0.5 font-display text-lg font-medium leading-snug tracking-tight">
              Add Raffy’s bookshelf
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "ios"
                ? "Put the shelf on your Home Screen so gift-checking is one tap away."
                : "Install as an app — quick search when you’re in the bookshop."}
            </p>

            {mode === "ios" && iosStepsOpen ? (
              <ol className="mt-3 space-y-1.5 rounded-xl bg-muted/80 px-3 py-2.5 text-sm text-foreground">
                <li>
                  1. Tap{" "}
                  <span className="inline-flex items-center gap-1 font-medium">
                    Share <Share className="inline size-3.5 text-primary" aria-hidden />
                  </span>{" "}
                  in Safari
                </li>
                <li>
                  2. Choose{" "}
                  <span className="font-medium">Add to Home Screen</span>
                </li>
                <li>
                  3. Tap <span className="font-medium">Add</span> — done
                </li>
              </ol>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {mode === "bip" ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void onInstall()}
                  disabled={installing || !deferred}
                >
                  <Download />
                  {installing ? "Installing…" : "Install"}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIosStepsOpen((o) => !o)}
                  aria-expanded={iosStepsOpen}
                >
                  <Share />
                  {iosStepsOpen ? "Hide steps" : "How to add"}
                </Button>
              )}
              <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Dismiss install prompt"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
