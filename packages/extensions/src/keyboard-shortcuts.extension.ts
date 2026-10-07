import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

/** Platform-neutral shortcut strings, rendered by core's formatShortcut/ariaKeyShortcut. */
export const FOCUS_CHROME_SHORTCUT = "Alt+F10";
export const OPEN_BLOCK_MENU_SHORTCUT = "Shift+F10";

/** What the adapters do when a shortcut needs their UI. Return true when handled. */
export interface KeyboardShortcutHandlers {
  /** Alt+F10: focus the visible bubble menu, else the toolbar. */
  readonly focusChrome?: () => boolean;
  /** Shift+F10 / ContextMenu: open the block (or table cell) menu for the caret. */
  readonly openBlockMenu?: () => boolean;
}

export interface KeyboardShortcutsStorage {
  handlers: KeyboardShortcutHandlers;
}

/** Windows and Linux follow ContextMenu / Shift+F10 with a native contextmenu event. */
function suppressNextContextMenu(doc: Document): void {
  const block = (event: Event): void => event.preventDefault();
  doc.addEventListener("contextmenu", block, { capture: true, once: true });
  // macOS never sends it; a stale listener must not eat the next right-click.
  setTimeout(() => doc.removeEventListener("contextmenu", block, { capture: true }), 1000);
}

/**
 * Registers what Alt+F10 and Shift+F10/ContextMenu do for this editor.
 *
 * @param editor - Editor built with KeyboardShortcutsExtension
 * @param handlers - Adapter callbacks
 * @returns Disposer that removes these handlers (and only these)
 */
export function setKeyboardShortcutHandlers(
  editor: Editor,
  handlers: KeyboardShortcutHandlers,
): () => void {
  const storage = editor.storage.scrybKeyboardShortcuts as KeyboardShortcutsStorage | undefined;
  if (!storage) return () => undefined;
  storage.handlers = handlers;
  return () => {
    if (storage.handlers === handlers) storage.handlers = {};
  };
}

/**
 * Editor-level keys whose targets are adapter UI: Alt+F10 to the chrome,
 * Shift+F10/ContextMenu to the caret block's menu.
 */
export const KeyboardShortcutsExtension = Extension.create<
  Record<string, never>,
  KeyboardShortcutsStorage
>({
  name: "scrybKeyboardShortcuts",

  addStorage() {
    return { handlers: {} };
  },

  addKeyboardShortcuts() {
    const openBlockMenu = (): boolean => {
      const opened = this.storage.handlers.openBlockMenu?.() ?? false;
      if (opened) suppressNextContextMenu(this.editor.view.dom.ownerDocument);
      return opened;
    };
    return {
      "Alt-F10": () => this.storage.handlers.focusChrome?.() ?? false,
      "Shift-F10": openBlockMenu,
      ContextMenu: openBlockMenu,
    };
  },
});

declare module "@tiptap/core" {
  interface Storage {
    scrybKeyboardShortcuts: KeyboardShortcutsStorage;
  }
}
