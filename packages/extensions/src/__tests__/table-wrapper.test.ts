import { describe, it, expect, afterEach } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { TableBundle, TABLE_WRAPPER_CLASS, ensureTableWrappers } from "../table-bundle.extension";

// =============================================================================
// The scroll wrapper in saved HTML
// =============================================================================
//
// Read-only output scrolls a wide table only if the table arrives inside its
// wrapper. The wrapper is useless if it costs the round trip, so saving and
// reopening a document must give back the same document.
// =============================================================================

const editors: Editor[] = [];

function createEditor(content: string): Editor {
  const editor = new Editor({ extensions: [StarterKit, TableBundle], content });
  editors.push(editor);
  return editor;
}

afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

const BARE_TABLE = "<table><tbody><tr><td><p>Cell</p></td></tr></tbody></table>";

describe("saved tables", () => {
  it("are saved inside the scroll wrapper and reopen as the same document", () => {
    const saved = createEditor(`<p>Before</p>${BARE_TABLE}<p>After</p>`);
    const html = saved.getHTML();

    expect(html).toContain(`<div class="${TABLE_WRAPPER_CLASS}"><table`);
    expect(createEditor(html).getJSON()).toEqual(saved.getJSON());
  });
});

describe("ensureTableWrappers", () => {
  it("wraps bare tables, nested ones included, and nothing else", () => {
    const nested = `<table><tbody><tr><td>${BARE_TABLE}</td></tr></tbody></table>`;
    const doc = new DOMParser().parseFromString(ensureTableWrappers(`<p>Text</p>${nested}`), "text/html");

    const tables = Array.from(doc.querySelectorAll("table"));
    expect(tables).toHaveLength(2);
    for (const table of tables) {
      expect(table.parentElement?.className).toBe(TABLE_WRAPPER_CLASS);
    }
    expect(doc.querySelectorAll(`.${TABLE_WRAPPER_CLASS}`)).toHaveLength(2);
    expect(doc.body.firstElementChild?.tagName).toBe("P");
  });

  it("leaves HTML that is already wrapped, or has no table, exactly as it was", () => {
    const current = createEditor(BARE_TABLE).getHTML();
    const prose = "<p>No tables &amp; no wrappers</p>";

    expect(ensureTableWrappers(current)).toBe(current);
    expect(ensureTableWrappers(ensureTableWrappers(BARE_TABLE))).toBe(ensureTableWrappers(BARE_TABLE));
    expect(ensureTableWrappers(prose)).toBe(prose);
  });
});
