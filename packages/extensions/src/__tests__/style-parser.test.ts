import { describe, it, expect } from "vitest";
import {
  hasValidUnit,
  ensureSizeUnit,
  parseStyleValue,
  parseStyleProperty,
  cleanFontFamily,
  parseNumericValue,
  createStyleAttribute,
  CSS_SIZE_UNITS,
} from "../utils/style-parser.utils";

// =============================================================================
// hasValidUnit
// =============================================================================

describe("hasValidUnit", () => {
  it("returns true for value with px unit", () => {
    expect(hasValidUnit("16px")).toBe(true);
  });

  it("returns true for value with em unit", () => {
    expect(hasValidUnit("1.5em")).toBe(true);
  });

  it("returns true for value with rem unit", () => {
    expect(hasValidUnit("2rem")).toBe(true);
  });

  it("returns true for value with % unit", () => {
    expect(hasValidUnit("100%")).toBe(true);
  });

  it("returns true for value with pt unit", () => {
    expect(hasValidUnit("12pt")).toBe(true);
  });

  it("returns false for a plain number", () => {
    expect(hasValidUnit("16")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(hasValidUnit("")).toBe(false);
  });

  it("supports custom unit list", () => {
    expect(hasValidUnit("16vw", ["vw", "vh"])).toBe(true);
    expect(hasValidUnit("16px", ["vw", "vh"])).toBe(false);
  });

  it("uses CSS_SIZE_UNITS by default", () => {
    // All standard units should pass
    for (const unit of CSS_SIZE_UNITS) {
      expect(hasValidUnit(`10${unit}`)).toBe(true);
    }
  });
});

// =============================================================================
// ensureSizeUnit
// =============================================================================

describe("ensureSizeUnit", () => {
  it("appends px to a plain number", () => {
    expect(ensureSizeUnit("16")).toBe("16px");
  });

  it("does not double-add px if already present", () => {
    expect(ensureSizeUnit("16px")).toBe("16px");
  });

  it("does not add unit if em is present", () => {
    expect(ensureSizeUnit("1.5em")).toBe("1.5em");
  });

  it("does not add unit if rem is present", () => {
    expect(ensureSizeUnit("2rem")).toBe("2rem");
  });

  it("does not add unit if % is present", () => {
    expect(ensureSizeUnit("100%")).toBe("100%");
  });

  it("trims whitespace", () => {
    expect(ensureSizeUnit("  16  ")).toBe("16px");
  });

  it("returns empty string as-is", () => {
    expect(ensureSizeUnit("")).toBe("");
  });

  it("uses custom default unit", () => {
    expect(ensureSizeUnit("16", "em")).toBe("16em");
  });

  it("uses custom default unit with rem", () => {
    expect(ensureSizeUnit("2", "rem")).toBe("2rem");
  });

  it("respects custom allowed units", () => {
    // "vw" is not in the default CSS_SIZE_UNITS, so if we pass it as allowed, "16vw" should be kept
    expect(ensureSizeUnit("16vw", "px", ["vw", "vh"])).toBe("16vw");
  });

  it("appends default when value has unrecognized unit in custom list", () => {
    // "16px" but only ["vw"] is allowed -- px is not recognized, so default unit appended
    expect(ensureSizeUnit("16px", "em", ["vw"])).toBe("16pxem");
  });
});

// =============================================================================
// parseStyleValue
// =============================================================================

describe("parseStyleValue", () => {
  it("extracts a CSS property value from an element", () => {
    const el = document.createElement("div");
    el.style.setProperty("font-size", "16px");
    expect(parseStyleValue(el, "font-size")).toBe("16px");
  });

  it("returns null for an unset property", () => {
    const el = document.createElement("div");
    expect(parseStyleValue(el, "font-size")).toBeNull();
  });

  it("returns null for empty string value", () => {
    const el = document.createElement("div");
    el.style.setProperty("color", "");
    expect(parseStyleValue(el, "color")).toBeNull();
  });
});

// =============================================================================
// parseStyleProperty
// =============================================================================

describe("parseStyleProperty", () => {
  it("extracts a camelCase style property", () => {
    const el = document.createElement("div");
    el.style.fontSize = "20px";
    expect(parseStyleProperty(el, "fontSize")).toBe("20px");
  });

  it("returns null for an unset property", () => {
    const el = document.createElement("div");
    expect(parseStyleProperty(el, "fontSize")).toBeNull();
  });

  it("returns null for non-string property values", () => {
    const el = document.createElement("div");
    // length is a number, not a string
    expect(parseStyleProperty(el, "length")).toBeNull();
  });
});

// =============================================================================
// cleanFontFamily
// =============================================================================

describe("cleanFontFamily", () => {
  it("removes single quotes", () => {
    expect(cleanFontFamily("'Arial'")).toBe("Arial");
  });

  it("removes double quotes", () => {
    expect(cleanFontFamily('"Helvetica Neue"')).toBe("Helvetica Neue");
  });

  it("removes mixed quotes", () => {
    expect(cleanFontFamily("'\"Times New Roman\"'")).toBe("Times New Roman");
  });

  it("trims whitespace", () => {
    expect(cleanFontFamily("  Arial  ")).toBe("Arial");
  });

  it("returns null for null input", () => {
    expect(cleanFontFamily(null)).toBeNull();
  });

  it("returns null for empty string after cleanup", () => {
    expect(cleanFontFamily("''")).toBeNull();
  });

  it("returns null for string that is only quotes", () => {
    expect(cleanFontFamily('""')).toBeNull();
  });
});

// =============================================================================
// parseNumericValue
// =============================================================================

describe("parseNumericValue", () => {
  it("parses '16px' to 16", () => {
    expect(parseNumericValue("16px")).toBe(16);
  });

  it("parses '1.5em' to 1 (parseInt truncates)", () => {
    expect(parseNumericValue("1.5em")).toBe(1);
  });

  it("parses '100%' to 100", () => {
    expect(parseNumericValue("100%")).toBe(100);
  });

  it("returns null for null input", () => {
    expect(parseNumericValue(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseNumericValue("")).toBeNull();
  });

  it("returns null for non-numeric string", () => {
    expect(parseNumericValue("abc")).toBeNull();
  });

  it("parses negative values", () => {
    expect(parseNumericValue("-5px")).toBe(-5);
  });

  it("parses values with only a number", () => {
    expect(parseNumericValue("42")).toBe(42);
  });
});

// =============================================================================
// createStyleAttribute
// =============================================================================

describe("createStyleAttribute", () => {
  it("creates a style attribute object", () => {
    const result = createStyleAttribute("font-size", "16px");
    expect(result).toEqual({ style: "font-size: 16px" });
  });

  it("returns empty object for null value", () => {
    const result = createStyleAttribute("font-size", null);
    expect(result).toEqual({});
  });

  it("creates correct CSS for color property", () => {
    const result = createStyleAttribute("color", "#ff0000");
    expect(result).toEqual({ style: "color: #ff0000" });
  });

  it("creates correct CSS for complex values", () => {
    const result = createStyleAttribute("font-family", "Arial, sans-serif");
    expect(result).toEqual({ style: "font-family: Arial, sans-serif" });
  });
});
