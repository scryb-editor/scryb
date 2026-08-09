import { Extension } from "@tiptap/core";
import type { Transaction } from "prosemirror-state";
import type { TransactionCommandPayload } from "./types/extension.types";

/**
 * Node types that carry a line height.
 *
 * Paragraph and heading are enough to cover the whole document: list items,
 * blockquotes and table cells all hold paragraphs, and it is those paragraphs
 * a selection walks over.
 */
const LINE_HEIGHT_NODE_TYPES = ["paragraph", "heading"] as const;
type LineHeightNodeType = (typeof LINE_HEIGHT_NODE_TYPES)[number];

/**
 * Checks whether a node type carries a line height
 * @param nodeTypeName - The node type name to check
 * @returns True if the node type accepts a line height attribute
 */
function isLineHeightNode(nodeTypeName: string): nodeTypeName is LineHeightNodeType {
  return LINE_HEIGHT_NODE_TYPES.includes(nodeTypeName as LineHeightNodeType);
}

/**
 * Reads a line height left behind by the pre-node versions of this extension,
 * which wrote it onto a `textStyle` span inside the block.
 *
 * Those spans render nothing useful — an inline box cannot pull a line box
 * below the block's own strut — but documents saved with them still exist, and
 * lifting the value onto the block is what the author meant all along.
 *
 * @param element - The block element being parsed
 * @returns The legacy line height, or null when the block has none
 */
function readLegacyLineHeight(element: HTMLElement): string | null {
  const span = element.querySelector<HTMLElement>("span[style*='line-height']");
  return span?.style.lineHeight || null;
}

/**
 * Collects the positions of blocks in the selection whose line height changes
 * @param tr - Transaction to read from
 * @param lineHeight - The line height to apply, or null to clear it
 * @returns Positions of the blocks that need updating
 */
function collectLineHeightUpdates(
  tr: Transaction,
  lineHeight: string | null
): readonly number[] {
  const { doc, selection } = tr;
  if (!selection || !doc) return [];

  const { from, to } = selection;
  const positions: number[] = [];

  doc.nodesBetween(from, to, (node, pos) => {
    if (!isLineHeightNode(node.type.name)) return;
    const current = (node.attrs["lineHeight"] as string | null) ?? null;
    if (current === lineHeight) return;
    positions.push(pos);
  });

  return positions;
}

/**
 * Writes the line height onto the collected blocks
 * Updates are applied in reverse order to keep the earlier positions valid
 * @param tr - Transaction to modify
 * @param positions - Positions of the blocks to update
 * @param lineHeight - The line height to apply, or null to clear it
 * @returns Modified transaction
 */
function applyLineHeightUpdates(
  tr: Transaction,
  positions: readonly number[],
  lineHeight: string | null
): Transaction {
  [...positions].reverse().forEach((pos) => {
    const node = tr.doc.nodeAt(pos);
    if (node) {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        lineHeight,
      });
    }
  });

  return tr;
}

/**
 * Creates a command that writes one line height across the selected blocks
 * @param lineHeight - The line height to write, or null to clear it
 * @returns Command handler function
 */
function createLineHeightCommand(lineHeight: string | null) {
  return ({ tr, state, dispatch }: TransactionCommandPayload): boolean => {
    const nextTr = tr.setSelection(state.selection);
    const positions = collectLineHeightUpdates(nextTr, lineHeight);
    if (positions.length === 0) return false;

    const updatedTr = applyLineHeightUpdates(nextTr, positions, lineHeight);
    if (dispatch) dispatch(updatedTr);
    return true;
  };
}

/**
 * TipTap extension for line-height, applied to whole blocks
 *
 * Line height is a block property, not an inline one. Written onto a span the
 * value is silently capped by the block's strut — an anonymous inline box
 * carrying the block's own font-size and line-height — so anything below the
 * stylesheet's line height renders identically to it. Written onto the
 * paragraph or heading it simply wins, which is what every editor a user has
 * met (Word, Docs, Notion) does with the same control.
 *
 * Values may be unitless (1.5), a percentage (150%) or carry a unit (24px);
 * the original format is preserved on the way out.
 *
 * Provides commands:
 * - setLineHeight(lineHeight: string): Sets the line height for the selected blocks
 * - unsetLineHeight(): Restores the stylesheet's line height
 *
 * @example
 * ```typescript
 * // Set line height with unitless value
 * editor.commands.setLineHeight('1.5');
 *
 * // Set line height with unit
 * editor.commands.setLineHeight('24px');
 *
 * // Remove line height
 * editor.commands.unsetLineHeight();
 * ```
 */
export const LineHeightExtension = Extension.create({
  name: "lineHeight",

  addGlobalAttributes() {
    return [
      {
        types: [...LINE_HEIGHT_NODE_TYPES],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (element: HTMLElement) =>
              element.style.lineHeight || readLegacyLineHeight(element),
            renderHTML: (attributes: Record<string, unknown>) => {
              const lineHeight = attributes["lineHeight"];
              if (!lineHeight || typeof lineHeight !== "string") {
                return {};
              }
              return {
                style: `line-height: ${lineHeight}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLineHeight: (lineHeight: string) => createLineHeightCommand(lineHeight),
      unsetLineHeight: () => createLineHeightCommand(null),
    } as Record<string, unknown>;
  },
});

/**
 * Type augmentation for TipTap commands
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    lineHeight: {
      /**
       * Sets the line height for the blocks in the selection
       * @param lineHeight - The line height value (unitless, percentage, or with unit)
       */
      setLineHeight: (lineHeight: string) => ReturnType;
      /**
       * Removes the line height from the blocks in the selection
       */
      unsetLineHeight: () => ReturnType;
    };
  }
}
