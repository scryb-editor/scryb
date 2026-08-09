import { Extension } from "@tiptap/core";
import type { Transaction } from "prosemirror-state";
import type { IndentConfig, TransactionCommandPayload } from "./types/extension.types";

/**
 * Default indent configuration
 * Following Open/Closed Principle - configurable values
 */
const DEFAULT_INDENT_CONFIG: IndentConfig = {
  min: 0,
  max: 210,
  step: 30,
} as const;

/** Node types that support indentation */
const INDENTABLE_NODE_TYPES = ["paragraph", "listItem", "heading", "blockquote"] as const;
type IndentableNodeType = (typeof INDENTABLE_NODE_TYPES)[number];

/**
 * Checks if a node type supports indentation
 * @param nodeTypeName - The node type name to check
 * @returns True if the node type is indentable
 */
function isIndentableNode(nodeTypeName: string): nodeTypeName is IndentableNodeType {
  return INDENTABLE_NODE_TYPES.includes(nodeTypeName as IndentableNodeType);
}

/**
 * Calculates new indent level within bounds
 * @param currentIndent - Current indent value
 * @param delta - Change in indent (positive or negative)
 * @param config - Indent configuration
 * @returns New indent value clamped within bounds
 */
function calculateNewIndent(
  currentIndent: number,
  delta: number,
  config: IndentConfig
): number {
  return Math.max(config.min, Math.min(config.max, currentIndent + delta));
}

/**
 * Node update entry for batch processing
 */
interface NodeUpdate {
  readonly pos: number;
  readonly indent: number;
}

/**
 * Collects nodes that need indent updates within selection
 * @param tr - Transaction to read from
 * @param delta - Indent change amount
 * @param config - Indent configuration
 * @returns Array of node updates to apply
 */
function collectIndentUpdates(
  tr: Transaction,
  delta: number,
  config: IndentConfig
): readonly NodeUpdate[] {
  const { doc, selection } = tr;
  if (!selection || !doc) return [];

  const { from, to } = selection;
  const updates: NodeUpdate[] = [];

  doc.nodesBetween(from, to, (node, pos) => {
    if (!isIndentableNode(node.type.name)) return;

    const currentIndent = (node.attrs["indent"] as number) || 0;
    const newIndent = calculateNewIndent(currentIndent, delta, config);

    if (newIndent !== currentIndent) {
      updates.push({ pos, indent: newIndent });
    }
  });

  return updates;
}

/**
 * Applies indent updates to the transaction
 * Updates are applied in reverse order to maintain correct positions
 * @param tr - Transaction to modify
 * @param updates - Node updates to apply
 * @returns Modified transaction
 */
function applyIndentUpdates(
  tr: Transaction,
  updates: readonly NodeUpdate[]
): Transaction {
  // Apply updates in reverse order to maintain correct positions
  [...updates].reverse().forEach(({ pos, indent }) => {
    const node = tr.doc.nodeAt(pos);
    if (node) {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        indent,
      });
    }
  });

  return tr;
}

/**
 * Updates indent level for nodes in the current selection
 * @param tr - Transaction to modify
 * @param delta - Amount to change indent (positive for indent, negative for outdent)
 * @param config - Indent configuration
 * @returns Modified transaction
 */
function updateIndentLevel(
  tr: Transaction,
  delta: number,
  config: IndentConfig = DEFAULT_INDENT_CONFIG
): Transaction {
  const updates = collectIndentUpdates(tr, delta, config);
  return applyIndentUpdates(tr, updates);
}

/**
 * Creates an indent command handler
 * @param delta - Indent change amount
 * @returns Command handler function
 */
function createIndentCommand(delta: number) {
  return () =>
    ({ tr, state, dispatch }: TransactionCommandPayload): boolean => {
      const { selection } = state;
      const newTr = tr.setSelection(selection);
      const updatedTr = updateIndentLevel(newTr, delta);

      if (updatedTr.docChanged && dispatch) {
        dispatch(updatedTr);
        return true;
      }

      return false;
    };
}

/**
 * TipTap extension for paragraph and list item indentation
 *
 * Provides commands:
 * - indent(): Increases indentation by one step
 * - outdent(): Decreases indentation by one step
 *
 * Keyboard shortcuts:
 * - Tab: indent
 * - Shift-Tab: outdent
 *
 * @example
 * ```typescript
 * // Indent selected content
 * editor.commands.indent();
 *
 * // Outdent selected content
 * editor.commands.outdent();
 * ```
 */
export const IndentExtension = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: [...INDENTABLE_NODE_TYPES],
        attributes: {
          indent: {
            default: 0,
            renderHTML: (attributes: Record<string, unknown>) => {
              const indent = attributes["indent"] as number;
              if (!indent || indent === 0) {
                return {};
              }
              return {
                style: `margin-left: ${indent}px !important;`,
              };
            },
            // Returns the VALUE, not `{ indent: value }`. Tiptap assigns whatever
            // comes back straight onto the attribute, so the object form stored
            // `indent: { indent: 30 }`: indentation was lost on every HTML round
            // trip, and `renderHTML`'s falsy check let an object through as
            // truthy, emitting `style="margin-left: [object Object]px"` — which
            // the browser drops, leaving the empty `style=""` on every block.
            parseHTML: (element: HTMLElement) => {
              const marginLeft = element.style.marginLeft;
              if (!marginLeft) return 0;

              return parseInt(marginLeft.replace("px", ""), 10) || 0;
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      indent: createIndentCommand(DEFAULT_INDENT_CONFIG.step),
      outdent: createIndentCommand(-DEFAULT_INDENT_CONFIG.step),
    } as Record<string, unknown>;
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => (this.editor.commands as { indent: () => boolean }).indent(),
      "Shift-Tab": () =>
        (this.editor.commands as { outdent: () => boolean }).outdent(),
    };
  },
});

/**
 * Type augmentation for TipTap commands
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      /**
       * Increases indentation for selected paragraphs/list items
       */
      indent: () => ReturnType;
      /**
       * Decreases indentation for selected paragraphs/list items
       */
      outdent: () => ReturnType;
    };
  }
}
