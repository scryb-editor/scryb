import { describe, it, expect, afterEach, vi } from "vitest";
import type * as Shortcuts from "../toolbar/shortcuts";

/** Loads the shortcut module fresh under `userAgent`; it reads the platform once at import. */
async function loadFor(userAgent: string): Promise<typeof Shortcuts> {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent });
  return import("../toolbar/shortcuts");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("formatShortcut", () => {
  it("draws arrow keys as arrows on Apple devices", async () => {
    const { formatShortcut } = await loadFor("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
    expect(formatShortcut("Mod+Shift+ArrowUp")).toBe("⌘⇧↑");
    expect(formatShortcut("Mod+Shift+ArrowDown")).toBe("⌘⇧↓");
  });

  it("draws arrow keys as arrows elsewhere", async () => {
    const { formatShortcut } = await loadFor("Mozilla/5.0 (X11; Linux x86_64)");
    expect(formatShortcut("Mod+Shift+ArrowUp")).toBe("Ctrl+Shift+↑");
    expect(formatShortcut("Mod+Shift+ArrowDown")).toBe("Ctrl+Shift+↓");
    expect(formatShortcut("Mod+B")).toBe("Ctrl+B");
  });

  it("keeps ARIA key names for aria-keyshortcuts", async () => {
    const { ariaKeyShortcut } = await loadFor("Mozilla/5.0 (X11; Linux x86_64)");
    expect(ariaKeyShortcut("Mod+Shift+ArrowUp")).toBe("Control+Shift+ArrowUp");
  });
});
