import type { AnyExtension, JSONContent } from "@tiptap/core";

export interface RenderOptions {
  /** Additional extensions beyond the Scryb defaults for custom schema nodes */
  extensions?: AnyExtension[];
  /**
   * Wrap the output in `<div class="scryb-content">…</div>` so the shared content
   * stylesheet (`@scryb-editor/themes/viewer.css`) applies. Default `true`.
   * Set `false` if the consumer provides its own `.scryb-content` container.
   */
  wrapper?: boolean;
  /**
   * Theme for the rendered output. When set, the content is wrapped in an outer
   * `<div class="scryb-theme-{theme}">` so the theme's design tokens resolve.
   *
   * Required for dark output: the theme tokens (`--scryb-table-border`, etc.) are
   * defined on `.scryb-theme-*` selectors, so a bare `.scryb-content` with no theme
   * ancestor falls back to light values. Omit to inherit a theme class the consumer
   * has already placed on an ancestor. Ignored when `wrapper` is `false`.
   */
  theme?: "light" | "dark" | "auto";
}

export type { JSONContent };
