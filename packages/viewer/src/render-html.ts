import { generateHTML } from "@tiptap/html";
import type { JSONContent } from "@tiptap/core";
import { buildExtensions, CONTENT_ROOT_CLASS } from "@scryb-editor/core";
import type { RenderOptions } from "./types";

/**
 * Converts Tiptap JSON content to an HTML string.
 *
 * SSR-safe: works in Node.js with no DOM required.
 * Uses @tiptap/html which operates on ProseMirror JSON without
 * needing a browser environment.
 *
 * Extension list is sourced from buildExtensions() in @scryb-editor/core,
 * ensuring the viewer schema always matches the editor schema exactly.
 *
 * Load `@scryb-editor/themes/viewer.css` wherever this output renders so the
 * content styles apply. For dark output, pass `theme: "dark"` (or place a
 * `.scryb-theme-dark` ancestor yourself) — without a theme ancestor the content
 * tokens fall back to their light values.
 *
 * @param content - ProseMirror JSON document
 * @param options - Render options (extra extensions, wrapper, theme)
 * @returns HTML string, wrapped in `<div class="scryb-content">` (and an outer
 *   `<div class="scryb-theme-…">` when `theme` is set) unless `wrapper: false`.
 *
 * @example
 * ```typescript
 * renderToHTML(doc);                    // '<div class="scryb-content">…</div>'
 * renderToHTML(doc, { theme: "dark" }); // '<div class="scryb-theme-dark"><div class="scryb-content">…</div></div>'
 * renderToHTML(doc, { wrapper: false }); // bare HTML, consumer owns the container
 * ```
 */
export function renderToHTML(content: JSONContent, options: RenderOptions = {}): string {
  const extensions = [
    // Import from @scryb-editor/core — single source of truth for the extension list.
    // This prevents schema divergence between editor and viewer (fixes VIEW-03).
    ...buildExtensions(),
    ...(options.extensions ?? []),
  ];
  const html = generateHTML(content, extensions);
  if (options.wrapper === false) {
    return html;
  }
  const content_ = `<div class="${CONTENT_ROOT_CLASS}">${html}</div>`;
  return options.theme ? `<div class="scryb-theme-${options.theme}">${content_}</div>` : content_;
}
