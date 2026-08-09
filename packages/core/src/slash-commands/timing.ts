// =============================================================================
// Slash Command Timing Constants
// =============================================================================

/**
 * Milliseconds to wait after the user selects a slash command before executing it.
 *
 * The brief delay allows ProseMirror to settle the transaction that inserted the
 * paragraph node before the command function fires. Without the delay, some
 * commands (e.g., heading insertion) race with the node insertion and fail silently.
 *
 * Canonical source of truth — both Angular and React slash command components
 * import this value; do not hardcode 10 in adapters.
 */
export const SLASH_COMMAND_EXECUTE_DELAY_MS = 10;

/**
 * Milliseconds to wait after the Tiptap editor mounts before the adapter
 * considers the editor "fully initialized".
 *
 * Used to defer bubble menu attachment and other post-init operations that
 * require the editor's ProseMirror view to be fully rendered in the DOM.
 *
 * Canonical source of truth — both Angular (editor init effect) and React
 * (onChange debounce baseline) use this value.
 */
export const EDITOR_INIT_DELAY_MS = 100;
