import { describe, it, expect } from "vitest";
import { createTocCallbackStore } from "../toc/callback-store";

// =============================================================================
// createTocCallbackStore — unit tests (CK-TOC-01, CK-XCUT-04)
// =============================================================================

describe("createTocCallbackStore", () => {
  it("returns an object with an onUpdate function (no-op by default)", () => {
    const store = createTocCallbackStore();
    expect(typeof store.onUpdate).toBe("function");
    // Calling the noop must not throw
    expect(() => store.onUpdate([])).not.toThrow();
    expect(() => store.onUpdate([], true)).not.toThrow();
  });

  it("onUpdate noop returns undefined (not an error)", () => {
    const store = createTocCallbackStore();
    const result = store.onUpdate([]);
    expect(result).toBeUndefined();
  });

  it("allows patching onUpdate by direct assignment and forwarding fires", () => {
    const store = createTocCallbackStore();
    let captured: unknown[] = [];
    let capturedIsCreate: boolean | undefined;

    store.onUpdate = (content, isCreate) => {
      captured = content;
      capturedIsCreate = isCreate;
    };

    const mockItem = {
      id: "abc",
      isActive: false,
      isScrolledOver: false,
      level: 1,
      originalLevel: 1,
      textContent: "Hello",
      pos: 0,
      dom: null as unknown as HTMLHeadingElement,
      editor: null as never,
      itemIndex: 0,
      node: null as never,
    };

    store.onUpdate([mockItem], true);
    expect(captured).toHaveLength(1);
    expect(capturedIsCreate).toBe(true);
  });

  it("creates independent stores (patches do not bleed between instances)", () => {
    const storeA = createTocCallbackStore();
    const storeB = createTocCallbackStore();

    let calledA = false;
    let calledB = false;

    storeA.onUpdate = () => { calledA = true; };
    storeB.onUpdate = () => { calledB = true; };

    storeA.onUpdate([]);
    expect(calledA).toBe(true);
    expect(calledB).toBe(false);

    storeB.onUpdate([]);
    expect(calledB).toBe(true);
  });
});
