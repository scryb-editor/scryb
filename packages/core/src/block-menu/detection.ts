import type { Editor } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";
import type { BlockDetectionResult } from "./types";

// =============================================================================
// Block type registry
// =============================================================================

/**
 * Set of ProseMirror node type names that qualify as block-level nodes
 * for side menu detection and block operations.
 */
export const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "table",
  "image",
  "horizontalRule",
]);

/**
 * Node types whose drag handle drags the block but does not open the block menu.
 *
 * Empty, and kept as the seam rather than deleted: a host adding a node type
 * whose handle should stay a pure drag affordance has one place to say so.
 *
 * The table used to be here, because the menu was the same five rows on every
 * block and none of them were true of a table. Now that the rows are resolved
 * per block, a table gets the ones that are — its name, Duplicate, Copy and
 * Delete — while its row- and column-scoped actions stay in the table bubble
 * menu, where the selection they need already exists.
 */
export const BLOCK_MENU_EXCLUDED_TYPES = new Set<string>();

/**
 * Returns whether the block at `pos` should open the block context menu on a
 * drag-handle click. Canonical so both adapters exclude the same node types.
 *
 * @param editor - The Tiptap editor instance
 * @param pos - ProseMirror position of the block, or null
 * @returns false for excluded types (and for a null position), true otherwise
 */
export function canOpenBlockMenuAt(editor: Editor, pos: number | null): boolean {
  if (pos === null) return false;
  const node = editor.state.doc.resolve(pos).nodeAfter;
  return !BLOCK_MENU_EXCLUDED_TYPES.has(node?.type.name ?? "");
}

// =============================================================================
// Block detection utilities
// =============================================================================

/**
 * Returns true if the given node type name is a recognized block-level node.
 *
 * @param typeName - ProseMirror node type name to test
 * @returns true if the type is in BLOCK_TYPES
 */
export function isBlockNode(typeName: string): boolean {
  return BLOCK_TYPES.has(typeName);
}

/**
 * Returns the priority for a block node type.
 * Lower values win when multiple candidate blocks are found at the same position.
 * Priority ordering: listItem < blockquote < codeBlock < table < image < heading < paragraph < bulletList/orderedList < horizontalRule < unknown
 *
 * @param typeName - ProseMirror node type name
 * @returns Priority number (0 = highest, 99 = lowest/unknown)
 */
export function getBlockTypePriority(typeName: string): number {
  switch (typeName) {
    case "listItem":
      return 0;
    case "blockquote":
      return 1;
    case "codeBlock":
      return 2;
    case "table":
      return 3;
    case "image":
      return 4;
    case "heading":
      return 5;
    case "paragraph":
      return 6;
    case "bulletList":
    case "orderedList":
      return 7;
    case "horizontalRule":
      return 8;
    default:
      return 99;
  }
}

/**
 * Walks the resolved position's ancestry to find the highest-priority block node
 * that should display the side menu or receive block operations.
 *
 * Returns a BlockDetectionResult containing the ProseMirror position and the
 * corresponding DOM element. Returns null if no qualifying block is found.
 *
 * @param editor - The Tiptap editor instance
 * @param resolvedPos - A ProseMirror ResolvedPos (e.g. from editor.state.doc.resolve())
 * @returns BlockDetectionResult with pos and element, or null
 */
export function getBlockFromResolvedPos(
  editor: Editor,
  resolvedPos: ResolvedPos,
): BlockDetectionResult | null {
  const candidates: Array<{ pos: number; element: HTMLElement; type: string }> = [];

  for (let depth = resolvedPos.depth; depth > 0; depth -= 1) {
    const node = resolvedPos.node(depth);
    if (!isBlockNode(node.type.name)) continue;

    const blockPos = resolvedPos.before(depth);
    const domNode = editor.view.nodeDOM(blockPos);
    const element =
      domNode instanceof HTMLElement
        ? domNode
        : domNode instanceof Node && domNode.parentElement instanceof HTMLElement
          ? domNode.parentElement
          : null;

    if (element) {
      candidates.push({ pos: blockPos, element, type: node.type.name });
    }
  }

  if (!candidates.length) return null;

  const best = candidates.reduce((winner, candidate) => {
    if (!winner) return candidate;
    return getBlockTypePriority(candidate.type) < getBlockTypePriority(winner.type)
      ? candidate
      : winner;
  }, candidates[0]!);

  return { pos: best.pos, element: best.element };
}
