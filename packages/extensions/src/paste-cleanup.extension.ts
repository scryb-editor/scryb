import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import OfficePaste from "@intevation/tiptap-extension-office-paste";
import DOMPurify from "dompurify";

// =============================================================================
// XSS sanitization configuration
// =============================================================================

/**
 * HTML tags allowed through the DOMPurify sanitizer when pasting content.
 * Covers standard block/inline elements safe for rich text editing.
 */
const ALLOWED_TAGS = [
  "p",
  "div",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "br",
  "hr",
  "strong",
  "em",
  "b",
  "i",
  "u",
  "s",
  "del",
  "sub",
  "sup",
  "blockquote",
  "pre",
  "code",
  "figure",
  "figcaption",
] as const;

/**
 * HTML attributes allowed through the DOMPurify sanitizer.
 */
const ALLOWED_ATTR = [
  "class",
  "href",
  "src",
  "alt",
  "title",
  "width",
  "height",
  "colspan",
  "rowspan",
  "style",
  "target",
  "rel",
  "id",
] as const;

// =============================================================================
// Extension
// =============================================================================

/**
 * PasteCleanupExtension
 *
 * Wraps `@intevation/tiptap-extension-office-paste` for Word/Google Docs
 * paste cleanup, and adds a DOMPurify XSS sanitization layer that strips
 * dangerous tags (script, iframe) and event attributes (onerror, onclick)
 * before content enters the editor.
 *
 * @example
 * ```typescript
 * const editor = new Editor({
 *   extensions: [StarterKit, PasteCleanupExtension],
 * });
 * ```
 */
export const PasteCleanupExtension = Extension.create({
  name: "pasteCleanup",

  addExtensions() {
    // Include OfficePaste to clean up Word/Google Docs paste artifacts
    return [OfficePaste];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          /**
           * Sanitize HTML before it is parsed and inserted into the editor.
           * Strips XSS vectors (script tags, event handlers, javascript: hrefs).
           */
          transformPastedHTML(html: string): string {
            return DOMPurify.sanitize(html, {
              ALLOWED_TAGS: [...ALLOWED_TAGS],
              ALLOWED_ATTR: [...ALLOWED_ATTR],
            });
          },
        },
      }),
    ];
  },
});
