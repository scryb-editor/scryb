import { describe, it, expect, vi, beforeEach } from "vitest";
import { BubbleMenuCoordinator } from "../bubble-menu/coordinator";
import type { BubbleMenuConfig, BubbleMenuType } from "../bubble-menu/types";

// =============================================================================
// Test helpers
// =============================================================================

function createMenuConfig(
  type: BubbleMenuType,
  priority: number,
  shouldShow: boolean | ((state: { editor: unknown; from: number; to: number }) => boolean) = true
): BubbleMenuConfig {
  return {
    type,
    priority,
    shouldShow: typeof shouldShow === "function" ? shouldShow : () => shouldShow,
  };
}

describe("BubbleMenuCoordinator", () => {
  let coordinator: BubbleMenuCoordinator;

  beforeEach(() => {
    coordinator = new BubbleMenuCoordinator();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // registerMenu / unregisterMenu
  // ═══════════════════════════════════════════════════════════════════════════

  describe("registerMenu", () => {
    it("adds a menu to the coordinator", () => {
      coordinator.registerMenu(createMenuConfig("text", 10));
      // After registering, updating active should be able to find it
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });
      expect(coordinator.activeMenu).toBe("text");
    });

    it("replaces an existing menu with the same type", () => {
      coordinator.registerMenu(createMenuConfig("text", 10, true));
      coordinator.registerMenu(createMenuConfig("text", 20, false));
      // The second registration (shouldShow = false) replaces the first
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });
      expect(coordinator.activeMenu).toBeNull();
    });
  });

  describe("unregisterMenu", () => {
    it("removes a menu from the coordinator", () => {
      coordinator.registerMenu(createMenuConfig("text", 10));
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });
      expect(coordinator.activeMenu).toBe("text");

      coordinator.unregisterMenu("text");
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });
      expect(coordinator.activeMenu).toBeNull();
    });

    it("clears active menu if the unregistered menu was active", () => {
      coordinator.registerMenu(createMenuConfig("text", 10));
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });
      expect(coordinator.activeMenu).toBe("text");

      coordinator.unregisterMenu("text");
      expect(coordinator.activeMenu).toBeNull();
    });

    it("does not affect active menu when unregistering a non-active menu", () => {
      coordinator.registerMenu(createMenuConfig("text", 10));
      coordinator.registerMenu(createMenuConfig("image", 20));
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });
      // "image" has higher priority and both shouldShow = true
      expect(coordinator.activeMenu).toBe("image");

      coordinator.unregisterMenu("text");
      expect(coordinator.activeMenu).toBe("image");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateActiveMenu (priority-based resolution)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("updateActiveMenu", () => {
    it("selects the menu with the highest priority when multiple should show", () => {
      coordinator.registerMenu(createMenuConfig("text", 10));
      coordinator.registerMenu(createMenuConfig("image", 20));
      coordinator.registerMenu(createMenuConfig("table", 5));

      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 10 });
      expect(coordinator.activeMenu).toBe("image");
    });

    it("selects a lower-priority menu if a higher-priority one has shouldShow = false", () => {
      coordinator.registerMenu(createMenuConfig("text", 10, true));
      coordinator.registerMenu(createMenuConfig("image", 20, false));

      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 10 });
      expect(coordinator.activeMenu).toBe("text");
    });

    it("sets active menu to null when no menus should show", () => {
      coordinator.registerMenu(createMenuConfig("text", 10, false));
      coordinator.registerMenu(createMenuConfig("image", 20, false));

      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 10 });
      expect(coordinator.activeMenu).toBeNull();
    });

    it("sets active menu to null when no menus are registered", () => {
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 10 });
      expect(coordinator.activeMenu).toBeNull();
    });

    it("calls shouldShow with the state argument", () => {
      const shouldShow = vi.fn().mockReturnValue(true);
      coordinator.registerMenu({
        type: "text",
        priority: 10,
        shouldShow,
      });

      const state = { editor: {}, from: 5, to: 15 };
      coordinator.updateActiveMenu(state);
      expect(shouldShow).toHaveBeenCalledWith(state);
    });

    it("evaluates shouldShow dynamically each time", () => {
      let showText = true;
      coordinator.registerMenu(createMenuConfig("text", 10, () => showText));
      coordinator.registerMenu(createMenuConfig("image", 20, false));

      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 10 });
      expect(coordinator.activeMenu).toBe("text");

      showText = false;
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 10 });
      expect(coordinator.activeMenu).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // activeMenu getter
  // ═══════════════════════════════════════════════════════════════════════════

  describe("activeMenu", () => {
    it("returns null initially", () => {
      expect(coordinator.activeMenu).toBeNull();
    });

    it("returns the currently active menu type after update", () => {
      coordinator.registerMenu(createMenuConfig("text", 10));
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });
      expect(coordinator.activeMenu).toBe("text");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // onActiveMenuChange (listener)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("onActiveMenuChange", () => {
    it("fires callback when active menu changes", () => {
      const callback = vi.fn();
      coordinator.onActiveMenuChange(callback);
      coordinator.registerMenu(createMenuConfig("text", 10));
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });

      expect(callback).toHaveBeenCalledWith("text");
    });

    it("fires callback with null when active menu is cleared", () => {
      const callback = vi.fn();
      coordinator.registerMenu(createMenuConfig("text", 10));
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });

      coordinator.onActiveMenuChange(callback);
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 0 });
      // text menu still shouldShow = true, so won't be null.
      // Let's force unregister
      coordinator.unregisterMenu("text");
      expect(callback).toHaveBeenCalledWith(null);
    });

    it("does not fire callback when active menu does not change", () => {
      const callback = vi.fn();
      coordinator.registerMenu(createMenuConfig("text", 10));
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });
      // Now subscribe
      coordinator.onActiveMenuChange(callback);
      // Update again, same result
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });
      // Should NOT have been called because active menu is still "text"
      expect(callback).not.toHaveBeenCalled();
    });

    it("returns an unsubscribe function", () => {
      const callback = vi.fn();
      const unsubscribe = coordinator.onActiveMenuChange(callback);
      coordinator.registerMenu(createMenuConfig("text", 10));
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      coordinator.unregisterMenu("text");
      // Should not have been called again
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("supports multiple listeners", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      coordinator.onActiveMenuChange(cb1);
      coordinator.onActiveMenuChange(cb2);

      coordinator.registerMenu(createMenuConfig("text", 10));
      coordinator.updateActiveMenu({ editor: {}, from: 0, to: 5 });

      expect(cb1).toHaveBeenCalledWith("text");
      expect(cb2).toHaveBeenCalledWith("text");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // willShow / didHide / isActive
  // ═══════════════════════════════════════════════════════════════════════════

  describe("willShow", () => {
    it("sets the active menu to the given id", () => {
      coordinator.willShow("text");
      expect(coordinator.activeMenu).toBe("text");
    });

    it("replaces the current active menu", () => {
      coordinator.willShow("text");
      coordinator.willShow("image");
      expect(coordinator.activeMenu).toBe("image");
    });

    it("does not fire listener if already active", () => {
      coordinator.willShow("text");
      const callback = vi.fn();
      coordinator.onActiveMenuChange(callback);
      coordinator.willShow("text");
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("didHide", () => {
    it("clears the active menu if it matches", () => {
      coordinator.willShow("text");
      coordinator.didHide("text");
      expect(coordinator.activeMenu).toBeNull();
    });

    it("does not clear if the id does not match", () => {
      coordinator.willShow("text");
      coordinator.didHide("image");
      expect(coordinator.activeMenu).toBe("text");
    });
  });

  describe("isActive", () => {
    it("returns true for the currently active menu", () => {
      coordinator.willShow("text");
      expect(coordinator.isActive("text")).toBe(true);
    });

    it("returns false for a non-active menu", () => {
      coordinator.willShow("text");
      expect(coordinator.isActive("image")).toBe(false);
    });

    it("returns false when no menu is active", () => {
      expect(coordinator.isActive("text")).toBe(false);
    });
  });
});
