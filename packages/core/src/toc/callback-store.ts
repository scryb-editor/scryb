import type { TableOfContentData } from "@tiptap/extension-table-of-contents";

// =============================================================================
// TOC Callback Store
// =============================================================================

/**
 * Callbacks interface for the Table of Contents adapter components.
 *
 * The `onUpdate` callback is called by the TOC extension when the heading list
 * changes (on doc creation, on every transaction, and on scroll events for
 * active-item tracking). Adapter components patch this callback on mount to
 * update their local state.
 *
 * Mirror of the slash-commands `SlashCommandCallbacks` / `createCallbackStore`
 * pattern — both use a shared mutable object to work around Tiptap 3's
 * `mergeDeep` that recreates options on every access.
 */
export interface TocCallbacks {
  /** Called whenever the TOC item list or active state changes. */
  onUpdate: (content: TableOfContentData, isCreate?: boolean) => void;
}

/**
 * Creates a mutable TOC callbacks store pre-initialized with no-op functions.
 *
 * Usage:
 * 1. Consumer creates the store once per editor instance.
 * 2. Store is passed into `ScrybEditorConfig.toc.callbacks` before creating the editor.
 * 3. The `<scryb-toc>` / `<Toc>` component patches `store.onUpdate` on mount.
 * 4. The TOC extension internally calls `options.toc.callbacks.onUpdate(...)`.
 *
 * @returns A TocCallbacks object with all callbacks initialized as no-ops.
 *
 * @example
 * ```typescript
 * const tocCallbacks = createTocCallbackStore();
 * const editor = createScrybEditor({ toc: { enabled: true, callbacks: tocCallbacks } });
 * // Later in the component:
 * tocCallbacks.onUpdate = (items) => setItems([...items]);
 * ```
 */
export function createTocCallbackStore(): TocCallbacks {
  return {
    onUpdate: () => { /* noop until adapter patches */ },
  };
}
