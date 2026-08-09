import type { BubbleMenuConfig, BubbleMenuType } from "./types";

// =============================================================================
// BUBBLE MENU COORDINATOR
// =============================================================================

/**
 * Manages bubble menu visibility and priority across multiple menus.
 *
 * Framework-agnostic plain class — no Angular DI, no Tippy.js references.
 * Positioning is handled by the framework adapter (e.g., Floating UI in React/Angular).
 *
 * Usage:
 * 1. Register menus with `registerMenu()`.
 * 2. Call `updateActiveMenu()` on editor selection changes.
 * 3. Subscribe to changes with `onActiveMenuChange()`.
 *
 * @example
 * ```typescript
 * const coordinator = new BubbleMenuCoordinator();
 *
 * coordinator.registerMenu({
 *   type: "text",
 *   priority: 10,
 *   shouldShow: ({ from, to }) => from !== to,
 * });
 *
 * const unsubscribe = coordinator.onActiveMenuChange((activeMenu) => {
 *   console.log("Active menu:", activeMenu);
 * });
 * ```
 */
export class BubbleMenuCoordinator {
  private _menus: Map<BubbleMenuType, BubbleMenuConfig> = new Map();
  private _activeMenu: BubbleMenuType | null = null;
  private _listeners: Array<(activeMenu: BubbleMenuType | null) => void> = [];

  /**
   * Register a bubble menu with the coordinator.
   * If a menu with the same type already exists, it is replaced.
   *
   * @param config Configuration for the bubble menu.
   */
  registerMenu(config: BubbleMenuConfig): void {
    this._menus.set(config.type, config);
  }

  /**
   * Unregister a bubble menu.
   * If the menu was active, the active menu is cleared.
   *
   * @param type The type of the menu to unregister.
   */
  unregisterMenu(type: BubbleMenuType): void {
    this._menus.delete(type);
    if (this._activeMenu === type) {
      this._setActiveMenu(null);
    }
  }

  /**
   * Evaluate all registered menus and update the active menu.
   * Call this on editor `selectionUpdate` and `transaction` events.
   *
   * The menu with the highest `priority` whose `shouldShow` returns true wins.
   *
   * @param state Current editor selection state.
   */
  updateActiveMenu(state: { editor: unknown; from: number; to: number }): void {
    let best: BubbleMenuConfig | null = null;

    for (const config of this._menus.values()) {
      if (config.shouldShow(state)) {
        if (best === null || config.priority > best.priority) {
          best = config;
        }
      }
    }

    this._setActiveMenu(best?.type ?? null);
  }

  /**
   * The currently active bubble menu type, or null if none is active.
   */
  get activeMenu(): BubbleMenuType | null {
    return this._activeMenu;
  }

  /**
   * Subscribe to active menu changes.
   * Returns an unsubscribe function — call it to remove the listener.
   *
   * @param fn Callback invoked whenever the active menu changes.
   * @returns Cleanup function.
   */
  onActiveMenuChange(fn: (menu: BubbleMenuType | null) => void): () => void {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  }

  /**
   * Called when a specific menu wants to show itself.
   * Hides any currently active menu if it differs.
   * Compatible with the Angular service pattern.
   *
   * @param id Unique identifier for the requesting menu.
   */
  willShow(id: string): void {
    if (this._activeMenu !== id) {
      this._setActiveMenu(id as BubbleMenuType);
    }
  }

  /**
   * Called when a specific menu hides or is destroyed.
   * Clears the active reference if it matches.
   *
   * @param id Unique identifier for the menu.
   */
  didHide(id: string): void {
    if (this._activeMenu === id) {
      this._setActiveMenu(null);
    }
  }

  /**
   * Check if a specific menu is currently active.
   *
   * @param id Menu type identifier.
   */
  isActive(id: string): boolean {
    return this._activeMenu === id;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private _setActiveMenu(menu: BubbleMenuType | null): void {
    if (this._activeMenu === menu) return;
    this._activeMenu = menu;
    for (const listener of this._listeners) {
      listener(menu);
    }
  }
}
