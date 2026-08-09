// @vitest-environment jsdom
//
// DOMPurify 3.4.12 requires a standard-compliant DOM implementation to walk
// and sanitize the element tree correctly. happy-dom (the package default,
// see vitest.config.ts) does not fully satisfy DOMPurify's expectations with
// this dompurify version, which silently breaks sanitization in tests only
// (real browsers are unaffected). jsdom is the DOM DOMPurify's own test suite
// targets, so this file opts into it via the per-file environment pragma.
import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { PasteCleanupExtension } from "../paste-cleanup.extension";
import DOMPurify from "dompurify";

describe("PasteCleanupExtension", () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  function createEditor() {
    return new Editor({
      extensions: [StarterKit, PasteCleanupExtension],
      content: "<p></p>",
    });
  }

  it("extension has name 'pasteCleanup'", () => {
    editor = createEditor();
    const ext = editor.extensionManager.extensions.find(
      (e) => e.name === "pasteCleanup",
    );
    expect(ext).toBeDefined();
  });

  it("is exported as PasteCleanupExtension", () => {
    expect(PasteCleanupExtension).toBeDefined();
    expect(PasteCleanupExtension.name).toBe("pasteCleanup");
  });

  it("DOMPurify strips script tags from HTML", () => {
    const dirty = '<p>Hello</p><script>alert("xss")</script>';
    const clean = DOMPurify.sanitize(dirty);
    expect(clean).not.toContain("<script>");
    expect(clean).toContain("<p>Hello</p>");
  });

  it("DOMPurify strips event attributes from HTML", () => {
    const dirty = '<img src="x" onerror="alert(1)">';
    const clean = DOMPurify.sanitize(dirty);
    expect(clean).not.toContain("onerror");
  });

  it("DOMPurify passes through clean HTML", () => {
    const clean = "<p>Normal <strong>bold</strong> text</p>";
    const result = DOMPurify.sanitize(clean);
    expect(result).toContain("<p>Normal");
    expect(result).toContain("<strong>bold</strong>");
  });
});
