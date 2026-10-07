import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Fragment } from "@tiptap/pm/model";
import { getCaretBlock } from "./caret";

export type BlockMoveDirection = "up" | "down";

/** Platform-neutral; rendered by formatShortcut / ariaKeyShortcut. */
export const MOVE_BLOCK_UP_SHORTCUT = "Mod+Shift+ArrowUp";
export const MOVE_BLOCK_DOWN_SHORTCUT = "Mod+Shift+ArrowDown";

/**
 * Where `moveBlock` must insert the block at `pos` to swap it with its
 * previous or next sibling.
 *
 * @param editor - The editor
 * @param pos - Position before the block
 * @param direction - Which sibling to swap with
 * @returns The `toPos` for moveBlock, or null when there is no sibling that way
 */
export function getBlockMoveTarget(editor: Editor, pos: number, direction: BlockMoveDirection): number | null {
  const { doc } = editor.state;
  if (pos < 0 || pos >= doc.content.size) return null;
  const $pos = doc.resolve(pos);
  const node = $pos.nodeAfter;
  if (!node) return null;
  const index = $pos.index();
  const parent = $pos.parent;
  const otherIndex = direction === "up" ? index - 1 : index + 1;
  if (otherIndex < 0 || otherIndex >= parent.childCount) return null;
  const other = parent.child(otherIndex);

  // The swap must leave a parent its schema accepts as is. A list or task
  // item is `paragraph block*`: moving its leading paragraph below its sublist
  // would make ProseMirror fill the gap with an empty paragraph instead.
  const first = Math.min(index, otherIndex);
  const swapped = Fragment.from(direction === "up" ? [node, other] : [other, node]);
  if (!parent.canReplace(first, first + 2, swapped)) return null;

  return direction === "up" ? pos - other.nodeSize : pos + node.nodeSize + other.nodeSize;
}

/**
 * Moves the block at `pos` one place, through the `moveBlock` command.
 *
 * Not executeBlockMove (drag.ts): that is the pointer drop path, while the
 * spec routes keyboard and menu moves through `moveBlock`, which carries the
 * caret with the block so repeated presses keep moving the same one.
 *
 * @param editor - The editor
 * @param pos - Position before the block, as the block menu resolved it
 * @param direction - Up or down
 * @returns true when the block moved
 */
export function moveBlockAtPos(editor: Editor, pos: number | null, direction: BlockMoveDirection): boolean {
  // `editable: false` blocks typing, not a programmatic dispatch.
  if (!editor.isEditable || pos === null) return false;
  const target = getBlockMoveTarget(editor, pos, direction);
  if (target === null) return false;
  return editor.chain().focus().moveBlock(pos, target).run();
}

/**
 * Moves the caret's block, resolved exactly as the block menu resolves it.
 *
 * @param editor - The editor
 * @param direction - Up or down
 * @returns true when the block moved
 */
export function moveCaretBlock(editor: Editor, direction: BlockMoveDirection): boolean {
  const block = getCaretBlock(editor);
  return block ? moveBlockAtPos(editor, block.pos, direction) : false;
}

/** Mod+Shift+ArrowUp/Down: reorder without dragging (WCAG 2.5.7). */
export const BlockMoveShortcutsExtension = Extension.create({
  name: "scrybBlockMoveShortcuts",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-ArrowUp": () => moveCaretBlock(this.editor, "up"),
      "Mod-Shift-ArrowDown": () => moveCaretBlock(this.editor, "down"),
    };
  },
});
