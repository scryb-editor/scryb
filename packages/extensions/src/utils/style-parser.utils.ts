/**
 * Utility functions for parsing and formatting CSS style values
 * Following Single Responsibility Principle - each function has one purpose
 */

/** Supported CSS units for size values */
export const CSS_SIZE_UNITS = ["px", "em", "rem", "%", "pt"] as const;
export type CssSizeUnit = (typeof CSS_SIZE_UNITS)[number];

/** Default unit to use when none is specified */
const DEFAULT_SIZE_UNIT: CssSizeUnit = "px";

/**
 * Checks if a value contains a valid CSS unit
 * @param value - The value to check
 * @param units - Array of valid units
 * @returns True if value contains a valid unit
 */
export function hasValidUnit(
  value: string,
  units: readonly string[] = CSS_SIZE_UNITS
): boolean {
  return units.some((unit) => value.includes(unit));
}

/**
 * Ensures a size value has a valid CSS unit
 * @param value - The value to normalize
 * @param defaultUnit - The unit to append if none is present
 * @param allowedUnits - Array of valid units to check
 * @returns The value with a unit appended if needed
 */
export function ensureSizeUnit(
  value: string,
  defaultUnit: CssSizeUnit = DEFAULT_SIZE_UNIT,
  allowedUnits: readonly string[] = CSS_SIZE_UNITS
): string {
  if (!value) return value;

  const trimmedValue = value.trim();
  if (hasValidUnit(trimmedValue, allowedUnits)) {
    return trimmedValue;
  }

  return `${trimmedValue}${defaultUnit}`;
}

/**
 * Parses a CSS style value from an HTML element
 * @param element - The HTML element to parse from
 * @param cssProperty - The CSS property name to extract
 * @returns The parsed value or null if not present
 */
export function parseStyleValue(
  element: HTMLElement,
  cssProperty: string
): string | null {
  const value = element.style.getPropertyValue(cssProperty);
  return value || null;
}

/**
 * Parses a CSS style value using element.style object access
 * Handles camelCase property names
 * @param element - The HTML element to parse from
 * @param styleProp - The camelCase style property name
 * @returns The parsed value or null if not present
 */
export function parseStyleProperty(
  element: HTMLElement,
  styleProp: keyof CSSStyleDeclaration
): string | null {
  const value = element.style[styleProp];
  if (typeof value === "string" && value) {
    return value;
  }
  return null;
}

/**
 * Cleans a font family string by removing quotes
 * @param fontFamily - The font family string to clean
 * @returns The cleaned font family string
 */
export function cleanFontFamily(fontFamily: string | null): string | null {
  if (!fontFamily) return null;
  return fontFamily.replace(/['"]+/g, "").trim() || null;
}

/**
 * Parses a numeric value from a style string (removes unit)
 * @param value - The style value to parse
 * @returns The numeric value or null
 */
export function parseNumericValue(value: string | null): number | null {
  if (!value) return null;
  const parsed = parseInt(value.replace(/[^\d.-]/g, ""), 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Creates CSS style string for a property
 * @param property - The CSS property name
 * @param value - The value to set
 * @returns The CSS style string or empty object if no value
 */
export function createStyleAttribute(
  property: string,
  value: string | null
): Record<string, string> {
  if (!value) return {};
  return { style: `${property}: ${value}` };
}
