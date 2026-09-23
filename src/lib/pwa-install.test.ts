import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INSTALL_DISMISS_KEY,
  INSTALL_DISMISS_MS,
  clearInstallDismissed,
  isInstallPromptDismissed,
  isIosDevice,
  isRunningAsInstalledPwa,
  shouldPreferInstallPrompt,
  writeInstallDismissed,
} from "./pwa-install.ts";

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe("isRunningAsInstalledPwa", () => {
  it("detects display-mode: standalone", () => {
    const win = {
      matchMedia: (q: string) => ({
        matches: q.includes("standalone"),
      }),
      navigator: {},
    };
    assert.equal(isRunningAsInstalledPwa(win as never), true);
  });

  it("detects iOS navigator.standalone", () => {
    const win = {
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: true },
    };
    assert.equal(isRunningAsInstalledPwa(win as never), true);
  });

  it("is false in a normal browser tab", () => {
    const win = {
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: false },
    };
    assert.equal(isRunningAsInstalledPwa(win as never), false);
  });
});

describe("isIosDevice", () => {
  it("recognises iPhone Safari", () => {
    assert.equal(
      isIosDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
      true,
    );
  });

  it("recognises iPadOS desktop UA with touch", () => {
    assert.equal(
      isIosDevice(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        5,
      ),
      true,
    );
  });

  it("recognises Chrome on iOS (still needs A2HS)", () => {
    assert.equal(
      isIosDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0.0.0 Mobile/15E148 Safari/604.1",
      ),
      true,
    );
  });

  it("is false on desktop Chrome", () => {
    assert.equal(
      isIosDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ),
      false,
    );
  });
});

describe("dismiss storage", () => {
  it("writes and honours a 14-day window", () => {
    const storage = memoryStorage();
    const now = 1_700_000_000_000;
    const until = writeInstallDismissed(storage, now);
    assert.equal(until, now + INSTALL_DISMISS_MS);
    assert.equal(storage.getItem(INSTALL_DISMISS_KEY), String(until));
    assert.equal(isInstallPromptDismissed(storage, now + 1000), true);
    assert.equal(
      isInstallPromptDismissed(storage, now + INSTALL_DISMISS_MS + 1),
      false,
    );
  });

  it("clears dismiss", () => {
    const storage = memoryStorage({
      [INSTALL_DISMISS_KEY]: String(Date.now() + 99999),
    });
    clearInstallDismissed(storage);
    assert.equal(isInstallPromptDismissed(storage), false);
  });
});

describe("shouldPreferInstallPrompt", () => {
  it("prefers home, share, and gift-check", () => {
    assert.equal(shouldPreferInstallPrompt("/"), true);
    assert.equal(shouldPreferInstallPrompt("/share"), true);
    assert.equal(shouldPreferInstallPrompt("/share/wishlist"), true);
    assert.equal(shouldPreferInstallPrompt("/check"), true);
  });

  it("skips editor-ish routes", () => {
    assert.equal(shouldPreferInstallPrompt("/login"), false);
    assert.equal(shouldPreferInstallPrompt("/wishlist"), false);
    assert.equal(shouldPreferInstallPrompt("/invite/abc"), false);
  });
});
