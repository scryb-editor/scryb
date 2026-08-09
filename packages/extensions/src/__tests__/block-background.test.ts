import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { BlockBackgroundExtension } from "../block-background.extension";

// =============================================================================
// Block background round trip
// =============================================================================
//
// `parseHTML` returned `{ backgroundColor: value }` where Tiptap wants the
// value: the return is assigned straight onto the attribute, so every parsed
// block stored the truthy object `{ backgroundColor: null }`. `renderHTML` then
// emitted `background-color: [object Object]`, which the browser discards —
// leaving `style=""` on every block in the demo's HTML output, and losing real
// background colours on any HTML round trip.
// =============================================================================

let editor: Editor | null = null;

function createEditor(content: string): Editor {
  editor = new Editor({ extensions: [StarterKit, BlockBackgroundExtension], content });
  return editor;
}

function backgroundAttrs(instance: Editor): unknown[] {
  const found: unknown[] = [];
  instance.state.doc.descendants((node) => {
    if (node.type.name === "paragraph") found.push(node.attrs["backgroundColor"]);
    return true;
  });
  return found;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("BlockBackgroundExtension", () => {
  it("parses a background colour into a string, not an object", () => {
    const instance = createEditor('<p style="background-color: rgb(255, 235, 59)">Tinted</p>');

    expect(backgroundAttrs(instance)).toEqual(["rgb(255, 235, 59)"]);
  });

  it("leaves an untinted block null", () => {
    const instance = createEditor("<p>Plain</p>");

    expect(backgroundAttrs(instance)).toEqual([null]);
  });

  it("emits no style attribute for an untinted block", () => {
    const instance = createEditor("<p>Plain</p>");

    expect(instance.getHTML()).not.toContain('style=""');
    expect(instance.getHTML()).not.toContain("[object Object]");
  });

  it("survives an HTML round trip", () => {
    const instance = createEditor('<p style="background-color: rgb(255, 235, 59)">Tinted</p>');

    const html = instance.getHTML();
    expect(html).toContain("background-color: rgb(255, 235, 59)");

    const reparsed = new Editor({
      extensions: [StarterKit, BlockBackgroundExtension],
      content: html,
    });
    expect(backgroundAttrs(reparsed)).toEqual(["rgb(255, 235, 59)"]);
    reparsed.destroy();
  });
});
