import type { Editor } from "@tiptap/core";
import type { EmojiItem } from "@tiptap/extension-emoji";

// =============================================================================
// Emoji Callback Store
// =============================================================================

/**
 * Subset of the Tiptap suggestion render props used by the Emoji adapter
 * components. Structurally compatible with the full `SuggestionRenderProps`
 * but typed to the emoji-specific `EmojiItem` so adapters don't need to
 * import from `@tiptap/extension-emoji` directly.
 */
export interface EmojiSuggestionProps {
  readonly editor: Editor;
  readonly range: { readonly from: number; readonly to: number };
  readonly query: string;
  readonly items: readonly EmojiItem[];
  readonly command: (item: EmojiItem) => void;
  readonly clientRect: (() => DOMRect | null) | null;
}

/**
 * Lifecycle callbacks for the Emoji suggestion popup.
 *
 * Mirrors the `@tiptap/suggestion` render lifecycle and adds an imperative
 * `openPopup` handle so the "Insert emoji" slash command / toolbar button can
 * trigger the popup without the user typing `:`.
 *
 * Usage:
 * 1. Consumer creates the store once per editor instance via `createEmojiCallbackStore()`.
 * 2. Store is passed into `ScrybEditorConfig.emoji.callbacks`.
 * 3. The adapter popup component patches all five handlers on mount and restores
 *    noops on unmount.
 */
export interface EmojiCallbacks {
  /** Called when the suggestion plugin opens (query starts). Adapter mounts the popup. */
  onStart: (props: EmojiSuggestionProps) => void;
  /** Called on every query character change. Adapter re-renders filtered list. */
  onUpdate: (props: EmojiSuggestionProps) => void;
  /** Called when the suggestion exits (Escape, click outside, or item selected). Adapter unmounts. */
  onExit: () => void;
  /**
   * Called on every keydown event while the suggestion is active.
   * Return `true` to consume the event (prevents it reaching the editor).
   * Return `false` to pass it through (Tab, unknown keys).
   */
  onKeyDown: (props: { readonly event: KeyboardEvent }) => boolean;
  /**
   * Imperative handle for the "Insert emoji" slash command.
   *
   * The slash command invokes this after inserting a `:` at the cursor so the
   * same suggestion popup opens without the user having typed `:` themselves.
   * Adapter components patch this to either:
   *   (a) rely on the suggestion plugin detecting the programmatic `:` insertion, OR
   *   (b) synthesize an `onStart` call with a derived clientRect if (a) doesn't fire.
   */
  openPopup: (editor: Editor) => void;
}

/**
 * Creates a mutable Emoji callbacks store pre-initialized with no-op functions.
 *
 * @returns An `EmojiCallbacks` object with all handlers initialized as safe no-ops.
 *   `onKeyDown` returns `false` by default (never swallows events before adapter patches in).
 *
 * @example
 * ```typescript
 * const emojiCallbacks = createEmojiCallbackStore();
 * const editor = createScrybEditor({
 *   emoji: { enabled: true, callbacks: emojiCallbacks },
 * });
 * // The adapter component patches the handlers on mount:
 * emojiCallbacks.onStart = (props) => { /* show popup *\/ };
 * emojiCallbacks.openPopup = (editor) => { /* imperative trigger *\/ };
 * ```
 */
export function createEmojiCallbackStore(): EmojiCallbacks {
  return {
    onStart: () => { /* noop until adapter patches */ },
    onUpdate: () => { /* noop until adapter patches */ },
    onExit: () => { /* noop until adapter patches */ },
    onKeyDown: () => false,
    openPopup: () => { /* noop until adapter patches */ },
  };
}

/**
 * Shape of `editor.storage.scrybEmojiStore` — a thin namespace extension
 * registered alongside the Emoji extension that exposes the adapter's
 * `EmojiCallbacks` reference so toolbar / bubble menu commands can invoke
 * `openPopup(editor)` without importing adapter code.
 */
export interface ScrybEmojiStoreShape {
  callbacks?: EmojiCallbacks;
}

/**
 * Invokes `openPopup` on the emoji store stashed on `editor.storage`.
 * Safe no-op when the emoji extension is not registered.
 */
export function openEmojiPopup(editor: Editor): void {
  const store = editor.storage["scrybEmojiStore"] as ScrybEmojiStoreShape | undefined;
  store?.callbacks?.openPopup?.(editor);
}
