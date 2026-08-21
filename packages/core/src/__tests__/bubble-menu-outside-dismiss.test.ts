import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Editor } from "@tiptap/core";

import { createBubbleMenuOutsideDismiss } from "../bubble-menu/outside-dismiss";

// =============================================================================
// Test helpers
// =============================================================================

interface Dom {
  /** This editor's `.scryb-editor` root. */
  root: HTMLElement;
  /** Stand-in for `editor.view.dom`. */
  editorDom: HTMLElement;
  /** The element the plugin shows and hides. */
  menu: HTMLElement;
  /** A plain button in the menu. */
  menuButton: HTMLElement;
  /** The menu's overlay trigger, wired to `ownedSurface` while "open". */
  menuTrigger: HTMLElement;
  /** A second trigger, wired to the body-portaled overlay while "open". */
  bodyTrigger: HTMLElement;
  /** Overlay the menu owns, portaled into this editor's themed container. */
  ownedSurface: HTMLElement;
  /** A control inside that overlay. */
  ownedItem: HTMLElement;
  /** Overlay the menu owns, portaled straight to `<body>` (no themed container). */
  bodySurface: HTMLElement;
  /** A control inside the body-portaled overlay. */
  bodyItem: HTMLElement;
  /** A control in a *second* editor's themed portal container. */
  otherPortalItem: HTMLElement;
  /** A control inside a second editor's root. */
  otherEditorItem: HTMLElement;
  /** This editor's themed portal container. */
  portal: HTMLElement;
  /** Where the adapter parks the menu before the plugin's first `show()`. */
  menuHost: HTMLElement;
  /** Anything else on the host page. */
  outside: HTMLElement;
}

/**
 * Builds the DOM shape both adapters produce: an editor root wrapping the
 * ProseMirror surface and the bubble menu, overlays the menu opened (one in a
 * themed portal container, one straight on `<body>`), a second editor with a
 * themed container of its own, and an unrelated element standing in for
 * "outside the editor".
 *
 * The menu's trigger starts *closed*: `openOverlays()` wires the
 * `aria-controls` / `aria-expanded` contract that marks the overlays as this
 * menu's own.
 */
function buildDom(): Dom {
  document.body.innerHTML = "";

  const root = document.createElement("div");
  root.className = "scryb-editor";

  const editorDom = document.createElement("div");
  editorDom.className = "tiptap ProseMirror";
  root.appendChild(editorDom);

  const menu = document.createElement("div");
  menu.style.visibility = "visible";
  const menuButton = document.createElement("button");
  const menuTrigger = document.createElement("button");
  const bodyTrigger = document.createElement("button");
  menu.append(menuButton, menuTrigger, bodyTrigger);
  root.appendChild(menu);

  // This editor's themed portal container, with the overlay inside it.
  const portal = document.createElement("div");
  portal.className = "scryb-editor-portal";
  const ownedSurface = document.createElement("div");
  ownedSurface.id = "surface-«r0»"; // generated ids are not valid CSS selectors
  const ownedItem = document.createElement("button");
  ownedSurface.appendChild(ownedItem);
  portal.appendChild(ownedSurface);

  // The same menu's overlay when no themed container exists — straight on body.
  const bodySurface = document.createElement("div");
  bodySurface.id = "surface-body";
  const bodyItem = document.createElement("button");
  bodySurface.appendChild(bodyItem);

  // A second editor on the page, with a themed container of its own.
  const otherEditor = document.createElement("div");
  otherEditor.className = "scryb-editor";
  const otherEditorItem = document.createElement("button");
  otherEditor.appendChild(otherEditorItem);

  const otherPortal = document.createElement("div");
  otherPortal.className = "scryb-editor-portal";
  const otherPortalItem = document.createElement("button");
  otherPortal.appendChild(otherPortalItem);

  const outside = document.createElement("button");

  // The adapter's own template slot, where the menu waits for the first `show()`.
  const menuHost = document.createElement("div");

  document.body.append(root, portal, bodySurface, otherEditor, otherPortal, outside, menuHost);

  return {
    root,
    editorDom,
    menu,
    menuButton,
    menuTrigger,
    bodyTrigger,
    ownedSurface,
    ownedItem,
    bodySurface,
    bodyItem,
    otherPortalItem,
    otherEditorItem,
    portal,
    menuHost,
    outside,
  };
}

/** Marks both overlays as open, the way Radix and the Angular controls do. */
function openOverlays(dom: Dom): void {
  dom.menuTrigger.setAttribute("aria-expanded", "true");
  dom.menuTrigger.setAttribute("aria-controls", dom.ownedSurface.id);
  dom.bodyTrigger.setAttribute("aria-expanded", "true");
  dom.bodyTrigger.setAttribute("aria-controls", dom.bodySurface.id);
}

interface FakeEditor {
  editor: Editor;
  dispatch: ReturnType<typeof vi.fn>;
  setMeta: ReturnType<typeof vi.fn>;
}

function createFakeEditor(editorDom: HTMLElement, isDestroyed = false): FakeEditor {
  const setMeta = vi.fn(() => ({ __tr: true }));
  const dispatch = vi.fn();
  const editor = {
    isDestroyed,
    view: { dom: editorDom, dispatch },
    state: { tr: { setMeta } },
  } as unknown as Editor;
  return { editor, dispatch, setMeta };
}

function mousedownOn(target: HTMLElement): void {
  target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
}

function pressEscape(target: HTMLElement = document.body): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

function focusIn(to: HTMLElement, from: HTMLElement | null = null): void {
  to.dispatchEvent(new FocusEvent("focusin", { bubbles: true, relatedTarget: from }));
}

/**
 * The focus event an overlay fires while closing: it drops focus with no
 * `relatedTarget` and only hands it back to its trigger a tick later.
 */
function focusOut(from: HTMLElement, to: HTMLElement | null): void {
  from.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: to }));
}

// =============================================================================
// Tests
// =============================================================================

describe("createBubbleMenuOutsideDismiss", () => {
  let dom: Dom;
  let dispose: (() => void) | null = null;

  /** Stands in for hit testing, which jsdom has no layout to perform. */
  let hitTest: () => Element | null = () => null;

  beforeEach(() => {
    dom = buildDom();
    hitTest = () => null;
    document.elementFromPoint = () => hitTest();
  });

  afterEach(() => {
    dispose?.();
    dispose = null;
    document.body.innerHTML = "";
  });

  function arm(
    overrides: {
      isDestroyed?: boolean;
      onDismiss?: () => void;
      chromeRoots?: () => readonly (Element | null | undefined)[];
    } = {},
  ): FakeEditor {
    const fake = createFakeEditor(dom.editorDom, overrides.isDestroyed ?? false);
    dispose = createBubbleMenuOutsideDismiss({
      editor: fake.editor,
      pluginKey: "scrybTextBubbleMenu",
      getMenuElement: () => dom.menu,
      getChromeRoots: overrides.chromeRoots,
      onDismiss: overrides.onDismiss,
    });
    return fake;
  }

  // ═══════════════ Pointer: dismissal ═══════════════

  it("dispatches the plugin's hide meta on a mousedown outside the editor", () => {
    const fake = arm();

    mousedownOn(dom.outside);

    expect(fake.setMeta).toHaveBeenCalledWith("scrybTextBubbleMenu", "hide");
    expect(fake.dispatch).toHaveBeenCalledTimes(1);
  });

  it("calls onDismiss before dispatching so adapters can reset menu-local state", () => {
    const order: string[] = [];
    const fake = createFakeEditor(dom.editorDom);
    fake.dispatch.mockImplementation(() => order.push("dispatch"));
    dispose = createBubbleMenuOutsideDismiss({
      editor: fake.editor,
      pluginKey: "scrybTextBubbleMenu",
      getMenuElement: () => dom.menu,
      onDismiss: () => order.push("onDismiss"),
    });

    mousedownOn(dom.outside);

    expect(order).toEqual(["onDismiss", "dispatch"]);
  });

  it("treats a click into a second editor on the page as outside", () => {
    const fake = arm();

    mousedownOn(dom.otherEditorItem);

    expect(fake.dispatch).toHaveBeenCalledTimes(1);
  });

  it("treats a click in another editor's portal container as outside", () => {
    const fake = arm();
    openOverlays(dom);

    mousedownOn(dom.otherPortalItem);

    expect(fake.dispatch).toHaveBeenCalledTimes(1);
  });

  it("dismisses on a click in a surface whose trigger is closed", () => {
    const fake = arm();
    // No openOverlays(): nothing on the page belongs to this menu.

    mousedownOn(dom.ownedItem);

    expect(fake.dispatch).toHaveBeenCalledTimes(1);
  });

  // ═══════════════ Pointer: clicks that must NOT dismiss ═══════════════

  it("ignores a click on the menu itself", () => {
    const fake = arm();

    mousedownOn(dom.menuButton);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("ignores a click inside the editor content", () => {
    const fake = arm();

    mousedownOn(dom.editorDom);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("ignores a click in an overlay the menu opened into the themed container", () => {
    const fake = arm();
    openOverlays(dom);

    mousedownOn(dom.ownedItem);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("ignores a click in an overlay the menu opened straight onto <body>", () => {
    const fake = arm();
    openOverlays(dom);

    mousedownOn(dom.bodyItem);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("follows a nested overlay opened from inside an overlay", () => {
    const fake = arm();
    openOverlays(dom);

    // A dropdown opened from a control inside the overflow panel, portaled out.
    const nested = document.createElement("div");
    nested.id = "surface-nested";
    const nestedItem = document.createElement("button");
    nested.appendChild(nestedItem);
    document.body.appendChild(nested);
    dom.ownedItem.setAttribute("aria-expanded", "true");
    dom.ownedItem.setAttribute("aria-controls", nested.id);

    mousedownOn(nestedItem);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("re-resolves a press an open overlay reported as <html>", () => {
    const fake = arm();
    // While an overlay is open the page beneath it is not clickable, so the
    // press that closes it reports <html> even though it landed on the trigger.
    hitTest = () => dom.menuTrigger;

    mousedownOn(document.documentElement);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("dismisses when the re-resolved point really is the page background", () => {
    const fake = arm();
    hitTest = () => document.body;

    mousedownOn(document.documentElement);

    expect(fake.dispatch).toHaveBeenCalledTimes(1);
  });

  it("ignores a press that resolves to no element at all — the page scrollbar", () => {
    const fake = arm();
    hitTest = () => null;

    mousedownOn(document.documentElement);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("ignores a click in a chrome root the adapter declared", () => {
    // The themed portal container: the toolbar's overlays render in there, and
    // using them must not close the menu.
    const fake = arm({ chromeRoots: () => [dom.portal] });

    mousedownOn(dom.ownedItem);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("still dismisses on a click in another editor's portal container", () => {
    const fake = arm({ chromeRoots: () => [dom.portal] });

    mousedownOn(dom.otherPortalItem);

    expect(fake.dispatch).toHaveBeenCalledTimes(1);
  });

  it("ignores focus landing in a declared chrome root", () => {
    const fake = arm({ chromeRoots: () => [dom.portal] });

    focusIn(dom.ownedItem, dom.editorDom);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  // ═══════════════ Keyboard ═══════════════

  it("dismisses on Escape", () => {
    const fake = arm();

    pressEscape(dom.editorDom);

    expect(fake.setMeta).toHaveBeenCalledWith("scrybTextBubbleMenu", "hide");
    expect(fake.dispatch).toHaveBeenCalledTimes(1);
  });

  it("leaves the first Escape to an open overlay", () => {
    const fake = arm();
    openOverlays(dom);

    pressEscape(dom.editorDom);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("leaves the first Escape to an overlay rendered inline in the menu", () => {
    const fake = arm();
    // A dropdown that renders inside the menu portals nothing out; its open
    // trigger is the only trace of it.
    dom.menuTrigger.setAttribute("aria-expanded", "true");

    pressEscape(dom.editorDom);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("dismisses on Escape when the overlay ignored the key", () => {
    vi.useFakeTimers();
    const fake = arm();
    openOverlays(dom);

    pressEscape(dom.editorDom);
    expect(fake.dispatch).not.toHaveBeenCalled();

    // Nothing closed: the overlay does not handle Escape, so the menu takes it.
    vi.runAllTimers();

    expect(fake.dispatch).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("stays put when the overlay did close on Escape", () => {
    vi.useFakeTimers();
    const fake = arm();
    openOverlays(dom);

    pressEscape(dom.editorDom);
    dom.menuTrigger.setAttribute("aria-expanded", "false");
    dom.bodyTrigger.setAttribute("aria-expanded", "false");
    vi.runAllTimers();

    expect(fake.dispatch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("ignores keys other than Escape", () => {
    const fake = arm();

    dom.editorDom.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  // ═══════════════ Focus ═══════════════

  it("dismisses when focus lands on the host page", () => {
    const fake = arm();

    focusIn(dom.outside, dom.editorDom);

    expect(fake.dispatch).toHaveBeenCalledTimes(1);
  });

  it("dismisses when focus lands in a second editor", () => {
    const fake = arm();

    focusIn(dom.otherEditorItem, dom.editorDom);

    expect(fake.dispatch).toHaveBeenCalledTimes(1);
  });

  it("ignores focus moving onto the menu's own buttons", () => {
    const fake = arm();

    focusIn(dom.menuButton, dom.editorDom);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("ignores focus moving into an overlay the menu opened", () => {
    const fake = arm();
    openOverlays(dom);

    focusIn(dom.bodyItem, dom.editorDom);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("ignores focus returning to the editor from an overlay", () => {
    const fake = arm();

    focusIn(dom.editorDom, dom.menuButton);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("survives an overlay closing, which drops focus before restoring it", () => {
    const fake = arm();
    openOverlays(dom);

    // What Radix does on close: focus leaves the surface with no relatedTarget,
    // then lands back on the trigger inside the menu a tick later.
    focusOut(dom.ownedItem, null);
    focusIn(dom.menuTrigger, null);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("stays put when focus leaves the document entirely", () => {
    const fake = arm();

    // Switching windows fires no focusin; the menu belongs to a selection that
    // is still there when the user comes back.
    focusOut(dom.editorDom, null);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  // ═══════════════ Guards ═══════════════

  it("stays silent while the plugin has not shown the menu", () => {
    const fake = arm();
    // Parked in its adapter's template, not appended to the editor yet.
    dom.menuHost.appendChild(dom.menu);

    mousedownOn(dom.outside);
    pressEscape();
    focusIn(dom.outside, dom.editorDom);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("keeps working while Floating UI hides a menu whose anchor scrolled away", () => {
    const fake = arm();
    // `hide: true` sets visibility on a menu the plugin still considers shown.
    dom.menu.style.visibility = "hidden";

    mousedownOn(dom.outside);

    expect(fake.dispatch).toHaveBeenCalledTimes(1);
  });

  it("stays silent while the menu is detached from the document", () => {
    const fake = arm();
    dom.menu.remove();

    mousedownOn(dom.outside);
    pressEscape();

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  it("stays silent once the editor is destroyed", () => {
    const fake = arm({ isDestroyed: true });

    mousedownOn(dom.outside);
    pressEscape();
    focusIn(dom.outside, dom.editorDom);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });

  // ═══════════════ Cleanup ═══════════════

  it("stops listening on every channel after the returned cleanup runs", () => {
    const fake = arm();

    dispose?.();
    dispose = null;
    mousedownOn(dom.outside);
    pressEscape();
    focusIn(dom.outside, dom.editorDom);

    expect(fake.dispatch).not.toHaveBeenCalled();
  });
});
