import type { Editor } from "@tiptap/core";
import { DOMSerializer, type Node as ProseMirrorNode, type Schema } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import {
  isCellAlign,
  isCellVerticalAlign,
  tableHasColumnWidths,
  type CellAlign,
  type CellVerticalAlign,
} from "@scryb-editor/extensions";
import {
  collectCellPositionsIn,
  readSharedCellAttr,
  setCellAttrInScope,
} from "../table-menu/cell-attrs";
import type { SharedCellAttr } from "../table-menu/cell-attrs";
import type {
  BlockMenuItem,
  BlockMenuTurnType,
  BlockMenuLabels,
  BlockMenuCapabilities,
} from "./types";
import {
  FULL_BLOCK_MENU_CAPABILITIES,
  findTextblockPosInBlock,
  getBlockMenuCapabilities,
} from "./capabilities";
import {
  getBlockMoveTarget,
  moveBlockAtPos,
  MOVE_BLOCK_UP_SHORTCUT,
  MOVE_BLOCK_DOWN_SHORTCUT,
} from "./move";

// Module augmentation: block background commands (provided by BlockBackgroundExtension in extensions)
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockBackground: {
      setBlockBackground: (color: string) => ReturnType;
      unsetBlockBackground: () => ReturnType;
    };
  }
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Identifiers for the top-level block menu items.
 */
export const BLOCK_MENU_ITEM_IDS = {
  delete: "delete",
  duplicate: "duplicate",
  copy: "copy",
  colors: "colors",
  turnInto: "turnInto",
  alignment: "alignment",
  fitToWidth: "fitToWidth",
  moveUp: "moveUp",
  moveDown: "moveDown",
} as const;

/**
 * Identifiers for the alignment submenu items.
 */
export const BLOCK_MENU_ALIGN_IDS = {
  left: "align:left",
  center: "align:center",
  right: "align:right",
  top: "align:top",
  middle: "align:middle",
  bottom: "align:bottom",
} as const;

/** Icon per alignment, shared so both adapters draw the same submenu. */
const BLOCK_MENU_ALIGN_ICONS: Record<CellAlign, string> = {
  left: "format_align_left",
  center: "format_align_center",
  right: "format_align_right",
};

const BLOCK_MENU_VERTICAL_ALIGN_ICONS: Record<CellVerticalAlign, string> = {
  top: "vertical_align_top",
  middle: "vertical_align_center",
  bottom: "vertical_align_bottom",
};

/**
 * Identifiers for the color submenu items.
 */
export const BLOCK_MENU_COLOR_IDS = {
  default: "color:default",
  yellow: "color:yellow",
  orange: "color:orange",
  red: "color:red",
  pink: "color:pink",
  purple: "color:purple",
  blue: "color:blue",
  green: "color:green",
  gray: "color:gray",
} as const;

/**
 * Identifiers for the "Turn into" submenu items.
 */
export const BLOCK_MENU_TURN_IDS = {
  paragraph: "turn:paragraph",
  heading1: "turn:heading1",
  heading2: "turn:heading2",
  heading3: "turn:heading3",
  bulletList: "turn:bulletList",
  orderedList: "turn:orderedList",
  taskList: "turn:taskList",
  blockquote: "turn:blockquote",
  codeBlock: "turn:codeBlock",
  details: "turn:details",
} as const;

/**
 * Maps each color ID to its corresponding CSS hex value (or null for "default"/no color).
 * Exported so framework adapters can build color swatches without duplicating the map.
 */
export const BLOCK_MENU_COLOR_VALUES: Record<
  (typeof BLOCK_MENU_COLOR_IDS)[keyof typeof BLOCK_MENU_COLOR_IDS],
  string | null
> = {
  [BLOCK_MENU_COLOR_IDS.default]: null,
  [BLOCK_MENU_COLOR_IDS.yellow]: "#FEF08A",
  [BLOCK_MENU_COLOR_IDS.orange]: "#FED7AA",
  [BLOCK_MENU_COLOR_IDS.red]: "#FECACA",
  [BLOCK_MENU_COLOR_IDS.pink]: "#FBCFE8",
  [BLOCK_MENU_COLOR_IDS.purple]: "#DDD6FE",
  [BLOCK_MENU_COLOR_IDS.blue]: "#BFDBFE",
  [BLOCK_MENU_COLOR_IDS.green]: "#BBF7D0",
  [BLOCK_MENU_COLOR_IDS.gray]: "#F3F4F6",
};

const COPY_FEEDBACK_DURATION_MS = 1500;

/**
 * The alignment labels the submenu builder reads.
 *
 * Narrower than BlockMenuLabels so the grip menus, which carry the same six
 * words under a different label set, build the same submenu from the same code.
 */
export interface AlignMenuLabels {
  readonly alignLeft?: string;
  readonly alignCenter?: string;
  readonly alignRight?: string;
  readonly alignTop?: string;
  readonly alignMiddle?: string;
  readonly alignBottom?: string;
}

// =============================================================================
// Menu item builders
// =============================================================================

/**
 * Creates the full block menu item list with no active color or block type.
 *
 * @param labels - Localized label set for all menu items
 * @returns Array of top-level BlockMenuItem objects: colors, turnInto,
 *   separator, duplicate, copy, separator, delete (danger, always last)
 */
export function createBlockMenuItems(labels: BlockMenuLabels): BlockMenuItem[] {
  return createBlockMenuItemsWithActiveColor(labels, null, null);
}

/**
 * Creates the block menu item list for the block at `pos`: active color, active
 * block type and available entries all read from the document.
 *
 * The entry point both adapters use, so a block type never offers one of them a
 * transform the other hides.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the block the menu was opened on
 * @param labels - Localized label set for all menu items
 * @returns Array of top-level BlockMenuItem objects for that specific block
 */
export function createBlockMenuItemsForBlock(
  editor: Editor,
  pos: number | null,
  labels: BlockMenuLabels,
): BlockMenuItem[] {
  const items = buildBlockMenuItems(labels, {
    activeColor: getBlockBackgroundColor(editor, pos),
    activeBlockType: getBlockTypeAtPos(editor, pos),
    capabilities: getBlockMenuCapabilities(editor, pos),
    activeAlign: readTableCellAlign(editor, pos),
    activeVerticalAlign: readTableCellVerticalAlign(editor, pos),
    fitToWidth: isTableFitToWidthAtPos(editor, pos),
    canMoveUp: pos !== null && getBlockMoveTarget(editor, pos, "up") !== null,
    canMoveDown: pos !== null && getBlockMoveTarget(editor, pos, "down") !== null,
  });

  // The title goes on here rather than inside the builder because it is the
  // only part of the menu that needs the document: a caller passing labels
  // alone has no block to name.
  const title = getBlockDisplayName(editor, pos, labels.blockTypes);
  if (!title) return items;

  return [{ id: "header:blockType", label: title, header: true }, ...items];
}

/**
 * Creates the block menu item list, marking the active color and active block
 * type, and omitting whichever transforms the block cannot perform.
 *
 * @param labels - Localized label set for all menu items
 * @param activeColor - The currently active background color hex value, or null
 * @param activeBlockType - The currently active block type, or null
 * @param capabilities - Which transforms this block supports; defaults to all
 * @returns Array of top-level BlockMenuItem objects with isActive flags set
 */
export function createBlockMenuItemsWithActiveColor(
  labels: BlockMenuLabels,
  activeColor: string | null,
  activeBlockType: BlockMenuTurnType | null,
  capabilities: BlockMenuCapabilities = FULL_BLOCK_MENU_CAPABILITIES,
): BlockMenuItem[] {
  return buildBlockMenuItems(labels, {
    activeColor,
    activeBlockType,
    capabilities,
    activeAlign: null,
    activeVerticalAlign: null,
    fitToWidth: true,
    canMoveUp: false,
    canMoveDown: false,
  });
}

/** Everything the builder needs to know about the block it is describing. */
interface BlockMenuBuildState {
  readonly activeColor: string | null;
  readonly activeBlockType: BlockMenuTurnType | null;
  readonly capabilities: BlockMenuCapabilities;
  /** `"mixed"` when the table's cells disagree, so nothing is marked. */
  readonly activeAlign: CellAlign | "mixed" | null;
  /** `"mixed"` when the table's cells disagree, so nothing is marked. */
  readonly activeVerticalAlign: CellVerticalAlign | "mixed" | null;
  readonly fitToWidth: boolean;
  /** Whether the block has a sibling above / below to swap with. */
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
}

function buildBlockMenuItems(
  labels: BlockMenuLabels,
  state: BlockMenuBuildState,
): BlockMenuItem[] {
  const { capabilities } = state;
  const normalizedActiveColor = normalizeColorValue(state.activeColor);

  // Transform actions lead, clipboard follows, delete sits alone at the end —
  // the destructive item must never be the one under the pointer when the
  // menu opens (matches the Notion/Tiptap menu grammar). A transform the block
  // cannot perform is dropped rather than disabled: an image has no "current
  // block type" to grey out against, and a row that can never enable reads as
  // a broken editor.
  const items: BlockMenuItem[] = [];

  if (capabilities.colors) {
    items.push({
      id: BLOCK_MENU_ITEM_IDS.colors,
      label: labels.colors,
      icon: "palette",
      submenuItems: createColorMenuItems(labels.colorNames, normalizedActiveColor),
    });
  }

  if (capabilities.turnInto) {
    items.push({
      id: BLOCK_MENU_ITEM_IDS.turnInto,
      label: labels.turnInto,
      icon: "swap_horiz",
      submenuItems: createTurnIntoMenuItems(labels.blockTypes, state.activeBlockType),
    });
  }

  if (capabilities.align && labels.alignment) {
    items.push({
      id: BLOCK_MENU_ITEM_IDS.alignment,
      label: labels.alignment,
      icon: BLOCK_MENU_ALIGN_ICONS[isCellAlign(state.activeAlign) ? state.activeAlign : "left"],
      submenuItems: createAlignMenuItems(labels, state.activeAlign, state.activeVerticalAlign),
    });
  }

  if (capabilities.fitToWidth && labels.fitToWidth) {
    // A toggle rather than a pair of rows: the two states are one question, and
    // `isActive` is how every other toggle in this editor answers it.
    items.push({
      id: BLOCK_MENU_ITEM_IDS.fitToWidth,
      label: labels.fitToWidth,
      icon: "swap_horiz",
      isActive: state.fitToWidth,
    });
  }

  // Only when a transform group exists above it — a menu must never open on a
  // separator.
  if (items.length > 0) {
    items.push({ id: "separator:clipboard", label: "", separator: true });
  }

  // Reordering sits with the clipboard group: it moves the block, it does not
  // transform it. Dragging was the only way to reorder (WCAG 2.5.7).
  if (labels.moveUp && state.canMoveUp) {
    items.push({ id: BLOCK_MENU_ITEM_IDS.moveUp, label: labels.moveUp, icon: "arrow_upward", shortcut: MOVE_BLOCK_UP_SHORTCUT });
  }
  if (labels.moveDown && state.canMoveDown) {
    items.push({ id: BLOCK_MENU_ITEM_IDS.moveDown, label: labels.moveDown, icon: "arrow_downward", shortcut: MOVE_BLOCK_DOWN_SHORTCUT });
  }

  items.push(
    {
      id: BLOCK_MENU_ITEM_IDS.duplicate,
      label: labels.duplicate,
      icon: "content_copy",
    },
    {
      id: BLOCK_MENU_ITEM_IDS.copy,
      label: labels.copy,
      icon: "content_paste",
      feedbackIcon: "check",
      feedbackDurationMs: COPY_FEEDBACK_DURATION_MS,
    },
    { id: "separator:danger", label: "", separator: true },
    {
      id: BLOCK_MENU_ITEM_IDS.delete,
      label: labels.delete,
      icon: "delete",
      danger: true,
    },
  );

  return items;
}

// =============================================================================
// Block actions
// =============================================================================

/**
 * Deletes the block node at the given ProseMirror position.
 * If the block is the only one in the document, replaces it with an empty paragraph.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror document position of the block, or null
 * @returns true if the action was dispatched, false otherwise
 */
export function deleteBlockAtPos(editor: Editor, pos: number | null): boolean {
  if (!editor || pos === null) return false;

  const { state, view } = editor;
  const { doc, schema } = state;
  const node = doc.nodeAt(pos);
  if (!node) return false;

  const tr = state.tr;
  const isOnlyBlock = pos === 0 && node.nodeSize === doc.content.size;

  if (isOnlyBlock && schema.nodes["paragraph"]) {
    const paragraph = schema.nodes["paragraph"].createAndFill();
    if (paragraph) {
      tr.replaceWith(pos, pos + node.nodeSize, paragraph);
    } else {
      tr.delete(pos, pos + node.nodeSize);
    }
  } else {
    tr.delete(pos, pos + node.nodeSize);
  }

  view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Duplicates the block node at the given position by inserting a copy after it.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror document position of the block, or null
 * @returns true if the action was dispatched, false otherwise
 */
export function duplicateBlockAtPos(editor: Editor, pos: number | null): boolean {
  if (!editor || pos === null) return false;

  const { state, view } = editor;
  const { doc } = state;
  const node = doc.nodeAt(pos);
  if (!node) return false;

  const tr = state.tr;
  const duplicatedNode = node.copy(node.content);
  const insertPos = pos + node.nodeSize;

  tr.insert(insertPos, duplicatedNode);

  const selectionPos = Math.min(insertPos + 1, tr.doc.content.size);
  tr.setSelection(TextSelection.create(tr.doc, selectionPos));

  view.dispatch(tr.scrollIntoView());
  return true;
}

/**
 * Copies the block at the given position to the clipboard as both HTML and plain text.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror document position of the block, or null
 * @returns true if copy was attempted, false if prerequisites were not met
 */
export function copyBlockAtPos(editor: Editor, pos: number | null): boolean {
  if (!editor || pos === null) return false;
  if (typeof navigator === "undefined") return false;

  const { doc, schema } = editor.state;
  const node = doc.nodeAt(pos);
  if (!node) return false;

  const html = serializeNodeToHtml(node, schema);
  const text = node.textContent ?? "";

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const clipboardItem = new ClipboardItem({
      "text/plain": new Blob([text], { type: "text/plain" }),
      "text/html": new Blob([html], { type: "text/html" }),
    });

    void navigator.clipboard.write([clipboardItem]).catch(() => undefined);
    return true;
  }

  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => undefined);
    return true;
  }

  return true;
}

/**
 * Returns the background color of the block node at the given position.
 * Checks the direct node attribute first, then searches child nodes.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror document position of the block, or null
 * @returns The CSS color string, or null if not set
 */
export function getBlockBackgroundColor(editor: Editor, pos: number | null): string | null {
  if (!editor || pos === null) return null;

  const { doc } = editor.state;
  const node = doc.nodeAt(pos);
  if (!node) return null;

  const directColor = node.attrs["backgroundColor"] as string | null | undefined;
  if (directColor) return directColor;

  let foundColor: string | null = null;
  doc.nodesBetween(pos, pos + node.nodeSize, (child) => {
    const color = child.attrs["backgroundColor"] as string | null | undefined;
    if (color) {
      foundColor = color;
      return false;
    }
    return true;
  });

  return foundColor;
}

/**
 * Returns the block type (as a BlockMenuTurnType) of the node at the given position.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror document position of the block, or null
 * @returns The BlockMenuTurnType string, or null if not found
 */
export function getBlockTypeAtPos(editor: Editor, pos: number | null): BlockMenuTurnType | null {
  if (!editor || pos === null) return null;

  const { doc } = editor.state;
  const node = doc.nodeAt(pos);
  if (!node) return null;

  // A block with no textblock inside it — an image, a horizontal rule — is not
  // one of these types and cannot become one. Answering "paragraph" for it, as
  // the fallthrough below otherwise does, made the Turn into submenu report a
  // current type the block does not have.
  if (findTextblockPosInBlock(editor, pos) === null) return null;

  const resolvedPos = doc.resolve(Math.min(pos + 1, doc.content.size));
  for (let depth = resolvedPos.depth; depth > 0; depth--) {
    const ancestor = resolvedPos.node(depth);
    if (ancestor.type.name === "taskList") return "taskList";
    if (ancestor.type.name === "bulletList") return "bulletList";
    if (ancestor.type.name === "orderedList") return "orderedList";
  }

  if (node.type.name === "heading") {
    const level = Number(node.attrs["level"]);
    if (level === 1) return "heading1";
    if (level === 2) return "heading2";
    if (level === 3) return "heading3";
  }

  if (node.type.name === "blockquote") return "blockquote";
  if (node.type.name === "codeBlock") return "codeBlock";
  if (node.type.name === "details") return "details";

  return "paragraph";
}

// ═══════════════ Table layout ═══════════════

/**
 * Reads an attribute shared by every cell of the table at `pos`.
 *
 * Scoped to the whole table because this menu is opened from the table's drag
 * handle; the grip menus read the same attributes one line at a time, through
 * the same primitive.
 */
function getSharedTableCellAttr(
  editor: Editor,
  pos: number | null,
  attrName: string,
): SharedCellAttr {
  if (!editor || pos === null) return { value: null, mixed: false };
  return readSharedCellAttr(editor, { kind: "table", tablePos: pos }, attrName);
}

/**
 * The table's horizontal alignment as the menu needs it: the shared value, or
 * `"mixed"` when its cells disagree, so the submenu can mark neither.
 */
function readTableCellAlign(
  editor: Editor,
  pos: number | null,
): CellAlign | "mixed" | null {
  const { value, mixed } = getSharedTableCellAttr(editor, pos, "cellAlign");
  if (mixed) return "mixed";
  return isCellAlign(value) ? value : null;
}

/** The vertical counterpart of {@link readTableCellAlign}. */
function readTableCellVerticalAlign(
  editor: Editor,
  pos: number | null,
): CellVerticalAlign | "mixed" | null {
  const { value, mixed } = getSharedTableCellAttr(editor, pos, "cellVerticalAlign");
  if (mixed) return "mixed";
  return isCellVerticalAlign(value) ? value : null;
}

/**
 * Reads the horizontal alignment shared by every cell of the table at `pos`.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the table, or null
 * @returns The shared alignment, or null when unset, mixed, or not a table
 */
export function getTableCellAlignAtPos(editor: Editor, pos: number | null): CellAlign | null {
  const align = readTableCellAlign(editor, pos);
  return align === "mixed" ? null : align;
}

/**
 * Reads the vertical alignment shared by every cell of the table at `pos`.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the table, or null
 * @returns The shared alignment, or null when unset, mixed, or not a table
 */
export function getTableCellVerticalAlignAtPos(
  editor: Editor,
  pos: number | null,
): CellVerticalAlign | null {
  const align = readTableCellVerticalAlign(editor, pos);
  return align === "mixed" ? null : align;
}

/** Writes an attribute onto every cell of the table at `pos`. */
function setCellAttrForTable(
  editor: Editor,
  pos: number | null,
  attrs: Record<string, unknown>,
): boolean {
  if (!editor || pos === null) return false;
  return setCellAttrInScope(editor, { kind: "table", tablePos: pos }, attrs);
}

/**
 * Aligns the content of every cell in the table at `pos` horizontally.
 *
 * The whole table rather than one cell, because this menu is opened from the
 * table's drag handle: it has no cell selection to narrow to, and acting on
 * only the first cell would be a quiet lie about what the handle points at.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the table, or null
 * @param align - Where the content should sit
 * @returns true when the attribute was written
 *
 * @example
 * ```typescript
 * setTableCellAlignAtPos(editor, tablePos, "center");
 * ```
 */
export function setTableCellAlignAtPos(
  editor: Editor,
  pos: number | null,
  align: CellAlign,
): boolean {
  return setCellAttrForTable(editor, pos, { cellAlign: align });
}

/**
 * Aligns the content of every cell in the table at `pos` vertically.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the table, or null
 * @param align - Where the content should sit within the row's height
 * @returns true when the attribute was written
 */
export function setTableCellVerticalAlignAtPos(
  editor: Editor,
  pos: number | null,
  align: CellVerticalAlign,
): boolean {
  return setCellAttrForTable(editor, pos, { cellVerticalAlign: align });
}

/**
 * Returns whether the table at `pos` fills the content column.
 *
 * Full width is the default, so an untouched table reports true.
 *
 * A dragged column disagrees with the attribute and wins: prosemirror-tables
 * writes the sum of the `colwidth` attributes onto the table as an inline
 * `min-width`, which no stylesheet can talk down, so a table carrying column
 * widths is whatever those widths add up to and not the width of the column it
 * sits in. Reporting it as fitted would leave the one table that needs this
 * action unable to receive it — the toggle would be lit, and pressing it would
 * shrink the table to its content instead of fitting it.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the table, or null
 * @returns True when the table draws at full width
 */
export function isTableFitToWidthAtPos(editor: Editor, pos: number | null): boolean {
  if (!editor || pos === null) return false;

  const node = editor.state.doc.nodeAt(pos);
  if (node?.type.name !== "table") return false;

  if (node.attrs["tableWidth"] === "auto") return false;

  return !tableHasColumnWidths(node);
}

/**
 * Writes layout attributes onto the table at `pos`.
 *
 * setNodeMarkup rather than a selection-based command: the caller already knows
 * which table it means, and placing a selection to find one again is how an
 * action ends up on the wrong node.
 */
function setTableLayoutAtPos(
  editor: Editor,
  pos: number | null,
  attrs: Record<string, unknown>,
  options?: { readonly clearColumnWidths?: boolean },
): boolean {
  if (!editor || pos === null) return false;

  const { state, view } = editor;
  const node = state.doc.nodeAt(pos);
  if (node?.type.name !== "table") return false;

  const tr = state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });

  if (options?.clearColumnWidths) {
    // In the same transaction as the width mode, and back to front: one undo
    // should put back the table the user was looking at, not half of it.
    // setNodeMarkup leaves every node's size alone, so the positions taken from
    // the old document still point at the same cells.
    for (const cellPos of [
      ...collectCellPositionsIn(state.doc, { kind: "table", tablePos: pos }),
    ].reverse()) {
      const cell = tr.doc.nodeAt(cellPos);
      if (cell) tr.setNodeMarkup(cellPos, undefined, { ...cell.attrs, colwidth: null });
    }
  }

  view.dispatch(tr);

  if (options?.clearColumnWidths) clearStaleColumnElementWidths(view, pos);

  return true;
}

/**
 * Removes the width left on a `<col>` by a column that no longer has one.
 *
 * Tiptap's table node view writes `width: 556px` onto a `<col>` when the cell
 * carries a `colwidth`, and when the attribute goes away it writes a
 * `min-width` in its place — without ever removing the `width` it wrote before.
 * The element ends up carrying both, and the stale `width` is what the table is
 * actually laid out from, so a table cleared in the document stayed exactly as
 * wide as it was on screen.
 *
 * Done here, once, on the table just changed, rather than as a rule in the
 * stylesheet: a standing `width: auto !important` on these elements would also
 * outrank the widths the column-resize handle writes while a column is being
 * dragged, and freeze the drag preview.
 *
 * ProseMirror has already updated the DOM by the time dispatch returns, so the
 * elements read here are the ones the node view just wrote.
 */
function clearStaleColumnElementWidths(view: EditorView, pos: number): void {
  const dom = view.nodeDOM(pos);
  if (!dom || !(dom instanceof Element)) return;

  const table = dom.matches("table") ? dom : dom.querySelector("table");
  for (const col of table?.querySelectorAll("col") ?? []) {
    col.style.removeProperty("width");
  }
}

/**
 * Sets whether the table at `pos` fills the content column.
 *
 * Fitting drops every column's measured width along with the attribute. The
 * width mode alone cannot fit anything: prosemirror-tables' node view sums the
 * `colwidth` attributes and writes the total onto the table as an inline
 * `min-width`, and an inline declaration outranks the stylesheet's `width:
 * 100%`. A table whose columns were dragged wider than the editor therefore
 * kept its scrollbar no matter which way the toggle was thrown.
 *
 * With the widths gone the table falls back to `width: 100%` over
 * `table-layout: fixed`: the columns divide the available space evenly, long
 * cells wrap onto more lines, and the rows grow taller to hold them. That is
 * the trade this action makes — height for width — and it is the only way a
 * table too wide for its column can be made to fit without hiding content.
 *
 * Shrinking to content leaves the widths alone: they are the reason a
 * content-width table has the shape it does, and the user asked for a narrower
 * table, not a reset one.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the table, or null
 * @param fit - True to fill the column, false to shrink to content
 * @returns true when the attribute was written
 *
 * @example
 * ```typescript
 * setTableFitToWidthAtPos(editor, tablePos, true);
 * ```
 */
export function setTableFitToWidthAtPos(
  editor: Editor,
  pos: number | null,
  fit: boolean,
): boolean {
  if (!fit) return setTableLayoutAtPos(editor, pos, { tableWidth: "auto" });
  return setTableLayoutAtPos(editor, pos, { tableWidth: null }, { clearColumnWidths: true });
}

/**
 * Node type names for blocks no conversion can target, mapped to the label key
 * that names them. A menu opened from a drag handle never says which block it
 * is about to act on, and on these the "Turn into" row — the only other thing
 * that would have named the block — is not there to say it.
 */
const UNCONVERTIBLE_BLOCK_LABEL_KEYS: Record<string, "table" | "image" | "divider"> = {
  table: "table",
  image: "image",
  resizableImage: "image",
  horizontalRule: "divider",
};

/**
 * Returns the display name of the block at `pos`, for the menu's title.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror document position of the block, or null
 * @param blockTypes - Localized block type names
 * @returns The localized name, or null when no label covers this block
 *
 * @example
 * ```typescript
 * getBlockDisplayName(editor, headingPos, labels.blockTypes); // "Heading 2"
 * getBlockDisplayName(editor, tablePos, labels.blockTypes); // "Table"
 * ```
 */
export function getBlockDisplayName(
  editor: Editor,
  pos: number | null,
  blockTypes: BlockMenuLabels["blockTypes"],
): string | null {
  if (!editor || pos === null) return null;

  const turnType = getBlockTypeAtPos(editor, pos);
  if (turnType) {
    // "details" is the node; "toggle" is what every surface calls it.
    const key = turnType === "details" ? "toggle" : turnType;
    return blockTypes[key] ?? null;
  }

  const nodeTypeName = editor.state.doc.nodeAt(pos)?.type.name ?? "";
  const labelKey = UNCONVERTIBLE_BLOCK_LABEL_KEYS[nodeTypeName];
  return labelKey ? (blockTypes[labelKey] ?? null) : null;
}

/**
 * Sets the background color of the block at the given position.
 * Passes null to remove the background color.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror document position of the block, or null
 * @param color - CSS color string to apply, or null to remove
 * @returns true if the command ran successfully, false otherwise
 */
export function setBlockBackgroundColor(
  editor: Editor,
  pos: number | null,
  color: string | null,
): boolean {
  if (!editor || pos === null) return false;

  const selectionPos = findTextblockPosInBlock(editor, pos);
  if (selectionPos === null) return false;

  const chain = editor.chain().focus().setTextSelection(selectionPos);

  if (color) {
    return chain.setBlockBackground(color).run();
  }

  return chain.unsetBlockBackground().run();
}

/**
 * Converts the block at the given position to the specified block type.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror document position of the block, or null
 * @param type - The target BlockMenuTurnType to convert to
 * @returns true if the command ran successfully, false otherwise
 */
export function setBlockTypeAtPos(
  editor: Editor,
  pos: number | null,
  type: BlockMenuTurnType,
): boolean {
  if (!editor || pos === null) return false;

  const selectionPos = findTextblockPosInBlock(editor, pos);
  if (selectionPos === null) return false;

  const chain = editor.chain().focus().setTextSelection(selectionPos);

  switch (type) {
    case "paragraph":
      return chain.setParagraph().run();
    case "heading1":
      return chain.toggleHeading({ level: 1 }).run();
    case "heading2":
      return chain.toggleHeading({ level: 2 }).run();
    case "heading3":
      return chain.toggleHeading({ level: 3 }).run();
    case "bulletList":
      return chain.toggleBulletList().run();
    case "orderedList":
      return chain.toggleOrderedList().run();
    case "taskList":
      return (
        chain as unknown as {
          toggleTaskList: () => { run: () => boolean };
        }
      )
        .toggleTaskList()
        .run();
    case "blockquote":
      return chain.toggleBlockquote().run();
    case "codeBlock":
      return chain.toggleCodeBlock().run();
    case "details":
      return (
        chain as unknown as {
          setDetails: () => { run: () => boolean };
        }
      )
        .setDetails()
        .run();
    default:
      return false;
  }
}

/**
 * Dispatches a block menu action based on the item ID.
 * Routes to the appropriate action function (delete, duplicate, copy, color, or turn into).
 *
 * Refuses everything but Copy on a read-only editor. The guard belongs here and
 * not only in the menus that call it: ProseMirror's `editable: false` stops
 * input arriving through the DOM, but nothing in it stops a programmatic
 * `view.dispatch`, which is what every entry below performs. A menu that forgot
 * to check would otherwise edit a document the licence gate had frozen.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror document position of the block, or null
 * @param itemId - The block menu item ID that was activated
 * @returns true if an action was dispatched, false otherwise
 */
export function handleBlockMenuAction(
  editor: Editor,
  pos: number | null,
  itemId: string,
): boolean {
  if (!editor) return false;
  // Copy reads the document and writes only to the clipboard, so it stays.
  if (!editor.isEditable && itemId !== BLOCK_MENU_ITEM_IDS.copy) return false;

  if (itemId === BLOCK_MENU_ITEM_IDS.delete) {
    return deleteBlockAtPos(editor, pos);
  }

  if (itemId === BLOCK_MENU_ITEM_IDS.duplicate) {
    return duplicateBlockAtPos(editor, pos);
  }

  if (itemId === BLOCK_MENU_ITEM_IDS.copy) {
    return copyBlockAtPos(editor, pos);
  }

  if (itemId === BLOCK_MENU_ITEM_IDS.moveUp) return moveBlockAtPos(editor, pos, "up");
  if (itemId === BLOCK_MENU_ITEM_IDS.moveDown) return moveBlockAtPos(editor, pos, "down");

  // `BLOCK_MENU_COLOR_VALUES` maps the "default" color item to `null` so
  // `!== undefined` distinguishes "color item, reset to default" from "not a
  // color item at all" — a truthy check would break reset-to-default.
  const colorValue = BLOCK_MENU_COLOR_VALUES[itemId as keyof typeof BLOCK_MENU_COLOR_VALUES];
  if (colorValue !== undefined) {
    return setBlockBackgroundColor(editor, pos, colorValue);
  }

  const turnType = getTurnTypeFromId(itemId);
  if (turnType) {
    return setBlockTypeAtPos(editor, pos, turnType);
  }

  const align = getAlignFromId(itemId);
  if (align) {
    return setTableCellAlignAtPos(editor, pos, align);
  }

  const verticalAlign = getVerticalAlignFromId(itemId);
  if (verticalAlign) {
    return setTableCellVerticalAlignAtPos(editor, pos, verticalAlign);
  }

  if (itemId === BLOCK_MENU_ITEM_IDS.fitToWidth) {
    // Reads the current state rather than taking it from the menu item: the
    // document is the truth, and the menu may have been built a moment ago.
    return setTableFitToWidthAtPos(editor, pos, !isTableFitToWidthAtPos(editor, pos));
  }

  return false;
}

// =============================================================================
// Private helpers
// =============================================================================

function serializeNodeToHtml(node: ProseMirrorNode, schema: Schema): string {
  const serializer = DOMSerializer.fromSchema(schema);
  const fragment = serializer.serializeNode(node);
  const container = document.createElement("div");
  container.appendChild(fragment);
  return container.innerHTML;
}

/**
 * Builds the colour swatches, marking the one in force.
 *
 * `"mixed"` marks none of them, not even Default: a scope whose cells carry
 * different colours has no colour of its own, and Default is a colour like any
 * other here — claiming it would offer to keep a state that is not the case.
 */
export function createColorMenuItems(
  colorLabels: BlockMenuLabels["colorNames"],
  activeColor: string | "mixed" | null,
): BlockMenuItem[] {
  return [
    {
      id: BLOCK_MENU_COLOR_IDS.default,
      label: colorLabels.default,
      swatchColor: "#FFFFFF",
      isActive: activeColor === null,
    },
    {
      id: BLOCK_MENU_COLOR_IDS.yellow,
      label: colorLabels.yellow,
      swatchColor: BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.yellow],
      isActive: activeColor === normalizeColorValue(BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.yellow]),
    },
    {
      id: BLOCK_MENU_COLOR_IDS.orange,
      label: colorLabels.orange,
      swatchColor: BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.orange],
      isActive: activeColor === normalizeColorValue(BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.orange]),
    },
    {
      id: BLOCK_MENU_COLOR_IDS.red,
      label: colorLabels.red,
      swatchColor: BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.red],
      isActive: activeColor === normalizeColorValue(BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.red]),
    },
    {
      id: BLOCK_MENU_COLOR_IDS.pink,
      label: colorLabels.pink,
      swatchColor: BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.pink],
      isActive: activeColor === normalizeColorValue(BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.pink]),
    },
    {
      id: BLOCK_MENU_COLOR_IDS.purple,
      label: colorLabels.purple,
      swatchColor: BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.purple],
      isActive: activeColor === normalizeColorValue(BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.purple]),
    },
    {
      id: BLOCK_MENU_COLOR_IDS.blue,
      label: colorLabels.blue,
      swatchColor: BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.blue],
      isActive: activeColor === normalizeColorValue(BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.blue]),
    },
    {
      id: BLOCK_MENU_COLOR_IDS.green,
      label: colorLabels.green,
      swatchColor: BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.green],
      isActive: activeColor === normalizeColorValue(BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.green]),
    },
    {
      id: BLOCK_MENU_COLOR_IDS.gray,
      label: colorLabels.gray,
      swatchColor: BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.gray],
      isActive: activeColor === normalizeColorValue(BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.gray]),
    },
  ];
}

/**
 * Builds the cell alignment submenu: horizontal above, vertical below.
 *
 * Two axes rather than one list, separated, because they are independent
 * settings — a cell is centred horizontally AND sits at the top — and a flat
 * list of six would read as one six-way choice.
 *
 * Cells with no alignment of their own read as left and top, which is where the
 * stylesheet already puts them, so those are marked rather than leaving the
 * submenu open with nothing selected and implying the content is somewhere it
 * is not. Cells that disagree with each other come in as `"mixed"` and mark
 * nothing — which is why the callers have to tell unset from mixed rather than
 * reporting null for both, since the default would otherwise be marked for a
 * table whose first column is centred and the rest is not.
 */
export function createAlignMenuItems(
  labels: AlignMenuLabels,
  activeAlign: CellAlign | "mixed" | null,
  activeVerticalAlign: CellVerticalAlign | "mixed" | null,
): BlockMenuItem[] {
  const alignLabels: Record<CellAlign, string | undefined> = {
    left: labels.alignLeft,
    center: labels.alignCenter,
    right: labels.alignRight,
  };
  const verticalLabels: Record<CellVerticalAlign, string | undefined> = {
    top: labels.alignTop,
    middle: labels.alignMiddle,
    bottom: labels.alignBottom,
  };

  const horizontal = (["left", "center", "right"] as const)
    .filter((align) => Boolean(alignLabels[align]))
    .map((align) => ({
      id: BLOCK_MENU_ALIGN_IDS[align],
      label: alignLabels[align] as string,
      icon: BLOCK_MENU_ALIGN_ICONS[align],
      isActive: activeAlign !== "mixed" && (activeAlign ?? "left") === align,
    }));

  const vertical = (["top", "middle", "bottom"] as const)
    .filter((align) => Boolean(verticalLabels[align]))
    .map((align) => ({
      id: BLOCK_MENU_ALIGN_IDS[align],
      label: verticalLabels[align] as string,
      icon: BLOCK_MENU_VERTICAL_ALIGN_ICONS[align],
      isActive: activeVerticalAlign !== "mixed" && (activeVerticalAlign ?? "top") === align,
    }));

  if (horizontal.length === 0 || vertical.length === 0) return [...horizontal, ...vertical];

  return [
    ...horizontal,
    { id: "separator:verticalAlign", label: "", separator: true },
    ...vertical,
  ];
}

function createTurnIntoMenuItems(
  blockTypeLabels: BlockMenuLabels["blockTypes"],
  activeBlockType: BlockMenuTurnType | null,
): BlockMenuItem[] {
  const items: BlockMenuItem[] = [
    {
      id: BLOCK_MENU_TURN_IDS.paragraph,
      label: blockTypeLabels.paragraph,
      icon: "format_paragraph",
      isActive: activeBlockType === "paragraph",
    },
    {
      id: BLOCK_MENU_TURN_IDS.heading1,
      label: blockTypeLabels.heading1,
      icon: "format_h1",
      isActive: activeBlockType === "heading1",
    },
    {
      id: BLOCK_MENU_TURN_IDS.heading2,
      label: blockTypeLabels.heading2,
      icon: "format_h2",
      isActive: activeBlockType === "heading2",
    },
    {
      id: BLOCK_MENU_TURN_IDS.heading3,
      label: blockTypeLabels.heading3,
      icon: "format_h3",
      isActive: activeBlockType === "heading3",
    },
    {
      id: BLOCK_MENU_TURN_IDS.bulletList,
      label: blockTypeLabels.bulletList,
      icon: "format_list_bulleted",
      isActive: activeBlockType === "bulletList",
    },
    {
      id: BLOCK_MENU_TURN_IDS.orderedList,
      label: blockTypeLabels.orderedList,
      icon: "format_list_numbered",
      isActive: activeBlockType === "orderedList",
    },
    {
      id: BLOCK_MENU_TURN_IDS.taskList,
      label: blockTypeLabels.taskList,
      icon: "checklist",
      isActive: activeBlockType === "taskList",
    },
    {
      id: BLOCK_MENU_TURN_IDS.blockquote,
      label: blockTypeLabels.blockquote,
      icon: "format_quote",
      isActive: activeBlockType === "blockquote",
    },
    {
      id: BLOCK_MENU_TURN_IDS.codeBlock,
      label: blockTypeLabels.codeBlock,
      icon: "code",
      isActive: activeBlockType === "codeBlock",
    },
  ];

  // Details / Toggle block — appended only when the extension is registered
  // (signalled by the adapter providing the blockTypes.toggle label).
  // This avoids showing "Turn into → Toggle" when config.details is omitted.
  if (blockTypeLabels.toggle) {
    items.push({
      id: BLOCK_MENU_TURN_IDS.details,
      label: blockTypeLabels.toggle,
      icon: "expand_more",
      isActive: activeBlockType === "details",
    });
  }

  return items;
}

export function normalizeColorValue(color: string | null | undefined): string | null {
  if (!color || typeof color !== "string") return null;

  const trimmed = color.trim().toLowerCase();

  // A colour written as #FEF08A comes back from the DOM as rgb(254, 240, 138):
  // parseHTML reads element.style.backgroundColor, and the browser normalizes
  // it. Comparing that against a hex palette matched nothing, so a row that was
  // visibly yellow reported no colour at all once the document had been saved
  // and reloaded. Both forms are folded to hex here, where every comparison in
  // this file already happens.
  //
  // Commas or spaces, and the alpha behind either a comma or a slash: CSS Color
  // 4 serialises `rgb(254 240 138 / 50%)`, which is what a browser returns for
  // anything authored in the modern syntax and what arrives on paste from an
  // editor that uses it. Stripping the whitespace first, as this did, turned
  // that form into `rgb(254240138)` — no match, and back to the symptom.
  const rgb =
    /^rgba?\(\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/.exec(
      trimmed,
    );
  if (!rgb) return trimmed.replace(/\s+/g, "");

  // A fully transparent colour is "no colour", which is what an unset cell reads
  // as — otherwise clearing a cell would leave it matching a black swatch.
  const alpha = rgb[4];
  if (alpha !== undefined && parseFloat(alpha) === 0) return null;

  const channel = (value: string | undefined): string =>
    Math.min(255, Math.max(0, Number(value))).toString(16).padStart(2, "0");
  return `#${channel(rgb[1])}${channel(rgb[2])}${channel(rgb[3])}`;
}

function getAlignFromId(itemId: string): CellAlign | null {
  switch (itemId) {
    case BLOCK_MENU_ALIGN_IDS.left:
      return "left";
    case BLOCK_MENU_ALIGN_IDS.center:
      return "center";
    case BLOCK_MENU_ALIGN_IDS.right:
      return "right";
    default:
      return null;
  }
}

function getVerticalAlignFromId(itemId: string): CellVerticalAlign | null {
  switch (itemId) {
    case BLOCK_MENU_ALIGN_IDS.top:
      return "top";
    case BLOCK_MENU_ALIGN_IDS.middle:
      return "middle";
    case BLOCK_MENU_ALIGN_IDS.bottom:
      return "bottom";
    default:
      return null;
  }
}

function getTurnTypeFromId(itemId: string): BlockMenuTurnType | null {
  switch (itemId) {
    case BLOCK_MENU_TURN_IDS.paragraph:
      return "paragraph";
    case BLOCK_MENU_TURN_IDS.heading1:
      return "heading1";
    case BLOCK_MENU_TURN_IDS.heading2:
      return "heading2";
    case BLOCK_MENU_TURN_IDS.heading3:
      return "heading3";
    case BLOCK_MENU_TURN_IDS.bulletList:
      return "bulletList";
    case BLOCK_MENU_TURN_IDS.orderedList:
      return "orderedList";
    case BLOCK_MENU_TURN_IDS.taskList:
      return "taskList";
    case BLOCK_MENU_TURN_IDS.blockquote:
      return "blockquote";
    case BLOCK_MENU_TURN_IDS.codeBlock:
      return "codeBlock";
    case BLOCK_MENU_TURN_IDS.details:
      return "details";
    default:
      return null;
  }
}

// =============================================================================
// BLOCK POSITION UTILITIES
// =============================================================================

/**
 * Returns the document position immediately after the block node at `blockPos`.
 *
 * This is the correct insertion point when the user clicks "+" (add block after):
 * `blockPos + node.nodeSize` places the cursor after the entire node including
 * its closing token.
 *
 * Returns `null` if `blockPos` does not resolve to a node in the document
 * (e.g., invalid position or position at end of document).
 *
 * Canonical implementation — both Angular and React side menu components
 * import this function; no adapter-local position arithmetic is permitted.
 *
 * @param editor - The active Tiptap editor instance.
 * @param blockPos - The document position of the block node to insert after.
 * @returns Position after the block, or null if the block cannot be resolved.
 *
 * @example
 * const insertPos = getInsertAfterPos(editor, block.pos);
 * if (insertPos !== null) slashCommands.openForInsertAfter(insertPos, anchor);
 */
export function getInsertAfterPos(editor: Editor, blockPos: number): number | null {
  const $pos = editor.state.doc.resolve(blockPos);
  const node = $pos.nodeAfter;
  if (!node) return null;
  return blockPos + node.nodeSize;
}
