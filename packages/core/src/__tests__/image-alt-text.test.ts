import { describe, expect, it } from "vitest";
import { resolveImageAlt } from "../image/alt-text";

describe("resolveImageAlt", () => {
  it("returns trimmed text", () => expect(resolveImageAlt({ text: "  A cat  ", decorative: false })).toBe("A cat"));
  it("treats whitespace as no alt", () => expect(resolveImageAlt({ text: "   ", decorative: false })).toBeNull());
  it("decorative wins over typed text", () => expect(resolveImageAlt({ text: "A cat", decorative: true })).toBe(""));
});
