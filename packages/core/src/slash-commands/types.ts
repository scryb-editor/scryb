import type { Editor, Range } from "@tiptap/core";

/**
 * Represents a single slash command item.
 */
export interface SlashCommandItem {
  readonly id?: string;
  readonly title: string;
  readonly description: string;
  readonly icon?: string;
  readonly category?: string;
  readonly keywords?: readonly string[];
  readonly group?: "text" | "lists" | "media" | "advanced" | string;
  readonly command: (editor: Editor) => void;
}

/**
 * Callbacks provided by the framework adapter to handle slash command menu rendering.
 * The core plugin is responsible for detection and filtering;
 * the framework adapter is responsible for UI rendering via these callbacks.
 */
export interface SlashCommandCallbacks {
  /** Called when slash command menu should be shown */
  onStart: (props: {
    query: string;
    items: SlashCommandItem[];
    clientRect: (() => DOMRect | null) | null;
    range: Range;
  }) => void;
  /** Called when query changes (user types after /) */
  onUpdate: (props: {
    query: string;
    items: SlashCommandItem[];
    clientRect: (() => DOMRect | null) | null;
    range: Range;
  }) => void;
  /** Called when menu should be hidden */
  onExit: () => void;
  /** Called when the user presses a key while menu is open */
  onKeyDown?: (props: { event: KeyboardEvent }) => boolean;
}

/**
 * Configuration for the slash commands feature.
 *
 * Passed to the SlashCommands component/directive to customize the available commands.
 * Both Angular and React adapters accept this type for consistent consumer API.
 *
 * @example
 * // Angular
 * <scryb-editor [slashCommands]="{ commands: myCommands }">
 *
 * // React (future — currently React accepts commands directly)
 */
export interface SlashCommandsConfig {
  /** Custom slash command list. Defaults to core defaultSlashCommands. */
  commands?: SlashCommandItem[];
}

/**
 * Creates a mutable callbacks store pre-initialized with no-op functions.
 *
 * Tiptap 3's `Extension.options` getter recreates the options object on every
 * access via `mergeDeep`, making it impossible to patch callbacks through the
 * extension options reference. The workaround is a shared mutable object that
 * both the extension closure and the adapter component reference at call time.
 *
 * Both Angular (`_angularCallbacks`) and React (`_sharedCallbacks`) solve this
 * identically. This factory is the canonical source — adapters call
 * `createCallbackStore()` instead of building the noop object inline.
 *
 * @returns A SlashCommandCallbacks object with all callbacks initialized as no-ops.
 *
 * @example
 * export const _sharedCallbacks = createCallbackStore();
 * // Later: _sharedCallbacks.onStart = actualHandler;
 */
export function createCallbackStore(): SlashCommandCallbacks {
  return {
    onStart: () => {},
    onUpdate: () => {},
    onExit: () => {},
    onKeyDown: () => false,
  };
}
