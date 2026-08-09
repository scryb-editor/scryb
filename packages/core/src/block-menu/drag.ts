import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

// =============================================================================
// Block Move
// =============================================================================

/**
 * Executes a block reorder transaction in the ProseMirror document.
 *
 * Uses tr.delete + tr.insert + TextSelection + addToHistory meta — the same
 * pattern used by both Angular's handleBlockDrop and React's executeBlockDrop.
 * Does NOT use editor.commands.moveBlock, which lacks TextSelection + addToHistory.
 *
 * @param editor - The active Tiptap editor instance
 * @param sourcePos - ProseMirror position of the source block (start of node)
 * @param targetPos - ProseMirror position of the target block (start of node)
 * @param place - Whether to insert "before" or "after" the target block
 * @returns true if the transaction was dispatched, false if it was a no-op
 */
export function executeBlockMove(
  editor: Editor,
  sourcePos: number,
  targetPos: number,
  place: "before" | "after",
): boolean {
  const { state, view } = editor;

  const source$pos = state.doc.resolve(sourcePos);
  const target$pos = state.doc.resolve(targetPos);
  const sourceNode = source$pos.nodeAfter;
  const targetNode = target$pos.nodeAfter;

  if (!sourceNode || !targetNode) return false;

  const sourceEnd = sourcePos + sourceNode.nodeSize;
  const insertPos = place === "after"
    ? targetPos + targetNode.nodeSize
    : targetPos;

  // No-op if dropping onto the same block
  if (targetPos === sourcePos) return false;
  // No-op if drop position is within source block bounds
  if (insertPos >= sourcePos && insertPos <= sourceEnd) return false;

  // Adjust insertion position to account for the deletion shift
  let adjustedInsertPos = insertPos;
  if (sourcePos < insertPos) {
    adjustedInsertPos = insertPos - sourceNode.nodeSize;
  }

  const tr = state.tr;
  tr.delete(sourcePos, sourceEnd);
  tr.insert(adjustedInsertPos, sourceNode.copy(sourceNode.content));

  const selectionPos = Math.min(adjustedInsertPos + 1, tr.doc.content.size);
  tr.setSelection(TextSelection.create(tr.doc, selectionPos));
  tr.setMeta("addToHistory", true);
  view.dispatch(tr.scrollIntoView());

  return true;
}
