import { Extension } from "@tiptap/core";
import { DragHandlePlugin, normalizeNestedOptions } from "@tiptap/extension-drag-handle";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/core";
import { moveBlockCommand } from "./block-move.extension";

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
    // Same command BlockMoveExtension registers; both are the one function, so
    // whichever Tiptap keeps when both are present behaves identically.
    return { moveBlock: moveBlockCommand } as Record<string, unknown>;
  },
});
