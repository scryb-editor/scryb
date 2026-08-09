import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { columnResizingPluginKey } from "@tiptap/pm/tables";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

// =============================================================================
// Types
// =============================================================================

/** Horizontal placement of a cell's content. */
export type CellAlign = "left" | "center" | "right";

/** Vertical placement of a cell's content within the row's height. */
export type CellVerticalAlign = "top" | "middle" | "bottom";

/**
 * How wide a table draws.
 *
 * `"full"` is the default and the historical behaviour: the stylesheet gives
 * every table `width: 100%`. `"auto"` lets it shrink to its content.
 */
export type TableWidthMode = "full" | "auto";

const CELL_ALIGNS: readonly CellAlign[] = ["left", "center", "right"];
const CELL_VERTICAL_ALIGNS: readonly CellVerticalAlign[] = ["top", "middle", "bottom"];

/** Node types that carry the cell alignment attributes. */
export const TABLE_CELL_TYPES = ["tableCell", "tableHeader"] as const;

/** Classes emitted per alignment. Kept in step with the rules in content.css. */
const CELL_ALIGN_CLASSES: Record<CellAlign, string> = {
  left: "scryb-cell-align-left",
  center: "scryb-cell-align-center",
  right: "scryb-cell-align-right",
};

const CELL_VERTICAL_ALIGN_CLASSES: Record<CellVerticalAlign, string> = {
  top: "scryb-cell-valign-top",
  middle: "scryb-cell-valign-middle",
  bottom: "scryb-cell-valign-bottom",
};

/** Class emitted when a table is content-width rather than full-width. */
export const TABLE_WIDTH_AUTO_CLASS = "scryb-table-width-auto";

/** Class emitted when a full-width table carries no measured column widths. */
export const TABLE_WIDTH_FIT_CLASS = "scryb-table-width-fit";

// =============================================================================
// Guards
// =============================================================================

/**
 * Narrows an arbitrary value to a CellAlign.
 *
 * @param value - Candidate alignment
 * @returns True when the value is one of the three horizontal alignments
 */
export function isCellAlign(value: unknown): value is CellAlign {
  return typeof value === "string" && CELL_ALIGNS.includes(value as CellAlign);
}

/**
 * Narrows an arbitrary value to a CellVerticalAlign.
 *
 * @param value - Candidate alignment
 * @returns True when the value is one of the three vertical alignments
 */
export function isCellVerticalAlign(value: unknown): value is CellVerticalAlign {
  return typeof value === "string" && CELL_VERTICAL_ALIGNS.includes(value as CellVerticalAlign);
}

/**
 * Whether any cell of a table node carries a measured column width.
 *
 * A dragged column outranks the table's width mode: prosemirror-tables writes
 * the sum of these attributes onto the table as an inline width, and no
 * stylesheet can talk an inline declaration down. Anything asking whether a
 * table is as wide as the column it sits in has to ask this first.
 *
 * @param table - A table node
 * @returns True when at least one cell has been given a column width
 *
 * @example
 * ```typescript
 * const fitted = !tableHasColumnWidths(tableNode);
 * ```
 */
export function tableHasColumnWidths(table: ProseMirrorNode): boolean {
  let found = false;

  table.descendants((node: ProseMirrorNode) => {
    if (found) return false;
    if (!TABLE_CELL_TYPES.includes(node.type.name as (typeof TABLE_CELL_TYPES)[number])) {
      return true;
    }
    const colwidth = node.attrs["colwidth"];
    if (Array.isArray(colwidth) && colwidth.some((width) => typeof width === "number")) {
      found = true;
    }
    // Nothing below a cell carries a column width.
    return false;
  });

  return found;
}

/**
 * The width marks for a document: the set that applies, and the list it was
 * built from, kept so one table's mark can be dropped without walking the
 * document again.
 */
interface TableWidthDecorations {
  readonly decorations: DecorationSet;
  readonly all: readonly Decoration[];
}

/** Spec key naming the table a fit mark belongs to. */
const FIT_MARK_TABLE_POS = "scrybFitTable";

const TABLE_LAYOUT_PLUGIN_KEY = new PluginKey<TableWidthDecorations>("scrybTableLayout");

// =============================================================================
// Extension
// =============================================================================

/**
 * Adds layout attributes to a table and its cells: how wide the table draws,
 * where each cell's content sits horizontally and vertically, and what colour
 * the cell is painted.
 *
 * They live together because they answer one question — how a table is laid
 * out — and because the width mode is what decides whether the table has room
 * to be laid out at all.
 *
 * Rendered as classes rather than inline styles, the way text alignment already
 * is in this editor: the widths involved are a stylesheet's business, since the
 * wrapper's floor has to come off in the same breath as the table's width.
 *
 * Ships inside TableBundle, so it reaches the viewer's extension set too — a
 * table saved with centred cells renders that way in read-only output.
 *
 * @example
 * ```typescript
 * // Set through core's block menu actions, which hold the table's
 * // position and apply the setting to every cell:
 * setTableCellAlignAtPos(editor, tablePos, "center");
 * ```
 */
export const TableLayoutExtension = Extension.create({
  name: "tableLayout",

  addGlobalAttributes() {
    return [
      {
        types: ["table"],
        attributes: {
          tableWidth: {
            default: null,
            renderHTML: (attributes: Record<string, unknown>) => {
              // Only the non-default mode is written, so a table that has never
              // been touched serialises exactly as it did before this existed.
              if (attributes["tableWidth"] !== "auto") return {};
              return { class: TABLE_WIDTH_AUTO_CLASS };
            },
            // Returns the VALUE. Tiptap assigns whatever comes back straight
            // onto the attribute, so the `{ attr: value }` shape stores a
            // truthy object on every parsed table and loses the setting on each
            // HTML round trip.
            parseHTML: (element: HTMLElement) =>
              element.classList.contains(TABLE_WIDTH_AUTO_CLASS) ? "auto" : null,
          },
        },
      },
      {
        types: [...TABLE_CELL_TYPES],
        attributes: {
          cellAlign: {
            default: null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const align = attributes["cellAlign"];
              if (!isCellAlign(align)) return {};
              return { class: CELL_ALIGN_CLASSES[align] };
            },
            parseHTML: (element: HTMLElement) => {
              for (const align of CELL_ALIGNS) {
                if (element.classList.contains(CELL_ALIGN_CLASSES[align])) return align;
              }
              // Cells pasted from a word processor carry the intent as an
              // inline style rather than one of our classes.
              const inline = element.style.textAlign;
              return isCellAlign(inline) ? inline : null;
            },
          },
          cellVerticalAlign: {
            default: null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const align = attributes["cellVerticalAlign"];
              if (!isCellVerticalAlign(align)) return {};
              return { class: CELL_VERTICAL_ALIGN_CLASSES[align] };
            },
            parseHTML: (element: HTMLElement) => {
              for (const align of CELL_VERTICAL_ALIGNS) {
                if (element.classList.contains(CELL_VERTICAL_ALIGN_CLASSES[align])) return align;
              }
              const inline = element.style.verticalAlign;
              return isCellVerticalAlign(inline) ? inline : null;
            },
          },
          cellBackground: {
            default: null,
            // An inline colour rather than a class, unlike the alignments above:
            // the palette is a set of values a consumer may replace, so there is
            // no fixed list of classes for a stylesheet to carry. This matches
            // how blockBackground writes a paragraph's colour, and the two are
            // separate attributes because blockBackground does not reach cells.
            renderHTML: (attributes: Record<string, unknown>) => {
              const color = attributes["cellBackground"];
              if (typeof color !== "string" || color.length === 0) return {};
              return { style: `background-color: ${color}` };
            },
            // Returns the VALUE. The `{ attr: value }` shape stores a truthy
            // object on every parsed cell and renders `[object Object]`.
            parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<TableWidthDecorations>({
        key: TABLE_LAYOUT_PLUGIN_KEY,
        // Held in plugin state rather than rebuilt from the `decorations` prop.
        // That prop is asked on every view update — a selection move, a hover, a
        // scroll — and the walk below is the whole document; doing it per
        // keystroke put a full-document traversal on the hot path of every
        // transaction for a decoration only tables carry.
        state: {
          init: (_config, state) => buildTableWidthDecorations(state.doc),
          apply: (tr, current) =>
            tr.docChanged ? buildTableWidthDecorations(tr.doc) : current,
        },
        props: {
          decorations(state) {
            const built = TABLE_LAYOUT_PLUGIN_KEY.getState(state);
            if (!built) return DecorationSet.empty;

            // A column being dragged is a width the document does not have yet,
            // so the fit mark is still on and the columns it frees would absorb
            // the drag instead of showing it: the table would sit still under
            // the pointer and then jump wider on release. Read here rather than
            // in `apply`, where another plugin's state may not exist yet.
            const resizing = columnResizingPluginKey.getState(state);
            if (!resizing?.dragging) return built.decorations;

            // Only the table being dragged. Lifting every fit mark in the
            // document made unrelated tables elsewhere on the page jump to their
            // floor for the length of a drag they had nothing to do with.
            const dragged = tablePosContaining(state.doc, resizing.activeHandle);
            if (dragged === null) return built.decorations;

            return DecorationSet.create(
              state.doc,
              built.all.filter((decoration) => decoration.spec[FIT_MARK_TABLE_POS] !== dragged),
            );
          },
        },
      }),
    ];
  },
});

/**
 * Marks every content-width table in the document.
 *
 * The table's width mode reaches saved HTML through renderHTML, but never the
 * editing DOM: a resizable table is drawn by prosemirror-tables' own node view,
 * which builds its element and ignores renderHTML entirely. A node decoration is
 * the one channel that reaches a node view's DOM.
 *
 * Cells need no such treatment — they are rendered from the schema, so their
 * classes arrive through renderHTML in the editor as well.
 */
function buildTableWidthDecorations(doc: ProseMirrorNode): TableWidthDecorations {
  const all: Decoration[] = [];

  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.type.name === "table") {
      if (node.attrs["tableWidth"] === "auto") {
        all.push(Decoration.node(pos, pos + node.nodeSize, { class: TABLE_WIDTH_AUTO_CLASS }));
      } else if (!tableHasColumnWidths(node)) {
        // A full-width table with no column widths is one nothing has been said
        // about, so it may be told to fit the column it sits in. The moment a
        // column is dragged the class goes, and the table is as wide as its
        // columns again — which is what the drag asked for.
        all.push(
          Decoration.node(
            pos,
            pos + node.nodeSize,
            { class: TABLE_WIDTH_FIT_CLASS },
            { [FIT_MARK_TABLE_POS]: pos },
          ),
        );
      }
      // Cells carry their own attributes; nothing below is a table.
      return false;
    }

    // Only a block that holds other blocks can hold a table. Descending into a
    // paragraph's inline content would walk every text node in the document for
    // nothing.
    return node.isBlock && !node.isTextblock;
  });

  return { decorations: DecorationSet.create(doc, all), all };
}

/**
 * The position of the table holding the cell at `cellPos`.
 *
 * `activeHandle` on the column-resizing plugin names a cell, and the mark to
 * lift belongs to its table.
 *
 * @param doc - The document to resolve against
 * @param cellPos - Position of a cell, or -1 when no handle is active
 * @returns The table's position, or null when the cell resolves to nothing
 */
function tablePosContaining(doc: ProseMirrorNode, cellPos: number): number | null {
  if (cellPos < 0 || cellPos > doc.content.size) return null;

  const resolved = doc.resolve(cellPos);
  for (let depth = resolved.depth; depth > 0; depth--) {
    if (resolved.node(depth).type.name === "table") return resolved.before(depth);
  }
  return null;
}
