import { Extension } from "@tiptap/core";
import type { ChainCommandPayload } from "../types/extension.types";

/**
 * Configuration for creating a text style extension
 * Following Interface Segregation Principle - minimal interface
 */
export interface TextStyleExtensionConfig {
  /** Extension name (used in commands and schema) */
  readonly name: string;
  /** CSS property name for rendering */
  readonly cssProperty: string;
  /** Function to parse the value from HTML */
  readonly parseValue: (element: HTMLElement) => string | null;
  /** Function to format the value for rendering (optional) */
  readonly formatValue?: (value: string) => string;
}

/**
 * Factory function to create text style extensions
 * Following Open/Closed Principle - open for extension through config, closed for modification
 * Following DRY - single implementation for similar extensions
 *
 * @param config - Configuration for the extension
 * @returns A configured TipTap Extension
 *
 * @example
 * ```typescript
 * const FontSizeExtension = createTextStyleExtension({
 *   name: 'fontSize',
 *   cssProperty: 'font-size',
 *   parseValue: (el) => el.style.fontSize || null,
 *   formatValue: (value) => ensureSizeUnit(value),
 * });
 * ```
 */
export function createTextStyleExtension(config: TextStyleExtensionConfig): ReturnType<typeof Extension.create> {
  const { name, cssProperty, parseValue, formatValue } = config;

  // Generate command names following naming convention
  const setCommandName = `set${capitalize(name)}` as const;
  const unsetCommandName = `unset${capitalize(name)}` as const;

  return Extension.create({
    name,

    addGlobalAttributes() {
      return [
        {
          types: ["textStyle"],
          attributes: {
            [name]: {
              default: null,
              parseHTML: (element: HTMLElement) => parseValue(element),
              renderHTML: (attributes: Record<string, unknown>) => {
                const value = attributes[name];
                if (!value || typeof value !== "string") {
                  return {};
                }
                const formattedValue = formatValue ? formatValue(value) : value;
                return {
                  style: `${cssProperty}: ${formattedValue}`,
                };
              },
            },
          },
        },
      ];
    },

    addCommands() {
      return {
        [setCommandName]:
          (value: string) =>
          ({ chain }: ChainCommandPayload) => {
            return chain()
              .setMark("textStyle", { [name]: value })
              .run();
          },
        [unsetCommandName]:
          () =>
          ({ chain }: ChainCommandPayload) => {
            return chain()
              .setMark("textStyle", { [name]: null })
              .run();
          },
      } as Record<string, unknown>;
    },
  });
}

/**
 * Capitalizes the first letter of a string
 * @param str - String to capitalize
 * @returns Capitalized string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
