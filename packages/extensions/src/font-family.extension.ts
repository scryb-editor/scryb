import { createTextStyleExtension } from "./factories/text-style-extension.factory";
import { cleanFontFamily } from "./utils/style-parser.utils";

/**
 * TipTap extension for font-family text styling
 *
 * Provides commands:
 * - setFontFamily(fontFamily: string): Sets the font family for selected text
 * - unsetFontFamily(): Removes the font family from selected text
 *
 * @example
 * ```typescript
 * // Set font family
 * editor.commands.setFontFamily('Arial');
 *
 * // Remove font family
 * editor.commands.unsetFontFamily();
 * ```
 */
export const FontFamilyExtension = createTextStyleExtension({
  name: "fontFamily",
  cssProperty: "font-family",
  parseValue: (element: HTMLElement) => cleanFontFamily(element.style.fontFamily),
});

/**
 * Type augmentation for TipTap commands
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontFamily: {
      /**
       * Sets the font family for selected text
       * @param fontFamily - The font family name to apply
       */
      setFontFamily: (fontFamily: string) => ReturnType;
      /**
       * Removes the font family from selected text
       */
      unsetFontFamily: () => ReturnType;
    };
  }
}
