/**
 * Tests for Phase 69-01: POPULAR_EMOJIS constant, toolbar/bubble emoji item-config,
 * items() empty-query behaviour, and scrybEmojiStore storage namespace.
 */

import { describe, it, expect } from "vitest";
import { POPULAR_EMOJIS, POPULAR_EMOJI_SHORTCODES } from "../emoji/popular";
import { TOOLBAR_ITEM_CONFIG } from "../toolbar/item-config";
import { BUBBLE_MENU_ITEM_CONFIG } from "../bubble-menu/item-config";
import { MATERIAL_ICONS } from "../toolbar/config";
import { buildExtensions } from "../editor-factory";
import { createEmojiCallbackStore } from "../emoji/callback-store";

// =============================================================================
// POPULAR_EMOJIS invariants
// =============================================================================

describe("POPULAR_EMOJIS", () => {
  it("exports POPULAR_EMOJI_SHORTCODES as a readonly string array", () => {
    expect(Array.isArray(POPULAR_EMOJI_SHORTCODES)).toBe(true);
    expect(POPULAR_EMOJI_SHORTCODES.length).toBeGreaterThanOrEqual(40);
  });

  it("exports POPULAR_EMOJIS as a readonly array with > 40 items", () => {
    expect(Array.isArray(POPULAR_EMOJIS)).toBe(true);
    expect(POPULAR_EMOJIS.length).toBeGreaterThan(40);
  });

  it("POPULAR_EMOJIS.length is <= POPULAR_EMOJI_SHORTCODES.length (no extras, some may be missing from dataset)", () => {
    expect(POPULAR_EMOJIS.length).toBeLessThanOrEqual(POPULAR_EMOJI_SHORTCODES.length);
  });

  it("every item in POPULAR_EMOJIS is a non-null object with a name field", () => {
    for (const emoji of POPULAR_EMOJIS) {
      expect(emoji).not.toBeNull();
      expect(typeof (emoji as { name?: string }).name).toBe("string");
    }
  });

  it("POPULAR_EMOJIS contains grinning (first curated entry)", () => {
    const names = POPULAR_EMOJIS.map((e) => (e as { name: string }).name);
    expect(names).toContain("grinning");
  });

  it("POPULAR_EMOJIS preserves curated ordering (grinning before heart)", () => {
    const names = POPULAR_EMOJIS.map((e) => (e as { name: string }).name);
    const grinningIdx = names.indexOf("grinning");
    const heartIdx = names.indexOf("heart");
    expect(grinningIdx).toBeGreaterThanOrEqual(0);
    expect(heartIdx).toBeGreaterThanOrEqual(0);
    expect(grinningIdx).toBeLessThan(heartIdx);
  });

  it("POPULAR_EMOJIS does not contain duplicates", () => {
    const names = POPULAR_EMOJIS.map((e) => (e as { name: string }).name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// =============================================================================
// MATERIAL_ICONS — emoji entry
// =============================================================================

describe("MATERIAL_ICONS", () => {
  it("includes emoji entry with value 'emoji_emotions'", () => {
    expect(MATERIAL_ICONS["emoji"]).toBe("emoji_emotions");
  });
});

// =============================================================================
// TOOLBAR_ITEM_CONFIG — emoji entry
// =============================================================================

describe("TOOLBAR_ITEM_CONFIG.emoji", () => {
  it("exists on TOOLBAR_ITEM_CONFIG", () => {
    expect(TOOLBAR_ITEM_CONFIG["emoji" as keyof typeof TOOLBAR_ITEM_CONFIG]).toBeDefined();
  });

  it("has icon 'emoji_emotions'", () => {
    const item = TOOLBAR_ITEM_CONFIG["emoji" as keyof typeof TOOLBAR_ITEM_CONFIG];
    expect(item.icon).toBe("emoji_emotions");
  });

  it("has a non-empty label", () => {
    const item = TOOLBAR_ITEM_CONFIG["emoji" as keyof typeof TOOLBAR_ITEM_CONFIG];
    expect(typeof item.label).toBe("string");
    expect(item.label.length).toBeGreaterThan(0);
  });

  it("has a command function (not null)", () => {
    const item = TOOLBAR_ITEM_CONFIG["emoji" as keyof typeof TOOLBAR_ITEM_CONFIG];
    expect(typeof item.command).toBe("function");
  });

  it("command reads editor.storage.scrybEmojiStore and calls openPopup when present", () => {
    let openPopupCalled = false;
    const fakeEditor = {
      storage: {
        scrybEmojiStore: {
          callbacks: {
            openPopup: () => { openPopupCalled = true; },
          },
        },
      },
    } as unknown as import("@tiptap/core").Editor;

    const item = TOOLBAR_ITEM_CONFIG["emoji" as keyof typeof TOOLBAR_ITEM_CONFIG];
    item.command?.(fakeEditor);
    expect(openPopupCalled).toBe(true);
  });

  it("command is a safe no-op when scrybEmojiStore is absent", () => {
    const fakeEditor = {
      storage: {},
    } as unknown as import("@tiptap/core").Editor;

    const item = TOOLBAR_ITEM_CONFIG["emoji" as keyof typeof TOOLBAR_ITEM_CONFIG];
    expect(() => item.command?.(fakeEditor)).not.toThrow();
  });
});

// =============================================================================
// BUBBLE_MENU_ITEM_CONFIG — emoji entry
// =============================================================================

describe("BUBBLE_MENU_ITEM_CONFIG.emoji", () => {
  it("exists on BUBBLE_MENU_ITEM_CONFIG", () => {
    expect(BUBBLE_MENU_ITEM_CONFIG["emoji" as keyof typeof BUBBLE_MENU_ITEM_CONFIG]).toBeDefined();
  });

  it("has icon 'emoji_emotions'", () => {
    const item = BUBBLE_MENU_ITEM_CONFIG["emoji" as keyof typeof BUBBLE_MENU_ITEM_CONFIG];
    expect(item.icon).toBe("emoji_emotions");
  });

  it("command is a safe no-op when scrybEmojiStore is absent", () => {
    const fakeEditor = {
      storage: {},
    } as unknown as import("@tiptap/core").Editor;

    const item = BUBBLE_MENU_ITEM_CONFIG["emoji" as keyof typeof BUBBLE_MENU_ITEM_CONFIG];
    expect(() => item.command?.(fakeEditor)).not.toThrow();
  });
});

// =============================================================================
// scrybEmojiStore — storage namespace gating
// =============================================================================

describe("buildExtensions — scrybEmojiStore gating", () => {
  it("registers scrybEmojiStore extension when config.emoji.enabled === true", () => {
    const callbacks = createEmojiCallbackStore();
    const extensions = buildExtensions({ emoji: { enabled: true, callbacks } });
    const names = extensions.map((ext) => ext.name);
    expect(names).toContain("scrybEmojiStore");
  });

  it("does NOT register scrybEmojiStore when config.emoji is omitted (CK-XCUT-04)", () => {
    const extensions = buildExtensions({});
    const names = extensions.map((ext) => ext.name);
    expect(names).not.toContain("scrybEmojiStore");
  });

  it("does NOT register scrybEmojiStore when config.emoji.enabled === false", () => {
    const extensions = buildExtensions({ emoji: { enabled: false } });
    const names = extensions.map((ext) => ext.name);
    expect(names).not.toContain("scrybEmojiStore");
  });
});

// =============================================================================
// items() empty-query returns POPULAR_EMOJIS
// =============================================================================

describe("buildExtensions — emoji items() empty-query returns POPULAR_EMOJIS", () => {
  it("items({ query: '' }) returns POPULAR_EMOJIS (popular-first picker)", () => {
    const callbacks = createEmojiCallbackStore();
    const extensions = buildExtensions({ emoji: { enabled: true, callbacks } });
    const emojiExt = extensions.find((ext) => ext.name === "emoji");
    expect(emojiExt).toBeDefined();

    const opts = (emojiExt as {
      options?: {
        suggestion?: {
          items?: (opts: { query: string }) => unknown[];
        };
      };
    }).options;

    const items = opts?.suggestion?.items?.({ query: "" });
    expect(Array.isArray(items)).toBe(true);
    // Should return POPULAR_EMOJIS on empty query
    expect(items!.length).toBeGreaterThan(10);
    // First item should be 'grinning'
    expect((items![0] as { name?: string }).name).toBe("grinning");
  });

  it("items({ query: 'smile' }) returns filtered results (not POPULAR_EMOJIS)", () => {
    const callbacks = createEmojiCallbackStore();
    const extensions = buildExtensions({ emoji: { enabled: true, callbacks } });
    const emojiExt = extensions.find((ext) => ext.name === "emoji");

    const opts = (emojiExt as {
      options?: {
        suggestion?: {
          items?: (opts: { query: string }) => unknown[];
        };
      };
    }).options;

    const items = opts?.suggestion?.items?.({ query: "smile" });
    expect(Array.isArray(items)).toBe(true);
    expect(items!.length).toBeGreaterThan(0);
    // Should NOT start with grinning (would be filtered by 'smile' substring)
    // All returned items should have shortcodes/tags matching 'smile'
    for (const item of items!) {
      const e = item as { name: string; shortcodes?: string[]; tags?: string[] };
      const matchesName = e.name.toLowerCase().includes("smile");
      const matchesShortcode = e.shortcodes?.some((sc) => sc.toLowerCase().includes("smile")) ?? false;
      const matchesTag = e.tags?.some((t) => t.toLowerCase().includes("smile")) ?? false;
      expect(matchesName || matchesShortcode || matchesTag).toBe(true);
    }
  });

  it("items({ query: '   ' }) returns POPULAR_EMOJIS for whitespace-only query", () => {
    const callbacks = createEmojiCallbackStore();
    const extensions = buildExtensions({ emoji: { enabled: true, callbacks } });
    const emojiExt = extensions.find((ext) => ext.name === "emoji");

    const opts = (emojiExt as {
      options?: {
        suggestion?: {
          items?: (opts: { query: string }) => unknown[];
        };
      };
    }).options;

    const items = opts?.suggestion?.items?.({ query: "   " });
    expect(Array.isArray(items)).toBe(true);
    expect(items!.length).toBeGreaterThan(10);
    expect((items![0] as { name?: string }).name).toBe("grinning");
  });
});
