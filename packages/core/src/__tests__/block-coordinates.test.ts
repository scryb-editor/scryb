import { describe, it, expect, vi } from "vitest";
import { getBlockCoordinates, getBlockFirstLineBox } from "../utils/block-coordinates";

// ═══════════════ Test Helpers ═══════════════

/**
 * Creates a mock HTMLElement with a stubbed getBoundingClientRect.
 */
function makeMockEl(rect: { top: number; left: number; width?: number; height?: number }): HTMLElement {
  const el = document.createElement("div");
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({
    top: rect.top,
    left: rect.left,
    right: rect.left + (rect.width ?? 100),
    bottom: rect.top + (rect.height ?? 24),
    width: rect.width ?? 100,
    height: rect.height ?? 24,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect);
  return el;
}

// ═══════════════ Tests ═══════════════

describe("getBlockCoordinates", () => {
  it("returns { top: 0, left: 0 } when block and wrapper have same origin", () => {
    const wrapper = makeMockEl({ top: 100, left: 50 });
    const block = makeMockEl({ top: 100, left: 50 });
    expect(getBlockCoordinates(wrapper, block)).toEqual({ top: 0, left: 0 });
  });

  it("returns positive offset when block is below-right of wrapper", () => {
    const wrapper = makeMockEl({ top: 100, left: 50 });
    const block = makeMockEl({ top: 200, left: 90 });
    expect(getBlockCoordinates(wrapper, block)).toEqual({ top: 100, left: 40 });
  });

  it("returns negative top when block is above wrapper", () => {
    const wrapper = makeMockEl({ top: 200, left: 50 });
    const block = makeMockEl({ top: 180, left: 50 });
    expect(getBlockCoordinates(wrapper, block)).toEqual({ top: -20, left: 0 });
  });

  it("returns negative left when block is left of wrapper", () => {
    const wrapper = makeMockEl({ top: 100, left: 200 });
    const block = makeMockEl({ top: 100, left: 150 });
    expect(getBlockCoordinates(wrapper, block)).toEqual({ top: 0, left: -50 });
  });
});

// ═══════════════ First-line metrics ═══════════════

/** Stubs the client rects a range over the element's contents would report. */
function stubLineRects(el: HTMLElement, rects: Array<{ top: number; height: number }>): void {
  const range = document.createRange();
  vi.spyOn(range, "getClientRects").mockReturnValue(
    rects.map((r) => ({ ...r, left: 0, right: 100, bottom: r.top + r.height, width: 100, x: 0, y: r.top, toJSON: () => ({}) })) as unknown as DOMRectList,
  );
  vi.spyOn(range, "selectNodeContents").mockImplementation(() => undefined);
  vi.spyOn(el.ownerDocument, "createRange").mockReturnValue(range);
}

function stubStyle(el: HTMLElement, style: { lineHeight: string; fontSize: string; paddingTop?: string }): void {
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (target) =>
      (target === el
        ? { lineHeight: style.lineHeight, fontSize: style.fontSize, paddingTop: style.paddingTop ?? "0px" }
        : { lineHeight: "normal", fontSize: "16px", paddingTop: "0px" }) as CSSStyleDeclaration,
  );
}

describe("getBlockFirstLineBox", () => {
  it("returns the first line box of a multi-line block, not the whole block", () => {
    const block = makeMockEl({ top: 100, left: 0, height: 72 });
    stubStyle(block, { lineHeight: "24px", fontSize: "16px" });
    stubLineRects(block, [
      { top: 102, height: 19 },
      { top: 126, height: 19 },
      { top: 150, height: 19 },
    ]);

    expect(getBlockFirstLineBox(block)).toEqual({ top: 102, height: 19 });
  });

  it("picks the topmost rect regardless of the order they are reported in", () => {
    const block = makeMockEl({ top: 100, left: 0, height: 48 });
    stubStyle(block, { lineHeight: "24px", fontSize: "16px" });
    stubLineRects(block, [
      { top: 126, height: 19 },
      { top: 102, height: 19 },
    ]);

    expect(getBlockFirstLineBox(block)).toEqual({ top: 102, height: 19 });
  });

  it("ignores a whole-node rect (table, image) and falls back to a top band", () => {
    // A range over a table reports one rect spanning the entire node. Centring
    // on it would park the handles in the middle of the table.
    const block = makeMockEl({ top: 200, left: 0, height: 260 });
    stubStyle(block, { lineHeight: "24px", fontSize: "16px" });
    stubLineRects(block, [{ top: 200, height: 260 }]);

    expect(getBlockFirstLineBox(block)).toEqual({ top: 200, height: 24 });
  });

  it("keeps a tall line when the block's own line-height is tall (headings)", () => {
    const block = makeMockEl({ top: 300, left: 0, height: 48 });
    stubStyle(block, { lineHeight: "48px", fontSize: "32px" });
    stubLineRects(block, [{ top: 305, height: 38 }]);

    expect(getBlockFirstLineBox(block)).toEqual({ top: 305, height: 38 });
  });

  it("offsets the fallback band by padding-top", () => {
    const block = makeMockEl({ top: 400, left: 0, height: 120 });
    stubStyle(block, { lineHeight: "20px", fontSize: "14px", paddingTop: "12px" });
    stubLineRects(block, []);

    expect(getBlockFirstLineBox(block)).toEqual({ top: 412, height: 20 });
  });

  it("derives a line height from font-size when line-height is `normal`", () => {
    const block = makeMockEl({ top: 500, left: 0, height: 100 });
    stubStyle(block, { lineHeight: "normal", fontSize: "20px" });
    stubLineRects(block, []);

    expect(getBlockFirstLineBox(block)).toEqual({ top: 500, height: 24 });
  });
});
