import { createTextStyleExtension } from "./factories/text-style-extension.factory";
import { ensureSizeUnit, parseStyleProperty } from "./utils/style-parser.utils";

/** Allowed units for font size values */
const FONT_SIZE_UNITS = ["px", "em", "rem"] as const;

/**
 * TipTap extension for font-size text styling
 *
 * Provides commands:
 * - setFontSize(fontSize: string): Sets the font size for selected text
 * - unsetFontSize(): Removes the font size from selected text
 *
 * @example
 * ```typescript
 * // Set font size with unit
 * editor.commands.setFontSize('16px');
 *
 * // Set font size without unit (will default to px)
 * editor.commands.setFontSize('16');
 *
 * // Remove font size
 * editor.commands.unsetFontSize();
 * ```
 */
export const FontSizeExtension = createTextStyleExtension({
  name: "fontSize",
  cssProperty: "font-size",
  parseValue: (element: HTMLElement) => {
    const fontSize = parseStyleProperty(element, "fontSize");
    if (!fontSize) return null;
    // Return with 'px' unit if no unit is present
    return ensureSizeUnit(fontSize, "px", FONT_SIZE_UNITS);
  },
  formatValue: (value: string) => ensureSizeUnit(value, "px", FONT_SIZE_UNITS),
});

/**
 * Type augmentation for TipTap commands
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      /**
       * Sets the font size for selected text
       * @param fontSize - The font size value (with or without unit)
       */
      setFontSize: (fontSize: string) => ReturnType;
      /**
       * Removes the font size from selected text
       */
      unsetFontSize: () => ReturnType;
    };
  }
}
