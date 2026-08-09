import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { TransactionCommandPayload } from "./types/extension.types";

/**
 * Plugin key for the block-menu target decoration. Holds the position of the
 * block the block-context menu is currently acting on, or null.
 */
const BLOCK_MENU_TARGET_KEY = new PluginKey<number | null>("scrybBlockMenuTarget");

/** Transaction meta carrying the new target position (or null to clear). */
interface BlockMenuTargetMeta {
  readonly pos: number | null;
}

/**
 * Marks the block the block-context menu acts on with
 * `data-block-menu-active="true"`, styled by themes.
 *
 * The menu is a list of verbs ("Delete", "Duplicate") and the pointer has to
 * leave the block to reach it, so without the mark nothing on screen says what
 * they apply to.
 *
 * A decoration rather than an attribute the adapters set on the block element:
 * opening the menu dispatches a transaction, ProseMirror redraws the paragraph,
 * and an attribute set on the old element goes out with it. Decorations are
 * re-applied on every redraw. Not a `NodeSelection` either — that would displace
 * the caret and have to be restored on close, and the menu's actions already
 * carry the block position.
 *
 * Framework-agnostic: both adapters drive it through `setBlockMenuTarget`.
 *
 * @example
 * ```typescript
 * // Mark the block at position 12 while its menu is open
 * editor.commands.setBlockMenuTarget(12);
 * // Clear on close
 * editor.commands.setBlockMenuTarget(null);
 * ```
 */
export const BlockMenuTargetExtension = Extension.create({
  name: "scrybBlockMenuTarget",

  addProseMirrorPlugins() {
    return [
      new Plugin<number | null>({
        key: BLOCK_MENU_TARGET_KEY,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(BLOCK_MENU_TARGET_KEY) as BlockMenuTargetMeta | undefined;
            if (meta) return meta.pos;
            // Keep the mark glued to its block while the document edits around it.
            return value === null ? null : tr.mapping.map(value);
          },
        },
        props: {
          decorations(state) {
            const pos = BLOCK_MENU_TARGET_KEY.getState(state);
            if (pos === null || pos === undefined) return null;
            if (pos < 0 || pos >= state.doc.content.size) return null;

            // `resolve(pos).nodeAfter`, not `doc.nodeAt(pos)`: nodeAt descends
            // and returns a descendant (the text node inside a paragraph) when
            // pos is not a node boundary, which makes the range below describe
            // no real node — DecorationSet.create then drops it silently.
            // nodeAfter is null in that case, so the wash simply does not
            // render. Reachable after tr.mapping.map lands mid-node.
            const node = state.doc.resolve(pos).nodeAfter;
            if (!node) return null;

            return DecorationSet.create(state.doc, [
              Decoration.node(pos, pos + node.nodeSize, { "data-block-menu-active": "true" }),
            ]);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      /**
       * Marks a block as the block-context menu's target, or clears the mark.
       *
       * The transaction carries no document change and opts out of history, so
       * opening a menu never lands in the undo stack or moves the caret.
       *
       * @param pos - Start position of the block to mark, or null to clear
       * @returns True once the meta is dispatched
       */
      setBlockMenuTarget:
        (pos: number | null) =>
        ({ tr, dispatch }: TransactionCommandPayload): boolean => {
          if (dispatch) {
            const meta: BlockMenuTargetMeta = { pos };
            dispatch(tr.setMeta(BLOCK_MENU_TARGET_KEY, meta).setMeta("addToHistory", false));
          }
          return true;
        },
    } as Record<string, unknown>;
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    scrybBlockMenuTarget: {
      /**
       * Marks a block as the block-context menu's target so it renders with
       * `data-block-menu-active="true"`, or clears the mark with null.
       *
       * @param pos - Start position of the block to mark, or null to clear
       */
      setBlockMenuTarget: (pos: number | null) => ReturnType;
    };
  }
}
