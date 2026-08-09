import { Extension } from "@tiptap/core";
import type { Transaction } from "prosemirror-state";
import type { TransactionCommandPayload } from "./types/extension.types";

/**
 * Node types that support block background color
 */
export const BLOCK_BACKGROUND_NODE_TYPES = ["paragraph", "heading", "blockquote"] as const;
type BlockBackgroundNodeType = (typeof BLOCK_BACKGROUND_NODE_TYPES)[number];

/**
 * Checks if a node type supports block background color
 *
 * Exported so a menu can ask whether a colour entry would do anything on the
 * block it is about to be drawn over, rather than duplicating this list and
 * drifting from it.
 *
 * @param nodeTypeName - The node type name to check
 * @returns True if the node type supports block background
 */
export function isBlockBackgroundNode(nodeTypeName: string): nodeTypeName is BlockBackgroundNodeType {
  return BLOCK_BACKGROUND_NODE_TYPES.includes(nodeTypeName as BlockBackgroundNodeType);
}

/**
 * Node update entry for batch processing
 */
interface NodeUpdate {
  readonly pos: number;
  readonly backgroundColor: string | null;
}

/**
 * Collects nodes that need background color updates within selection
 * @param tr - Transaction to read from
 * @param color - The background color to set (null to unset)
 * @returns Array of node updates to apply
 */
function collectBackgroundUpdates(
  tr: Transaction,
  color: string | null
): readonly NodeUpdate[] {
  const { doc, selection } = tr;
  if (!selection || !doc) return [];

  const { from, to } = selection;
  const updates: NodeUpdate[] = [];

  doc.nodesBetween(from, to, (node, pos) => {
    if (!isBlockBackgroundNode(node.type.name)) return;

    const currentColor = (node.attrs["backgroundColor"] as string | null) || null;

    if (currentColor !== color) {
      updates.push({ pos, backgroundColor: color });
    }
  });

  return updates;
}

/**
 * Applies background color updates to the transaction
 * Updates are applied in reverse order to maintain correct positions
 * @param tr - Transaction to modify
 * @param updates - Node updates to apply
 * @returns Modified transaction
 */
function applyBackgroundUpdates(
  tr: Transaction,
  updates: readonly NodeUpdate[]
): Transaction {
  // Apply updates in reverse order to maintain correct positions
  [...updates].reverse().forEach(({ pos, backgroundColor }) => {
    const node = tr.doc.nodeAt(pos);
    if (node) {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        backgroundColor,
      });
    }
  });

  return tr;
}

/**
 * Updates background color for nodes in the current selection
 * @param tr - Transaction to modify
 * @param color - The background color to set (null to unset)
 * @returns Modified transaction
 */
function updateBlockBackground(
  tr: Transaction,
  color: string | null
): Transaction {
  const updates = collectBackgroundUpdates(tr, color);
  return applyBackgroundUpdates(tr, updates);
}

/**
 * TipTap extension for block-level background colors
 *
 * Adds backgroundColor attribute to paragraph, heading, and blockquote nodes.
 * The attribute renders as an inline style: style="background-color: [value]"
 *
 * Provides commands:
 * - setBlockBackground(color: string): Sets the background color for selected blocks
 * - unsetBlockBackground(): Removes the background color from selected blocks
 *
 * @example
 * ```typescript
 * // Set background color
 * editor.commands.setBlockBackground('#ffeb3b');
 *
 * // Remove background color
 * editor.commands.unsetBlockBackground();
 * ```
 */
export const BlockBackgroundExtension = Extension.create({
  name: "blockBackground",

  addGlobalAttributes() {
    return [
      {
        types: [...BLOCK_BACKGROUND_NODE_TYPES],
        attributes: {
          backgroundColor: {
            default: null,
            renderHTML: (attributes: Record<string, unknown>) => {
              const backgroundColor = attributes["backgroundColor"] as string | null;
              if (!backgroundColor) {
                return {};
              }
              return {
                style: `background-color: ${backgroundColor}`,
              };
            },
            // Returns the VALUE, not `{ backgroundColor: value }`. Tiptap
            // assigns the return straight onto the attribute, so the object
            // form stored `{ backgroundColor: null }` — truthy — on every
            // parsed block: `renderHTML` then emitted
            // `background-color: [object Object]`, which the browser discards,
            // leaving the empty `style=""` that showed up on all 50 blocks in
            // the demo's HTML output. Block backgrounds were also lost on any
            // HTML round trip.
            parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setBlockBackground:
        (color: string) =>
        ({ tr, state, dispatch }: TransactionCommandPayload): boolean => {
          const { selection } = state;
          const newTr = tr.setSelection(selection);
          const updatedTr = updateBlockBackground(newTr, color);

          if (updatedTr.docChanged && dispatch) {
            dispatch(updatedTr);
            return true;
          }

          return false;
        },
      unsetBlockBackground:
        () =>
        ({ tr, state, dispatch }: TransactionCommandPayload): boolean => {
          const { selection } = state;
          const newTr = tr.setSelection(selection);
          const updatedTr = updateBlockBackground(newTr, null);

          if (updatedTr.docChanged && dispatch) {
            dispatch(updatedTr);
            return true;
          }

          return false;
        },
    } as Record<string, unknown>;
  },
});

/**
 * Type augmentation for TipTap commands
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    blockBackground: {
      /**
       * Sets the background color for selected blocks
       * @param color - The background color value (hex, rgb, etc.)
       */
      setBlockBackground: (color: string) => ReturnType;
      /**
       * Removes the background color from selected blocks
       */
      unsetBlockBackground: () => ReturnType;
    };
  }
}
