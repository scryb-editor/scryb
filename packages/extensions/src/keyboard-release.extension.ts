import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/** Whether the next Tab or Shift+Tab leaves the editor instead of reaching a keymap. */
export interface KeyboardReleaseState {
  readonly armed: boolean;
}

export const KEYBOARD_RELEASE_KEY = new PluginKey<KeyboardReleaseState>("scrybKeyboardRelease");

/** Pressing one of these alone must not cancel the release: Shift+Tab starts with Shift. */
const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock"]);

const DISARMED: KeyboardReleaseState = { armed: false };

/**
 * Reports whether Escape has armed the one-shot Tab release.
 *
 * @param state - The editor state to read
 * @returns true when the next plain Tab or Shift+Tab will move focus out of the editor
 */
export function isKeyboardReleaseArmed(state: EditorState): boolean {
  return KEYBOARD_RELEASE_KEY.getState(state)?.armed ?? false;
}

function setArmed(view: EditorView, armed: boolean): void {
  if (isKeyboardReleaseArmed(view.state) === armed) return;
  // Not an edit: undo must never step back through a key press.
  view.dispatch(
    view.state.tr.setMeta(KEYBOARD_RELEASE_KEY, { armed }).setMeta("addToHistory", false),
  );
}

/**
 * Esc-then-Tab keyboard release.
 *
 * Tab indents and moves between table cells, so without an escape hatch a
 * keyboard user cannot leave the editor without changing the document. Escape
 * arms a one-shot release; the next plain Tab or Shift+Tab skips every
 * ProseMirror keymap and the browser moves focus. Any other key, a pointer
 * down, or blur disarms it.
 *
 * Priority 1 (the lowest) is the point: ProseMirror offers keydown to each
 * plugin in order and stops at the first that handles it, so an open slash,
 * emoji or mention popup consumes Escape before this plugin sees it.
 */
export const KeyboardReleaseExtension = Extension.create({
  name: "scrybKeyboardRelease",
  priority: 1,

  addProseMirrorPlugins() {
    return [
      new Plugin<KeyboardReleaseState>({
        key: KEYBOARD_RELEASE_KEY,
        state: {
          init: () => DISARMED,
          apply(tr, value) {
            return (tr.getMeta(KEYBOARD_RELEASE_KEY) as KeyboardReleaseState | undefined) ?? value;
          },
        },
        view(view) {
          // Capture phase on the document: toolbar buttons preventDefault their
          // mousedown to keep focus in the editor, so neither blur nor an
          // editable-scoped listener would see a press on surrounding chrome.
          const doc = view.dom.ownerDocument;
          const disarm = (): void => setArmed(view, false);
          doc.addEventListener("pointerdown", disarm, true);
          return {
            destroy: () => doc.removeEventListener("pointerdown", disarm, true),
          };
        },
        props: {
          handleDOMEvents: {
            keydown(view, event) {
              if (!isKeyboardReleaseArmed(view.state)) return false;
              if (MODIFIER_KEYS.has(event.key) || event.key === "Escape") return false;
              setArmed(view, false);
              const plainTab =
                event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey;
              // `true` makes ProseMirror skip its own keydown handling (every
              // keymap) without preventDefault, so the browser moves focus.
              return plainTab;
            },
            blur(view) {
              setArmed(view, false);
              return false;
            },
          },
          handleKeyDown(view, event) {
            if (event.key !== "Escape" || event.isComposing || event.defaultPrevented) return false;
            if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false;
            setArmed(view, true);
            // Not consumed: document-level listeners still see the Escape.
            return false;
          },
        },
      }),
    ];
  },
});
