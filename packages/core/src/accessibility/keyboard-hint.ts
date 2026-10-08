import { FOCUS_CHROME_SHORTCUT, OPEN_BLOCK_MENU_SHORTCUT } from "@scryb-editor/extensions";
import type { TiptapTranslations } from "../i18n/types";
import { interpolate } from "../i18n/interpolate";
import { formatShortcut } from "../toolbar/shortcuts";
import { MOVE_BLOCK_DOWN_SHORTCUT, MOVE_BLOCK_UP_SHORTCUT } from "../block-menu/move";

/** English fallbacks for catalogs that predate a sentence. */
const ENGLISH = {
  leaveEditor: "Press Escape, then Tab, to leave the editor.",
  toolbar: "{keys} moves to the formatting menu or the toolbar.",
  blockMenu: "{keys} opens the actions for the current block.",
  moveBlock: "{keys} moves the current block.",
} as const;

let instanceCounter = 0;

/**
 * Creates an id unique to one editor instance on the page, for elements that
 * are referenced by id (the keyboard hint, and later the character limit).
 *
 * @returns An id of the form `scryb-editor-<n>`
 */
export function createEditorInstanceId(): string {
  instanceCounter += 1;
  return `scryb-editor-${instanceCounter}`;
}

/**
 * The id of the element holding an editor's keyboard hint.
 *
 * @param instanceId - The editor instance id
 * @returns The hint element id
 */
export function keyboardHintId(instanceId: string): string {
  return `${instanceId}-keyboard-hint`;
}

/**
 * The keyboard help a screen reader announces as the editable's description.
 * The keys it lists are otherwise undiscoverable without a pointer. Each
 * `{keys}` is the platform's name for the keys ("⌥F10" on Apple devices,
 * "Alt+F10" elsewhere), so a Mac user hears the key their keyboard labels.
 *
 * @param translations - The active translation catalog
 * @returns The hint sentences joined with spaces
 */
export function getKeyboardHintText(translations: TiptapTranslations): string {
  const hints = translations.editor.keyboardHints;
  const moveKeys = `${formatShortcut(MOVE_BLOCK_UP_SHORTCUT)} / ${formatShortcut(MOVE_BLOCK_DOWN_SHORTCUT)}`;
  return [
    hints?.leaveEditor ?? ENGLISH.leaveEditor,
    interpolate(hints?.toolbar ?? ENGLISH.toolbar, { keys: formatShortcut(FOCUS_CHROME_SHORTCUT) }),
    interpolate(hints?.blockMenu ?? ENGLISH.blockMenu, { keys: formatShortcut(OPEN_BLOCK_MENU_SHORTCUT) }),
    interpolate(hints?.moveBlock ?? ENGLISH.moveBlock, { keys: moveKeys }),
  ].join(" ");
}

/**
 * Id of the hidden element describing the character limit. Referenced by the
 * editable's `aria-describedby` next to the keyboard hint.
 *
 * @param instanceId - Per-editor id (React `useId()`, Angular `createEditorInstanceId()`)
 * @returns `${instanceId}-character-limit`
 * @example characterLimitId("scryb-editor-1") // "scryb-editor-1-character-limit"
 */
export function characterLimitId(instanceId: string): string {
  return `${instanceId}-character-limit`;
}
