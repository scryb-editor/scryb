import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { MarkdownAutoformatExtension } from "../markdown-autoformat.extension";

describe("MarkdownAutoformatExtension", () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  function createEditor() {
    return new Editor({
      extensions: [StarterKit, MarkdownAutoformatExtension],
      content: "<p></p>",
    });
  }

  it("extension has name 'markdownAutoformat'", () => {
    editor = createEditor();
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === "markdownAutoformat",
    );
    expect(ext).toBeDefined();
  });

  it("is exported as MarkdownAutoformatExtension", () => {
    expect(MarkdownAutoformatExtension).toBeDefined();
    expect(MarkdownAutoformatExtension.name).toBe("markdownAutoformat");
  });
});
