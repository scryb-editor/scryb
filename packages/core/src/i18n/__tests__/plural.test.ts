import { describe, it, expect } from "vitest";
import { pluralFormsFrom, selectPlural } from "../plural";

describe("selectPlural", () => {
  it("picks the singular form for one in English", () => {
    expect(selectPlural("en", 1, { one: "{count} issue", other: "{count} issues" })).toBe("{count} issue");
  });

  it("picks the plural form for zero and many in English", () => {
    const forms = { one: "{count} issue", other: "{count} issues" };

    expect(selectPlural("en", 0, forms)).toBe("{count} issues");
    expect(selectPlural("en", 5, forms)).toBe("{count} issues");
  });

  it("treats a bare string as the other form", () => {
    expect(selectPlural("en", 1, "{count} items")).toBe("{count} items");
  });

  it("uses French rules, where zero takes the singular", () => {
    const forms = { one: "{count} probleme", other: "{count} problemes" };

    expect(selectPlural("fr", 0, forms)).toBe("{count} probleme");
    expect(selectPlural("fr", 2, forms)).toBe("{count} problemes");
  });

  it("supports languages with more than two forms", () => {
    const forms = { one: "{count} файл", few: "{count} файла", many: "{count} файлов", other: "{count} файла" };

    expect(selectPlural("ru", 1, forms)).toBe("{count} файл");
    expect(selectPlural("ru", 3, forms)).toBe("{count} файла");
    expect(selectPlural("ru", 5, forms)).toBe("{count} файлов");
  });

  it("uses the single Chinese category for every count", () => {
    // Chinese declares only `other` in CLDR — which is why the built-in `zh`
    // catalog stores plain strings for count-bearing keys. Handing it a
    // `one`/`other` map must still never select `one`.
    const forms = { one: "{count} 个问题（单数）", other: "{count} 个问题" };

    expect(selectPlural("zh", 1, forms)).toBe("{count} 个问题");
    expect(selectPlural("zh", 7, forms)).toBe("{count} 个问题");
  });

  it("uses Spanish rules, where only one takes the singular", () => {
    const forms = { one: "{count} problema", other: "{count} problemas" };

    expect(selectPlural("es", 1, forms)).toBe("{count} problema");
    expect(selectPlural("es", 0, forms)).toBe("{count} problemas");
  });

  it("falls back to the other form when the matched category is absent", () => {
    expect(selectPlural("ru", 3, { one: "{count} файл", other: "fallback" })).toBe("fallback");
  });

  it("falls back to English rules for an unknown locale", () => {
    expect(selectPlural("xx", 1, { one: "one", other: "other" })).toBe("one");
  });
});

describe("pluralFormsFrom", () => {
  it("pairs two plain strings into one/other, matching the legacy two-key behaviour", () => {
    const forms = pluralFormsFrom("Found {count} issue", "Found {count} issues");

    expect(forms).toEqual({ one: "Found {count} issue", other: "Found {count} issues" });
    expect(selectPlural("en", 1, forms)).toBe("Found {count} issue");
    expect(selectPlural("en", 3, forms)).toBe("Found {count} issues");
  });

  it("preserves every category when the plural key carries a full PluralForms map", () => {
    // The whole point of widening these keys: a Russian catalog needs `few`
    // and `many`, which rebuilding `{ one, other }` by hand would discard.
    const forms = pluralFormsFrom("{count} проблема", {
      few: "{count} проблемы",
      many: "{count} проблем",
      other: "{count} проблема",
    });

    expect(selectPlural("ru", 1, forms)).toBe("{count} проблема");
    expect(selectPlural("ru", 3, forms)).toBe("{count} проблемы");
    expect(selectPlural("ru", 5, forms)).toBe("{count} проблем");
  });

  it("lets the plural map's own one form win over the singular key", () => {
    const forms = pluralFormsFrom("ignored", { one: "wins", other: "other" });

    expect(forms.one).toBe("wins");
  });

  it("reads the singular out of a PluralForms map supplied on the singular key", () => {
    expect(pluralFormsFrom({ one: "one form", other: "other form" }, "plural").one).toBe("one form");
    // No `one` on the map — fall back to its mandatory `other`.
    expect(pluralFormsFrom({ other: "only form" }, "plural").one).toBe("only form");
  });
});
