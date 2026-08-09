import { Extension, markInputRule, nodeInputRule } from "@tiptap/core";

/**
 * MarkdownAutoformatExtension
 *
 * Provides Markdown-style input shortcuts for common formatting.
 * Uses Tiptap's `markInputRule` and `nodeInputRule` helpers to react to
 * typed patterns and convert them to their corresponding marks or nodes.
 *
 * Supported shortcuts:
 * - `**text**` → bold
 * - `*text*` → italic
 * - `~~text~~` → strikethrough
 * - `` `text` `` → code
 * - `# ` → heading level 1
 * - `## ` → heading level 2
 * - `### ` → heading level 3
 * - `> ` → blockquote
 * - `---` → horizontal rule
 * - `- ` or `* ` → bullet list
 * - `1. ` → ordered list
 *
 * @example
 * ```typescript
 * const editor = new Editor({
 *   extensions: [StarterKit, MarkdownAutoformatExtension],
 * });
 * ```
 */
export const MarkdownAutoformatExtension = Extension.create({
  name: "markdownAutoformat",

  addInputRules() {
    const schema = this.editor.schema;

    const rules = [];

    // ─── Mark input rules ───────────────────────────────────────────────────

    // **bold**
    if (schema.marks["bold"]) {
      rules.push(
        markInputRule({
          find: /(?:^|\s)\*\*([^*]+)\*\*$/,
          type: schema.marks["bold"],
        }),
      );
    }

    // *italic* (single asterisk, not double)
    if (schema.marks["italic"]) {
      rules.push(
        markInputRule({
          find: /(?:^|\s)\*([^*]+)\*$/,
          type: schema.marks["italic"],
        }),
      );
    }

    // ~~strike~~
    if (schema.marks["strike"]) {
      rules.push(
        markInputRule({
          find: /(?:^|\s)~~([^~]+)~~$/,
          type: schema.marks["strike"],
        }),
      );
    }

    // `code`
    if (schema.marks["code"]) {
      rules.push(
        markInputRule({
          find: /(?:^|\s)`([^`]+)`$/,
          type: schema.marks["code"],
        }),
      );
    }

    // ─── Node input rules ───────────────────────────────────────────────────

    // # Heading 1
    if (schema.nodes["heading"]) {
      rules.push(
        nodeInputRule({
          find: /^#\s$/,
          type: schema.nodes["heading"],
          getAttributes: () => ({ level: 1 }),
        }),
      );

      // ## Heading 2
      rules.push(
        nodeInputRule({
          find: /^##\s$/,
          type: schema.nodes["heading"],
          getAttributes: () => ({ level: 2 }),
        }),
      );

      // ### Heading 3
      rules.push(
        nodeInputRule({
          find: /^###\s$/,
          type: schema.nodes["heading"],
          getAttributes: () => ({ level: 3 }),
        }),
      );
    }

    // > Blockquote
    if (schema.nodes["blockquote"]) {
      rules.push(
        nodeInputRule({
          find: /^>\s$/,
          type: schema.nodes["blockquote"],
        }),
      );
    }

    // --- Horizontal rule
    if (schema.nodes["horizontalRule"]) {
      rules.push(
        nodeInputRule({
          find: /^---$/,
          type: schema.nodes["horizontalRule"],
        }),
      );
    }

    // - or * Bullet list
    if (schema.nodes["bulletList"]) {
      rules.push(
        nodeInputRule({
          find: /^[-*]\s$/,
          type: schema.nodes["bulletList"],
        }),
      );
    }

    // 1. Ordered list
    if (schema.nodes["orderedList"]) {
      rules.push(
        nodeInputRule({
          find: /^1\.\s$/,
          type: schema.nodes["orderedList"],
        }),
      );
    }

    return rules;
  },
});
