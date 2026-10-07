import { describe, it, expect, afterEach } from "vitest";
import { Editor, Extension } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Plugin } from "@tiptap/pm/state";
import { IndentExtension } from "../indent.extension";
import { TableBundle } from "../table-bundle.extension";
import { KeyboardReleaseExtension, isKeyboardReleaseArmed } from "../keyboard-release.extension";

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

/** Mounts into the document, as in an app, so document-level listeners see editor events. */
function createEditor(content: string, extra: Extension[] = []): Editor {
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: [StarterKit, IndentExtension, TableBundle, KeyboardReleaseExtension, ...extra],
    content,
  });
  return editor;
}

/** Dispatches a keydown on the editable, the way a real key press reaches ProseMirror. */
function press(instance: Editor, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  instance.view.dom.dispatchEvent(event);
  return event;
}

/** Puts the caret at the end of the first text node containing `text`. */
function caretAfter(instance: Editor, text: string): void {
  let target = -1;
  instance.state.doc.descendants((node, pos) => {
    if (target === -1 && node.isText && node.text?.includes(text)) target = pos + node.nodeSize;
  });
  instance.commands.setTextSelection(target);
}

function snapshot(instance: Editor): string {
  return JSON.stringify(instance.getJSON());
}

describe("KeyboardReleaseExtension", () => {
  it("lets Tab indent when the release is not armed", () => {
    const instance = createEditor("<p>Hello</p>");
    caretAfter(instance, "Hello");
    const before = snapshot(instance);

    const tab = press(instance, "Tab");

    expect(tab.defaultPrevented).toBe(true);
    expect(snapshot(instance)).not.toBe(before);
  });

  it("hands Tab to the browser after Escape, leaving the paragraph untouched", () => {
    const instance = createEditor("<p>Hello</p>");
    caretAfter(instance, "Hello");
    const before = snapshot(instance);

    press(instance, "Escape");
    expect(isKeyboardReleaseArmed(instance.state)).toBe(true);
    const tab = press(instance, "Tab");

    expect(tab.defaultPrevented).toBe(false);
    expect(snapshot(instance)).toBe(before);
    expect(isKeyboardReleaseArmed(instance.state)).toBe(false);
  });

  it("releases Shift+Tab the same way", () => {
    const instance = createEditor('<p style="margin-left: 30px">Hello</p>');
    caretAfter(instance, "Hello");
    const before = snapshot(instance);

    press(instance, "Escape");
    const tab = press(instance, "Tab", { shiftKey: true });

    expect(tab.defaultPrevented).toBe(false);
    expect(snapshot(instance)).toBe(before);
  });

  it("releases Tab from the last table cell instead of adding a row", () => {
    const instance = createEditor(
      "<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr></tbody></table>",
    );
    caretAfter(instance, "b");
    const before = snapshot(instance);

    press(instance, "Escape");
    const tab = press(instance, "Tab");

    expect(tab.defaultPrevented).toBe(false);
    expect(snapshot(instance)).toBe(before);
  });

  it("releases Tab inside a list item instead of indenting it", () => {
    const instance = createEditor("<ul><li><p>one</p></li><li><p>two</p></li></ul>");
    caretAfter(instance, "two");
    const before = snapshot(instance);

    press(instance, "Escape");
    const tab = press(instance, "Tab");

    expect(tab.defaultPrevented).toBe(false);
    expect(snapshot(instance)).toBe(before);
  });

  it("releases Tab in a code block", () => {
    const instance = createEditor("<pre><code>let a = 1;</code></pre>");
    caretAfter(instance, "let a");
    const before = snapshot(instance);

    press(instance, "Escape");
    const tab = press(instance, "Tab");

    expect(tab.defaultPrevented).toBe(false);
    expect(snapshot(instance)).toBe(before);
  });

  it("disarms on any other key", () => {
    const instance = createEditor("<p>Hello</p>");
    caretAfter(instance, "Hello");

    press(instance, "Escape");
    press(instance, "ArrowLeft");

    expect(isKeyboardReleaseArmed(instance.state)).toBe(false);
    expect(press(instance, "Tab").defaultPrevented).toBe(true);
  });

  it("stays armed across a bare Shift press so Shift+Tab can follow", () => {
    const instance = createEditor("<p>Hello</p>");
    caretAfter(instance, "Hello");

    press(instance, "Escape");
    press(instance, "Shift", { shiftKey: true });

    expect(isKeyboardReleaseArmed(instance.state)).toBe(true);
  });

  it("disarms on pointer down and on blur", () => {
    const instance = createEditor("<p>Hello</p>");
    caretAfter(instance, "Hello");

    press(instance, "Escape");
    instance.view.dom.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(isKeyboardReleaseArmed(instance.state)).toBe(false);

    press(instance, "Escape");
    instance.view.dom.dispatchEvent(new FocusEvent("blur"));
    expect(isKeyboardReleaseArmed(instance.state)).toBe(false);
  });

  it("disarms on pointer down outside the editable, even when it keeps focus", () => {
    const instance = createEditor("<p>Hello</p>");
    caretAfter(instance, "Hello");
    const toolbarButton = document.createElement("button");
    document.body.appendChild(toolbarButton);

    press(instance, "Escape");
    toolbarButton.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    toolbarButton.remove();

    expect(isKeyboardReleaseArmed(instance.state)).toBe(false);
  });

  it("stops listening for outside pointer down once destroyed", () => {
    const instance = createEditor("<p>Hello</p>");
    caretAfter(instance, "Hello");
    press(instance, "Escape");
    instance.destroy();

    expect(() => document.body.dispatchEvent(new Event("pointerdown"))).not.toThrow();
    expect(isKeyboardReleaseArmed(instance.state)).toBe(true);
  });

  it("does not arm when another plugin consumed the Escape", () => {
    const popup = Extension.create({
      name: "fakePopup",
      addProseMirrorPlugins() {
        return [new Plugin({ props: { handleKeyDown: (_view, event) => event.key === "Escape" } })];
      },
    });
    const instance = createEditor("<p>Hello</p>", [popup]);
    caretAfter(instance, "Hello");

    press(instance, "Escape");

    expect(isKeyboardReleaseArmed(instance.state)).toBe(false);
  });

  it("ignores Escape while composing", () => {
    const instance = createEditor("<p>Hello</p>");
    caretAfter(instance, "Hello");

    press(instance, "Escape", { isComposing: true });

    expect(isKeyboardReleaseArmed(instance.state)).toBe(false);
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Meta", { metaKey: true }],
  ])("does not treat %s+Tab as the release and disarms", (_name, init) => {
    const instance = createEditor("<p>Hello</p>");
    caretAfter(instance, "Hello");
    const before = snapshot(instance);

    press(instance, "Escape");
    press(instance, "Tab", init);

    expect(isKeyboardReleaseArmed(instance.state)).toBe(false);
    expect(press(instance, "Tab").defaultPrevented).toBe(true);
    expect(snapshot(instance)).not.toBe(before);
  });

  it("keeps the arming out of undo history", () => {
    const instance = createEditor("<p>Hello</p>");
    caretAfter(instance, "Hello");
    const beforeTyping = snapshot(instance);
    instance.commands.insertContent(" world");

    press(instance, "Escape");
    expect(isKeyboardReleaseArmed(instance.state)).toBe(true);
    instance.commands.undo();

    expect(snapshot(instance)).toBe(beforeTyping);
    expect(instance.can().undo()).toBe(false);
  });
});
