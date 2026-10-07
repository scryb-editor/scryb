/**
 * Dismissal for Tiptap bubble menus — pointer, keyboard and focus.
 *
 * Canonical source of truth — both the Angular and React adapters import this
 * helper; no adapter-local duplicate is permitted.
 *
 * ## Why this exists
 *
 * `BubbleMenuView` (`@tiptap/extension-bubble-menu`) hides the menu from the
 * editor's `blur` event, guarded by a one-shot `preventHide` flag that any
 * mousedown inside the menu element arms. The flag is cleared in exactly one
 * place — the blur handler — which clears it and returns *without* hiding.
 *
 * Every Scryb menu button calls `preventDefault()` on mousedown so the editor
 * keeps its selection while a command runs. That is correct, and it means no
 * blur ever follows an in-menu mousedown: the flag stays armed and swallows the
 * *next* genuine blur instead — the user's click outside the editor, the Tab
 * that moves focus away, the switch to another window. The menu then stays on
 * screen until the selection changes.
 *
 * The flag lives in third-party code and is not reachable from here, so this
 * helper stops dismissal depending on that blur at all. It watches three exits
 * of its own — mousedown, Escape and focus landing somewhere else — and
 * dispatches the plugin's supported `"hide"` transaction meta. The show path is
 * untouched: the menu reappears on the next selection exactly as before.
 *
 * Focus is read from `focusin` — where focus *arrived* — never from `focusout`.
 * A closing overlay drops focus with a null `relatedTarget` and only restores
 * it to its trigger a tick later, so a `focusout` listener cannot tell that
 * transient gap from the user genuinely leaving.
 *
 * ## What counts as "inside"
 *
 * The menu element, this editor's own `.scryb-editor` root, any root the adapter
 * declares as its chrome — the themed portal container `<ScrybEditor>` appends to
 * `document.body`, where the toolbar's overlays render — and any overlay the menu
 * currently owns. Ownership is read from the DOM contract every overlay
 * primitive we use already honours: an open trigger carries
 * `aria-controls="<id of its surface>"`, so the surfaces are resolved from the
 * menu's own triggers — transitively, for a dropdown opened inside a panel.
 * That works wherever the surface is portaled to (a themed container, or plain
 * `<body>` when the editor is composed without one) and it never matches
 * another editor's overlays, which no trigger of this menu points at.
 *
 * One wrinkle: while an overlay is open, overlay primitives park
 * `pointer-events: none` on `<body>` so the page underneath cannot be clicked.
 * Hit testing then stops at the root, and the click that closes the overlay
 * arrives with `<html>` as its target no matter what it landed on — the menu's
 * own trigger included. The block is already lifted by the time `mousedown`
 * fires, so those events are re-resolved from their coordinates instead of
 * being trusted, and only a press that really landed on the page background
 * dismisses.
 */

import type { Editor } from "@tiptap/core";
import type { PluginKey } from "@tiptap/pm/state";

// ═══════════════ Constants ═══════════════

/**
 * Root element both adapters render around the ProseMirror surface. Everything
 * inside it — toolbar, bubble menus, link editor, image panel — counts as the
 * editor's own chrome and must never dismiss the menu.
 */
const EDITOR_ROOT_SELECTOR = ".scryb-editor";

/** Meta value `BubbleMenuView.transactionHandler` reads to hide the menu. */
const HIDE_META = "hide";

/** `KeyboardEvent.key` of the key that closes floating surfaces. */
const ESCAPE_KEY = "Escape";

/** Marks a trigger whose surface is currently open. */
const OPEN_TRIGGER_SELECTOR = '[aria-expanded="true"]';

/**
 * How many levels of nested overlays are followed when resolving the menu's
 * own surfaces. A panel containing a dropdown is two; the cap only exists so a
 * malformed `aria-controls` cycle cannot spin.
 */
const MAX_SURFACE_DEPTH = 4;

// ═══════════════ Types ═══════════════

/**
 * Options for {@link createBubbleMenuOutsideDismiss}.
 */
export interface BubbleMenuOutsideDismissOptions {
  /** Editor whose view dispatches the hide transaction. */
  readonly editor: Editor;
  /**
   * The same key handed to `BubbleMenuPlugin`. A string in the React adapter,
   * a `PluginKey` instance in the Angular one — `Transaction.setMeta` accepts
   * both, and the plugin reads the meta back with the identical value.
   */
  readonly pluginKey: string | PluginKey;
  /**
   * Returns the element the plugin owns — the one it appends on `show()` and
   * removes on `hide()`, not the styled inner wrapper. Read lazily because the
   * adapters resolve it from a view child / ref that may not exist yet.
   */
  readonly getMenuElement: () => HTMLElement | null | undefined;
  /**
   * Extra elements that belong to this editor's chrome, beyond the `.scryb-editor`
   * root — the themed portal container is the one that matters, since the toolbar's
   * overlays render inside it and interacting with them must not close the menu.
   * Read lazily: the container mounts after the first render, and adapters resolve
   * it per editor so another editor's container is never mistaken for this one's.
   */
  readonly getChromeRoots?: () => readonly (Element | null | undefined)[];
  /**
   * Called right before the hide transaction is dispatched. Adapters use it to
   * reset menu-local UI state (an open overflow panel, for instance) that the
   * plugin knows nothing about.
   */
  readonly onDismiss?: () => void;
}

// ═══════════════ Helpers ═══════════════

/**
 * Resolves an event target to the nearest `Element`. Mousedown and focus
 * targets are elements in practice; the text-node branch is defensive.
 */
function toElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

/**
 * Whether the plugin currently has the menu on screen.
 *
 * `BubbleMenuView.show()` appends the element to `view.dom.parentElement` and
 * `hide()` removes it again, so being a child of that target is the plugin's own
 * definition of shown. Reading `style.visibility` instead would be wrong twice
 * over: the element is parked, hidden, in its adapter's template before the first
 * `show()`, and the Floating UI `hide` middleware sets the same property to
 * `hidden` while the menu is still shown but its anchor is scrolled out of view —
 * a state where dismissal must keep working, or the menu comes back on screen
 * after the user has left it.
 */
function isMenuLive(menu: HTMLElement | null | undefined, editor: Editor): menu is HTMLElement {
  if (!menu || !menu.isConnected) return false;
  return menu.parentElement === editor.view.dom.parentElement;
}

/**
 * What the press actually landed on.
 *
 * A target of `<html>` or `<body>` means one of two things: the user pressed
 * the page background, or an overlay was blocking the page when the browser hit
 * tested (see the module header). Only the coordinates tell them apart, and by
 * `mousedown` the block is gone, so the point is tested again. Covers inline
 * dropdowns and portaled panels alike, in both adapters.
 */
function resolveTarget(event: MouseEvent): Element | null {
  const target = toElement(event.target);
  if (target !== document.documentElement && target !== document.body) return target;
  if (typeof document.elementFromPoint !== "function") return target;

  // `null` means the press hit no element at all — the page scrollbar. Dragging
  // it is not leaving the editor, so the caller ignores an unresolved press.
  return document.elementFromPoint(event.clientX, event.clientY);
}

/**
 * Every overlay the menu currently has open, wherever it is portaled to.
 *
 * Radix (React) and the Angular controls both mark an open trigger with
 * `aria-controls` pointing at the id of the surface it opened, and drop the
 * attribute once closed. Walking the menu's triggers therefore yields exactly
 * this menu's surfaces — the overflow panel, the link and image popovers, the
 * accessibility dialog — and nothing belonging to another editor.
 *
 * Resolution is transitive: a surface is searched for triggers of its own, so a
 * dropdown opened from inside the overflow panel is found too.
 *
 * Ids are read with `getElementById` on purpose: generated ids such as
 * `radix-«r7»` are not valid CSS selectors.
 */
function collectOpenSurfaces(menu: HTMLElement): readonly Element[] {
  const surfaces: Element[] = [];
  let frontier: Element[] = [menu];

  for (let depth = 0; depth < MAX_SURFACE_DEPTH && frontier.length > 0; depth++) {
    const next: Element[] = [];

    for (const host of frontier) {
      for (const trigger of Array.from(host.querySelectorAll("[aria-controls]"))) {
        if (trigger.getAttribute("aria-expanded") === "false") continue;

        const id = trigger.getAttribute("aria-controls");
        if (!id) continue;

        const surface = document.getElementById(id);
        if (!surface || surface === menu || surfaces.includes(surface)) continue;
        // Inline surfaces already live inside the menu; nothing to add.
        if (menu.contains(surface)) continue;

        surfaces.push(surface);
        next.push(surface);
      }
    }

    frontier = next;
  }

  return surfaces;
}

/**
 * Whether the menu has any overlay open — inline or portaled.
 *
 * {@link collectOpenSurfaces} only reports surfaces that live outside the menu,
 * so a dropdown rendered inline would read as "nothing open". The open trigger
 * is the one signal both shapes share, wherever the surface ends up.
 */
function hasOpenOverlay(menu: HTMLElement): boolean {
  if (menu.querySelector(OPEN_TRIGGER_SELECTOR)) return true;
  return collectOpenSurfaces(menu).some((surface) => surface.querySelector(OPEN_TRIGGER_SELECTOR));
}

// ═══════════════ Factory ═══════════════

/**
 * Dismisses a bubble menu when the user leaves it — pressing the pointer down
 * outside the editor's chrome, pressing Escape, or giving focus to something
 * else — instead of relying on the upstream plugin's blur path.
 *
 * An interaction is treated as *inside* — and therefore ignored — when it lands
 * in the menu element, anywhere in this editor's `.scryb-editor` root, in a chrome
 * root the adapter declares, or in an overlay the menu currently owns (see the module header for how ownership is
 * resolved). Escape is deferred while such an overlay is open, so the first
 * press closes the overlay and only the next one closes the menu.
 *
 * Listeners are registered on `window` in the capture phase. Capture starts at
 * the window, so these run before any document-level listener — including the
 * adapters' own overlay controls, whose Escape handler would otherwise have
 * already closed the overlay and left this one reading "nothing was open".
 *
 * @param options - Editor, plugin key, menu element accessor and optional hook.
 * @returns Cleanup function that removes the listeners. Safe to call twice.
 *
 * @example
 * ```ts
 * const dispose = createBubbleMenuOutsideDismiss({
 *   editor,
 *   pluginKey: "scrybTextBubbleMenu",
 *   getMenuElement: () => menuElementRef.current,
 *   onDismiss: () => setOverflowOpen(false),
 * });
 * // later
 * dispose();
 * ```
 */
export function createBubbleMenuOutsideDismiss(
  options: BubbleMenuOutsideDismissOptions,
): () => void {
  if (typeof window === "undefined") return () => undefined;

  const { editor, pluginKey, getMenuElement, getChromeRoots, onDismiss } = options;

  /**
   * The visible menu, or `null` when there is nothing to dismiss. Every handler
   * starts here so an idle editor costs one property read per event.
   */
  const activeMenu = (): HTMLElement | null => {
    if (editor.isDestroyed) return null;
    const menu = getMenuElement();
    return isMenuLive(menu, editor) ? menu : null;
  };

  /** Whether an element belongs to the menu, this editor's chrome, or an owned overlay. */
  const isInsideChrome = (element: Element, menu: HTMLElement): boolean => {
    if (menu.contains(element)) return true;

    const root = editor.view.dom.closest(EDITOR_ROOT_SELECTOR) ?? editor.view.dom.parentElement;
    if (root?.contains(element)) return true;

    const extraRoots = getChromeRoots?.() ?? [];
    if (extraRoots.some((chrome) => chrome?.contains(element))) return true;

    return collectOpenSurfaces(menu).some((surface) => surface.contains(element));
  };

  const dismiss = (): void => {
    onDismiss?.();
    editor.view.dispatch(editor.state.tr.setMeta(pluginKey, HIDE_META));
  };

  // ── Pointer ──────────────────────────────────────────────────────────────
  const handleMouseDown = (event: MouseEvent): void => {
    const menu = activeMenu();
    if (!menu) return;

    const target = resolveTarget(event);
    if (!target || isInsideChrome(target, menu)) return;

    dismiss();
  };

  // ── Keyboard ─────────────────────────────────────────────────────────────
  let pendingEscape: ReturnType<typeof setTimeout> | undefined;
  let stopMarkingEscape: (() => void) | undefined;

  /**
   * Marks `event` as used once overlays registered on the document have seen
   * it, but before it reaches the editor.
   *
   * Something always closes on this press — the overlay, or the menu once the
   * deferred check finds the overlay ignored the key — so the editor's
   * Esc-then-Tab release must not arm on it. Marking it here, in the window's
   * capture phase, would be too early: overlay primitives such as Radix's
   * DismissableLayer listen on the document and skip an Escape that is already
   * `defaultPrevented`, so the overlay would stay open. A document capture
   * listener added now runs after theirs, since an event reaching a node runs
   * the listeners that node holds at that moment, in registration order.
   */
  const markEscapeAfterOverlays = (event: KeyboardEvent): void => {
    stopMarkingEscape?.();
    const doc = editor.view.dom.ownerDocument;
    const mark = (seen: Event): void => {
      if (seen !== event) return;
      stopMarkingEscape?.();
      if (!seen.defaultPrevented) seen.preventDefault();
    };
    doc.addEventListener("keydown", mark, true);
    stopMarkingEscape = () => {
      doc.removeEventListener("keydown", mark, true);
      stopMarkingEscape = undefined;
    };
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== ESCAPE_KEY) return;

    const menu = activeMenu();
    if (!menu) return;

    // An open overlay owns the first Escape: it closes, the menu stays. Not
    // every overlay handles the key though, and one that ignores it must not
    // swallow the menu's own dismissal — so the verdict waits a tick and reads
    // whether anything actually closed.
    if (hasOpenOverlay(menu)) {
      markEscapeAfterOverlays(event);
      clearTimeout(pendingEscape);
      pendingEscape = setTimeout(() => {
        // Normally already gone; covers a propagation stopped before the document.
        stopMarkingEscape?.();
        const stillOpen = activeMenu();
        if (stillOpen && hasOpenOverlay(stillOpen)) dismiss();
      }, 0);
      return;
    }

    // A keyboard user who reached the menu with Alt+F10 must land back in the
    // text, not on <body> when the menu disappears under them.
    const focusWasInMenu = menu.contains(document.activeElement);
    // The key is spent closing this menu. Marking it stops the editor's
    // Esc-then-Tab release from also arming on the same press.
    event.preventDefault();
    dismiss();
    if (focusWasInMenu) editor.commands.focus();
  };

  // ── Focus ────────────────────────────────────────────────────────────────
  const handleFocusIn = (event: FocusEvent): void => {
    const menu = activeMenu();
    if (!menu) return;

    // Where focus landed is the only reliable signal — see the module header.
    const to = toElement(event.target);
    if (!to || isInsideChrome(to, menu)) return;

    dismiss();
  };

  window.addEventListener("mousedown", handleMouseDown, true);
  window.addEventListener("keydown", handleKeyDown, true);
  window.addEventListener("focusin", handleFocusIn, true);

  return () => {
    clearTimeout(pendingEscape);
    stopMarkingEscape?.();
    window.removeEventListener("mousedown", handleMouseDown, true);
    window.removeEventListener("keydown", handleKeyDown, true);
    window.removeEventListener("focusin", handleFocusIn, true);
  };
}
