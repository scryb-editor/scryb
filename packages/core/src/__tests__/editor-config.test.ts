import { describe, it, expect } from "vitest";
import type { ScrybEditorConfig } from "../config/editor-config";
import { DEFAULT_EDITOR_CONFIG } from "../config/editor-config";
import { DEFAULT_TOOLBAR_ORDER, DEFAULT_TOOLBAR_MAX_VISIBLE_ITEMS } from "../toolbar/config";
import { DEFAULT_BUBBLE_MENU_ITEMS, DEFAULT_MAX_VISIBLE_ITEMS } from "../bubble-menu/config";
import { DEFAULT_IMAGE_UPLOAD_CONFIG } from "../image/types";

// =============================================================================
// Tests
// =============================================================================

describe("ScrybEditorConfig", () => {
  it("DEFAULT_EDITOR_CONFIG is defined and satisfies ScrybEditorConfig (type assignability)", () => {
    // Type-level check via assignment — if this compiles the satisfies constraint holds
    const _check: ScrybEditorConfig = DEFAULT_EDITOR_CONFIG;
    expect(_check).toBeDefined();
    expect(DEFAULT_EDITOR_CONFIG).toBeDefined();
  });

  it("has all documented fields", () => {
    const expectedKeys = [
      "bubbleMenu",
      "characterCount",
      "editable",
      "height",
      "hideWhenInactive",
      "image",
      "imageBubbleMenu",
      "locale",
      "maxCharacters",
      "officePaste",
      "placeholder",
      "sideMenu",
      "slashCommands",
      "theme",
      "toolbar",
      "typography",
    ];
    expect(Object.keys(DEFAULT_EDITOR_CONFIG).sort()).toEqual(expectedKeys);
  });
});

describe("DEFAULT_EDITOR_CONFIG", () => {
  it("theme equals 'light'", () => {
    expect(DEFAULT_EDITOR_CONFIG.theme).toBe("light");
  });

  it("locale equals 'en'", () => {
    expect(DEFAULT_EDITOR_CONFIG.locale).toBe("en");
  });

  it("editable equals true", () => {
    expect(DEFAULT_EDITOR_CONFIG.editable).toBe(true);
  });

  it("maxCharacters equals null", () => {
    expect(DEFAULT_EDITOR_CONFIG.maxCharacters).toBeNull();
  });

  it("placeholder equals empty string", () => {
    expect(DEFAULT_EDITOR_CONFIG.placeholder).toBe("");
  });

  it("toolbar.items is a non-empty array (spread from DEFAULT_TOOLBAR_ORDER)", () => {
    expect(Array.isArray(DEFAULT_EDITOR_CONFIG.toolbar.items)).toBe(true);
    expect(DEFAULT_EDITOR_CONFIG.toolbar.items.length).toBeGreaterThan(0);
    expect(DEFAULT_EDITOR_CONFIG.toolbar.items).toEqual([...DEFAULT_TOOLBAR_ORDER]);
  });

  it("bubbleMenu.items is a non-empty array (spread from DEFAULT_BUBBLE_MENU_ITEMS)", () => {
    expect(Array.isArray(DEFAULT_EDITOR_CONFIG.bubbleMenu.items)).toBe(true);
    expect(DEFAULT_EDITOR_CONFIG.bubbleMenu.items!.length).toBeGreaterThan(0);
    expect(DEFAULT_EDITOR_CONFIG.bubbleMenu.items).toEqual([...DEFAULT_BUBBLE_MENU_ITEMS]);
  });

  it("bubbleMenu.maxVisibleItems equals DEFAULT_MAX_VISIBLE_ITEMS (7)", () => {
    expect(DEFAULT_EDITOR_CONFIG.bubbleMenu.maxVisibleItems).toBe(DEFAULT_MAX_VISIBLE_ITEMS);
    expect(DEFAULT_EDITOR_CONFIG.bubbleMenu.maxVisibleItems).toBe(7);
  });

  it("toolbar.maxVisibleItems equals DEFAULT_TOOLBAR_MAX_VISIBLE_ITEMS (14)", () => {
    expect(DEFAULT_EDITOR_CONFIG.toolbar.maxVisibleItems).toBe(DEFAULT_TOOLBAR_MAX_VISIBLE_ITEMS);
    expect(DEFAULT_EDITOR_CONFIG.toolbar.maxVisibleItems).toBe(14);
  });

  it("sideMenu.enabled equals true and sideMenu.buttons equals true", () => {
    expect(DEFAULT_EDITOR_CONFIG.sideMenu.enabled).toBe(true);
    expect(DEFAULT_EDITOR_CONFIG.sideMenu.buttons).toBe(true);
  });

  it("characterCount.show equals true", () => {
    expect(DEFAULT_EDITOR_CONFIG.characterCount.show).toBe(true);
  });

  it("image matches DEFAULT_IMAGE_UPLOAD_CONFIG (spread)", () => {
    expect(DEFAULT_EDITOR_CONFIG.image).toEqual({ ...DEFAULT_IMAGE_UPLOAD_CONFIG });
  });

  it("height.minHeight equals 200", () => {
    expect(DEFAULT_EDITOR_CONFIG.height.minHeight).toBe(200);
  });

  it("slashCommands.enabled equals true", () => {
    expect(DEFAULT_EDITOR_CONFIG.slashCommands.enabled).toBe(true);
  });

  it("toolbar.items is NOT the same reference as DEFAULT_TOOLBAR_ORDER (spread check)", () => {
    expect(DEFAULT_EDITOR_CONFIG.toolbar.items).not.toBe(DEFAULT_TOOLBAR_ORDER);
  });

  it("bubbleMenu.items is NOT the same reference as DEFAULT_BUBBLE_MENU_ITEMS (spread check)", () => {
    expect(DEFAULT_EDITOR_CONFIG.bubbleMenu.items).not.toBe(DEFAULT_BUBBLE_MENU_ITEMS);
  });
});
