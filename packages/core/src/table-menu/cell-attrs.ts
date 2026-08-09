import { TableMap } from "@tiptap/pm/tables";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

import type { TableLineOrientation } from "./geometry";

// =============================================================================
// Types
// =============================================================================

/**
 * Which cells of a table an attribute write reaches.
 *
 * The two shapes exist because the two menus that write cell attributes point
 * at different things: the block menu is opened from the table's drag handle
 * and means every cell, while a grip menu means exactly the line its grip sits
 * against.
 */
export type TableCellScope =
  | { readonly kind: "table"; readonly tablePos: number }
  | {
      readonly kind: "line";
      readonly tablePos: number;
      readonly orientation: TableLineOrientation;
      readonly index: number;
    };

// =============================================================================
// Cell collection
// =============================================================================

/**
 * Lists the document positions of every cell a scope covers, without repeats.
 *
 * A merged cell occupies several slots of the table map and so appears several
 * times in a scan; writing to it twice in one transaction is not merely wasteful
 * but wrong, since the second write is measured against a document the first has
 * already changed.
 *
 * @param editor - The Tiptap editor instance
 * @param scope - The table, row or column to cover
 * @returns Cell positions in document order, or an empty array when the scope
 *   does not resolve to a table
 */
export function collectCellPositions(editor: Editor, scope: TableCellScope): number[] {
  if (!editor) return [];
  return collectCellPositionsIn(editor.state.doc, scope);
}

/**
 * The same list, read from a document rather than from the editor.
 *
 * Needed by anything running inside a transaction that has already changed the
 * table: `editor.state.doc` is then a document behind, and positions taken from
 * it point at cells that have moved.
 *
 * @param doc - The document to read
 * @param scope - The table, row or column to cover
 * @returns Cell positions in document order, or an empty array when the scope
 *   does not resolve to a table
 */
export function collectCellPositionsIn(
  doc: ProseMirrorNode,
  scope: TableCellScope,
): number[] {
  const tableNode = doc.nodeAt(scope.tablePos);
  if (tableNode?.type.name !== "table") return [];

  const map = TableMap.get(tableNode);
  const tableStart = scope.tablePos + 1;
  const seen = new Set<number>();
  const positions: number[] = [];

  const push = (slot: number | undefined): void => {
    if (slot === undefined || seen.has(slot)) return;
    seen.add(slot);
    positions.push(tableStart + slot);
  };

  if (scope.kind === "table") {
    for (const slot of map.map) push(slot);
  } else if (scope.orientation === "row") {
    if (scope.index < 0 || scope.index >= map.height) return [];
    for (let col = 0; col < map.width; col++) push(map.map[scope.index * map.width + col]);
  } else {
    if (scope.index < 0 || scope.index >= map.width) return [];
    for (let row = 0; row < map.height; row++) push(map.map[row * map.width + scope.index]);
  }

  return positions;
}

// =============================================================================
// Read / write
// =============================================================================

/**
 * What a scope has to say about one cell attribute.
 *
 * Two fields rather than one nullable value because a menu needs to tell two
 * situations apart that a single null cannot: no cell has the attribute at all,
 * and the cells disagree. The first means the default is in force and can be
 * marked as active; the second means nothing should be marked.
 */
export interface SharedCellAttr {
  /** The value every cell agrees on. Null when unset, and null when mixed. */
  readonly value: unknown;
  /** Whether the cells disagree with each other. */
  readonly mixed: boolean;
}

/**
 * Reads an attribute across a scope, telling an unset scope from a mixed one.
 *
 * @param editor - The Tiptap editor instance
 * @param scope - The table, row or column to read
 * @param attrName - Name of the cell attribute
 * @returns The shared value and whether the cells disagree
 *
 * @example
 * ```typescript
 * const { value, mixed } = readSharedCellAttr(editor, { kind: "table", tablePos }, "cellAlign");
 * ```
 */
export function readSharedCellAttr(
  editor: Editor,
  scope: TableCellScope,
  attrName: string,
): SharedCellAttr {
  const positions = collectCellPositions(editor, scope);
  if (positions.length === 0) return { value: null, mixed: false };

  const { doc } = editor.state;
  let shared: unknown;
  let seen = false;

  for (const pos of positions) {
    const cell = doc.nodeAt(pos);
    if (!cell) continue;

    const value = cell.attrs[attrName] ?? null;
    if (!seen) {
      shared = value;
      seen = true;
    } else if (shared !== value) {
      return { value: null, mixed: true };
    }
  }

  return { value: seen ? shared : null, mixed: false };
}

/**
 * Reads an attribute shared by every cell in a scope.
 *
 * Returns null when the cells disagree, so a menu built from it marks nothing
 * rather than claiming the whole line is set the way its first cell happens to
 * be. Callers that need to act on the disagreement itself — to leave the
 * default unmarked as well — should read {@link readSharedCellAttr} instead.
 *
 * @param editor - The Tiptap editor instance
 * @param scope - The table, row or column to read
 * @param attrName - Name of the cell attribute
 * @returns The shared value, or null when unset, mixed, or out of a table
 *
 * @example
 * ```typescript
 * const align = getSharedCellAttr(editor, { kind: "line", tablePos, orientation: "column", index: 1 }, "cellAlign");
 * ```
 */
export function getSharedCellAttr(
  editor: Editor,
  scope: TableCellScope,
  attrName: string,
): unknown {
  return readSharedCellAttr(editor, scope, attrName).value;
}

/**
 * Writes attributes onto every cell in a scope.
 *
 * One transaction for the whole scope, applied back to front so each
 * setNodeMarkup is measured against positions the earlier ones have not moved.
 * (They do not move here — a markup change keeps node sizes — but the order
 * costs nothing and stops that from becoming a trap if an attribute ever
 * changes the rendered node.)
 *
 * @param editor - The Tiptap editor instance
 * @param scope - The table, row or column to write
 * @param attrs - Attributes to merge onto each cell
 * @returns true when the transaction was dispatched
 *
 * @example
 * ```typescript
 * setCellAttrInScope(editor, { kind: "table", tablePos }, { cellAlign: "center" });
 * ```
 */
export function setCellAttrInScope(
  editor: Editor,
  scope: TableCellScope,
  attrs: Record<string, unknown>,
): boolean {
  const positions = collectCellPositions(editor, scope);
  if (positions.length === 0) return false;

  const { state, view } = editor;
  const tr = state.tr;

  for (const pos of [...positions].reverse()) {
    const cell = tr.doc.nodeAt(pos);
    if (cell) tr.setNodeMarkup(pos, undefined, { ...cell.attrs, ...attrs });
  }

  view.dispatch(tr);
  return true;
}
