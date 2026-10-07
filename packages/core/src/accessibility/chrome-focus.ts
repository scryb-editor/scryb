import type { Editor } from "@tiptap/core";
import { isForwardTabFocus } from "../utils/dom-events";

const TOOLBAR_SELECTOR = '.scryb-toolbar[role="toolbar"]';
const BUBBLE_SELECTOR = '.scryb-bubble-menu[role="toolbar"]';
/** A trigger whose popup is open; Escape belongs to that popup first. */
const OPEN_TRIGGER_SELECTOR = '[aria-expanded="true"]';

/**
 * The bubble menu currently showing in this editor, if any. Bubble menus mount
 * in the editable's parent, inside the editor root.
 *
 * @param root - The editor's root element
 * @returns The visible bubble menu, or null
 */
export function findVisibleBubbleMenu(root: HTMLElement): HTMLElement | null {
  for (const menu of Array.from(root.querySelectorAll<HTMLElement>(BUBBLE_SELECTOR))) {
    // Tiptap hides bubble menus with `visibility` (inherited) or by detaching them.
    if (getComputedStyle(menu).visibility !== "hidden" && menu.getClientRects().length > 0) return menu;
  }
  return null;
}

/**
 * Focuses the toolbar's current roving item (the one with tabindex 0).
 *
 * @param root - The editor's root element
 * @returns true when something received focus
 */
export function focusToolbar(root: HTMLElement): boolean {
  const toolbar = root.querySelector<HTMLElement>(TOOLBAR_SELECTOR);
  const item =
    toolbar?.querySelector<HTMLElement>('button[tabindex="0"]') ??
    toolbar?.querySelector<HTMLElement>("button");
  if (!item) return false;
  item.focus();
  return true;
}

/**
 * Alt+F10: the visible bubble menu if there is one, otherwise the toolbar.
 *
 * @param root - The editor's root element
 * @returns true when focus moved
 */
export function focusEditorChrome(root: HTMLElement): boolean {
  const first = findVisibleBubbleMenu(root)?.querySelector<HTMLElement>("button");
  if (first) {
    first.focus();
    return true;
  }
  return focusToolbar(root);
}

/**
 * Escape from the toolbar or a bubble menu returns focus to the editor with
 * its selection intact. An Escape that an open popup handles is left alone:
 * the focused trigger reads `aria-expanded="true"`, or the popup consumed the
 * event and either moved focus or is still open.
 *
 * A consumed Escape is not enough on its own to stand down. Some layers mark
 * the key while closing something the user never navigated into — the React
 * toolbar's Radix tooltip, which opens on keyboard focus, or a bubble menu
 * dismissed while focus sits in the toolbar. Neither moves focus, so honouring
 * their mark would leave the user one press short of the editor.
 *
 * @param root - The editor's root element
 * @param editor - The editor to return to
 * @returns Disposer
 */
export function installChromeEscape(root: HTMLElement, editor: Editor): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const chrome = target.closest(`${TOOLBAR_SELECTOR}, ${BUBBLE_SELECTOR}`);
    if (!chrome) return;
    if (target.closest(OPEN_TRIGGER_SELECTOR)) return;
    if (event.defaultPrevented) {
      const focusMoved = target.ownerDocument.activeElement !== target;
      if (focusMoved || chrome.querySelector(OPEN_TRIGGER_SELECTOR)) return;
    }
    event.preventDefault();
    editor.commands.focus();
  };
  root.addEventListener("keydown", onKeyDown);
  return () => root.removeEventListener("keydown", onKeyDown);
}

/**
 * Whether focus entered `root` from an element that precedes it — a forward
 * Tab. A hidden-until-active toolbar should then receive focus before the
 * content does, as it would if it had been there all along. Any other route in
 * is not an entry of this kind: a click means the user chose where the caret
 * goes, and app code calling `editor.commands.focus()` (say, on Enter in a
 * title field above the editor) asked for the caret. Needs
 * `installPointerTracking` to know the latest input was a plain Tab.
 *
 * @param event - A focus event inside the root; its relatedTarget is where focus came from
 * @param root - The editor's root element
 * @returns true for a forward entry from outside
 */
export function isForwardFocusEntry(event: FocusEvent, root: HTMLElement): boolean {
  const from = event.relatedTarget;
  if (!(from instanceof Node) || !from.isConnected || root.contains(from)) return false;
  if (!isForwardTabFocus()) return false;
  return (from.compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/**
 * Whether the document's focused element lies inside any of `roots` — the
 * editor card and its portal container. Focus on the toolbar or a portaled
 * popup is still focus in the editor.
 *
 * @param roots - Elements that count as the editor; null entries are skipped
 * @returns true when focus is inside one of them
 */
export function isActiveElementWithin(roots: ReadonlyArray<Element | null | undefined>): boolean {
  const active = document.activeElement;
  if (!active) return false;
  return roots.some((root) => !!root?.contains(active));
}
