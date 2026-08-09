import { describe, it, expect, vi, beforeEach } from "vitest";
import { I18nManager } from "../i18n/i18n-manager";
import { registerLocale, resetRegistry } from "../i18n/registry";
import type { SupportedLocale, TiptapTranslations } from "../i18n/types";

describe("I18nManager", () => {
  let i18n: I18nManager;

  beforeEach(() => {
    // Mock navigator.language to "en-US" so constructor always starts in "en"
    vi.stubGlobal("navigator", { language: "en-US" });
    i18n = new I18nManager();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Locale Management
  // ═══════════════════════════════════════════════════════════════════════════

  describe("default locale", () => {
    it("defaults to 'en' when browser language is English", () => {
      expect(i18n.locale).toBe("en");
    });
  });

  describe("setLocale", () => {
    it("switches to French", () => {
      i18n.setLocale("fr");
      expect(i18n.locale).toBe("fr");
    });

    it("switches to Portuguese", () => {
      i18n.setLocale("pt");
      expect(i18n.locale).toBe("pt");
    });

    it("switches back to English", () => {
      i18n.setLocale("fr");
      i18n.setLocale("en");
      expect(i18n.locale).toBe("en");
    });
  });

  describe("autoDetectLocale", () => {
    it("detects French browser language", () => {
      vi.stubGlobal("navigator", { language: "fr-FR" });
      i18n.autoDetectLocale();
      expect(i18n.locale).toBe("fr");
    });

    it("detects Portuguese browser language", () => {
      vi.stubGlobal("navigator", { language: "pt-BR" });
      i18n.autoDetectLocale();
      expect(i18n.locale).toBe("pt");
    });

    it("falls back to English for unsupported language", () => {
      vi.stubGlobal("navigator", { language: "de-DE" });
      i18n.autoDetectLocale();
      expect(i18n.locale).toBe("en");
    });

    it("does not throw when navigator is undefined", () => {
      vi.stubGlobal("navigator", undefined);
      // The method checks typeof navigator, so this should not throw
      expect(() => i18n.autoDetectLocale()).not.toThrow();
    });
  });

  describe("constructor auto-detection", () => {
    it("detects French on construction", () => {
      vi.stubGlobal("navigator", { language: "fr-CA" });
      const mgr = new I18nManager();
      expect(mgr.locale).toBe("fr");
    });

    it("detects Portuguese on construction", () => {
      vi.stubGlobal("navigator", { language: "pt" });
      const mgr = new I18nManager();
      expect(mgr.locale).toBe("pt");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Listener / Subscription
  // ═══════════════════════════════════════════════════════════════════════════

  describe("onLocaleChange", () => {
    it("fires callback when locale changes", () => {
      const callback = vi.fn();
      i18n.onLocaleChange(callback);
      i18n.setLocale("fr");
      expect(callback).toHaveBeenCalledWith("fr");
    });

    it("fires callback multiple times on multiple changes", () => {
      const callback = vi.fn();
      i18n.onLocaleChange(callback);
      i18n.setLocale("fr");
      i18n.setLocale("pt");
      i18n.setLocale("en");
      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenNthCalledWith(1, "fr");
      expect(callback).toHaveBeenNthCalledWith(2, "pt");
      expect(callback).toHaveBeenNthCalledWith(3, "en");
    });

    it("supports multiple listeners", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      i18n.onLocaleChange(cb1);
      i18n.onLocaleChange(cb2);
      i18n.setLocale("pt");
      expect(cb1).toHaveBeenCalledWith("pt");
      expect(cb2).toHaveBeenCalledWith("pt");
    });

    it("returns an unsubscribe function that removes the listener", () => {
      const callback = vi.fn();
      const unsubscribe = i18n.onLocaleChange(callback);
      i18n.setLocale("fr");
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      i18n.setLocale("pt");
      // Should not have been called again
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("unsubscribing one listener does not affect others", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const unsub1 = i18n.onLocaleChange(cb1);
      i18n.onLocaleChange(cb2);

      unsub1();
      i18n.setLocale("fr");
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledWith("fr");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Translation Access
  // ═══════════════════════════════════════════════════════════════════════════

  describe("translations", () => {
    it("returns a full translation object", () => {
      const t = i18n.translations;
      expect(t).toBeDefined();
      expect(t.toolbar).toBeDefined();
      expect(t.bubbleMenu).toBeDefined();
      expect(t.colorPicker).toBeDefined();
      expect(t.slashCommands).toBeDefined();
      expect(t.table).toBeDefined();
      expect(t.imageUpload).toBeDefined();
      expect(t.imageBubbleMenu).toBeDefined();
      expect(t.editor).toBeDefined();
      expect(t.common).toBeDefined();
      expect(t.accessibilityChecker).toBeDefined();
      expect(t.sideMenu).toBeDefined();
    });

    it("returns French translations after switching", () => {
      i18n.setLocale("fr");
      const t = i18n.translations;
      expect(t.toolbar).toBeDefined();
      // French "Bold" is "Gras"
      expect(t.toolbar.bold).toBe("Gras");
    });

    it("returns Portuguese translations after switching", () => {
      i18n.setLocale("pt");
      const t = i18n.translations;
      expect(t.toolbar).toBeDefined();
      // Portuguese "Bold" is "Negrito"
      expect(t.toolbar.bold).toBe("Negrito");
    });
  });

  describe("section-specific getters", () => {
    it("toolbar returns the toolbar section", () => {
      expect(i18n.toolbar.bold).toBe("Bold");
    });

    it("bubbleMenu returns the bubbleMenu section", () => {
      expect(i18n.bubbleMenu.bold).toBeDefined();
    });

    it("colorPicker returns the colorPicker section", () => {
      expect(i18n.colorPicker.textColor).toBeDefined();
    });

    it("slashCommands returns the slashCommands section", () => {
      expect(i18n.slashCommands.menuLabel).toBeDefined();
    });

    it("table returns the table section", () => {
      expect(i18n.table.addRowBefore).toBeDefined();
    });

    it("imageUpload returns the imageUpload section", () => {
      expect(i18n.imageUpload.selectImage).toBeDefined();
    });

    it("imageBubbleMenu returns the imageBubbleMenu section", () => {
      expect(i18n.imageBubbleMenu.changeImage).toBeDefined();
    });

    it("editor returns the editor section", () => {
      expect(i18n.editor.placeholder).toBeDefined();
    });

    it("common returns the common section", () => {
      expect(i18n.common.cancel).toBeDefined();
    });

    it("accessibilityChecker returns the accessibilityChecker section", () => {
      expect(i18n.accessibilityChecker.title).toBeDefined();
    });

    it("sideMenu returns the sideMenu section", () => {
      expect(i18n.sideMenu.addBlock).toBeDefined();
    });
  });

  describe("getSupportedLocales", () => {
    it("returns all five supported locales", () => {
      const locales = i18n.getSupportedLocales();
      expect(locales).toContain("en");
      expect(locales).toContain("fr");
      expect(locales).toContain("pt");
      expect(locales).toContain("es");
      expect(locales).toContain("zh");
      expect(locales).toHaveLength(5);
    });
  });

  describe("getToolbarTitle", () => {
    it("returns a toolbar title for a known key", () => {
      expect(i18n.getToolbarTitle("bold")).toBe("Bold");
    });

    it("returns localized toolbar title after switching locale", () => {
      i18n.setLocale("fr");
      expect(i18n.getToolbarTitle("bold")).toBe("Gras");
    });
  });

  describe("getBubbleMenuTitle", () => {
    it("returns a bubble menu title for a known key", () => {
      expect(i18n.getBubbleMenuTitle("bold")).toBeDefined();
      expect(typeof i18n.getBubbleMenuTitle("bold")).toBe("string");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Translation Completeness
  // ═══════════════════════════════════════════════════════════════════════════

  describe("translation completeness", () => {
    const REQUIRED_TOP_LEVEL_KEYS: Array<keyof TiptapTranslations> = [
      "toolbar",
      "colorPicker",
      "bubbleMenu",
      "slashCommands",
      "table",
      "imageUpload",
      "imageBubbleMenu",
      "editor",
      "common",
      "accessibilityChecker",
      "sideMenu",
    ];

    it.each(["en", "fr", "pt", "es", "zh"] as SupportedLocale[])("locale '%s' has all required top-level keys", (locale) => {
      i18n.setLocale(locale);
      const t = i18n.translations;
      for (const key of REQUIRED_TOP_LEVEL_KEYS) {
        expect(t[key], `Missing key '${key}' in '${locale}' translations`).toBeDefined();
      }
    });

    it.each(["en", "fr", "pt", "es", "zh"] as SupportedLocale[])("locale '%s' toolbar has all expected keys", (locale) => {
      i18n.setLocale(locale);
      const toolbar = i18n.toolbar;
      const expectedKeys = [
        "bold", "italic", "underline", "strike", "code",
        "superscript", "subscript", "textColor",
        "heading1", "heading2", "heading3",
        "bulletList", "orderedList", "blockquote",
        "alignLeft", "alignCenter", "alignRight", "alignJustify",
        "indent", "outdent", "link", "image", "horizontalRule",
        "table", "undo", "redo", "clear", "clearFormatting",
      ];
      for (const key of expectedKeys) {
        expect(
          toolbar[key as keyof typeof toolbar],
          `Missing toolbar key '${key}' in '${locale}'`
        ).toBeDefined();
      }
    });
  });
});

describe("I18nManager - late locale registration", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("starts applying a locale registered after it was requested", () => {
    // The lazily-loaded-catalog flow: select the locale up front, load and
    // register its chunk later. Resolving the request once, at setLocale
    // time, would leave the editor permanently English.
    const i18n = new I18nManager({ autoDetect: false });
    i18n.setLocale("de");
    expect(i18n.locale).toBe("en");
    expect(i18n.toolbar.bold).toBe("Bold");

    registerLocale("de", { toolbar: { bold: "Fett" } });

    expect(i18n.locale).toBe("de");
    expect(i18n.toolbar.bold).toBe("Fett");
  });

  it("resolves a constructor-supplied locale against catalogs registered later", () => {
    const i18n = new I18nManager({ locale: "de", autoDetect: false });
    expect(i18n.locale).toBe("en");

    registerLocale("de", { toolbar: { bold: "Fett" } });

    expect(i18n.locale).toBe("de");
  });

  it("notifies listeners when an instance-scoped catalog changes what the current locale reads", () => {
    const i18n = new I18nManager({ autoDetect: false });
    i18n.setLocale("de");
    const seen: string[] = [];
    i18n.onLocaleChange((locale) => seen.push(locale));

    i18n.registerLocale("de", { toolbar: { bold: "Fett" } });

    expect(seen).toEqual(["de"]);
    expect(i18n.toolbar.bold).toBe("Fett");
  });

  it("keeps reporting the resolved code, not the raw request", () => {
    registerLocale("pt-BR", { toolbar: { bold: "Negrito BR" } });
    const i18n = new I18nManager({ autoDetect: false });

    i18n.setLocale("PT-br");

    expect(i18n.locale).toBe("pt-BR");
  });
});

describe("I18nManager - global registry subscription", () => {
  beforeEach(() => {
    resetRegistry();
  });

  it("notifies listeners when a catalog is registered globally after the locale was chosen", () => {
    // The lazily-loaded-chunk flow end to end: nothing else would tell a UI
    // bound to this manager that "de" suddenly resolves to a real catalog.
    const i18n = new I18nManager({ autoDetect: false });
    i18n.setLocale("de");
    const seen: string[] = [];
    i18n.onLocaleChange((locale) => seen.push(locale));

    registerLocale("de", { toolbar: { bold: "Fett" } });

    expect(seen).toEqual(["de"]);
    expect(i18n.toolbar.bold).toBe("Fett");
  });

  it("notifies when a globally-registered catalog patches the locale already in use", () => {
    const i18n = new I18nManager({ autoDetect: false });
    i18n.setLocale("fr");
    const seen: string[] = [];
    i18n.onLocaleChange((locale) => seen.push(locale));

    registerLocale("fr", { toolbar: { bold: "Costaud" } });

    // The resolved code is unchanged — subscribers still have to re-read,
    // because what that code *reads* changed.
    expect(seen).toEqual(["fr"]);
    expect(i18n.toolbar.bold).toBe("Costaud");
  });

  it("stops reacting after destroy(), and destroy() is idempotent", () => {
    const i18n = new I18nManager({ autoDetect: false });
    const seen: string[] = [];
    i18n.onLocaleChange((locale) => seen.push(locale));

    i18n.destroy();
    i18n.destroy();
    registerLocale("de", { toolbar: { bold: "Fett" } });

    expect(seen).toEqual([]);
    // Reads still work — destroy() only drops subscriptions.
    expect(i18n.toolbar.bold).toBe("Bold");
  });
});
