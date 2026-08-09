import { describe, it, expect, vi } from "vitest";
import { BUBBLE_MENU_ITEM_CONFIG } from "../bubble-menu/item-config";
import { DEFAULT_BUBBLE_MENU_ITEMS } from "../bubble-menu/config";
import type { BubbleMenuItemKey } from "../bubble-menu/config";

// =============================================================================
// Mock helpers
// =============================================================================

/**
 * Creates a mock editor with a chain builder pattern.
 * Every method on the chain returns the chain itself (fluent API),
 * except `.run()` which is a terminal that returns void.
 */
function createMockEditor(overrides: Record<string, unknown> = {}) {
  const runFn = vi.fn();

  const chain: Record<string, unknown> = {};
  const chainProxy = new Proxy(chain, {
    get(_target, prop) {
      if (prop === "run") return runFn;
      return vi.fn().mockReturnValue(chainProxy);
    },
  });

  const isActiveFn = vi.fn().mockReturnValue(false);

  return {
    chain: vi.fn().mockReturnValue(chainProxy),
    isActive: isActiveFn,
    ...overrides,
  } as unknown as import("@tiptap/core").Editor;
}

// =============================================================================
// Tests
// =============================================================================

describe("BUBBLE_MENU_ITEM_CONFIG", () => {
  it("has an entry for every key in DEFAULT_BUBBLE_MENU_ITEMS", () => {
    const uniqueKeys = [...new Set(DEFAULT_BUBBLE_MENU_ITEMS)] as BubbleMenuItemKey[];
    for (const key of uniqueKeys) {
      expect(BUBBLE_MENU_ITEM_CONFIG[key], `Missing entry for key: ${key}`).toBeDefined();
    }
  });

  it("has 31 entries (one per BubbleMenuItemKey)", () => {
    expect(Object.keys(BUBBLE_MENU_ITEM_CONFIG).length).toBe(31);
  });

  it("default items act on the selection — no document- or cursor-scoped entries", () => {
    // The bubble menu is anchored to selected text, so an item that ignores the
    // selection has no business there. Each of these stays a valid key for
    // consumers who opt in; it is only excluded from the default list.
    const outOfScope: BubbleMenuItemKey[] = [
      "undo", // document history — Mod-Z reaches it from anywhere
      "redo",
      "clear", // wipes the document
      "image", // inserts at the cursor; the slash menu carries all three
      "table",
      "horizontalRule",
    ];

    for (const key of outOfScope) {
      expect(DEFAULT_BUBBLE_MENU_ITEMS, `${key} is document-scoped`).not.toContain(key);
      expect(BUBBLE_MENU_ITEM_CONFIG[key], `${key} must stay a valid key`).toBeDefined();
    }
  });

  it("accessibilityChecker is withheld from the default list but still usable", () => {
    // Off every default surface while the feature waits for polish. The key,
    // the panel components and `checkAccessibility()` stay, so re-listing it in
    // `config.bubbleMenu.items` restores the whole feature — that is the point
    // of withholding it rather than deleting it.
    expect(DEFAULT_BUBBLE_MENU_ITEMS).not.toContain("accessibilityChecker");
    expect(BUBBLE_MENU_ITEM_CONFIG["accessibilityChecker"]).toBeDefined();
  });

  it("simple button items have non-null command", () => {
    const simpleButtonKeys: BubbleMenuItemKey[] = [
      "bold",
      "italic",
      "underline",
      "strike",
      "code",
      "superscript",
      "subscript",
      "bulletList",
      "orderedList",
      "blockquote",
      "indent",
      "outdent",
      "horizontalRule",
      "table",
      "undo",
      "redo",
      "clear",
      "clearFormatting",
    ];

    for (const key of simpleButtonKeys) {
      const config = BUBBLE_MENU_ITEM_CONFIG[key];
      expect(config.command, `${key}.command should not be null`).not.toBeNull();
      expect(typeof config.command, `${key}.command should be a function`).toBe("function");
    }
  });

  it("dropdown/panel items have null command", () => {
    const dropdownKeys: BubbleMenuItemKey[] = [
      "blockType",
      "fontSize",
      "fontFamily",
      "lineHeight",
      "letterSpacing",
      "textColor",
      "textAlign",
      "link",
      "image",
      "accessibilityChecker",
      "math",
    ];

    for (const key of dropdownKeys) {
      const config = BUBBLE_MENU_ITEM_CONFIG[key];
      expect(config.command, `${key}.command should be null`).toBeNull();
    }
  });

  it("clearFormatting uses format_clear icon", () => {
    expect(BUBBLE_MENU_ITEM_CONFIG["clearFormatting"].icon).toBe("format_clear");
  });

  // The label resolves through `toolbar.clear` ("Clear formatting") and the icon
  // is `format_clear`, so a `clear` wired to clearContent read "Clear
  // formatting" and wiped the whole document from a selection popover.
  it("clear removes formatting, never the document", () => {
    const editor = createMockEditor();
    const chainSpy = vi.fn();
    const chain: Record<string, unknown> = {};
    const chainProxy = new Proxy(chain, {
      get(_target, prop) {
        if (prop === "run") return vi.fn();
        chainSpy(prop);
        return vi.fn().mockReturnValue(chainProxy);
      },
    });
    (editor as unknown as { chain: () => unknown }).chain = () => chainProxy;

    BUBBLE_MENU_ITEM_CONFIG["clear"].command?.(editor);

    const called = chainSpy.mock.calls.map(([name]) => name);
    expect(called).not.toContain("clearContent");
    expect(called).not.toContain("setContent");
    expect(called).toContain("unsetAllMarks");
  });

  it("clear and clearFormatting are synonyms", () => {
    expect(BUBBLE_MENU_ITEM_CONFIG["clear"].command).toBe(
      BUBBLE_MENU_ITEM_CONFIG["clearFormatting"].command,
    );
  });

  it("math item has null command (not yet implemented)", () => {
    expect(BUBBLE_MENU_ITEM_CONFIG["math"].command).toBeNull();
  });

  it("separator has empty icon and label", () => {
    const separator = BUBBLE_MENU_ITEM_CONFIG["separator"] as {
      icon: string;
      label: string;
      command: unknown;
      activeName?: string;
      isActive?: unknown;
    };
    expect(separator.icon).toBe("");
    expect(separator.label).toBe("");
    expect(separator.command).toBeNull();
    // Separator has no active state — neither activeName nor isActive.
    expect(separator.activeName).toBeUndefined();
    expect(separator.isActive).toBeUndefined();
  });
});
