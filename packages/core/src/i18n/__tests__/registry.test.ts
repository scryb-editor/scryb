import { describe, it, expect, beforeEach } from "vitest";
import { I18nManager } from "../i18n-manager";
import { registerLocale, getRegisteredLocales, resolveLocale, getCatalog, resetRegistry, subscribeToRegistry } from "../registry";

describe("locale registry", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("exposes the five built-in locales", () => {
    expect(getRegisteredLocales().sort()).toEqual(["en", "es", "fr", "pt", "zh"]);
  });

  it("registers a new locale from a partial catalog", () => {
    registerLocale("de", { toolbar: { bold: "Fett" } });

    expect(getRegisteredLocales()).toContain("de");
    expect(getCatalog("de").toolbar.bold).toBe("Fett");
  });

  it("fills untranslated keys from English", () => {
    registerLocale("de", { toolbar: { bold: "Fett" } });

    expect(getCatalog("de").toolbar.italic).toBe(getCatalog("en").toolbar.italic);
    expect(getCatalog("de").table.addRowBefore).toBe(getCatalog("en").table.addRowBefore);
  });

  it("merges deeply without dropping sibling sections", () => {
    registerLocale("de", { toolbar: { bold: "Fett" }, common: { close: "Schliessen" } });

    const de = getCatalog("de");
    expect(de.toolbar.bold).toBe("Fett");
    expect(de.common.close).toBe("Schliessen");
    expect(de.sideMenu).toEqual(getCatalog("en").sideMenu);
  });

  it("does not mutate the English catalog", () => {
    const before = getCatalog("en").toolbar.bold;
    registerLocale("de", { toolbar: { bold: "Fett" } });

    expect(getCatalog("en").toolbar.bold).toBe(before);
  });

  it("resolves a region tag to its base locale", () => {
    expect(resolveLocale("pt-BR")).toBe("pt");
    expect(resolveLocale("fr-CA")).toBe("fr");
  });

  it("prefers an exact region match when one is registered", () => {
    registerLocale("pt-BR", { toolbar: { bold: "Negrito BR" } });

    expect(resolveLocale("pt-BR")).toBe("pt-BR");
    expect(getCatalog("pt-BR").toolbar.bold).toBe("Negrito BR");
  });

  it("falls back to English for an unknown locale", () => {
    expect(resolveLocale("xx")).toBe("en");
  });

  it("re-registering a locale merges over its own current catalog (accumulates)", () => {
    registerLocale("de", { toolbar: { bold: "Fett" } });
    registerLocale("de", { toolbar: { bold: "Kraeftig" }, common: { close: "Schliessen" } });

    const de = getCatalog("de");
    // Second call's value for a key the first call also set wins...
    expect(de.toolbar.bold).toBe("Kraeftig");
    // ...but the second call merges over the first call's catalog, not over
    // English — so a section the second call never touched (added by the
    // first call) survives.
    expect(de.common.close).toBe("Schliessen");
  });

  it("patching a built-in locale preserves its other strings (does not revert to English)", () => {
    const originalItalic = getCatalog("fr").toolbar.italic;
    const originalClose = getCatalog("fr").common.close;
    expect(originalItalic).not.toBe(getCatalog("en").toolbar.italic);
    expect(originalClose).not.toBe(getCatalog("en").common.close);

    registerLocale("fr", { toolbar: { bold: "Costaud" } });

    const fr = getCatalog("fr");
    expect(fr.toolbar.bold).toBe("Costaud");
    // Every other French string must still be French, not silently reverted
    // to English by the patch.
    expect(fr.toolbar.italic).toBe(originalItalic);
    expect(fr.common.close).toBe(originalClose);
  });

  it("accumulates two successive registrations for a brand-new locale", () => {
    registerLocale("de", { toolbar: { bold: "Fett" } });
    registerLocale("de", { common: { close: "Schliessen" } });

    const de = getCatalog("de");
    // The first call's contribution must survive the second call.
    expect(de.toolbar.bold).toBe("Fett");
    expect(de.common.close).toBe("Schliessen");
    // Anything neither call touched still falls back to English.
    expect(de.toolbar.italic).toBe(getCatalog("en").toolbar.italic);
  });
});

describe("I18nManager registry integration", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("keeps the zero-argument constructor working", () => {
    const i18n = new I18nManager();

    expect(i18n.locale).toBe("en");
    expect(i18n.toolbar.bold).toBe("Bold");
    expect(i18n.getSupportedLocales().sort()).toEqual(["en", "es", "fr", "pt", "zh"]);
  });

  it("switches to a built-in locale as before", () => {
    const i18n = new I18nManager();
    i18n.setLocale("fr");

    expect(i18n.toolbar.bold).toBe("Gras");
  });

  it("accepts an injected catalog through the constructor", () => {
    const i18n = new I18nManager({ locale: "de", locales: { de: { toolbar: { bold: "Fett" } } } });

    expect(i18n.locale).toBe("de");
    expect(i18n.toolbar.bold).toBe("Fett");
    expect(i18n.toolbar.italic).toBe("Italic");
  });

  it("patching a built-in locale through the constructor's `locales` option preserves its other strings", () => {
    // Regression test: this is the exact shape `config.translations` uses in
    // both adapters (patch one string of an already-shipped locale) — it must
    // not revert every other string in that locale to English.
    const frBefore = new I18nManager();
    frBefore.setLocale("fr");
    const originalItalic = frBefore.toolbar.italic;
    const originalClose = frBefore.common.close;
    expect(originalItalic).not.toBe("Italic");
    expect(originalClose).not.toBe("Close");

    const i18n = new I18nManager({
      locale: "fr",
      locales: { fr: { toolbar: { bold: "Costaud" } } },
    });

    expect(i18n.toolbar.bold).toBe("Costaud");
    expect(i18n.toolbar.italic).toBe(originalItalic);
    expect(i18n.common.close).toBe(originalClose);
  });

  it("accumulates two successive instance registerLocale() calls for the same code", () => {
    const i18n = new I18nManager({ autoDetect: false });

    i18n.registerLocale("de", { toolbar: { bold: "Fett" } });
    i18n.registerLocale("de", { common: { close: "Schliessen" } });
    i18n.setLocale("de");

    expect(i18n.toolbar.bold).toBe("Fett");
    expect(i18n.common.close).toBe("Schliessen");
    expect(i18n.toolbar.italic).toBe("Italic");
  });

  it("keeps injected catalogs off the global registry", () => {
    new I18nManager({ locales: { de: { toolbar: { bold: "Fett" } } } });

    expect(getRegisteredLocales()).not.toContain("de");
  });

  it("prefers an instance catalog over a globally registered one", () => {
    registerLocale("de", { toolbar: { bold: "Global" } });
    const i18n = new I18nManager({ locale: "de", locales: { de: { toolbar: { bold: "Instance" } } } });

    expect(i18n.toolbar.bold).toBe("Instance");
  });

  it("sees a globally registered locale", () => {
    registerLocale("de", { toolbar: { bold: "Fett" } });
    const i18n = new I18nManager();
    i18n.setLocale("de");

    expect(i18n.toolbar.bold).toBe("Fett");
    expect(i18n.getSupportedLocales()).toContain("de");
  });

  it("notifies listeners when switching to a registered locale", () => {
    registerLocale("de", {});
    const i18n = new I18nManager();
    const seen: string[] = [];
    i18n.onLocaleChange((locale) => seen.push(locale));

    i18n.setLocale("de");

    expect(seen).toEqual(["de"]);
  });

  it("skips browser detection when autoDetect is false", () => {
    const i18n = new I18nManager({ locale: "fr", autoDetect: false });

    expect(i18n.locale).toBe("fr");
  });
});

describe("locale resolution is case-insensitive (RFC 5646)", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("resolves an uppercase region tag to the base locale", () => {
    expect(resolveLocale("PT-BR")).toBe("pt");
    expect(resolveLocale("pt-br")).toBe("pt");
  });

  it("resolves an uppercase built-in code to its canonical lowercase form", () => {
    expect(resolveLocale("FR")).toBe("fr");
  });

  it("resolves a mixed-case region tag via the base subtag", () => {
    expect(resolveLocale("En-US")).toBe("en");
  });

  it("matches a registered region-tagged locale regardless of casing", () => {
    registerLocale("de-AT", { toolbar: { bold: "Fett AT" } });

    expect(resolveLocale("DE-at")).toBe("de-AT");
    expect(getCatalog("DE-at").toolbar.bold).toBe("Fett AT");
  });

  it("falls back to a base locale registered under a different case than requested", () => {
    registerLocale("de", { toolbar: { bold: "Fett" } });

    expect(resolveLocale("DE-AT")).toBe("de");
    expect(getCatalog("de-AT").toolbar.bold).toBe("Fett");
  });

  it("falls back to English for an empty string", () => {
    expect(resolveLocale("")).toBe("en");
  });

  it("resolves a locale with private-use subtags via its base subtag", () => {
    expect(resolveLocale("pt-BR-x-private")).toBe("pt");
  });

  it("keeps getRegisteredLocales stable and canonical after case-insensitive lookups", () => {
    registerLocale("de-AT", { toolbar: { bold: "Fett AT" } });
    resolveLocale("DE-at");
    resolveLocale("de-at");

    const codes = getRegisteredLocales();
    expect(codes).toContain("de-AT");
    expect(codes.filter((c) => c.toLowerCase() === "de-at")).toEqual(["de-AT"]);
  });

  it("resolves I18nManager.setLocale case-insensitively against the global registry", () => {
    registerLocale("de", { toolbar: { bold: "Fett" } });
    const i18n = new I18nManager();

    i18n.setLocale("DE");

    expect(i18n.locale).toBe("de");
    expect(i18n.toolbar.bold).toBe("Fett");
  });

  it("resolves I18nManager.setLocale case-insensitively against instance catalogs", () => {
    const i18n = new I18nManager({ locales: { "de-AT": { toolbar: { bold: "Fett AT" } } } });

    i18n.setLocale("DE-at");

    expect(i18n.locale).toBe("de-AT");
    expect(i18n.toolbar.bold).toBe("Fett AT");
  });
});

describe("registry catalogs are immutable", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("throws when writing to a catalog returned by getCatalog", () => {
    const catalog = getCatalog("en");

    expect(() => {
      (catalog.toolbar as { bold: string }).bold = "corrupted";
    }).toThrow();

    expect(getCatalog("en").toolbar.bold).not.toBe("corrupted");
  });

  it("throws when writing to a registered locale's catalog", () => {
    registerLocale("de", { toolbar: { bold: "Fett" } });
    const catalog = getCatalog("de");

    expect(() => {
      (catalog.toolbar as { bold: string }).bold = "corrupted";
    }).toThrow();

    expect(getCatalog("de").toolbar.bold).toBe("Fett");
  });
});

describe("deepMerge array semantics", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("replaces array fields wholesale instead of concatenating", () => {
    const englishKeywords = getCatalog("en").slashCommands.heading1.keywords;

    registerLocale("de", {
      slashCommands: { heading1: { keywords: ["ueberschrift"] } },
    });

    const de = getCatalog("de");
    expect(de.slashCommands.heading1.keywords).toEqual(["ueberschrift"]);
    expect(de.slashCommands.heading1.keywords).not.toEqual([...englishKeywords, "ueberschrift"]);
    // Sibling fields on the same object still fall back to English.
    expect(de.slashCommands.heading1.title).toBe(getCatalog("en").slashCommands.heading1.title);
  });
});

describe("prototype pollution guard", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("ignores a __proto__ key coming from a JSON-parsed catalog", () => {
    // `JSON.parse` produces an *own enumerable* "__proto__" key (an object
    // literal would not), and fetching a catalog over the network then
    // handing it to registerLocale is a documented extension path. Assigning
    // it would invoke the Object.prototype setter and reparent the merged
    // catalog, so every key the catalog leaves unset would resolve through
    // attacker-chosen data.
    const hostile = JSON.parse('{"toolbar":{"bold":"Fett"},"__proto__":{"polluted":"yes"}}');

    registerLocale("de", hostile);

    const catalog = getCatalog("de");
    expect(catalog.toolbar.bold).toBe("Fett");
    expect(Object.getPrototypeOf(catalog)).toBe(Object.prototype);
    expect((catalog as Record<string, unknown>)["polluted"]).toBeUndefined();
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });

  it("ignores a nested __proto__ key in a subtree the base catalog has no counterpart for", () => {
    const hostile = JSON.parse('{"custom":{"__proto__":{"polluted":"yes"}}}');

    registerLocale("de", hostile);

    const custom = (getCatalog("de") as unknown as Record<string, Record<string, unknown>>)["custom"];
    expect(Object.getPrototypeOf(custom)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
  });
});

// =============================================================================
// Regressions found in code review
// =============================================================================

describe("listener isolation", () => {
  beforeEach(() => {
    resetRegistry();
  });

  // Listeners on one manager are consumer callbacks we do not control. An
  // unguarded forEach let the first one that throws abort the iteration, so
  // every listener registered after it silently stopped receiving updates.
  it("notifies later listeners on a manager when an earlier one throws", () => {
    const i18n = new I18nManager({ locale: "en", autoDetect: false });
    const seen: string[] = [];

    i18n.onLocaleChange(() => {
      throw new Error("subscriber exploded");
    });
    i18n.onLocaleChange((locale) => {
      seen.push(locale);
    });

    expect(() => i18n.setLocale("fr")).not.toThrow();
    expect(seen).toContain("fr");
  });

  // Same failure one layer up: a raw registry subscriber that throws would
  // strand every manager that subscribed after it.
  it("notifies later registry subscribers when an earlier one throws", () => {
    const seen: string[] = [];

    const unsubscribeThrower = subscribeToRegistry(() => {
      throw new Error("registry subscriber exploded");
    });
    const unsubscribeWatcher = subscribeToRegistry(() => {
      seen.push("notified");
    });

    try {
      expect(() =>
        registerLocale("de", { toolbar: { bold: "Fett" } } as never),
      ).not.toThrow();
      expect(seen).toEqual(["notified"]);
    } finally {
      unsubscribeThrower();
      unsubscribeWatcher();
    }
  });
});

describe("connect / destroy lifecycle", () => {
  beforeEach(() => {
    resetRegistry();
  });

  // React StrictMode runs effect setup, cleanup, then setup again against the
  // same instance. A manager that only subscribed in its constructor was left
  // permanently deaf to registerLocale after that first cleanup, which broke
  // late locale registration in every development build.
  it("resumes reacting to the registry after destroy then connect", () => {
    const i18n = new I18nManager({ locale: "en", autoDetect: false });
    const seen: string[] = [];
    i18n.onLocaleChange((locale) => seen.push(locale));

    i18n.destroy();
    i18n.connect();
    i18n.onLocaleChange((locale) => seen.push(locale));

    registerLocale("de", { toolbar: { bold: "Fett" } } as never);

    expect(seen.length).toBeGreaterThan(0);
  });

  it("does not accumulate duplicate registry listeners", () => {
    const i18n = new I18nManager({ locale: "en", autoDetect: false });
    let notifications = 0;
    i18n.onLocaleChange(() => {
      notifications += 1;
    });

    i18n.connect();
    i18n.connect();

    registerLocale("de", { toolbar: { bold: "Fett" } } as never);

    expect(notifications).toBe(1);
  });
});
