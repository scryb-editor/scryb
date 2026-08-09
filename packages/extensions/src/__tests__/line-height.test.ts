import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { LineHeightExtension } from "../line-height.extension";

describe("LineHeightExtension", () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  function createEditor(content = "<p>Hello</p>") {
    return new Editor({
      extensions: [StarterKit, LineHeightExtension],
      content,
    });
  }

  it("is exported with the name 'lineHeight'", () => {
    expect(LineHeightExtension.name).toBe("lineHeight");
  });

  it("writes the line height onto the block, not onto a span", () => {
    editor = createEditor();
    editor.commands.selectAll();
    editor.commands.setLineHeight("1.15");

    // The whole point: a span would be capped by the block's strut and render
    // identically to the stylesheet for every value below it.
    expect(editor.getHTML()).toBe('<p style="line-height: 1.15;">Hello</p>');
    expect(editor.getHTML()).not.toContain("<span");
  });

  it("applies to a heading as well as a paragraph", () => {
    editor = createEditor("<h2>Title</h2>");
    editor.commands.selectAll();
    editor.commands.setLineHeight("2");

    expect(editor.getHTML()).toContain('line-height: 2');
    expect(editor.getHTML()).toContain("<h2");
  });

  it("applies to every block the selection touches", () => {
    editor = createEditor("<p>One</p><p>Two</p><p>Three</p>");
    editor.commands.selectAll();
    editor.commands.setLineHeight("3");

    const matches = editor.getHTML().match(/line-height: 3/g);
    expect(matches).toHaveLength(3);
  });

  it("applies to the block under a collapsed cursor", () => {
    editor = createEditor("<p>One</p><p>Two</p>");
    // Inside the second paragraph, nothing selected.
    editor.commands.setTextSelection(8);
    editor.commands.setLineHeight("1");

    const html = editor.getHTML();
    expect(html).toBe('<p>One</p><p style="line-height: 1;">Two</p>');
  });

  it("unsetLineHeight restores the stylesheet's line height", () => {
    editor = createEditor();
    editor.commands.selectAll();
    editor.commands.setLineHeight("1.15");
    editor.commands.selectAll();
    editor.commands.unsetLineHeight();

    expect(editor.getHTML()).toBe("<p>Hello</p>");
  });

  it("reports false when nothing in the selection changes", () => {
    editor = createEditor();
    editor.commands.selectAll();
    expect(editor.commands.setLineHeight("1.5")).toBe(true);
    editor.commands.selectAll();
    expect(editor.commands.setLineHeight("1.5")).toBe(false);
  });

  it("round-trips a line height through HTML", () => {
    editor = createEditor('<p style="line-height: 2.5">Hello</p>');
    expect(editor.getAttributes("paragraph")["lineHeight"]).toBe("2.5");
    expect(editor.getHTML()).toContain("line-height: 2.5");
  });

  it("preserves a value that carries a unit", () => {
    editor = createEditor();
    editor.commands.selectAll();
    editor.commands.setLineHeight("24px");

    expect(editor.getHTML()).toContain("line-height: 24px");
  });

  it("lifts a legacy span line height onto the block", () => {
    // What the pre-node version of this extension used to write.
    editor = createEditor('<p><span style="line-height: 1.15">Hello</span></p>');

    expect(editor.getAttributes("paragraph")["lineHeight"]).toBe("1.15");
    expect(editor.getHTML()).toContain('<p style="line-height: 1.15;"');
  });
});
