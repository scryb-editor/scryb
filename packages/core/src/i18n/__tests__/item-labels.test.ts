import { describe, it, expect, beforeEach } from "vitest";
import { bubbleMenuItemLabel, toolbarItemLabel } from "../item-labels";
import { getCatalog, registerLocale, resetRegistry } from "../registry";

// ═══════════════════════════════════════════════════════════════════════════
// Toolbar / bubble menu item labels
// ═══════════════════════════════════════════════════════════════════════════
//
// Both adapters used to render `TOOLBAR_ITEM_CONFIG[item].label` — an English
// constant — straight into `title`/`aria-label`, so every button stayed in
// English no matter the locale even though the catalogs translated them.

describe("toolbarItemLabel", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("returns the catalog string for the active locale", () => {
    expect(toolbarItemLabel("bold", getCatalog("fr"))).toBe("Gras");
    expect(toolbarItemLabel("bold", getCatalog("pt"))).toBe("Negrito");
    expect(toolbarItemLabel("table", getCatalog("pt"))).toBe("Inserir tabela");
    expect(toolbarItemLabel("bold", getCatalog("es"))).toBe("Negrita");
    expect(toolbarItemLabel("bold", getCatalog("zh"))).toBe("加粗");
  });

  it("falls back to the English config label for keys a catalog does not translate", () => {
    // "de" resolves to a catalog that only patches one string; everything else
    // falls back to English rather than rendering blank.
    registerLocale("de", { toolbar: { bold: "Fett" } });

    expect(toolbarItemLabel("bold", getCatalog("de"))).toBe("Fett");
    expect(toolbarItemLabel("italic", getCatalog("de"))).toBe("Italic");
  });

  it("reads invisibleCharacters from its own catalog section", () => {
    // The button predates the toolbar section and is keyed by what it does.
    expect(toolbarItemLabel("invisibleCharacters", getCatalog("pt"))).toBe(
      getCatalog("pt").invisibleCharacters.show,
    );
  });

  it("localizes the grouped dropdown entries", () => {
    expect(toolbarItemLabel("textAlign", getCatalog("pt"))).toBe("Alinhamento do texto");
    expect(toolbarItemLabel("taskList", getCatalog("fr"))).toBe("Liste de tâches");
  });
});

describe("bubbleMenuItemLabel", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("prefers the bubbleMenu section", () => {
    expect(bubbleMenuItemLabel("bold", getCatalog("fr"))).toBe("Gras");
  });

  it("falls back to the toolbar section for entries the bubbleMenu section omits", () => {
    // `table` only exists under `toolbar`, but the bubble menu renders it too.
    const pt = getCatalog("pt");
    expect(pt.bubbleMenu).not.toHaveProperty("table");
    expect(bubbleMenuItemLabel("table", pt)).toBe(pt.toolbar.table);
  });

  it("falls back through toolbar, then to the English config label", () => {
    registerLocale("de", { bubbleMenu: { bold: "Fett" } });
    const de = getCatalog("de");

    expect(bubbleMenuItemLabel("bold", de)).toBe("Fett");
    // Not in `bubbleMenu`, so it comes from `toolbar` (English here, since the
    // "de" catalog inherits everything it did not patch).
    expect(bubbleMenuItemLabel("math", de)).toBe(de.toolbar.math);
    // Neither section has `separator`; the config map's label is the last resort.
    expect(bubbleMenuItemLabel("separator", de)).toBe("");
  });
});
