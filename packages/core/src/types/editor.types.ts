import type { Editor } from "@tiptap/core";

// =============================================================================
// Editor command types
// =============================================================================

/**
 * A function that performs an editor command (e.g., toggleBold, setHeading).
 */
export type EditorCommand = (editor: Editor, ...args: unknown[]) => void;

/**
 * A function that returns whether a command is currently active/applicable.
 */
export type EditorCommandCheck = (editor: Editor) => boolean;

// =============================================================================
// Supported locales
// =============================================================================

/**
 * Supported locales for the editor UI.
 *
 * - "en": English
 * - "fr": French
 * - "pt": Portuguese
 * - "es": Spanish
 * - "zh": Simplified Chinese
 */
export type SupportedLocale = "en" | "fr" | "pt" | "es" | "zh";

// =============================================================================
// Heading types
// =============================================================================

/**
 * Heading level options
 */
export type HeadingLevel = 1 | 2 | 3;

// =============================================================================
// Theme types
// =============================================================================

/**
 * Theme variants for the Scryb editor.
 *
 * - "light": Force light theme regardless of OS preference.
 * - "dark": Force dark theme regardless of OS preference.
 * - "auto": Follow the OS `prefers-color-scheme` setting.
 * - "none": Opt out of Scryb theming on the editor content. No class is
 *   applied to the editor host, so `color`, `caret-color`, and background
 *   inherit from the consumer's parent styles. Portaled overlays (Radix
 *   dropdowns, popovers) still render with light-mode chrome through an
 *   internal portal container, so the editor UI remains usable.
 *
 * For `"light"`, `"dark"`, and `"auto"`, the class `scryb-theme-{theme}` is
 * applied to the editor wrapper and to an internal portal container appended
 * to `document.body`. `document.documentElement` is never mutated.
 */
export type ScrybTheme = "light" | "dark" | "auto" | "none";
