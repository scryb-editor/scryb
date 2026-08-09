import type { LocaleCatalog, LocaleCode, TiptapTranslations } from "./types";
import {
  getCatalog,
  getRegisteredLocales,
  LocaleCatalogStore,
  mergeOverBase,
  resolveLocale,
  subscribeToRegistry,
} from "./registry";

// =============================================================================
// Options
// =============================================================================

/**
 * Options accepted by the `I18nManager` constructor. Every field is optional
 * so `new I18nManager()` keeps behaving exactly as it did before locales
 * became registrable — it still auto-detects the browser language and falls
 * back to English.
 */
export interface I18nManagerOptions {
  /**
   * Initial locale for this instance. Resolved the same way `setLocale` would
   * resolve it (instance catalogs first, then the global registry, then
   * `"en"`). If omitted, falls back to browser auto-detection (unless
   * `autoDetect` is `false`), then `"en"`.
   */
  locale?: LocaleCode;

  /**
   * Extra locale catalogs scoped to this instance only. Each catalog is
   * deep-merged over English, exactly like `registerLocale`, but these never
   * touch the global registry — other `I18nManager` instances never see
   * them, and they take precedence over anything globally registered under
   * the same code.
   */
  locales?: Record<string, LocaleCatalog>;

  /**
   * Set to `false` to skip browser language auto-detection when no `locale`
   * option is given. Defaults to `true`.
   */
  autoDetect?: boolean;
}

// =============================================================================
// I18nManager
// =============================================================================

/**
 * Framework-agnostic i18n manager for the Scryb editor.
 *
 * Uses a plain callback-based listener system instead of Angular signals.
 * Reads translations through the shared locale registry (see `./registry`),
 * so it supports the built-in `en`/`fr`/`pt` locales plus any locale
 * registered globally via `registerLocale` or injected per-instance through
 * the constructor's `locales` option.
 *
 * @example
 * ```typescript
 * const i18n = new I18nManager();
 * i18n.setLocale("fr");
 * console.log(i18n.translations.toolbar.bold); // "Gras"
 *
 * const unsubscribe = i18n.onLocaleChange((locale) => {
 *   console.log("Locale changed to:", locale);
 * });
 * // later...
 * unsubscribe();
 * ```
 *
 * @example Injecting a custom locale scoped to one instance
 * ```typescript
 * const i18n = new I18nManager({
 *   locale: "de",
 *   locales: { de: { toolbar: { bold: "Fett" } } },
 * });
 * console.log(i18n.toolbar.bold); // "Fett"
 * console.log(i18n.toolbar.italic); // "Italic" (falls back to English)
 * ```
 */
export class I18nManager {
  /**
   * The locale code as *requested*, before resolution. Stored raw (rather
   * than resolved once, at `setLocale` time) because catalogs can be
   * registered after a locale is selected — a lazily-loaded `de` chunk
   * arriving after `setLocale("de")` must start applying, not leave the
   * editor permanently English because `de` happened to be unregistered at
   * the instant it was requested. Every read path resolves it on demand; see
   * the `locale` getter and `_catalog()`.
   */
  private _requestedLocale: LocaleCode = "en";
  private _listeners: Array<(locale: LocaleCode) => void> = [];

  /**
   * Instance-scoped catalogs, registered either through the constructor's
   * `locales` option or via `registerLocale`. These are never written to the
   * global registry and take precedence over it in every read path.
   *
   * Uses the same `LocaleCatalogStore` the global registry uses, so instance
   * lookups fold case (RFC 5646) and resolve base subtags identically —
   * there is exactly one implementation of that logic, not two.
   */
  private _instanceCatalogs = new LocaleCatalogStore();

  /**
   * Removes this instance's global-registry subscription. Held so `destroy()`
   * can drop it — the registry keeps listeners strongly, so a manager created
   * per editor would otherwise be retained forever.
   *
   * `null` means "not currently subscribed", which is the state a manager is
   * in between `destroy()` and `connect()`.
   */
  private _unsubscribeRegistry: (() => void) | null = null;

  constructor(options: I18nManagerOptions = {}) {
    this.connect();

    if (options.locales) {
      for (const [code, catalog] of Object.entries(options.locales)) {
        this.registerLocale(code, catalog);
      }
    }

    if (options.locale !== undefined) {
      this._requestedLocale = options.locale;
    } else if (options.autoDetect !== false) {
      this.detectBrowserLanguage();
    } else {
      this._requestedLocale = "en";
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Locale management
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns the current locale, resolved against what is registered *now*
   * (instance catalogs first, then the global registry, then the base subtag,
   * then `"en"`) rather than at the time it was requested.
   */
  get locale(): LocaleCode {
    return this._resolveInstanceAware(this._requestedLocale);
  }

  /**
   * Sets the locale and notifies all registered listeners.
   *
   * The raw request is remembered; every read resolves it against whatever
   * is registered at that moment — instance catalogs before the global
   * registry, then the base subtag (e.g. `"pt-BR"` → `"pt"`), falling back to
   * `"en"` if nothing matches. Listeners are notified with the code it
   * currently settles on, not necessarily the raw string passed in.
   *
   * @param locale - The locale to switch to
   */
  setLocale(locale: LocaleCode): void {
    this._requestedLocale = locale;
    this._notify();
  }

  /**
   * Registers a callback invoked whenever the locale changes.
   * Returns an unsubscribe function.
   *
   * @param fn - Callback receiving the new locale
   * @returns Cleanup function that removes the listener
   */
  onLocaleChange(fn: (locale: LocaleCode) => void): () => void {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== fn);
    };
  }

  /**
   * Automatically detects and applies the browser language.
   * Falls back to "en" if the language is not supported.
   */
  autoDetectLocale(): void {
    this.detectBrowserLanguage();
  }

  /**
   * Registers a translation catalog scoped to this instance. The catalog is
   * deep-merged over whatever this instance already resolves `code` to right
   * now — its own previously-registered instance catalog for `code` if one
   * exists, otherwise the global registry's catalog (a built-in locale, a
   * globally-`registerLocale`d one, or English if `code` is unknown
   * everywhere) — exactly like the global `registerLocale`. Patching one
   * string of an already-translated locale (e.g. a built-in one passed
   * through `config.translations`) never reverts the rest of that locale to
   * English, and two calls for the same new code accumulate rather than the
   * second discarding the first.
   *
   * The result is never written to the global registry and takes precedence
   * over it for this instance in every read path (including a locale already
   * registered globally under the same code).
   *
   * @param code - A locale code, e.g. `"de"` or a region-tagged `"pt-BR"`
   * @param catalog - A partial `TiptapTranslations` catalog for this locale
   */
  registerLocale(code: LocaleCode, catalog: LocaleCatalog): void {
    this._instanceCatalogs.set(code, mergeOverBase(this._catalogFor(code), catalog));
    // Registering can change what the current locale resolves to (a locale
    // requested before its catalog existed) or what it reads (a patch to the
    // catalog already in use), so subscribers have to re-read either way.
    this._notify();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Translation access
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns the full translation object for the current locale.
   */
  get translations(): TiptapTranslations {
    return this._catalog();
  }

  /**
   * Returns toolbar translations for the current locale.
   */
  get toolbar(): TiptapTranslations["toolbar"] {
    return this._catalog().toolbar;
  }

  /**
   * Returns bubble menu translations for the current locale.
   */
  get bubbleMenu(): TiptapTranslations["bubbleMenu"] {
    return this._catalog().bubbleMenu;
  }

  /**
   * Returns color picker translations for the current locale.
   */
  get colorPicker(): TiptapTranslations["colorPicker"] {
    return this._catalog().colorPicker;
  }

  /**
   * Returns slash command translations for the current locale.
   */
  get slashCommands(): TiptapTranslations["slashCommands"] {
    return this._catalog().slashCommands;
  }

  /**
   * Returns table translations for the current locale.
   */
  get table(): TiptapTranslations["table"] {
    return this._catalog().table;
  }

  /**
   * Returns image upload translations for the current locale.
   */
  get imageUpload(): TiptapTranslations["imageUpload"] {
    return this._catalog().imageUpload;
  }

  /**
   * Returns image bubble menu translations for the current locale.
   */
  get imageBubbleMenu(): TiptapTranslations["imageBubbleMenu"] {
    return this._catalog().imageBubbleMenu;
  }

  /**
   * Returns editor translations for the current locale.
   */
  get editor(): TiptapTranslations["editor"] {
    return this._catalog().editor;
  }

  /**
   * Returns common translations for the current locale.
   */
  get common(): TiptapTranslations["common"] {
    return this._catalog().common;
  }

  /**
   * Returns accessibility checker translations for the current locale.
   */
  get accessibilityChecker(): TiptapTranslations["accessibilityChecker"] {
    return this._catalog().accessibilityChecker;
  }

  /**
   * Returns side menu translations for the current locale.
   */
  get sideMenu(): TiptapTranslations["sideMenu"] {
    return this._catalog().sideMenu;
  }

  /**
   * Returns all supported locale codes: this instance's own catalogs plus
   * everything in the global registry. Both sources report canonical
   * (as-registered) casing, so the union never mixes differently-cased
   * duplicates of the same code.
   */
  getSupportedLocales(): LocaleCode[] {
    return Array.from(new Set([...this._instanceCatalogs.keys(), ...getRegisteredLocales()]));
  }

  /**
   * Returns the toolbar translation for a given key.
   *
   * @param key - Key in the toolbar translations object
   */
  getToolbarTitle(key: keyof TiptapTranslations["toolbar"]): string {
    return this._catalog().toolbar[key];
  }

  /**
   * Returns the bubble menu translation for a given key.
   *
   * @param key - Key in the bubbleMenu translations object
   */
  getBubbleMenuTitle(key: keyof TiptapTranslations["bubbleMenu"]): string {
    return this._catalog().bubbleMenu[key];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Returns the translation catalog for the current locale, checking
   * instance catalogs before the global registry.
   */
  private _catalog(): TiptapTranslations {
    return this._catalogFor(this._requestedLocale);
  }

  /**
   * Releases this manager: drops its global-registry subscription and its own
   * listeners. Call it when the owning editor goes away — the registry holds
   * listeners strongly, so a per-editor manager that is never destroyed keeps
   * itself (and its catalogs) alive for the lifetime of the page.
   *
   * Safe to call more than once. The manager still reads correctly afterwards;
   * it just stops reacting to registry changes.
   */
  destroy(): void {
    this._unsubscribeRegistry?.();
    this._unsubscribeRegistry = null;
    this._listeners = [];
  }

  /**
   * (Re)subscribes this manager to the global locale registry.
   *
   * Called from the constructor, and again by any host whose lifecycle can
   * tear a component down and bring the same instance back — React's
   * StrictMode runs effect setup, cleanup, then setup again against one
   * instance, so a manager that only ever subscribed in its constructor would
   * be left permanently deaf to `registerLocale` after the first cleanup.
   *
   * Idempotent: connecting an already-connected manager does nothing, so it
   * cannot accumulate duplicate registry listeners.
   */
  connect(): void {
    if (this._unsubscribeRegistry) return;

    // A locale registered globally *after* this manager was created can change
    // what the current locale resolves to (a code requested before its catalog
    // existed) or what it reads (a patch to the catalog in use). Resolution is
    // already lazy; this is what tells subscribers to re-read.
    this._unsubscribeRegistry = subscribeToRegistry(() => this._notify());
  }

  /**
   * Notifies every listener with the locale as it resolves right now.
   *
   * Each call is isolated: the listeners are consumer callbacks and framework
   * teardowns we do not control, and one that throws would otherwise stop the
   * iteration and leave every listener after it on a stale locale.
   */
  private _notify(): void {
    const locale = this.locale;
    this._listeners.forEach((fn) => {
      try {
        fn(locale);
      } catch {
        // One listener's failure must not strand the rest.
      }
    });
  }

  /**
   * Returns the translation catalog for `code`, checking this instance's own
   * catalogs (case-insensitive exact code, then base subtag — see
   * `LocaleCatalogStore`) before falling back to the global registry.
   */
  private _catalogFor(code: string): TiptapTranslations {
    return this._instanceCatalogs.get(code) ?? getCatalog(code);
  }

  /**
   * Resolves `code` the same way `_catalogFor` looks it up: instance
   * catalogs (case-insensitive exact, then base subtag) take precedence over
   * the global registry's own resolution.
   */
  private _resolveInstanceAware(code: string): LocaleCode {
    return this._instanceCatalogs.resolve(code) ?? resolveLocale(code);
  }

  /**
   * Detects the browser language and applies the closest supported locale.
   * Resolution (instance catalogs, then the global registry, then base
   * subtag, then `"en"`) is delegated to `setLocale`, so a globally or
   * instance-registered locale like `"de"` is detected exactly like the
   * built-in `en`/`fr`/`pt` locales.
   */
  private detectBrowserLanguage(): void {
    if (typeof navigator === "undefined") return;
    this.setLocale(navigator.language.toLowerCase());
  }
}
