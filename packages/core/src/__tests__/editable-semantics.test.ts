import { afterEach, describe, expect, it } from "vitest";
import type { Editor } from "@tiptap/core";
import { createScrybEditor } from "../editor-factory";
import { getEditableAttributes } from "../accessibility/editable-attributes";
import { characterLimitId } from "../accessibility/keyboard-hint";
import { setTypeaheadCombobox, typeaheadComboboxState } from "../accessibility/typeahead-combobox";

let editor: Editor | undefined;
afterEach(() => { editor?.destroy(); editor = undefined; });

// Tiptap 3.30.2 emits `create` from a setTimeout (Editor.ts:186) and injects a
// direct role="textbox" at view construction (Editor.ts:600); the extension's
// onCreate re-applies the direct props, so assertions wait for `create`.
async function mount(attributes: Record<string, string>): Promise<Editor> {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const created = createScrybEditor({ element, editorProps: { attributes } });
  await new Promise<void>((resolve) => created.on("create", () => resolve()));
  return created;
}

describe("getEditableAttributes", () => {
  it("names and describes the editable", () => {
    expect(getEditableAttributes({ keyboardHintId: "e1-keyboard-hint", label: "Editor content", characterLimitId: "e1-character-limit" })).toEqual({
      "aria-label": "Editor content",
      "aria-describedby": "e1-keyboard-hint e1-character-limit",
    });
  });
  it("marks read-only and disabled, disabled winning", () => {
    expect(getEditableAttributes({ keyboardHintId: "h", label: "L", readOnly: true })["aria-readonly"]).toBe("true");
    const both = getEditableAttributes({ keyboardHintId: "h", label: "L", readOnly: true, disabled: true });
    expect(both["aria-disabled"]).toBe("true");
    expect(both["aria-readonly"]).toBeUndefined();
  });
  it("builds the limit id from the instance id", () => {
    expect(characterLimitId("scryb-editor-3")).toBe("scryb-editor-3-character-limit");
  });
});

describe("EditableSemanticsExtension", () => {
  it("puts role textbox + aria-multiline on view.dom", async () => {
    editor = await mount(getEditableAttributes({ keyboardHintId: "h", label: "Editor content" }));
    const dom = editor.view.dom;
    expect(dom.getAttribute("role")).toBe("textbox");
    expect(dom.getAttribute("aria-multiline")).toBe("true");
    expect(dom.getAttribute("aria-label")).toBe("Editor content");
    expect(dom.getAttribute("aria-describedby")).toBe("h");
  });
  it("keeps the role across setEditable (Tiptap drops its own on setOptions)", async () => {
    editor = await mount(getEditableAttributes({ keyboardHintId: "h", label: "L" }));
    editor.setEditable(false);
    editor.setEditable(true);
    expect(editor.view.dom.getAttribute("role")).toBe("textbox");
  });
  it("applies new attributes passed through setOptions", async () => {
    editor = await mount(getEditableAttributes({ keyboardHintId: "h", label: "L" }));
    editor.setOptions({ editorProps: { attributes: getEditableAttributes({ keyboardHintId: "h", label: "Contenu", readOnly: true }) } });
    expect(editor.view.dom.getAttribute("aria-label")).toBe("Contenu");
    expect(editor.view.dom.getAttribute("aria-readonly")).toBe("true");
  });
});

describe("typeahead hint on the editable (spec C2)", () => {
  const describedBy = (): string | null => editor!.view.dom.getAttribute("aria-describedby");

  it("appends the open popup's hint id and removes it on close", async () => {
    editor = await mount(getEditableAttributes({ keyboardHintId: "kb", label: "L", characterLimitId: "cl" }));
    setTypeaheadCombobox(editor, typeaheadComboboxState("lb", true, 2, 0, "lb-hint"));
    expect(describedBy()).toBe("kb cl lb-hint");
    setTypeaheadCombobox(editor, typeaheadComboboxState("lb", true, 2, 1, "lb-hint"));
    expect(describedBy()).toBe("kb cl lb-hint");
    setTypeaheadCombobox(editor, null);
    expect(describedBy()).toBe("kb cl");
  });

  it("survives the adapter re-applying its attributes while open", async () => {
    editor = await mount(getEditableAttributes({ keyboardHintId: "kb", label: "L" }));
    setTypeaheadCombobox(editor, typeaheadComboboxState("lb", true, 1, 0, "lb-hint"));
    editor.setOptions({ editorProps: { attributes: getEditableAttributes({ keyboardHintId: "kb", label: "L", characterLimitId: "cl" }) } });
    expect(describedBy()).toBe("kb cl lb-hint");
    setTypeaheadCombobox(editor, null);
    expect(describedBy()).toBe("kb cl");
  });

  it("leaves the description alone for a popup without a hint", async () => {
    editor = await mount(getEditableAttributes({ keyboardHintId: "kb", label: "L" }));
    setTypeaheadCombobox(editor, typeaheadComboboxState("lb", true, 1, 0));
    expect(describedBy()).toBe("kb");
  });
});
