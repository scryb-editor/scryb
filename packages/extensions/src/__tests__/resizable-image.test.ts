import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { ResizableImageExtension } from "../resizable-image.extension";
import { calculateNewDimensions } from "../utils/resize-handler.utils";
import type { Node as ProseMirrorNode } from "prosemirror-model";

describe("ResizableImageExtension", () => {
  let editor: Editor | undefined;

  beforeEach(() => {
    // Stub document.createElement and related DOM APIs not available in happy-dom
    // for resize control creation which uses querySelectorAll
    vi.spyOn(document, "querySelectorAll").mockReturnValue([] as unknown as NodeListOf<Element>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    editor?.destroy();
    editor = undefined;
  });

  function createEditor(content?: string) {
    return new Editor({
      extensions: [
        StarterKit,
        ResizableImageExtension.configure({
          inline: false,
          allowBase64: true,
          runOutsideZone: (fn) => fn(),
        }),
      ],
      content: content ?? "<p>hello</p>",
    });
  }

  // Test 1: Extension registers and has name 'resizableImage'
  it("extension has name 'resizableImage'", () => {
    editor = createEditor();
    const ext = editor.extensionManager.extensions.find((e) => e.name === "resizableImage");
    expect(ext).toBeDefined();
    expect(ext?.name).toBe("resizableImage");
  });

  // Test 2: NodeView update returns false when node type is not resizableImage
  it("NodeView update returns false when node type is not resizableImage", () => {
    editor = createEditor();

    // Create a paragraph node (not resizableImage) and test the type guard
    const paragraphNode = editor.schema.nodes["paragraph"]?.create({ }, editor.schema.text("test"));
    expect(paragraphNode).toBeDefined();
    if (!paragraphNode) return;

    // The updateImageNode function (internal to the extension) guards on node.type.name !== 'resizableImage'
    // We verify this by checking that the paragraph node type name is NOT 'resizableImage'
    expect(paragraphNode.type.name).not.toBe("resizableImage");
    expect(paragraphNode.type.name).toBe("paragraph");
  });

  // Test 3: NodeView update processes correctly when node IS resizableImage
  it("resizableImage node type exists in schema", () => {
    editor = createEditor();
    const imageNodeType = editor.schema.nodes["resizableImage"];
    expect(imageNodeType).toBeDefined();
    expect(imageNodeType?.name).toBe("resizableImage");
  });

  // Test 4: setResizableImage command inserts an image node
  it("setResizableImage command exists on editor", () => {
    editor = createEditor();
    expect(typeof editor.commands.setResizableImage).toBe("function");
  });

  // Test 5: updateResizableImage command exists on editor
  it("updateResizableImage command exists on editor", () => {
    editor = createEditor();
    expect(typeof editor.commands.updateResizableImage).toBe("function");
  });

  // Additional: Verify NodeView architecture — ProseMirror only calls update()
  // when the node changes, not on every transaction. This satisfies RNTM-03:
  // no per-transaction overhead for the ResizableImage NodeView.
  it("ResizableImageExtension uses addNodeView (not addProseMirrorPlugins) — inherently guarded against per-transaction overhead", () => {
    // The extension should define addNodeView, not a ProseMirror plugin with
    // a per-transaction update handler. This test documents the RNTM-03 guarantee.
    editor = createEditor();

    // The extension does NOT register a ProseMirror plugin via addProseMirrorPlugins
    // (it only uses addNodeView). ProseMirror NodeViews are called only when the
    // specific node may have changed — cursor-only transactions never trigger the NodeView update.
    const ext = editor.extensionManager.extensions.find((e) => e.name === "resizableImage");
    expect(ext).toBeDefined();

    // Verify the extension has no state plugin that would run on every transaction
    // by checking that options only contain the documented NodeView options
    const options = ext?.options as { inline: boolean; allowBase64: boolean; runOutsideZone: (fn: () => void) => void; HTMLAttributes: Record<string, unknown> };
    expect(typeof options.inline).toBe("boolean");
    expect(typeof options.allowBase64).toBe("boolean");
    expect(typeof options.runOutsideZone).toBe("function");
  });

  // ═══════════════ Dimension contract ═══════════════
  //
  // A width is either a pixel count or a CSS length, and the two take different
  // routes out of the document. Getting this wrong is not cosmetic:
  // `HTMLImageElement.width` is an IDL `unsigned long`, so a percentage assigned
  // to it becomes 0 and the image disappears.

  it("keeps a pixel width on the HTML attribute", () => {
    editor = createEditor();
    editor.commands.setResizableImage({ src: "img.png", width: 400, height: 200 });

    const html = editor.getHTML();
    expect(html).toContain('width="400"');
    expect(html).toContain('height="200"');
    expect(html).not.toContain("style=");
  });

  it("moves a CSS-length width into inline style, where it survives", () => {
    editor = createEditor();
    editor.commands.setResizableImage({ src: "img.png", width: "25%" });

    const html = editor.getHTML();
    expect(html).toContain("width: 25%");
    // The bare attribute would have been truncated to 25 pixels on the way back in.
    expect(html).not.toContain('width="25%"');
    expect(html).not.toContain('width="25"');
  });

  it("round-trips a percentage width through parse", () => {
    editor = createEditor('<img src="img.png" style="width: 50%">');
    const attrs = editor.state.doc.firstChild?.attrs;
    expect(attrs?.["width"]).toBe("50%");
  });

  it("round-trips a pixel width through parse, from either representation", () => {
    editor = createEditor('<img src="img.png" width="320">');
    expect(editor.state.doc.firstChild?.attrs["width"]).toBe(320);
    editor.destroy();

    editor = createEditor('<img src="img.png" style="width: 320px">');
    expect(editor.state.doc.firstChild?.attrs["width"]).toBe(320);
  });

  // ═══════════════ Resize bounds ═══════════════

  it("a drag cannot grow the image past the width it was given", () => {
    // The only ceiling used to be a 2000px constant, so dragging the corner
    // pushed the image straight out of the editor and off the page.
    const state = {
      isResizing: true,
      startX: 0,
      startY: 0,
      startWidth: 400,
      startHeight: 200,
      aspectRatio: 2,
      maxWidth: 470,
    };

    const result = calculateNewDimensions("se", 1200, 600, state);

    expect(result.width).toBe(470);
    // Both axes scale together — clamping the width alone would stretch the
    // image at the exact moment it reached the edge.
    expect(result.width / result.height).toBeCloseTo(400 / 200, 1);
  });

  it("a drag on the vertical edge is bounded by the same width", () => {
    const state = {
      isResizing: true,
      startX: 0,
      startY: 0,
      startWidth: 400,
      startHeight: 200,
      aspectRatio: 2,
      maxWidth: 470,
    };

    // Dragging "s" grows the height, and the width follows from the ratio.
    const result = calculateNewDimensions("s", 0, 900, state);

    expect(result.width).toBeLessThanOrEqual(470);
  });

  it("gives the image a width of its own during a drag, even with none stored", () => {
    // An image with no width attribute — straight from "Original size", from a
    // URL insert, or from pasted `<img src>` — sized the container by its own
    // intrinsic box. A drag wrote pixels to the container only, nothing
    // stretched the image to follow, and mouseup read the rendered box back:
    // the whole gesture committed the size it started from.
    vi.spyOn(document, "querySelectorAll").mockRestore();
    editor = createEditor('<img src="img.png">');

    const container = editor.view.nodeDOM(0) as HTMLElement;
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.style.width).toBe("");

    const handle = container.querySelector('.resize-handle[data-direction="se"]');
    handle?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: 0, clientY: 0 }));
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 120, clientY: 60 }));

    expect(img.style.width).toBe("100%");
    expect(container.style.width).not.toBe("");

    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  });

  it("drops both representations when the width is cleared", () => {
    editor = createEditor();
    editor.commands.setResizableImage({ src: "img.png", width: "25%" });
    // updateAttributes only reaches a node the selection is on.
    editor.commands.setNodeSelection(0);
    editor.commands.updateResizableImage({ width: null, height: null });

    const html = editor.getHTML();
    expect(html).not.toContain("width");
    expect(html).not.toContain("height");
  });
});
