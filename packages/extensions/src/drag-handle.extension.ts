import { Extension } from "@tiptap/core";
import { DragHandlePlugin, normalizeNestedOptions } from "@tiptap/extension-drag-handle";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";
import type { TransactionCommandPayload } from "./types/extension.types";

/**
 * Options for the DragHandle extension
 */
export interface DragHandleExtensionOptions {
  /** Called when the hovered block node changes. Fires with null when no block is hovered. */
  readonly onNodeChange?: (data: { node: ProseMirrorNode | null; editor: Editor; pos: number }) => void;
  /** Called when a drag operation starts on the handle element. */
  readonly onElementDragStart?: (e: DragEvent) => void;
  /** Called when a drag operation ends on the handle element. */
  readonly onElementDragEnd?: (e: DragEvent) => void;
}

/**
 * Framework-agnostic TipTap extension for drag-handle block reordering.
 *
 * Wraps @tiptap/extension-drag-handle's DragHandlePlugin to expose:
 * - `onNodeChange` callback for tracking the hovered block node
 * - `onElementDragStart` / `onElementDragEnd` callbacks for drag lifecycle events
 * - `moveBlock(fromPos, toPos)` command for programmatic block reordering
 *
 * This extension has zero Angular or React imports and is safe to use
 * in any framework adapter.
 *
 * @example
 * ```typescript
 * const editor = new Editor({
 *   extensions: [
 *     DragHandleExtension.configure({
 *       onNodeChange: ({ node, editor, pos }) => {
 *         console.log("Hovered node:", node?.type.name, "at pos:", pos);
 *       },
 *     }),
 *   ],
 * });
 *
 * // Move the first block to after the second block
 * editor.commands.moveBlock(0, 15);
 * ```
 */
export const DragHandleExtension = Extension.create<DragHandleExtensionOptions>({
  name: "dragHandle",

  addOptions() {
    return {
      onNodeChange: undefined,
      onElementDragStart: undefined,
      onElementDragEnd: undefined,
    };
  },

  addProseMirrorPlugins() {
    // Create a stub element — the plugin requires an element for positioning
    // Framework adapters (React, Angular) will replace this with a real handle element
    const element = document.createElement("div");

    const { plugin } = DragHandlePlugin({
      editor: this.editor,
      element,
      onNodeChange: this.options.onNodeChange,
      onElementDragStart: this.options.onElementDragStart,
      onElementDragEnd: this.options.onElementDragEnd,
      nestedOptions: normalizeNestedOptions(false),
    });

    return [plugin];
  },

  addCommands() {
    return {
      /**
       * Moves a block node from one position to another.
       *
       * Uses ProseMirror transaction delete + position remapping + insert to
       * correctly reposition the block, accounting for position shifts caused
       * by the delete operation.
       *
       * @param fromPos - The start position of the node to move
       * @param toPos - The target position where the node should be inserted
       * @returns True if the move was dispatched, false if the operation is invalid
       *
       * @example
       * ```typescript
       * // Move first paragraph to after the second paragraph
       * editor.commands.moveBlock(0, 15);
       * ```
       */
      moveBlock:
        (fromPos: number, toPos: number) =>
        ({ tr, state, dispatch }: TransactionCommandPayload): boolean => {
          // Guard: fromPos must be within document bounds before calling nodeAt
          // (nodeAt throws RangeError for out-of-bounds positions)
          if (fromPos < 0 || fromPos >= state.doc.content.size) return false;
          const node = state.doc.nodeAt(fromPos);
          if (!node) return false;

          // Guard: no-op when source and target are the same
          if (fromPos === toPos) return false;

          // Guard: target must be within document bounds
          if (toPos < 0 || toPos > state.doc.content.size) return false;

          // Delete the node from its current position
          tr.delete(fromPos, fromPos + node.nodeSize);

          // Remap the target position to account for the deletion
          const mappedTo = tr.mapping.map(toPos);

          // Insert the node at the remapped target position
          tr.insert(mappedTo, node);

          if (dispatch) {
            dispatch(tr.scrollIntoView());
            return true;
          }

          return false;
        },
    } as Record<string, unknown>;
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
