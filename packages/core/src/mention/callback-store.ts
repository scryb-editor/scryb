import type { Editor, Range } from "@tiptap/core";

// =============================================================================
// Mention Callback Store
// =============================================================================

/**
 * Shape of a single mentionable entity (user, tag, etc.). Consumers pass an
 * array of these via `ScrybEditorConfig.mention.items`; the suggestion
 * plugin's `items()` filter matches against the `label` field case-insensitively.
 */
export interface MentionItem {
  /** Stable identifier persisted on the node as `data-id`. */
  readonly id: string;
  /** Display label rendered inside the mention pill. */
  readonly label: string;
  /** Optional avatar URL rendered in the popup (not persisted on the node). */
  readonly avatarUrl?: string;
}

/**
 * Subset of Tiptap's suggestion render props relevant to the Mention adapter
 * components. Structurally compatible with the full `SuggestionRenderProps`
 * but typed to the adapter-facing `MentionItem` shape.
 */
export interface MentionSuggestionProps {
  readonly editor: Editor;
  readonly range: Range;
  readonly query: string;
  readonly items: readonly MentionItem[];
  readonly command: (item: MentionItem) => void;
  readonly clientRect: (() => DOMRect | null) | null;
}

/**
 * Lifecycle callbacks for the Mention suggestion popup.
 *
 * Mirrors the `@tiptap/suggestion` render lifecycle. Unlike emoji, mention has
 * no imperative `openPopup` handle — the trigger character (`@` by default) is
 * the sole entry point.
 *
 * Usage:
 * 1. Consumer creates the store once per editor instance via `createMentionCallbackStore()`.
 * 2. Store is passed into `ScrybEditorConfig.mention.callbacks`.
 * 3. The adapter popup component patches all four handlers on mount and restores
 *    noops on unmount.
 */
export interface MentionCallbacks {
  /** Called when the suggestion plugin opens (trigger char typed). */
  onStart: (props: MentionSuggestionProps) => void;
  /** Called on every query character change. */
  onUpdate: (props: MentionSuggestionProps) => void;
  /** Called when the suggestion exits (Escape, click outside, or item selected). */
  onExit: () => void;
  /**
   * Called on every keydown event while the suggestion is active.
   * Return `true` to consume the event, `false` to let it reach the editor.
   */
  onKeyDown: (props: { readonly event: KeyboardEvent }) => boolean;
}

/**
 * Creates a mutable Mention callbacks store pre-initialized with no-op functions.
 *
 * @example
 * ```typescript
 * const mentionCallbacks = createMentionCallbackStore();
 * const editor = createScrybEditor({
 *   mention: {
 *     enabled: true,
 *     items: [{ id: "1", label: "Ada Lovelace" }],
 *     callbacks: mentionCallbacks,
 *   },
 * });
 * ```
 */
export function createMentionCallbackStore(): MentionCallbacks {
  return {
    onStart: () => { /* noop until adapter patches */ },
    onUpdate: () => { /* noop until adapter patches */ },
    onExit: () => { /* noop until adapter patches */ },
    onKeyDown: () => false,
  };
}
