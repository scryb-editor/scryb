import { Extension } from "@tiptap/core";
import { StepMap } from "@tiptap/pm/transform";
import type { TransactionCommandPayload } from "./types/extension.types";

/**
 * The `moveBlock` command: moves the node at `fromPos` so it starts at
 * `toPos` (a position in the document before the move).
 *
 * Shared by BlockMoveExtension, which every Scryb editor registers, and
 * DragHandleExtension, which has always exposed it. A selection inside the
 * moved node moves with it, so repeating a keyboard move keeps acting on the
 * same block.
 *
 * @param fromPos - Position before the node to move
 * @param toPos - Insertion position, before the move
 * @returns The command
 */
export function moveBlockCommand(fromPos: number, toPos: number) {
  return ({ tr, state, dispatch }: TransactionCommandPayload): boolean => {
    if (fromPos < 0 || fromPos >= state.doc.content.size) return false;
    const node = state.doc.nodeAt(fromPos);
    if (!node) return false;
    if (fromPos === toPos) return false;
    if (toPos < 0 || toPos > state.doc.content.size) return false;

    const { selection } = tr;
    const end = fromPos + node.nodeSize;
    tr.delete(fromPos, end);
    const mappedTo = tr.mapping.map(toPos);
    tr.insert(mappedTo, node);

    // A selection inside the moved node moves with it, whatever its kind
    // (text, node, or a table's CellSelection): offsetting it and letting the
    // selection class map itself keeps its type and its cells.
    if (selection.from >= fromPos && selection.to <= end) {
      tr.setSelection(selection.map(tr.doc, StepMap.offset(mappedTo - fromPos)));
    }

    if (dispatch) {
      dispatch(tr.scrollIntoView());
      return true;
    }
    return false;
  };
}

/**
 * Registers `moveBlock` on every editor, so keyboard reordering works whether
 * or not the drag handle is mounted.
 */
export const BlockMoveExtension = Extension.create({
  name: "scrybBlockMove",
  addCommands() {
    return { moveBlock: moveBlockCommand } as Record<string, unknown>;
  },
});

/**
 * Type augmentation for TipTap commands.
 *
 * Note: @tiptap/extension-drag-handle already declares a `dragHandle` namespace
 * with lockDragHandle, unlockDragHandle, toggleDragHandle. We cannot redeclare
 * the same interface property with a different type (TypeScript TS2717). Instead,
 * moveBlock is registered under the `dragHandleBlock` namespace to avoid the
 * type conflict while keeping the command accessible as editor.commands.moveBlock.
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    dragHandleBlock: {
      /**
       * Moves a block node from one position to another.
       * Uses tr.delete + tr.mapping.map + tr.insert for correct position remapping.
       *
       * @param fromPos - The start position of the node to move
       * @param toPos - The target insertion position (before remapping)
       */
      moveBlock: (fromPos: number, toPos: number) => ReturnType;
    };
  }
}
