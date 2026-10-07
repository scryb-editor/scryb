import { describe, it, expect } from "vitest";
import {
  DEFAULT_IMAGE_BUBBLE_MENU_ORDER,
  IMAGE_BUBBLE_MENU_ITEM_CONFIG,
  visibleImageBubbleMenuItems,
} from "../bubble-menu/image-item-config";
import type { ImageBubbleMenuItemKey } from "../bubble-menu/image-item-config";

describe("IMAGE_BUBBLE_MENU_ITEM_CONFIG", () => {
  it("has an entry for every key in the default order", () => {
    for (const key of new Set(DEFAULT_IMAGE_BUBBLE_MENU_ORDER)) {
      expect(IMAGE_BUBBLE_MENU_ITEM_CONFIG[key], `Missing entry for ${key}`).toBeDefined();
    }
  });

  it("gives every control exactly one visual representation", () => {
    // This map is the whole point of the file: the two adapters used to
    // hand-write their own menus and drifted into showing different controls.
    // A control with both an icon and text, or neither, would let them drift
    // again by making the choice at the render site.
    for (const [key, config] of Object.entries(IMAGE_BUBBLE_MENU_ITEM_CONFIG)) {
      if (key === "separator") continue;
      const hasIcon = typeof config.icon === "string" && config.icon.length > 0;
      const hasText = typeof config.text === "string" && config.text.length > 0;
      expect(hasIcon !== hasText, `${key} must have an icon or text, not both`).toBe(true);
    }
  });

  it("marks the sizes with text and the actions with icons", () => {
    // Three copies of the same square icon at three icon sizes is what Angular
    // showed before, and nothing about it said which one was 50%.
    for (const key of ["resizeSmall", "resizeMedium", "resizeLarge", "resizeOriginal"] as const) {
      expect(IMAGE_BUBBLE_MENU_ITEM_CONFIG[key].text).toBeTruthy();
    }
    for (const key of ["changeImage", "deleteImage"] as const) {
      expect(IMAGE_BUBBLE_MENU_ITEM_CONFIG[key].icon).toBeTruthy();
    }
  });

  it("leaves changeImage without a command — it needs config the map cannot see", () => {
    expect(IMAGE_BUBBLE_MENU_ITEM_CONFIG["changeImage"].command).toBeNull();
    expect(IMAGE_BUBBLE_MENU_ITEM_CONFIG["deleteImage"].command).toBeTypeOf("function");
  });

  it("marks only the destructive control as danger", () => {
    const danger = Object.entries(IMAGE_BUBBLE_MENU_ITEM_CONFIG)
      .filter(([, config]) => config.danger)
      .map(([key]) => key);
    expect(danger).toEqual(["deleteImage"]);
  });
});

describe("visibleImageBubbleMenuItems()", () => {
  it("returns the full order when nothing is disabled", () => {
    expect(visibleImageBubbleMenuItems()).toEqual([...DEFAULT_IMAGE_BUBBLE_MENU_ORDER]);
  });

  it("drops a separator left leading by a hidden first control", () => {
    const items = visibleImageBubbleMenuItems({ changeImage: false });
    expect(items[0]).not.toBe("separator");
    expect(items).not.toContain("changeImage");
  });

  it("collapses separators around a hidden group rather than doubling them", () => {
    const items = visibleImageBubbleMenuItems({
      resizeSmall: false,
      resizeMedium: false,
      resizeLarge: false,
      resizeOriginal: false,
    });

    const doubled = items.some(
      (key, index) => key === "separator" && items[index + 1] === "separator",
    );
    expect(doubled).toBe(false);
  });

  it("never ends on a separator", () => {
    const items = visibleImageBubbleMenuItems({ deleteImage: false });
    expect(items[items.length - 1]).not.toBe("separator");
  });

  it("drops every separator when they are turned off", () => {
    const items: ImageBubbleMenuItemKey[] = visibleImageBubbleMenuItems({ separator: false });
    expect(items).not.toContain("separator");
  });

  it("offers Edit alt text right after Change image", () => {
    expect(visibleImageBubbleMenuItems().slice(0, 2)).toEqual(["changeImage", "editAltText"]);
    expect(IMAGE_BUBBLE_MENU_ITEM_CONFIG.editAltText.command).toBeNull();
  });
});
