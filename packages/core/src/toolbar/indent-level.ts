import type { Editor } from "@tiptap/core";

/** Pixels per indent level — IndentExtension's DEFAULT_INDENT_CONFIG.step. */
export const INDENT_STEP_PX = 30;

/**
 * Indent level (0-based steps) of the block holding the selection start.
 *
 * @param editor - Editor with IndentExtension
 * @returns Level, e.g. 2 for an `indent` attribute of 60
 * @example currentIndentLevel(editor) // 0
 */
export function currentIndentLevel(editor: Editor): number {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const indent = $from.node(depth).attrs["indent"] as number | undefined;
    if (indent !== undefined) return Math.round((indent || 0) / INDENT_STEP_PX);
  }
  return 0;
}
