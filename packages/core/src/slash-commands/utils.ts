import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import type { SlashCommandItem } from "./types";

/**
 * Inserts a new paragraph node at `pos`, sets the cursor inside it,
 * dispatches the transaction, focuses the editor, then executes the
 * slash command after `delayMs` milliseconds.
 *
 * This is the canonical "insert after block" transaction sequence used
 * when a slash command is selected via the "+" side menu button rather
 * than by typing "/". Both Angular and React adapters import this function —
 * no adapter-local copy is permitted.
 *
 * @param editor - The active Tiptap editor instance.
 * @param pos - Document position at which to insert the new paragraph.
 * @param command - The slash command item whose `command` function will be called.
 * @param delayMs - Milliseconds to wait before executing the command (default: SLASH_COMMAND_EXECUTE_DELAY_MS = 10).
 *
 * @example
 * insertBlockAndExecute(editor, insertAfterPos, selectedItem, SLASH_COMMAND_EXECUTE_DELAY_MS);
 */
export function insertBlockAndExecute(
  editor: Editor,
  pos: number,
  command: SlashCommandItem,
  delayMs: number,
): void {
  const { tr } = editor.state;
  const paragraphNode = editor.schema.nodes["paragraph"].create();
  tr.insert(pos, paragraphNode);
  const newParagraphPos = pos + 1;
  tr.setSelection(TextSelection.create(tr.doc, newParagraphPos));
  editor.view.dispatch(tr);
  editor.view.focus();
  setTimeout(() => {
    command.command(editor);
  }, delayMs);
}
