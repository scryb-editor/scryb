/**
 * Drop Indicator Utilities
 *
 * Pure functions for computing drop indicator position during block drag-and-drop.
 * Used by Angular and React adapters to determine where to render the 2px blue
 * horizontal line that shows where a dragged block will land.
 */

import type { Editor } from "@tiptap/core";

// =============================================================================
// Types
// =============================================================================

/**
 * Computed position for the drop indicator element.
 * x/y are pixel offsets relative to the positioned container.
 * width matches the editor content area width.
 */
export interface DropIndicatorPosition {
  x: number;
  y: number;
  width: number | string;
}

/**
 * Result of computing a drop indicator position.
 * null means the indicator should be hidden (cursor out of bounds or no valid block).
 * Non-null means the indicator should be shown at the returned position,
 * and the drop target is at the returned pos/place.
 */
export interface DropIndicatorResult {
  position: DropIndicatorPosition;
  targetPos: number;
  targetPlace: "before" | "after";
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Block node type names that are valid drag-and-drop targets.
 * Canonical superset from both Angular (isSideMenuBlockType) and React (DROPPABLE_BLOCK_TYPES).
 */
export const DROPPABLE_BLOCK_TYPES: readonly string[] = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "blockquote",
  "codeBlock",
  "image",
  "horizontalRule",
  "table",
] as const;

// =============================================================================
// Functions
// =============================================================================

/**
 * Resolves the block under the given viewport coordinates and computes
 * the drop indicator position (above or below that block).
 *
 * Returns null if the coordinates are outside editor bounds or no valid
 * droppable block is found — the caller should hide the indicator.
 *
 * @param editor - The Tiptap Editor instance
 * @param x - Viewport X coordinate (e.g. event.clientX)
 * @param y - Viewport Y coordinate (e.g. event.clientY)
 * @param containerEl - The positioned container element for relative offset calculation.
 *                      Pass the .scryb-editor-body element or equivalent offsetParent.
 *                      Falls back to editor.view.dom.getBoundingClientRect() if null.
 * @returns DropIndicatorResult with position + target info, or null to hide indicator
 */
export function computeDropIndicatorPosition(
  editor: Editor,
  x: number,
  y: number,
  containerEl: HTMLElement | null,
): DropIndicatorResult | null {
  const editorRect = editor.view.dom.getBoundingClientRect();

  // Hide indicator if cursor is outside the editor vertical bounds
  if (y < editorRect.top || y > editorRect.bottom) {
    return null;
  }

  // Clamp coords to within editor bounds before calling posAtCoords
  const safeX = Math.min(Math.max(x, editorRect.left + 1), editorRect.right - 1);
  const safeY = Math.min(Math.max(y, editorRect.top + 1), editorRect.bottom - 1);

  const coords = editor.view.posAtCoords({ left: safeX, top: safeY });
  if (!coords) {
    return null;
  }

  // Walk up the document tree to find the nearest droppable block
  const $pos = editor.state.doc.resolve(coords.pos);
  let blockPos: number | null = null;

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    const node = $pos.node(depth);
    if (DROPPABLE_BLOCK_TYPES.includes(node.type.name)) {
      blockPos = $pos.before(depth);
      break;
    }
  }

  // Also check depth=0 for top-level nodes (React edge case — canonical version includes it)
  if (blockPos === null && $pos.depth === 0) {
    const node = $pos.nodeAfter;
    if (node && DROPPABLE_BLOCK_TYPES.includes(node.type.name)) {
      blockPos = $pos.pos;
    }
  }

  if (blockPos === null) {
    return null;
  }

  const blockDom = editor.view.nodeDOM(blockPos);
  const blockEl = blockDom instanceof HTMLElement ? blockDom : (blockDom as Node | null)?.parentElement ?? null;
  if (!blockEl) {
    return null;
  }

  const blockRect = blockEl.getBoundingClientRect();
  const containerRect = containerEl?.getBoundingClientRect() ?? editorRect;
  const contentRect = editor.view.dom.getBoundingClientRect();

  const midpoint = blockRect.top + blockRect.height / 2;
  const placeAfter = y >= midpoint;
  const yPos = (placeAfter ? blockRect.bottom : blockRect.top) - containerRect.top;

  return {
    position: {
      x: contentRect.left - containerRect.left,
      y: yPos,
      width: contentRect.width,
    },
    targetPos: blockPos,
    targetPlace: placeAfter ? "after" : "before",
  };
}
