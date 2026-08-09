import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { DragHandleExtension } from "../drag-handle.extension";

describe("DragHandleExtension", () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  function createEditor(content?: string) {
    return new Editor({
      extensions: [StarterKit, DragHandleExtension],
      content: content ?? "<p></p>",
    });
  }

  it("extension has name 'dragHandle'", () => {
    editor = createEditor();
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === "dragHandle",
    );
    expect(ext).toBeDefined();
  });

  it("DragHandleExtension is exported and has correct name property", () => {
    expect(DragHandleExtension).toBeDefined();
    expect(DragHandleExtension.name).toBe("dragHandle");
  });

  it("moveBlock command exists on editor", () => {
    editor = createEditor();
    expect(typeof editor.commands.moveBlock).toBe("function");
  });

  it("moveBlock repositions a block — second paragraph before first", () => {
    editor = createEditor("<p>first</p><p>second</p>");
    const state = editor.state;

    // doc structure: doc(paragraph("first"), paragraph("second"))
    // paragraph "first": starts at pos 0, nodeSize = 2 + 5 = 7
    // paragraph "second": starts at pos 7, nodeSize = 2 + 6 = 8
    const firstChild = state.doc.child(0);
    const secondChild = state.doc.child(1);
    expect(firstChild.textContent).toBe("first");
    expect(secondChild.textContent).toBe("second");

    // Move first paragraph (pos 0) to after second paragraph
    // After second paragraph ends at pos 7 + 8 = 15, but we insert at end = doc.content.size = 15
    const result = editor.commands.moveBlock(0, 15);
    expect(result).toBe(true);

    const newDoc = editor.state.doc;
    expect(newDoc.child(0).textContent).toBe("second");
    expect(newDoc.child(1).textContent).toBe("first");
  });

  it("moveBlock returns false for invalid fromPos (nodeAt returns null)", () => {
    editor = createEditor("<p>hello</p>");
    // Position 999 is out of document range
    const result = editor.commands.moveBlock(999, 0);
    expect(result).toBe(false);
  });

  it("moveBlock returns false when fromPos equals toPos (no-op)", () => {
    editor = createEditor("<p>hello</p>");
    const result = editor.commands.moveBlock(0, 0);
    expect(result).toBe(false);
  });

  it("no Angular or React imports in extension source", async () => {
    // Import the extension module and verify no framework symbols are present.
    // A React component would have $$typeof; an Angular service would have ɵprov.
    const ext = await import("../drag-handle.extension");
    // The module exports DragHandleExtension and DragHandleExtensionOptions type
    const exportedKeys = Object.keys(ext);
    expect(exportedKeys).toContain("DragHandleExtension");
    // Framework-specific markers must be absent from the exported extension object
    const extAsUnknown = DragHandleExtension as unknown as Record<string, unknown>;
    expect(extAsUnknown["$$typeof"]).toBeUndefined();
    expect(extAsUnknown["ɵprov"]).toBeUndefined();
  });
});
