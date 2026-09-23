/** Soft “install as app” prompt helpers — no DOM, safe to unit-test. */

export const INSTALL_DISMISS_KEY = "story-shelf:install-dismissed-until";

/** Remember dismiss for two weeks so relatives aren’t nagged. */
export const INSTALL_DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

export type BeforeInstallPromptEventLike = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** True when the page is already running as an installed PWA. */
export function isRunningAsInstalledPwa(
  win: Pick<Window, "matchMedia" | "navigator"> = window,
): boolean {
  try {
    if (win.matchMedia("(display-mode: standalone)").matches) return true;
    if (win.matchMedia("(display-mode: fullscreen)").matches) return true;
    if (win.matchMedia("(display-mode: minimal-ui)").matches) return true;
  } catch {
    /* matchMedia can throw in odd test / SSR stubs */
  }
  const nav = win.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/**
 * iPhone / iPad (any browser shell). None of them fire beforeinstallprompt;
 * relatives need Share → Add to Home Screen copy.
 */
export function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
  const ua = userAgent;
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  // iPadOS 13+ reports as Macintosh but is touch
  return /Macintosh/i.test(ua) && maxTouchPoints > 1;
}

export function readDismissUntil(
  storage: Pick<Storage, "getItem">,
  now = Date.now(),
): number | null {
  const raw = storage.getItem(INSTALL_DISMISS_KEY);
  if (!raw) return null;
  const until = Number(raw);
  if (!Number.isFinite(until)) return null;
  if (until <= now) return null;
  return until;
}

export function isInstallPromptDismissed(
  storage: Pick<Storage, "getItem">,
  now = Date.now(),
): boolean {
  return readDismissUntil(storage, now) !== null;
}

export function writeInstallDismissed(
  storage: Pick<Storage, "setItem">,
  now = Date.now(),
  durationMs = INSTALL_DISMISS_MS,
): number {
  const until = now + durationMs;
  storage.setItem(INSTALL_DISMISS_KEY, String(until));
  return until;
}

export function clearInstallDismissed(
  storage: Pick<Storage, "removeItem">,
): void {
  storage.removeItem(INSTALL_DISMISS_KEY);
}

/** Guest / relative surfaces where the prompt is most useful. */
export function shouldPreferInstallPrompt(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname.startsWith("/share")) return true;
  if (pathname.startsWith("/check")) return true;
  return false;
}
