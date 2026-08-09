import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isFocusWithinEditor, watchForFocusLeavingEditor } from "../utils/dom-events";

// ═══════════════ Fixtures ═══════════════

let card: HTMLElement;
let portal: HTMLElement;
let outside: HTMLElement;

beforeEach(() => {
  card = document.createElement("div");
  const toolbarButton = document.createElement("button");
  card.appendChild(toolbarButton);

  portal = document.createElement("div");
  outside = document.createElement("button");

  document.body.append(card, portal, outside);
});

afterEach(() => {
  card.remove();
  portal.remove();
  outside.remove();
});

/** Dispatches a real event so the capture-phase listeners under test run. */
function fire(type: "pointerdown" | "focusin", target: Element): void {
  target.dispatchEvent(new Event(type, { bubbles: true }));
}

// ═══════════════ Tests ═══════════════

describe("isFocusWithinEditor", () => {
  it("is true when focus moved to the editor's own chrome", () => {
    const event = { relatedTarget: card.firstElementChild } as unknown as FocusEvent;
    expect(isFocusWithinEditor(event, [card, portal])).toBe(true);
  });

  it("is false when focus moved elsewhere on the page", () => {
    const event = { relatedTarget: outside } as unknown as FocusEvent;
    expect(isFocusWithinEditor(event, [card, portal])).toBe(false);
  });

  it("is false when there is no relatedTarget", () => {
    const event = { relatedTarget: null } as unknown as FocusEvent;
    expect(isFocusWithinEditor(event, [card, portal])).toBe(false);
  });
});

describe("watchForFocusLeavingEditor", () => {
  it("stays quiet while the pointer and focus remain inside the editor", () => {
    const onLeave = vi.fn();
    const disarm = watchForFocusLeavingEditor([card, portal], onLeave);

    fire("pointerdown", card.firstElementChild!);
    fire("focusin", card.firstElementChild!);
    fire("pointerdown", portal);

    expect(onLeave).not.toHaveBeenCalled();
    disarm();
  });

  it("fires once the pointer lands outside, then disarms itself", () => {
    const onLeave = vi.fn();
    watchForFocusLeavingEditor([card, portal], onLeave);

    fire("pointerdown", outside);
    expect(onLeave).toHaveBeenCalledTimes(1);

    // Already disarmed — a second interaction must not re-fire.
    fire("pointerdown", outside);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("fires when focus moves outside without a pointer event", () => {
    const onLeave = vi.fn();
    watchForFocusLeavingEditor([card, portal], onLeave);

    fire("focusin", outside);

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("never fires after the returned cleanup runs", () => {
    const onLeave = vi.fn();
    const disarm = watchForFocusLeavingEditor([card, portal], onLeave);

    disarm();
    fire("pointerdown", outside);

    expect(onLeave).not.toHaveBeenCalled();
  });

  it("tolerates cleanup being called after it already fired", () => {
    const onLeave = vi.fn();
    const disarm = watchForFocusLeavingEditor([card, portal], onLeave);

    fire("pointerdown", outside);
    expect(() => disarm()).not.toThrow();
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it("ignores roots that are null (an adapter's portal before it mounts)", () => {
    const onLeave = vi.fn();
    watchForFocusLeavingEditor([card, null], onLeave);

    fire("pointerdown", card.firstElementChild!);
    expect(onLeave).not.toHaveBeenCalled();

    fire("pointerdown", outside);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});
