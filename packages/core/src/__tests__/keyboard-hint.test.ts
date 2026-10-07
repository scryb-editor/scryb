import { describe, it, expect, afterEach } from "vitest";
import type { Editor } from "@tiptap/core";
import { createScrybEditor, buildExtensions } from "../editor-factory";
import {
  createEditorInstanceId,
  getKeyboardHintText,
  keyboardHintId,
} from "../accessibility/keyboard-hint";
import { getEditableAttributes } from "../accessibility/editable-attributes";
import { en } from "../i18n/locales/en";
import { es } from "../i18n/locales/es";
import { fr } from "../i18n/locales/fr";
import { pt } from "../i18n/locales/pt";
import { zh } from "../i18n/locales/zh";

describe("keyboard hint", () => {
  let editor: Editor | undefined;
  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it("creates unique instance ids", () => {
    const ids = new Set([createEditorInstanceId(), createEditorInstanceId(), createEditorInstanceId()]);
    expect(ids.size).toBe(3);
  });

  it("derives the hint id from the instance id", () => {
    expect(keyboardHintId("scryb-editor-7")).toBe("scryb-editor-7-keyboard-hint");
  });

  it("tells the user how to leave the editor", () => {
    expect(getKeyboardHintText(en)).toContain("Press Escape, then Tab, to leave the editor.");
  });

  it("lists Alt+F10", () => expect(getKeyboardHintText(en)).toContain("Alt+F10"));

  it("lists Shift+F10 after Alt+F10, before the move keys", () => {
    const text = getKeyboardHintText(en);
    expect(text).toContain("Shift+F10 opens the actions for the current block.");
    expect(text.indexOf("Alt+F10")).toBeLessThan(text.indexOf("Shift+F10"));
    expect(text.indexOf("Shift+F10")).toBeLessThan(text.indexOf("moves the current block"));
  });

  it("falls back to the English Shift+F10 sentence", () => {
    const { blockMenu: _omitted, ...rest } = en.editor.keyboardHints!;
    const catalog = { ...en, editor: { ...en.editor, keyboardHints: rest } };
    expect(getKeyboardHintText(catalog)).toContain("Shift+F10 opens the actions for the current block.");
  });

  it.each([
    ["en", en],
    ["es", es],
    ["fr", fr],
    ["pt", pt],
    ["zh", zh],
  ])("ships the leave-editor and block-menu hints in %s", (_code, catalog) => {
    expect(catalog.editor.keyboardHints?.leaveEditor).toBeTruthy();
    expect(catalog.editor.keyboardHints?.blockMenu).toContain("F10");
  });

  it("points the editable's aria-describedby at the hint", () => {
    editor = createScrybEditor({
      editorProps: { attributes: getEditableAttributes({ keyboardHintId: "x-keyboard-hint", label: "Editor content" }) },
    });
    expect(editor.view.dom.getAttribute("aria-describedby")).toBe("x-keyboard-hint");
    expect(editor.view.dom.getAttribute("aria-label")).toBe("Editor content");
    expect(editor.view.dom.classList.contains("scryb-content")).toBe(true);
  });

  it("registers the keyboard release in every editor core builds", () => {
    expect(buildExtensions().map((ext) => ext.name)).toContain("scrybKeyboardRelease");
  });
});
