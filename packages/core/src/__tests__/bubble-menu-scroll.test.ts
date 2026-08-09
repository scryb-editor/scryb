import { describe, it, expect, vi, afterEach } from "vitest";
import {
  BUBBLE_MENU_RESIZE_DELAY_MS,
  DOCUMENT_SCROLL_TARGET,
  createBubbleMenuFloatingOptions,
} from "../config/floating.config";

// ═══════════════ Resize/Scroll Delay ═══════════════

describe("BUBBLE_MENU_RESIZE_DELAY_MS", () => {
  // Tiptap's BubbleMenuView uses one debounced handler for both `resize` and
  // `scroll`. A debounce never fires while a continuous event stream is running,
  // so at the stock 60ms the menu stays pinned to its viewport coordinate for
  // the whole gesture and then jumps. Measured on the marketing page: the error
  // grew 1:1 with distance scrolled (58px, 108px, ... 308px) and only corrected
  // once scrolling stopped.
  it("is zero so every scroll frame repositions", () => {
    expect(BUBBLE_MENU_RESIZE_DELAY_MS).toBe(0);
  });
});

// ═══════════════ Document Scroll Target ═══════════════

describe("DOCUMENT_SCROLL_TARGET", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers on the document in the capture phase, passively", () => {
    const spy = vi.spyOn(document, "addEventListener");
    const listener = () => {};

    DOCUMENT_SCROLL_TARGET.addEventListener("scroll", listener);

    expect(spy).toHaveBeenCalledWith("scroll", listener, { capture: true, passive: true });
  });

  it("detaches with the same capture flag, or removeEventListener would not match", () => {
    const spy = vi.spyOn(document, "removeEventListener");
    const listener = () => {};

    DOCUMENT_SCROLL_TARGET.removeEventListener("scroll", listener);

    expect(spy).toHaveBeenCalledWith("scroll", listener, { capture: true });
  });

  it("observes a scroll on a nested element — scroll does not bubble, so only capture sees it", () => {
    const inner = document.createElement("div");
    document.body.appendChild(inner);

    const listener = vi.fn();
    DOCUMENT_SCROLL_TARGET.addEventListener("scroll", listener);

    try {
      // bubbles: false is what a real element scroll looks like
      inner.dispatchEvent(new Event("scroll", { bubbles: false }));
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      DOCUMENT_SCROLL_TARGET.removeEventListener("scroll", listener);
      inner.remove();
    }
  });

  it("observes a viewport scroll, which targets the document itself", () => {
    const listener = vi.fn();
    DOCUMENT_SCROLL_TARGET.addEventListener("scroll", listener);

    try {
      document.dispatchEvent(new Event("scroll", { bubbles: true }));
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      DOCUMENT_SCROLL_TARGET.removeEventListener("scroll", listener);
    }
  });

  it("stops observing once detached", () => {
    const listener = vi.fn();
    DOCUMENT_SCROLL_TARGET.addEventListener("scroll", listener);
    DOCUMENT_SCROLL_TARGET.removeEventListener("scroll", listener);

    document.dispatchEvent(new Event("scroll", { bubbles: true }));

    expect(listener).not.toHaveBeenCalled();
  });

  it("is a stable singleton — BubbleMenuView compares scrollTarget by identity when options change", () => {
    expect(createBubbleMenuFloatingOptions({ placement: "top", inline: true }).scrollTarget).toBe(
      createBubbleMenuFloatingOptions({ placement: "bottom", inline: false }).scrollTarget,
    );
  });
});

// ═══════════════ Floating Options ═══════════════

describe("createBubbleMenuFloatingOptions", () => {
  it("defaults scrollTarget to the document target so no caller has to pick one", () => {
    const options = createBubbleMenuFloatingOptions({ placement: "top", inline: true });

    expect(options.scrollTarget).toBe(DOCUMENT_SCROLL_TARGET);
  });

  it("keeps the middleware stack and placement it is given", () => {
    const options = createBubbleMenuFloatingOptions({ placement: "bottom-start", inline: false });

    expect(options).toMatchObject({
      strategy: "fixed",
      placement: "bottom-start",
      flip: true,
      shift: true,
      hide: true,
      inline: false,
    });
  });

  it("passes through the onShow reposition handler", () => {
    const onShow = () => {};

    expect(createBubbleMenuFloatingOptions({ placement: "top", inline: true, onShow }).onShow).toBe(onShow);
  });
});
