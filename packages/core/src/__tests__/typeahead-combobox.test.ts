import { afterEach, describe, expect, it } from "vitest";
import type { Editor } from "@tiptap/core";
import { createScrybEditor } from "../editor-factory";
import {
  createTypeaheadListboxId,
  setTypeaheadCombobox,
  typeaheadComboboxState,
  typeaheadOptionId,
} from "../accessibility/typeahead-combobox";

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

// Wait for Tiptap's deferred `create` (setTimeout in 3.30.2) so the
// EditableSemanticsExtension owns the role before the test dispatches.
async function mount(): Promise<Editor> {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const created = createScrybEditor({ element, content: "<p>hello</p>" });
  await new Promise<void>((resolve) => created.on("create", () => resolve()));
  return created;
}

describe("typeahead combobox wiring", () => {
  it("switches view.dom to an expanded combobox and back", async () => {
    editor = await mount();
    const dom = editor.view.dom;
    setTypeaheadCombobox(editor, { listboxId: "lb", activeOptionId: typeaheadOptionId("lb", 2) });
    expect(dom.getAttribute("role")).toBe("combobox");
    expect(dom.getAttribute("aria-expanded")).toBe("true");
    expect(dom.getAttribute("aria-controls")).toBe("lb");
    expect(dom.getAttribute("aria-autocomplete")).toBe("list");
    expect(dom.getAttribute("aria-activedescendant")).toBe("lb-option-2");
    expect(dom.hasAttribute("aria-multiline")).toBe(false);

    setTypeaheadCombobox(editor, null);
    expect(dom.getAttribute("role")).toBe("textbox");
    expect(dom.getAttribute("aria-multiline")).toBe("true");
    for (const attr of ["aria-expanded", "aria-controls", "aria-autocomplete", "aria-activedescendant"]) {
      expect(dom.hasAttribute(attr)).toBe(false);
    }
  });

  it("omits aria-activedescendant for an empty list and leaves undo history alone", async () => {
    editor = await mount();
    setTypeaheadCombobox(editor, { listboxId: "lb", activeOptionId: null });
    expect(editor.view.dom.getAttribute("role")).toBe("combobox");
    expect(editor.view.dom.hasAttribute("aria-multiline")).toBe(false);
    expect(editor.view.dom.hasAttribute("aria-activedescendant")).toBe(false);
    expect(editor.can().undo()).toBe(false);
  });

  it("is safe after destroy and mints unique listbox ids", async () => {
    editor = await mount();
    const destroyed = editor;
    destroyed.destroy();
    editor = undefined;
    expect(() => setTypeaheadCombobox(destroyed, null)).not.toThrow();
    expect(createTypeaheadListboxId("slash")).not.toBe(createTypeaheadListboxId("slash"));
  });
});

describe("typeaheadComboboxState", () => {
  it("returns null when closed", () => {
    expect(typeaheadComboboxState("lb", false, 3, 1)).toBeNull();
  });

  it("points at the active option when open with items", () => {
    expect(typeaheadComboboxState("lb", true, 3, 1)).toEqual({ listboxId: "lb", activeOptionId: "lb-option-1" });
  });

  it("has no active option when open with an empty list", () => {
    expect(typeaheadComboboxState("lb", true, 0, 0)).toEqual({ listboxId: "lb", activeOptionId: null });
  });
});
