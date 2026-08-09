import type { Editor } from "@tiptap/core";
import { isBlockBackgroundNode } from "@scryb-editor/extensions";
import type { BlockMenuCapabilities } from "./types";

// ═══════════════ Textblock lookup ═══════════════

/**
 * Returns a document position inside the first textblock descendant of the
 * block at `pos`, or null when the block contains no textblock at all.
 *
 * Every block action that edits content — a background colour, a type
 * conversion — needs a text position to place the selection on. An image, a
 * horizontal rule and a resizable embed have none. Returning null rather than
 * falling back to `pos + 1` matters: that fallback lands outside the node, so
 * the action ran against whatever block happened to follow, silently editing a
 * neighbour the user never pointed at.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the block, or null
 * @returns Position inside the first textblock, or null if the block has none
 */
export function findTextblockPosInBlock(editor: Editor, pos: number | null): number | null {
  if (!editor || pos === null) return null;

  const { doc } = editor.state;
  const node = doc.nodeAt(pos);
  if (!node) return null;

  let found: number | null = null;

  doc.nodesBetween(pos, pos + node.nodeSize, (child, childPos) => {
    if (found !== null) return false;

    // Never descend into an isolating node nested inside the block — a table
    // cell is the case that matters. Its paragraph is a selection island
    // belonging to the cell, not to the table, so treating it as "the table's
    // textblock" would let a menu aimed at the whole table colour one cell, or
    // convert one cell's paragraph, while claiming to act on the table.
    //
    // Strictly inside, because nodesBetween walks down to the range: the block
    // itself arrives at `pos` and its ancestors before that. A table is
    // isolating too, so `!== pos` would abandon the walk at the table on the
    // way down to one of its own cells.
    if (childPos > pos && child.type.spec.isolating) return false;

    if (child.isTextblock) {
      found = Math.min(childPos + 1, doc.content.size);
      return false;
    }
    return true;
  });

  return found;
}

// ═══════════════ Capabilities ═══════════════

/**
 * Returns whether a background colour applied at `pos` would change anything.
 *
 * The colour rides an attribute the BlockBackground extension declares on a
 * fixed set of node types, and it is written at the collapsed selection, so the
 * question is whether that selection's own ancestry contains one of those
 * types. A list item qualifies through the paragraph inside it; a code block
 * does not, since it is itself the textblock and carries no such attribute.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the block, or null
 * @returns true when setBlockBackgroundColor would produce a document change
 */
export function canColorBlockAt(editor: Editor, pos: number | null): boolean {
  if (!editor || pos === null) return false;

  // The extension is optional: a host assembling its own extension list can
  // leave it out, and then no node type supports the attribute at all.
  const commands = editor.commands as unknown as Record<string, unknown>;
  if (typeof commands["setBlockBackground"] !== "function") return false;

  const selectionPos = findTextblockPosInBlock(editor, pos);
  if (selectionPos === null) return false;

  const resolvedPos = editor.state.doc.resolve(selectionPos);
  for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
    if (isBlockBackgroundNode(resolvedPos.node(depth).type.name)) return true;
  }

  return false;
}

/**
 * Returns whether the block at `pos` can be converted to another block type.
 *
 * Every conversion target in the "Turn into" submenu is a textblock or wraps
 * one, so a block with no textblock inside it — an image, a horizontal rule —
 * has nothing to convert and nothing true to report as its current type.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the block, or null
 * @returns true when the block holds a textblock a conversion can act on
 */
export function canTurnIntoBlockAt(editor: Editor, pos: number | null): boolean {
  return findTextblockPosInBlock(editor, pos) !== null;
}

/**
 * Resolves which block menu entries would do something on the block at `pos`.
 *
 * The menu is built from this rather than from a fixed list, because an entry
 * that is present and inert is worse than an absent one: it reads as a broken
 * editor rather than as an action this block does not have.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the block, or null
 * @returns The capability flags for that block
 *
 * @example
 * ```typescript
 * getBlockMenuCapabilities(editor, imagePos); // { colors: false, turnInto: false }
 * getBlockMenuCapabilities(editor, listItemPos); // { colors: true, turnInto: true }
 * ```
 */
export function getBlockMenuCapabilities(
  editor: Editor,
  pos: number | null,
): BlockMenuCapabilities {
  const layout = canLayOutBlockAt(editor, pos);
  return {
    colors: canColorBlockAt(editor, pos),
    turnInto: canTurnIntoBlockAt(editor, pos),
    align: layout,
    fitToWidth: layout,
  };
}

/**
 * Returns whether the block at `pos` carries the table layout controls.
 *
 * Only a table does today. The check is for the attribute rather than the type
 * name, so a host that declares the same attribute on another node gets the
 * controls without editing this file — and a build assembled without
 * TableLayoutExtension does not get controls that write into nothing.
 *
 * One attribute answers for both controls because both ship in that one
 * extension: a document that has `tableWidth` on its tables has `cellAlign` on
 * their cells, and neither can arrive without the other.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the block, or null
 * @returns true when the block's cells can be aligned and its width toggled
 */
export function canLayOutBlockAt(editor: Editor, pos: number | null): boolean {
  if (!editor || pos === null) return false;

  const node = editor.state.doc.nodeAt(pos);
  if (!node) return false;

  return Boolean(node.type.spec.attrs && "tableWidth" in node.type.spec.attrs);
}

/**
 * Every entry available — the shape used when no block context is supplied.
 *
 * The layout pair is false rather than true: an unknown block is a textblock
 * far more often than a table, and a menu offering an alignment that writes an
 * attribute the node does not declare is the failure this module exists to
 * prevent.
 */
export const FULL_BLOCK_MENU_CAPABILITIES: BlockMenuCapabilities = {
  colors: true,
  turnInto: true,
  align: false,
  fitToWidth: false,
};
