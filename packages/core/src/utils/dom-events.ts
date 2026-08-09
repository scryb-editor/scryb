/**
 * Records the target of the most recent pointerdown, so a blur can tell a
 * scrollbar drag apart from the user clicking away.
 *
 * A blur carries no coordinates, and the two cases are otherwise identical at
 * the event level — both arrive with `relatedTarget === null`, the document
 * still focused, and `document.activeElement` reset to `<body>`.
 *
 * The asymmetry that separates them: Chrome handles native scrollbar
 * interaction in the compositor and dispatches no DOM pointer event for it, so
 * after a scrollbar drag the last pointerdown is still the one that focused the
 * editor — inside it. A click-away always leaves a pointerdown outside.
 */
let pointerTrackingInstalled = false;
/**
 * Held weakly: the listener is never removed, so a strong reference would pin a
 * destroyed editor's whole detached subtree until the next pointerdown anywhere
 * in the document. Clearing on pointerup is not an option — a scrollbar drag is
 * recognised precisely by the pointerdown that focused the editor still being
 * the last one on record, and its own pointerup would erase it.
 */
let lastPointerDownTarget: WeakRef<Node> | null = null;

function handlePointerDown(event: PointerEvent): void {
  lastPointerDownTarget = event.target instanceof Node ? new WeakRef(event.target) : null;
}

/**
 * Starts tracking pointerdown targets for {@link isScrollInducedBlur}.
 *
 * Idempotent and safe to call from every editor instance: one capture-phase
 * listener is installed for the document, never removed, and no-ops outside a
 * DOM environment. Adapters call this where they wire focus/blur, which always
 * runs before the pointerdown that can end the focus.
 *
 * @example
 * installPointerTracking();
 * editor.on("blur", ({ event }) => {
 *   if (isScrollInducedBlur(event, editorRoot)) return;
 *   // ...deactivate
 * });
 */
export function installPointerTracking(): void {
  if (pointerTrackingInstalled || typeof document === "undefined") return;
  pointerTrackingInstalled = true;
  document.addEventListener("pointerdown", handlePointerDown, true);
}

/**
 * True when a blur event was caused by dragging a scrollbar rather than by the
 * user leaving the editor.
 *
 * Dragging a scrollbar blurs a contenteditable with `relatedTarget === null`
 * while the document still has focus. So does clicking any non-focusable
 * element, which is how most users leave an editor — testing those two
 * conditions alone therefore swallows the ordinary click-away and pins the
 * editor active for the whole session. `editorRoot` plus
 * {@link installPointerTracking} supply the missing signal; without either this
 * reports `false` and the click-away wins, which is the safer of the two
 * defaults.
 *
 * Wheel and keyboard scrolling do not blur at all, so they never reach here.
 *
 * @param event - The `FocusEvent` delivered with Tiptap's `blur`.
 * @param editorRoot - The editor's outermost element. The toolbar and menus
 *   must be inside it, or interacting with them reads as leaving the editor.
 * @returns `true` when the blur should be ignored.
 */
export function isScrollInducedBlur(event: FocusEvent, editorRoot?: Element | null): boolean {
  if (event.relatedTarget !== null) return false;
  if (typeof document === "undefined") return false;
  if (!document.hasFocus()) return false;
  const pointerTarget = lastPointerDownTarget?.deref() ?? null;
  if (!editorRoot || !pointerTarget) return false;
  return editorRoot.contains(pointerTarget);
}

/**
 * True when a blur handed focus to something that still belongs to the editor.
 *
 * Menus that portal outside the editor's DOM — React's Radix dropdowns move
 * focus into their content on open — produce an ordinary focus handoff with a
 * `relatedTarget`, indistinguishable from the user clicking another widget on
 * the page. Under `hideWhenInactive` that collapsed the editor the moment a
 * toolbar dropdown opened, taking the open dropdown with it.
 *
 * @param event - The `FocusEvent` delivered with Tiptap's `blur`.
 * @param roots - Elements that count as "still the editor": its own root, plus
 *   any container it portals menus into.
 * @returns `true` when the blur should be ignored.
 *
 * @example
 * if (isFocusWithinEditor(event, [rootEl, portalEl])) return;
 */
export function isFocusWithinEditor(
  event: FocusEvent,
  roots: readonly (Element | null | undefined)[],
): boolean {
  const related = event.relatedTarget;
  if (typeof Node === "undefined" || !(related instanceof Node)) return false;
  return roots.some((root) => root?.contains(related) ?? false);
}

/**
 * Calls `onLeave` the first time the pointer or the focus lands outside every
 * given root, then disarms itself.
 *
 * The companion to {@link isFocusWithinEditor}, and the reason it is not enough
 * on its own: once focus has moved to the editor's own chrome — a toolbar
 * button, a portalled popover — the contenteditable is *already* blurred, so no
 * second `blur` will ever fire. An adapter that only returns early on that first
 * blur therefore never re-arms its deactivation timer, and `hideWhenInactive`
 * chrome stays up for the rest of the session once the user has opened the link
 * or image popover.
 *
 * Chrome dispatches no DOM pointer event for native scrollbar interaction (see
 * {@link isScrollInducedBlur}), so a scrollbar drag cannot trip this.
 *
 * @param roots - Elements that still count as "the editor": its root, plus any
 *   container it portals menus into.
 * @param onLeave - Run once, when focus or the pointer goes elsewhere.
 * @returns Cleanup that disarms the watch early; safe to call after it fired.
 *
 * @example
 * editor.on("blur", ({ event }) => {
 *   if (isFocusWithinEditor(event, roots)) {
 *     disarm = watchForFocusLeavingEditor(roots, scheduleDeactivate);
 *     return;
 *   }
 *   scheduleDeactivate();
 * });
 */
export function watchForFocusLeavingEditor(
  roots: readonly (Element | null | undefined)[],
  onLeave: () => void,
): () => void {
  if (typeof document === "undefined") return () => undefined;

  let disposed = false;

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    document.removeEventListener("pointerdown", handleLeave, true);
    document.removeEventListener("focusin", handleLeave, true);
  };

  function handleLeave(event: Event): void {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (roots.some((root) => root?.contains(target) ?? false)) return;
    dispose();
    onLeave();
  }

  document.addEventListener("pointerdown", handleLeave, true);
  document.addEventListener("focusin", handleLeave, true);

  return dispose;
}
