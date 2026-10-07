import { describe, it, expect, afterEach, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { KeyboardShortcutsExtension, setKeyboardShortcutHandlers } from "../keyboard-shortcuts.extension";

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function createEditor(content: string): Editor {
  editor = new Editor({ extensions: [StarterKit, KeyboardShortcutsExtension], content });
  return editor;
}

function press(instance: Editor, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  instance.view.dom.dispatchEvent(event);
  return event;
}

describe("KeyboardShortcutsExtension: adapter callbacks", () => {
  it("forwards Alt+F10 to focusChrome", () => {
    const instance = createEditor("<p>one</p>");
    const focusChrome = vi.fn(() => true);
    setKeyboardShortcutHandlers(instance, { focusChrome });

    const event = press(instance, "F10", { altKey: true });

    expect(focusChrome).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it("forwards Shift+F10 and ContextMenu to openBlockMenu", () => {
    const instance = createEditor("<p>one</p>");
    const openBlockMenu = vi.fn(() => true);
    setKeyboardShortcutHandlers(instance, { openBlockMenu });

    press(instance, "F10", { shiftKey: true });
    press(instance, "ContextMenu");

    expect(openBlockMenu).toHaveBeenCalledTimes(2);
  });

  it("swallows the native context menu that follows a handled key", () => {
    const instance = createEditor("<p>one</p>");
    setKeyboardShortcutHandlers(instance, { openBlockMenu: () => true });

    press(instance, "ContextMenu");
    const native = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(native);

    expect(native.defaultPrevented).toBe(true);
  });

  it("leaves the key alone when no handler claims it", () => {
    const instance = createEditor("<p>one</p>");
    expect(press(instance, "F10", { altKey: true }).defaultPrevented).toBe(false);
  });

  it("stops forwarding after the disposer runs", () => {
    const instance = createEditor("<p>one</p>");
    const focusChrome = vi.fn(() => true);
    const dispose = setKeyboardShortcutHandlers(instance, { focusChrome });

    dispose();
    press(instance, "F10", { altKey: true });

    expect(focusChrome).not.toHaveBeenCalled();
  });
});
