/**
 * Canonical color palette constants for Scryb color pickers.
 *
 * Both Angular and React adapters import from this module — the single source of truth
 * for all color picker defaults.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * A color option with a hex value and accessible label.
 * Used by the Angular color picker (labeled swatches).
 */
export interface ColorOption {
  color: string;
  label: string;
}

// =============================================================================
// Labeled Palette (both adapters — curated text colour picker)
// =============================================================================

/**
 * Default text colors for the labeled color picker.
 *
 * Every entry clears WCAG 4.5:1 as text on the light editor surface (#ffffff).
 * None can also clear it on the dark surface: one stored hex would need
 * luminance ≤ 0.183 and ≥ 0.237 at once. Dark-surface contrast of an applied
 * colour is the author's call (docs: reference/themes, "Text colour palette").
 */
export const DEFAULT_TEXT_COLORS: readonly ColorOption[] = [
  { color: "#000000", label: "Black" },
  { color: "#374151", label: "Gray" },
  { color: "#B91C1C", label: "Red" },
  { color: "#C2410C", label: "Orange" },
  { color: "#047857", label: "Green" },
  { color: "#0E7490", label: "Cyan" },
  { color: "#7C3AED", label: "Purple" },
  { color: "#DB2777", label: "Pink" },
  { color: "#4F46E5", label: "Indigo" },
  { color: "#4D7C0F", label: "Lime" },
] as const;

// =============================================================================
// Full Palette (legacy)
// =============================================================================

/**
 * 70-color swatch palette matching the Google Docs color grid.
 *
 * No adapter renders this anymore — the unlabeled hex grid gave the two
 * frameworks disjoint palettes (a color applied in one never showed as
 * active in the other) and its pure greens/cyans are unreadable as text
 * color. Both pickers now share DEFAULT_TEXT_COLORS.
 *
 * @deprecated Use DEFAULT_TEXT_COLORS.
 */
export const COLOR_PALETTE: readonly string[] = [
  "#000000", "#434343", "#666666", "#999999", "#B7B7B7", "#CCCCCC", "#D9D9D9", "#EFEFEF", "#F3F3F3", "#FFFFFF",
  "#980000", "#FF0000", "#FF9900", "#FFFF00", "#00FF00", "#00FFFF", "#4A86E8", "#0000FF", "#9900FF", "#FF00FF",
  "#E6B8AF", "#F4CCCC", "#FCE5CD", "#FFF2CC", "#D9EAD3", "#D0E0E3", "#C9DAF8", "#CFE2F3", "#D9D2E9", "#EAD1DC",
  "#DD7E6B", "#EA9999", "#F9CB9C", "#FFE599", "#B6D7A8", "#A2C4C9", "#A4C2F4", "#9FC5E8", "#B4A7D6", "#D5A6BD",
  "#CC4125", "#E06666", "#F6B26B", "#FFD966", "#93C47D", "#76A5AF", "#6D9EEB", "#6FA8DC", "#8E7CC3", "#C27BA0",
  "#A61C00", "#CC0000", "#E69138", "#F1C232", "#6AA84F", "#45818E", "#3C78D8", "#3D85C6", "#674EA7", "#A64D79",
  "#85200C", "#990000", "#B45F06", "#BF9000", "#38761D", "#134F5C", "#1155CC", "#0B5394", "#351C75", "#741B47",
] as const;
