import { Extension } from "@tiptap/core";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { TableLayoutExtension } from "./table-layout.extension";

/**
 * Configuration for table resizing behavior
 */
interface TableConfig {
  /** Whether the table columns are resizable */
  readonly resizable: boolean;
  /** Width of the resize handle in pixels */
  readonly handleWidth: number;
  /** Minimum cell width in pixels */
  readonly cellMinWidth: number;
}

/**
 * Default table configuration
 */
const DEFAULT_TABLE_CONFIG: TableConfig = {
  resizable: true,
  handleWidth: 5,
  cellMinWidth: 100,
} as const;

/**
 * CSS class names for table elements
 */
const TABLE_CSS_CLASSES = {
  header: "table-header",
  cell: "table-cell",
} as const;

/**
 * Class of the scroll container a table sits in, in the editor and in saved HTML.
 *
 * Not ours to choose: prosemirror-tables' node view draws the editor's wrapper
 * with it, and Tiptap's `renderWrapper` writes the same literal into saved HTML.
 * The themes target it in both places.
 */
export const TABLE_WRAPPER_CLASS = "tableWrapper";

/**
 * TipTap extension that bundles all table-related extensions
 *
 * Includes:
 * - Table: Main table extension with resizing
 * - TableRow: Row management
 * - TableHeader: Header cell styling
 * - TableCell: Regular cell styling
 *
 * This extension uses composition to provide a single import
 * for all table functionality.
 *
 * @example
 * ```typescript
 * const editor = new Editor({
 *   extensions: [
 *     TableBundle,
 *     // ... other extensions
 *   ],
 * });
 *
 * // Insert a table
 * editor.commands.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
 *
 * // Add a row
 * editor.commands.addRowAfter();
 *
 * // Delete a column
 * editor.commands.deleteColumn();
 * ```
 */
export const TableBundle = Extension.create({
  name: "tableExtension",

  addExtensions() {
    return [
      Table.configure({
        resizable: DEFAULT_TABLE_CONFIG.resizable,
        handleWidth: DEFAULT_TABLE_CONFIG.handleWidth,
        cellMinWidth: DEFAULT_TABLE_CONFIG.cellMinWidth,
        // Saves each table inside the same `div.tableWrapper` the editor draws
        // it in. The editor's wrapper comes from a node view, which saved HTML
        // never sees, so read-only output had no scroll container: a table wider
        // than its column bled out of the page or was cut off by it, where the
        // editor scrolled it. parseHTML matches only `table`, so the wrapper is
        // skipped on the way back in.
        renderWrapper: true,
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: TABLE_CSS_CLASSES.header,
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: TABLE_CSS_CLASSES.cell,
        },
      }),
      // Bundled rather than opt-in so the viewer's extension set gets it too:
      // a table saved centred has to render centred in read-only output.
      TableLayoutExtension,
    ];
  },
});

/**
 * Puts every table in an HTML string inside the scroll wrapper current saves carry.
 *
 * HTML saved before TableBundle wrote the wrapper has bare tables, and saved
 * content is not rewritten until someone edits it. Run stored HTML through this
 * before rendering it read-only and old documents scroll their wide tables the
 * way new ones do. Tables already in a wrapper are left alone, so it is safe on
 * any mix of old and new content.
 *
 * Needs a DOM; without one (server rendering) the HTML is returned unchanged.
 *
 * @param html - Stored editor HTML
 * @returns The same HTML with each bare `<table>` wrapped in `div.tableWrapper`
 *
 * @example
 * ```typescript
 * ensureTableWrappers("<table><tbody>…</tbody></table>");
 * // '<div class="tableWrapper"><table><tbody>…</tbody></table></div>'
 * ```
 */
export function ensureTableWrappers(html: string): string {
  if (typeof document === "undefined" || !/<table[\s>]/i.test(html)) return html;

  const template = document.createElement("template");
  template.innerHTML = html;
  const bare = Array.from(template.content.querySelectorAll("table")).filter(
    (table) => !table.parentElement?.classList.contains(TABLE_WRAPPER_CLASS),
  );
  if (bare.length === 0) return html;

  for (const table of bare) {
    const wrapper = table.ownerDocument.createElement("div");
    wrapper.className = TABLE_WRAPPER_CLASS;
    table.before(wrapper);
    wrapper.append(table);
  }
  return template.innerHTML;
}
