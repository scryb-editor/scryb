import { describe, expect, it } from "vitest";
import { en } from "../locales/en";
import { es } from "../locales/es";
import { fr } from "../locales/fr";
import { pt } from "../locales/pt";
import { zh } from "../locales/zh";

const PLURAL_CATEGORIES: Record<string, true> = { zero: true, one: true, two: true, few: true, many: true, other: true };

/**
 * Leaf key paths of a catalog. Arrays (e.g. `slashCommands.*.keywords`) and
 * `PluralForms` maps count as single leaves: catalogs legitimately differ in
 * keyword count per language, and a `string | PluralForms` value may be a plain
 * string in one locale (zh has no plural categories) and a plural map in another.
 */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    (Object.keys(value).length > 0 && Object.keys(value).every(key => PLURAL_CATEGORIES[key]))
  ) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("built-in locale parity", () => {
  const reference = keyPaths(en).sort();

  it.each([
    ["es", es],
    ["fr", fr],
    ["pt", pt],
    ["zh", zh],
  ])("%s has exactly the English key set", (_code, catalog) => {
    expect(keyPaths(catalog).sort()).toEqual(reference);
  });

  it("ships the accessibility strings the semantics work renders", () => {
    expect(en.editor.characterLimit).toBe("Maximum {limit} characters");
    expect(en.imageUpload.altText).toBe("Alt text");
    expect(en.imageBubbleMenu.resizeOriginal).toContain("1:1");
    expect(en.sideMenu.dragHandle).toBe("Block actions");
    expect(en.table.columnActions).toBe("Column {index} actions");
    expect(en.accessibilityChecker.issues?.imageTooWide?.message).toContain("{width}");
    expect(en.editor.regions?.linkEditor).toBe("Link editor");
  });
});
