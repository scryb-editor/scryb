import { describe, it, expect, afterEach, vi } from "vitest";
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

  describe("shortcut names", () => {
    /** Loads the hint fresh under `userAgent`; the shortcut module reads the platform once at import. */
    async function hintFor(userAgent: string, catalog = en): Promise<string> {
      vi.resetModules();
      vi.stubGlobal("navigator", { userAgent });
      const { getKeyboardHintText: fresh } = await import("../accessibility/keyboard-hint");
      return fresh(catalog);
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("names the keys the way a Mac keyboard labels them", async () => {
      const text = await hintFor("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
      expect(text).toContain("⌥F10 moves to the formatting menu or the toolbar.");
      expect(text).toContain("⇧F10 opens the actions for the current block.");
      expect(text).not.toContain("Alt+F10");
    });

    it("names Alt and Shift elsewhere", async () => {
      const text = await hintFor("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
      expect(text).toContain("Alt+F10 moves to the formatting menu or the toolbar.");
      expect(text).toContain("Shift+F10 opens the actions for the current block.");
    });

    it("keeps a consumer's sentence that spells the keys out itself", async () => {
      const catalog = {
        ...en,
        editor: { ...en.editor, keyboardHints: { ...en.editor.keyboardHints, toolbar: "Option+F10 reaches the menus." } },
      };
      expect(await hintFor("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", catalog)).toContain(
        "Option+F10 reaches the menus.",
      );
    });
  });

  it("lists the menu keys before the move keys", () => {
    const text = getKeyboardHintText(en);
    expect(text.indexOf("formatting menu")).toBeLessThan(text.indexOf("actions for the current block"));
    expect(text.indexOf("actions for the current block")).toBeLessThan(text.indexOf("moves the current block"));
  });

  it("falls back to the English block-menu sentence", () => {
    const { blockMenu: _omitted, ...rest } = en.editor.keyboardHints!;
    const catalog = { ...en, editor: { ...en.editor, keyboardHints: rest } };
    expect(getKeyboardHintText(catalog)).toContain("F10 opens the actions for the current block.");
  });

  it.each([
    ["en", en],
    ["es", es],
    ["fr", fr],
    ["pt", pt],
    ["zh", zh],
  ])("leaves the key names to the platform in %s", (_code, catalog) => {
    const hints = catalog.editor.keyboardHints;
    expect(hints?.leaveEditor).toBeTruthy();
    expect(hints?.toolbar).toContain("{keys}");
    expect(hints?.blockMenu).toContain("{keys}");
    expect(getKeyboardHintText(catalog)).not.toContain("{keys}");
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
