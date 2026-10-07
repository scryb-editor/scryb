import { describe, expect, it } from "vitest";
import { nextTabIndex } from "../accessibility/tabs";

describe("nextTabIndex", () => {
  it("moves right and wraps to the first tab", () => {
    expect(nextTabIndex("ArrowRight", 0, 2)).toBe(1);
    expect(nextTabIndex("ArrowRight", 1, 2)).toBe(0);
  });

  it("moves left and wraps to the last tab", () => {
    expect(nextTabIndex("ArrowLeft", 1, 3)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 3)).toBe(2);
  });

  it("jumps to the ends with Home and End", () => {
    expect(nextTabIndex("Home", 2, 3)).toBe(0);
    expect(nextTabIndex("End", 0, 3)).toBe(2);
  });

  it("ignores other keys and empty tablists", () => {
    expect(nextTabIndex("Enter", 0, 2)).toBeNull();
    expect(nextTabIndex("ArrowDown", 0, 2)).toBeNull();
    expect(nextTabIndex("ArrowRight", 0, 0)).toBeNull();
  });
});
