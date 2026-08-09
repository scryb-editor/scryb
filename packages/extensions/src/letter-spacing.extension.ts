import { createTextStyleExtension } from "./factories/text-style-extension.factory";
import { parseStyleProperty } from "./utils/style-parser.utils";

/**
 * TipTap extension for letter-spacing text styling
 *
 * Provides commands:
 * - setLetterSpacing(letterSpacing: string): Sets the letter spacing for selected text
 * - unsetLetterSpacing(): Removes the letter spacing from selected text
 *
 * @example
 * ```typescript
 * // Set letter spacing
 * editor.commands.setLetterSpacing('0.05em');
 *
 * // Remove letter spacing
 * editor.commands.unsetLetterSpacing();
 * ```
 */
export const LetterSpacingExtension = createTextStyleExtension({
  name: "letterSpacing",
  cssProperty: "letter-spacing",
  parseValue: (element: HTMLElement) =>
    parseStyleProperty(element, "letterSpacing"),
  // No formatValue needed - letter-spacing preserves its original format
});

/**
 * Type augmentation for TipTap commands
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    letterSpacing: {
      /**
       * Sets the letter spacing for selected text
       * @param letterSpacing - The letter spacing value
       */
      setLetterSpacing: (letterSpacing: string) => ReturnType;
      /**
       * Removes the letter spacing from selected text
       */
      unsetLetterSpacing: () => ReturnType;
    };
  }
}
