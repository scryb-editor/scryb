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
