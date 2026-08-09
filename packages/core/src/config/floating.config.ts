/**
 * Shared floating menu positioning configuration.
 *
 * Both Angular and React adapters use these constants when creating
 * floating menus (block menu, slash commands, bubble menus).
 * Centralizing here ensures consistent behavior across frameworks.
 */

import type { Editor } from "@tiptap/core";

/** Floating UI positioning strategy. "fixed" escapes overflow containers. */
export const FLOATING_STRATEGY = "fixed" as const;

/** Default offset in pixels from the reference element. */
export const FLOATING_OFFSET_PX = 4;

/** Padding in pixels for shift middleware (viewport edge avoidance). */
export const FLOATING_SHIFT_PADDING_PX = 8;

/** Offset between bubble menus and their anchor selection rect. */
export const BUBBLE_MENU_OFFSET_PX = 8;

/**
 * `resizeDelay` for every bubble menu plugin. Zero, on purpose.
 *
 * `BubbleMenuView` wires one debounced handler to both `resize` and `scroll`,
 * and a debounce never fires while a continuous event stream is running. At the
 * stock 60ms the menu therefore holds its viewport coordinate for the whole
 * scroll gesture and snaps into place only once the user stops — measured on the
 * marketing page, the error grew 1:1 with distance scrolled (58px at one frame,
 * 308px at six) before correcting.
 *
 * With zero the handler's `setTimeout` resolves between scroll frames, so each
 * one repositions. This is what Floating UI's own `autoUpdate` does: reposition
 * on the scroll event, no throttle.
 *
 * Because the plugin shares that handler, this un-throttles window resizes too:
 * dragging a window edge with a menu open now runs one `computePosition` per
 * resize event rather than one per 60ms. Accepted rather than worked around —
 * the cost is bounded by `updatePosition()`, which returns immediately unless a
 * menu is visible, and a menu is only visible while something is selected.
 */
export const BUBBLE_MENU_RESIZE_DELAY_MS = 0;

/**
 * The `scrollTarget` every bubble menu uses.
 *
 * `BubbleMenuView` keeps exactly one scroll listener and attaches it to
 * `options.scrollTarget ?? window` — a target passed in *replaces* the window
 * listener rather than adding to it. So an editor inside a scrollable container
 * (`config.height` with overflowing content, a modal, a chat pane) either
 * tracked its own scroller or the page, never both, and the menu drifted
 * whichever one it wasn't watching.
 *
 * This shim satisfies the `addEventListener` / `removeEventListener` shape the
 * plugin calls and registers on the document in the **capture** phase, which
 * sees every scroll in the page: element scrolls don't bubble, but the capture
 * path still runs window → document → … → target, and a viewport scroll targets
 * the document itself. One listener, all scrollers, and the plugin keeps owning
 * its lifecycle.
 *
 * Kept as a module singleton because `BubbleMenuView.updateOptions()` decides
 * whether to re-attach by comparing the new `scrollTarget` against the old one
 * by identity.
 *
 * Only the two methods are real. `dispatchEvent` exists to satisfy
 * `EventTarget` and is never called by the plugin.
 *
 * Coupled to `@tiptap/extension-bubble-menu` (3.29.0 at the time of writing),
 * which only ever calls `addEventListener("scroll", handler)` and its removal
 * with no options, and never otherwise touches `scrollTarget`. The cast at the
 * use site erases the type check, so if a future version passes listener options
 * or reads a real element off this — `scrollTop`, `instanceof Window` — the
 * build stays green and the menu silently stops tracking. Re-read
 * `BubbleMenuView` when bumping Tiptap.
 */
export const DOCUMENT_SCROLL_TARGET: EventTarget = {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    document.addEventListener(type, listener, { capture: true, passive: true });
  },
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    document.removeEventListener(type, listener, { capture: true });
  },
  dispatchEvent: (): boolean => false,
};

/**
 * Options block for Tiptap's `BubbleMenuPlugin` (Angular) / `BubbleMenu`
 * component (React). Shared across all bubble menu variants — only placement
 * (top vs. bottom-start) and whether the anchor is an inline text rect vs. a
 * block node rect vary. `hide: true` activates Floating UI's `hide` middleware
 * so the menu disappears when its anchor scrolls outside the clipping region
 * (consumed by BubbleMenuPlugin's built-in `referenceHidden` → `visibility:
 * hidden` handler).
 *
 * Pair with `BUBBLE_MENU_RESIZE_DELAY_MS` on the plugin's sibling `resizeDelay`
 * prop — it is not part of this options block, and without it scrolling still
 * leaves the menu behind.
 */
export function createBubbleMenuFloatingOptions(args: {
  readonly placement: "top" | "bottom" | "bottom-start";
  readonly inline: boolean;
  /**
   * Called by the plugin each time the menu becomes visible. Adapters use this
   * to re-run positioning on the next frame — the first `computePosition` after
   * a fresh `show()` can race the floating element's first layout measurement
   * and land the menu at the viewport origin; a follow-up reposition once the
   * element has dimensions corrects it.
   */
  readonly onShow?: () => void;
}): {
  readonly strategy: typeof FLOATING_STRATEGY;
  readonly placement: "top" | "bottom" | "bottom-start";
  readonly offset: number;
  readonly flip: true;
  readonly shift: true;
  readonly hide: true;
  readonly inline: boolean;
  readonly scrollTarget: HTMLElement | Window;
  readonly onShow: (() => void) | undefined;
} {
  return {
    strategy: FLOATING_STRATEGY,
    placement: args.placement,
    offset: BUBBLE_MENU_OFFSET_PX,
    flip: true,
    shift: true,
    hide: true,
    inline: args.inline,
    // Tiptap types scrollTarget as HTMLElement | Window, but only ever calls
    // add/removeEventListener on it. DOCUMENT_SCROLL_TARGET implements exactly
    // that, and covers scrollers no single element could.
    scrollTarget: DOCUMENT_SCROLL_TARGET as unknown as Window,
    onShow: args.onShow,
  };
}

/**
 * Builds an `onShow` handler that re-dispatches the plugin's `updatePosition`
 * meta on the next animation frame, once the floating element has been laid out.
 * Fixes the first-show positioning race for bubble menus.
 *
 * @param editor - Tiptap editor whose view dispatches the reposition transaction.
 * @param pluginKey - The bubble menu plugin key string (e.g. "scrybTextBubbleMenu").
 */
export function createBubbleMenuReposition(editor: Editor, pluginKey: string): () => void {
  return () => {
    requestAnimationFrame(() => {
      if (editor.isDestroyed) return;
      editor.view.dispatch(editor.state.tr.setMeta(pluginKey, "updatePosition"));
    });
  };
}
