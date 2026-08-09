import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { SlashCommandCallbacks, SlashCommandItem } from "./types";
import { defaultSlashCommands } from "./defaults";

// =============================================================================
// SLASH COMMANDS EXTENSION
// =============================================================================

/**
 * Configuration options for the SlashCommandsExtension.
 */
export interface SlashCommandOptions {
  /** Override the default command list. Defaults to defaultSlashCommands. */
  commands?: SlashCommandItem[];
  /** Callbacks the framework adapter provides to render the menu UI. */
  callbacks: SlashCommandCallbacks;
}

/**
 * Tiptap extension that detects "/" keystrokes and emits callbacks for
 * framework adapters to render a command picker UI.
 *
 * Framework-agnostic — UI rendering is delegated to the `callbacks` option.
 * Uses @tiptap/suggestion under the hood.
 *
 * @example
 * ```typescript
 * SlashCommandsExtension.configure({
 *   callbacks: {
 *     onStart: ({ items, clientRect }) => showMenu(items, clientRect),
 *     onUpdate: ({ items }) => updateMenu(items),
 *     onExit: () => hideMenu(),
 *   },
 * })
 * ```
 */
export const SlashCommandsExtension = Extension.create<SlashCommandOptions>({
  name: "slashCommands",

  addOptions() {
    return {
      commands: defaultSlashCommands(),
      callbacks: {
        onStart: () => {},
        onUpdate: () => {},
        onExit: () => {},
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        items: ({ query }) => {
          const commands = this.options.commands ?? defaultSlashCommands();
          if (!query) return commands;
          const q = query.toLowerCase();
          return commands.filter((item) => {
            if (item.title.toLowerCase().includes(q)) return true;
            if (item.description.toLowerCase().includes(q)) return true;
            if (item.keywords?.some((kw) => kw.toLowerCase().includes(q))) return true;
            return false;
          });
        },
        render: () => ({
          onStart: (props) => {
            this.options.callbacks.onStart({
              query: props.query,
              items: props.items as SlashCommandItem[],
              clientRect: props.clientRect ?? null,
              range: props.range,
            });
          },
          onUpdate: (props) => {
            this.options.callbacks.onUpdate({
              query: props.query,
              items: props.items as SlashCommandItem[],
              clientRect: props.clientRect ?? null,
              range: props.range,
            });
          },
          onExit: () => {
            this.options.callbacks.onExit();
          },
          onKeyDown: (props) => {
            return this.options.callbacks.onKeyDown?.(props) ?? false;
          },
        }),
      }),
    ];
  },
});
