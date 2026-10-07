import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getScrollableAncestor, prefersReducedMotion, scrollBehavior } from "../utils/dom-scroll";

// ═══════════════ Test Helpers ═══════════════

/**
 * Stubs the computed overflow-y on a specific element via getComputedStyle mock.
 * Returns a cleanup function to restore the original mock.
 */
function stubOverflowY(elementOverflowMap: Map<Element, string>): () => void {
  const original = window.getComputedStyle.bind(window);
  const spy = vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
    const mapped = elementOverflowMap.get(el as Element);
    if (mapped !== undefined) {
      return { overflowY: mapped } as unknown as CSSStyleDeclaration;
    }
    return original(el, pseudo);
  });

  return () => spy.mockRestore();
}

/**
 * Defines a read-only scrollHeight / clientHeight on an element so the
 * "is this actually scrollable?" check in getScrollableAncestor works.
 */
function setScrollDimensions(el: HTMLElement, scrollHeight: number, clientHeight: number): void {
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true, writable: false });
  Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true, writable: false });
}

// ═══════════════ Tests ═══════════════

describe("getScrollableAncestor", () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Attach a fresh container to document.body so parentElement walks work correctly
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  it("returns window when given null", () => {
    expect(getScrollableAncestor(null)).toBe(window);
  });

  it("returns window when no ancestor has a scrollable overflow-y", () => {
    const child = document.createElement("div");
    const parent = document.createElement("div");
    parent.appendChild(child);
    container.appendChild(parent);

    const overflowMap = new Map<Element, string>([
      [child, "visible"],
      [parent, "visible"],
      [container, "visible"],
    ]);
    const restore = stubOverflowY(overflowMap);

    try {
      const result = getScrollableAncestor(child);
      expect(result).toBe(window);
    } finally {
      restore();
    }
  });

  it("returns the nearest ancestor with overflow-y: auto and scrollHeight > clientHeight", () => {
    const child = document.createElement("div");
    const scrollable = document.createElement("div");
    scrollable.appendChild(child);
    container.appendChild(scrollable);

    setScrollDimensions(scrollable, 800, 400); // scrollable

    const overflowMap = new Map<Element, string>([
      [child, "visible"],
      [scrollable, "auto"],
      [container, "visible"],
    ]);
    const restore = stubOverflowY(overflowMap);

    try {
      expect(getScrollableAncestor(child)).toBe(scrollable);
    } finally {
      restore();
    }
  });

  it("skips an overflow-y: auto ancestor that cannot actually scroll (scrollHeight <= clientHeight)", () => {
    const child = document.createElement("div");
    const notActuallyScrollable = document.createElement("div");
    const outerScrollable = document.createElement("div");

    notActuallyScrollable.appendChild(child);
    outerScrollable.appendChild(notActuallyScrollable);
    container.appendChild(outerScrollable);

    // Inner div is "auto" but content fits — NOT scrollable
    setScrollDimensions(notActuallyScrollable, 200, 200);
    // Outer div overflows and can scroll
    setScrollDimensions(outerScrollable, 1000, 400);

    const overflowMap = new Map<Element, string>([
      [child, "visible"],
      [notActuallyScrollable, "auto"],
      [outerScrollable, "auto"],
      [container, "visible"],
    ]);
    const restore = stubOverflowY(overflowMap);

    try {
      expect(getScrollableAncestor(child)).toBe(outerScrollable);
    } finally {
      restore();
    }
  });

  it("skips overflow-y: hidden and visible, but qualifies overflow-y: scroll", () => {
    const child = document.createElement("div");
    const hiddenParent = document.createElement("div");
    const scrollParent = document.createElement("div");

    hiddenParent.appendChild(child);
    scrollParent.appendChild(hiddenParent);
    container.appendChild(scrollParent);

    setScrollDimensions(hiddenParent, 800, 400);  // overflow-y: hidden — should be skipped
    setScrollDimensions(scrollParent, 2000, 500); // overflow-y: scroll — should qualify

    const overflowMap = new Map<Element, string>([
      [child, "visible"],
      [hiddenParent, "hidden"],
      [scrollParent, "scroll"],
      [container, "visible"],
    ]);
    const restore = stubOverflowY(overflowMap);

    try {
      expect(getScrollableAncestor(child)).toBe(scrollParent);
    } finally {
      restore();
    }
  });

  it("returns the innermost (nearest) scrollable ancestor when multiple exist", () => {
    const child = document.createElement("div");
    const innerScroll = document.createElement("div");
    const outerScroll = document.createElement("div");

    innerScroll.appendChild(child);
    outerScroll.appendChild(innerScroll);
    container.appendChild(outerScroll);

    setScrollDimensions(innerScroll, 600, 200); // nearer scrollable
    setScrollDimensions(outerScroll, 1200, 400); // further scrollable

    const overflowMap = new Map<Element, string>([
      [child, "visible"],
      [innerScroll, "auto"],
      [outerScroll, "auto"],
      [container, "visible"],
    ]);
    const restore = stubOverflowY(overflowMap);

    try {
      // Should return innerScroll, not outerScroll
      expect(getScrollableAncestor(child)).toBe(innerScroll);
    } finally {
      restore();
    }
  });
});

// ═══════════════ Reduced motion ═══════════════


function stubReducedMotion(reduce: boolean): void {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: reduce && query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

describe("reduced motion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("jumps instead of animating when the user prefers reduced motion", () => {
    stubReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(scrollBehavior()).toBe("auto");
  });

  it("scrolls smoothly otherwise", () => {
    stubReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(scrollBehavior()).toBe("smooth");
  });
});
