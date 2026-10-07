import { describe, it, expect, vi } from "vitest";
import { resolveItemPressed, TOOLBAR_ITEM_CONFIG } from "../toolbar/item-config";
import { DEFAULT_TOOLBAR_ORDER } from "../toolbar/config";
import type { ToolbarItemKey } from "../toolbar/config";
import type { Editor } from "@tiptap/core";

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

describe("TOOLBAR_ITEM_CONFIG", () => {
  it("has an entry for every key in DEFAULT_TOOLBAR_ORDER", () => {
    const uniqueKeys = [...new Set(DEFAULT_TOOLBAR_ORDER)] as ToolbarItemKey[];
    for (const key of uniqueKeys) {
      expect(TOOLBAR_ITEM_CONFIG[key], `Missing entry for key: ${key}`).toBeDefined();
    }
  });

  it("has 33 entries (one per ToolbarItemKey)", () => {
    expect(Object.keys(TOOLBAR_ITEM_CONFIG).length).toBe(33);
  });

  it("accessibilityChecker is withheld from the default order but still usable", () => {
    // The feature waits for polish, so it ships unadvertised rather than
    // half-designed. Deleting the key would make it a rewrite to bring back;
    // withholding it makes it a one-line change.
    expect(DEFAULT_TOOLBAR_ORDER).not.toContain("accessibilityChecker");
    expect(TOOLBAR_ITEM_CONFIG["accessibilityChecker"]).toBeDefined();
  });

  it("simple button items have non-null command and an active-state check", () => {
    // activeName (string) is preferred for plain `editor.isActive(name)` lookups;
    // items with more complex state (heading levels, storage reads) keep a custom
    // isActive function. Every simple button item must expose one of the two.
    const simpleButtonKeys: ToolbarItemKey[] = [
      "bold",
      "italic",
      "underline",
      "strike",
      "code",
      "superscript",
      "subscript",
      "heading1",
      "heading2",
      "heading3",
      "bulletList",
      "orderedList",
      "blockquote",
    ];

    for (const key of simpleButtonKeys) {
      const config = TOOLBAR_ITEM_CONFIG[key] as {
        command?: unknown;
        activeName?: string;
        isActive?: unknown;
      };
      expect(config.command, `${key}.command should not be null`).not.toBeNull();
      expect(typeof config.command, `${key}.command should be a function`).toBe("function");
      const hasActiveCheck =
        typeof config.activeName === "string" || typeof config.isActive === "function";
      expect(hasActiveCheck, `${key} must expose activeName or isActive`).toBe(true);
    }
  });

  it("dropdown/panel items have null command", () => {
    const dropdownKeys: ToolbarItemKey[] = [
      "textColor",
      "fontFamily",
      "fontSize",
      "textAlign",
      "lineHeight",
      "letterSpacing",
      "link",
      "image",
      "accessibilityChecker",
    ];

    for (const key of dropdownKeys) {
      const config = TOOLBAR_ITEM_CONFIG[key];
      expect(config.command, `${key}.command should be null`).toBeNull();
    }
  });

  it("separator has empty icon and label", () => {
    const separator = TOOLBAR_ITEM_CONFIG["separator"] as {
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

  it("bold.command executes without error on a mock editor", () => {
    const mockEditor = createMockEditor();
    expect(() => {
      TOOLBAR_ITEM_CONFIG["bold"].command!(mockEditor);
    }).not.toThrow();
  });

  it("all items have string icon and string label", () => {
    for (const [key, config] of Object.entries(TOOLBAR_ITEM_CONFIG)) {
      expect(typeof config.icon, `${key}.icon should be a string`).toBe("string");
      expect(typeof config.label, `${key}.label should be a string`).toBe("string");
    }
  });
});

describe("resolveItemPressed", () => {
  const editor = { isActive: (name: string) => name === "bold" } as unknown as Editor;
  it("is undefined for items with no active concept", () => {
    expect(resolveItemPressed(editor, {})).toBeUndefined();
  });
  it("reads activeName, then isActive", () => {
    expect(resolveItemPressed(editor, { activeName: "bold" })).toBe(true);
    expect(resolveItemPressed(editor, { isActive: () => false })).toBe(false);
  });
});
