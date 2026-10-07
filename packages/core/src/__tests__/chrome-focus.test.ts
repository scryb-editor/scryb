import { describe, it, expect, afterEach, vi, type Mock } from "vitest";
import type { Editor } from "@tiptap/core";
import {
  focusEditorChrome,
  focusToolbar,
  installChromeEscape,
  isActiveElementWithin,
  isForwardFocusEntry,
} from "../accessibility/chrome-focus";
import { installPointerTracking } from "../utils/dom-events";

function editorRoot(name: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "scryb-editor";
  root.innerHTML = `
    <div class="scryb-toolbar" role="toolbar">
      <button tabindex="-1">${name}-a</button>
      <button tabindex="0">${name}-b</button>
    </div>`;
  document.body.appendChild(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("chrome focus", () => {
  it("focuses the toolbar's roving item", () => {
    const root = editorRoot("one");
    expect(focusToolbar(root)).toBe(true);
    expect(document.activeElement?.textContent).toBe("one-b");
  });

  it("focuses only the toolbar inside the given root", () => {
    editorRoot("one");
    const second = editorRoot("two");
    focusEditorChrome(second);
    expect(document.activeElement?.textContent).toBe("two-b");
  });

  it("reports false when there is no toolbar", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    expect(focusEditorChrome(root)).toBe(false);
  });
});

describe("isForwardFocusEntry", () => {
  it("is true when a Tab brought focus from an element before the root", () => {
    installPointerTracking();
    const before = document.createElement("button");
    const root = document.createElement("div");
    const inside = document.createElement("button");
    root.appendChild(inside);
    document.body.append(before, root);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(isForwardFocusEntry(new FocusEvent("focusin", { relatedTarget: before }), root)).toBe(true);
  });

  it("is false from after the root, from inside it, or from nowhere", () => {
    const root = document.createElement("div");
    const inside = document.createElement("button");
    const after = document.createElement("button");
    root.appendChild(inside);
    document.body.append(root, after);
    expect(isForwardFocusEntry(new FocusEvent("focusin", { relatedTarget: after }), root)).toBe(false);
    expect(isForwardFocusEntry(new FocusEvent("focusin", { relatedTarget: inside }), root)).toBe(false);
    expect(isForwardFocusEntry(new FocusEvent("focusin", { relatedTarget: null }), root)).toBe(false);
  });
});

describe("isActiveElementWithin", () => {
  it("is true when the active element is inside any given root", () => {
    const root = document.createElement("div");
    const portal = document.createElement("div");
    const button = document.createElement("button");
    portal.appendChild(button);
    document.body.append(root, portal);
    button.focus();
    expect(isActiveElementWithin([root, portal])).toBe(true);
  });

  it("is false when focus is elsewhere, and ignores null roots", () => {
    const root = document.createElement("div");
    root.appendChild(document.createElement("button"));
    const outside = document.createElement("button");
    document.body.append(root, outside);
    outside.focus();
    expect(isActiveElementWithin([root, null, undefined])).toBe(false);
  });
});

describe("isForwardFocusEntry — input modality and detached sources", () => {
  function beforeAndRoot(): { before: HTMLElement; root: HTMLElement } {
    const before = document.createElement("button");
    const root = document.createElement("div");
    document.body.append(before, root);
    return { before, root };
  }

  it("is false when a pointerdown, not a key, led to the focus", () => {
    installPointerTracking();
    const { before, root } = beforeAndRoot();
    root.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(isForwardFocusEntry(new FocusEvent("focusin", { relatedTarget: before }), root)).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(isForwardFocusEntry(new FocusEvent("focusin", { relatedTarget: before }), root)).toBe(true);
  });

  it("is false when any key but an unmodified Tab led to the focus", () => {
    installPointerTracking();
    const { before, root } = beforeAndRoot();
    const entry = (): boolean => isForwardFocusEntry(new FocusEvent("focusin", { relatedTarget: before }), root);
    // Enter in a preceding input whose handler calls editor.commands.focus().
    for (const init of [
      { key: "Enter" },
      { key: "Tab", shiftKey: true },
      { key: "Tab", ctrlKey: true },
      { key: "Tab", altKey: true },
      { key: "Tab", metaKey: true },
    ]) {
      document.dispatchEvent(new KeyboardEvent("keydown", init));
      expect(entry(), JSON.stringify(init)).toBe(false);
    }
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(entry()).toBe(true);
  });

  it("is false when focus came from an element no longer in the document", () => {
    const { before, root } = beforeAndRoot();
    before.remove();
    expect(isForwardFocusEntry(new FocusEvent("focusin", { relatedTarget: before }), root)).toBe(false);
  });
});

describe("installChromeEscape", () => {
  /** A root whose toolbar's second button holds focus, and a fake editor that records focus calls. */
  function setup(): { root: HTMLElement; button: HTMLElement; focus: Mock; dispose: () => void } {
    const root = editorRoot("esc");
    const button = root.querySelector<HTMLElement>('button[tabindex="0"]')!;
    button.focus();
    const focus = vi.fn();
    const dispose = installChromeEscape(root, { commands: { focus } } as unknown as Editor);
    return { root, button, focus, dispose };
  }

  /** Escape on `target`, with a document-capture listener that consumes it as an overlay would. */
  function pressConsumedEscape(target: HTMLElement, consume: (event: KeyboardEvent) => void): void {
    const listener = (event: Event): void => consume(event as KeyboardEvent);
    document.addEventListener("keydown", listener, true);
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    document.removeEventListener("keydown", listener, true);
  }

  it("returns to the editor on an unconsumed Escape from a toolbar item", () => {
    const { button, focus, dispose } = setup();
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(focus).toHaveBeenCalledTimes(1);
    dispose();
  });

  it("still returns when a tooltip consumed the Escape and focus never moved", () => {
    const { button, focus, dispose } = setup();
    pressConsumedEscape(button, (event) => event.preventDefault());
    expect(focus).toHaveBeenCalledTimes(1);
    dispose();
  });

  it("leaves a consumed Escape alone while a popup in the toolbar is still open", () => {
    const { root, button, focus, dispose } = setup();
    root.querySelector("button")!.setAttribute("aria-expanded", "true");
    pressConsumedEscape(button, (event) => event.preventDefault());
    expect(focus).not.toHaveBeenCalled();
    dispose();
  });

  it("leaves a consumed Escape alone when the consumer already moved focus", () => {
    const { root, button, focus, dispose } = setup();
    const other = root.querySelector<HTMLElement>('button[tabindex="-1"]')!;
    pressConsumedEscape(button, (event) => {
      event.preventDefault();
      other.focus();
    });
    expect(focus).not.toHaveBeenCalled();
    dispose();
  });
});
