/**
 * DOM scroll utilities: finding the nearest scrollable ancestor, and choosing a
 * programmatic scroll's `behavior` from the user's reduced-motion preference.
 *
 * `getScrollableAncestor`:
 *
 * No longer used by the bubble menus. `BubbleMenuView` keeps a single scroll
 * listener and attaches it to `scrollTarget ?? window`, so naming one element
 * meant the menu tracked that scroller *instead of* the page — the two cannot
 * both be observed through that option. They use `DOCUMENT_SCROLL_TARGET`
 * (`config/floating.config.ts`) instead, which sees every scroller at once.
 *
 * Kept as a public utility for consumers who need the nearest scrollable
 * ancestor for their own purposes.
 */

// ─── DOM Scroll Utilities ────────────────────────────────────────────────────

/**
 * Walks up the DOM tree from `el` and returns the nearest ancestor element
 * that is actually scrollable (i.e., its computed `overflow-y` is `"auto"` or
 * `"scroll"` AND its `scrollHeight` exceeds its `clientHeight`).
 *
 * If no scrollable ancestor is found — or if `el` is `null` — returns `window`,
 * which is the correct scroll listener target for the default viewport scroll.
 *
 * `document.body` and `document.documentElement` are treated as the viewport
 * boundary: if the walk reaches either without finding a qualifying ancestor,
 * `window` is returned.
 *
 * @param el - The element to start walking from (typically `editor.view.dom`).
 * @returns The nearest scrollable ancestor `HTMLElement`, or `window`.
 *
 * @example
 * ```ts
 * // Which container will move if the user scrolls the editor's surroundings
 * const scroller = getScrollableAncestor(editor.view.dom);
 * scroller.addEventListener("scroll", onSurroundingsMoved, { passive: true });
 * ```
 */
export function getScrollableAncestor(el: HTMLElement | null): HTMLElement | Window {
  if (!el) return window;

  let node: HTMLElement | null = el.parentElement;

  while (node !== null) {
    // Stop at viewport boundary — window is the right listener for these
    if (node === document.body || node === document.documentElement) {
      return window;
    }

    const overflowY = window.getComputedStyle(node).overflowY;
    // Only probe layout (scrollHeight/clientHeight forces reflow) when the
    // overflow style could plausibly scroll — most ancestors are `visible`.
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }

    node = node.parentElement;
  }

  return window;
}

/**
 * Whether the user asked the OS to minimise motion. False outside a browser.
 *
 * @returns `true` when `(prefers-reduced-motion: reduce)` matches.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The `behavior` for a programmatic `scrollIntoView`/`scrollTo`: an instant
 * jump under reduced motion, a smooth scroll otherwise.
 *
 * @example
 * row.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
 */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}
