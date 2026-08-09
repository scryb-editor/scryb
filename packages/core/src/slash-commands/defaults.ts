import type { Editor } from "@tiptap/core";
import type { TiptapTranslations } from "../i18n/types";
import type { DetailsConfig, EmojiConfig, YouTubeConfig } from "../config/editor-config";
import type { SlashCommandItem } from "./types";
import type { ImageUploadConfig } from "../image/types";
import { selectAndInsertImage } from "../image/insert";

// =============================================================================
// DEFAULT SLASH COMMANDS
// =============================================================================

/**
 * English default slash command labels.
 * Private — not exported. Use defaultSlashCommands() to get the full list.
 */
const EN: TiptapTranslations["slashCommands"] = {
  menuLabel: "Commands",
  noResults: "No commands found",
  groups: { text: "Text", lists: "Lists", media: "Media", advanced: "Advanced" },
  heading1: { title: "Heading 1", description: "Large section heading", keywords: ["heading", "h1", "title", "1", "header"] },
  heading2: { title: "Heading 2", description: "Medium section heading", keywords: ["heading", "h2", "title", "2", "header"] },
  heading3: { title: "Heading 3", description: "Small section heading", keywords: ["heading", "h3", "title", "3", "header"] },
  bulletList: { title: "Bullet List", description: "Create a bullet list", keywords: ["bullet", "list", "ul", "unordered"] },
  orderedList: { title: "Ordered List", description: "Create an ordered list", keywords: ["ordered", "list", "ol", "numbered"] },
  taskList: { title: "Task List", description: "Create a checklist with interactive checkboxes", keywords: ["task", "todo", "checklist", "checkbox", "list"] },
  blockquote: { title: "Blockquote", description: "Add a blockquote", keywords: ["quote", "blockquote", "citation"] },
  code: { title: "Code Block", description: "Add a code block", keywords: ["code", "codeblock", "pre", "programming"] },
  image: { title: "Image", description: "Insert an image", keywords: ["image", "photo", "picture", "img"] },
  horizontalRule: { title: "Horizontal Rule", description: "Add a horizontal line", keywords: ["hr", "horizontal", "rule", "line", "separator"] },
  table: { title: "Table", description: "Insert a table", keywords: ["table", "grid", "data", "rows", "columns"] },
  youtube: { title: "YouTube video", description: "Embed a YouTube video", keywords: ["youtube", "video", "embed"] },
  emoji: { slash: { label: "Insert emoji", description: "Search and insert an emoji" } },
};

/**
 * Default English URL prompt string used by the YouTube slash command when no
 * localized override is provided via the `youtubeUrlPrompt` argument. Adapters
 * typically pass `i18n.translations.youtube.urlPrompt` so consumers see the
 * translated prompt.
 */
const EN_YOUTUBE_URL_PROMPT = "Enter YouTube URL";

/**
 * Default dimensions used when inserting a table via the slash command.
 * Exported so adapters can reference the same constant for UI hints.
 */
export const DEFAULT_TABLE_DIMENSIONS = { rows: 3, cols: 3 } as const;

/**
 * Returns the default slash command list, optionally overriding per-command labels
 * with translated strings from the consuming adapter.
 *
 * Replaces the previous static `defaultSlashCommands` array export. The function
 * signature is backward-compatible for adapters that import by name — they simply
 * need to call `defaultSlashCommands()` instead of using it as a value.
 *
 * @param translations - Optional partial translation override for slash command
 *   labels (title, description, keywords). Falls back to English for any key
 *   not provided. Accepts the `slashCommands` sub-tree of `TiptapTranslations`.
 * @param youtube - Opt-in YouTube config; the entry is listed only when `enabled`
 * @returns Array of SlashCommandItem instances:
 *   - Text group:     heading1, heading2, heading3, blockquote, code
 *   - Lists group:    bulletList, orderedList, taskList
 *   - Media group:    image (opens the file picker), youtube (opt-in)
 *   - Advanced group: horizontalRule, table
 *
 * @example
 * // English defaults
 * const commands = defaultSlashCommands();
 *
 * @example
 * // French override
 * const commands = defaultSlashCommands(frTranslations.slashCommands);
 */
export function defaultSlashCommands(
  translations?: Partial<TiptapTranslations["slashCommands"]>,
  youtubeUrlPrompt?: string,
  details?: DetailsConfig,
  emoji?: EmojiConfig,
  youtube?: YouTubeConfig,
  image?: { config?: ImageUploadConfig; onError?: (message: string) => void },
): SlashCommandItem[] {
  const t = { ...EN, ...translations };
  const urlPromptLabel = youtubeUrlPrompt ?? EN_YOUTUBE_URL_PROMPT;
  const items: SlashCommandItem[] = [
    // ─── Text group ──────────────────────────────────────────────────────────
    {
      title: t.heading1.title,
      description: t.heading1.description,
      icon: "format_h1",
      keywords: t.heading1.keywords,
      group: "text",
      command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      title: t.heading2.title,
      description: t.heading2.description,
      icon: "format_h2",
      keywords: t.heading2.keywords,
      group: "text",
      command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      title: t.heading3.title,
      description: t.heading3.description,
      icon: "format_h3",
      keywords: t.heading3.keywords,
      group: "text",
      command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      title: t.blockquote.title,
      description: t.blockquote.description,
      icon: "format_quote",
      keywords: t.blockquote.keywords,
      group: "text",
      command: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      title: t.code.title,
      description: t.code.description,
      icon: "code",
      keywords: t.code.keywords,
      group: "text",
      command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    // ─── Lists group ─────────────────────────────────────────────────────────
    {
      title: t.bulletList.title,
      description: t.bulletList.description,
      icon: "format_list_bulleted",
      keywords: t.bulletList.keywords,
      group: "lists",
      command: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      title: t.orderedList.title,
      description: t.orderedList.description,
      icon: "format_list_numbered",
      keywords: t.orderedList.keywords,
      group: "lists",
      command: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      title: t.taskList.title,
      description: t.taskList.description,
      icon: "checklist",
      keywords: t.taskList.keywords,
      group: "lists",
      // TaskList/TaskItem are registered by default (D-QW-03 table-stakes).
      // The command is narrowed through an index cast because the
      // @tiptap/extension-task-list module augmentation is not picked up
      // transitively through core's declaration build.
      command: (editor) =>
        (editor.chain().focus() as unknown as {
          toggleTaskList: () => { run: () => boolean };
        })
          .toggleTaskList()
          .run(),
    },
    // ─── Media group ─────────────────────────────────────────────────────────
    {
      title: t.image.title,
      description: t.image.description,
      icon: "image",
      keywords: t.image.keywords,
      group: "media",
      // Was an empty placeholder with a comment saying adapters would override
      // it. Neither did, so the entry sat in the menu doing nothing at all.
      // The picker lives in core now, so both adapters get the same behaviour
      // and the same `config.image` honoured — including the upload hook.
      command: (editor) => {
        void selectAndInsertImage(editor, image?.config, image?.onError);
      },
    },
    // Opt-in via config.youtube.enabled, like details and emoji below. Listed
    // unconditionally it prompted for a URL and then discarded it: the command
    // it chains onto only exists once the extension is registered.
    ...(youtube?.enabled === true
      ? [
          {
            title: t.youtube.title,
            description: t.youtube.description,
            icon: "smart_display",
            keywords: t.youtube.keywords,
            group: "media" as const,
            command: (editor: Editor) => {
              // URL-prompt pattern: cloned from the image extension's prompt flow
              // but inlined with window.prompt() since YouTube only needs a URL —
              // no file picker, no upload service. Adapters may override this
              // entry via SlashCommandOptions.commands to swap in a custom dialog.
              const url = typeof window !== "undefined" ? window.prompt(urlPromptLabel) : null;
              if (!url) return;
              (editor.chain().focus() as unknown as { setYoutubeVideo: (opts: { src: string }) => { run: () => boolean } })
                .setYoutubeVideo({ src: url })
                .run();
            },
          },
        ]
      : []),
    // ─── Advanced group ──────────────────────────────────────────────────────
    {
      title: t.horizontalRule.title,
      description: t.horizontalRule.description,
      icon: "horizontal_rule",
      keywords: t.horizontalRule.keywords,
      group: "advanced",
      command: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      title: t.table.title,
      description: t.table.description,
      icon: "table_view",
      keywords: t.table.keywords,
      group: "advanced",
      command: (editor) => editor.chain().focus().insertTable(DEFAULT_TABLE_DIMENSIONS).run(),
    },
  ];

  // ─── Details / Toggle block (opt-in via config.details.enabled) ──────────
  if (details?.enabled === true) {
    items.push({
      title: t.toggle?.title ?? "Toggle",
      description: t.toggle?.description ?? "Collapsible toggle block",
      icon: "expand_more",
      keywords: ["toggle", "details", "collapsible", "accordion"],
      group: "advanced",
      command: (editor) =>
        (
          editor.chain().focus() as unknown as {
            setDetails: () => { run: () => boolean };
          }
        )
          .setDetails()
          .run(),
    });
  }

  // ─── Emoji picker (opt-in via config.emoji.enabled) ──────────────────────
  if (emoji?.enabled === true) {
    items.push({
      title: t.emoji?.slash.label ?? "Insert emoji",
      description: t.emoji?.slash.description ?? "Search and insert an emoji",
      icon: "emoji_emotions",
      keywords: ["emoji", "emoticon", "smiley", "icon", "reaction"],
      group: "text",
      /**
       * Opens the emoji suggestion popup at the current cursor position.
       *
       * Caller contract: the matched `/query` range MUST already be deleted
       * from the document before invocation. Both Angular and React adapters
       * do this inside their slash-menu selection handlers; direct callers
       * must mirror that or the literal `/emoji` remains in the document.
       *
       * Inserts `":"` at the cursor to trigger the Tiptap suggestion plugin
       * naturally, then calls `emoji.callbacks?.openPopup` as a fallback for
       * environments where the plugin does not detect programmatic inserts.
       */
      command: (editor) => {
        editor.chain().focus().insertContent(":").run();
        emoji.callbacks?.openPopup?.(editor);
      },
    });
  }

  return items;
}
