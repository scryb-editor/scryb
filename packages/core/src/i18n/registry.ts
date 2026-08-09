import type { LocaleCatalog, LocaleCode, TiptapTranslations } from "./types";
import { en } from "./locales/en";
import { fr } from "./locales/fr";
import { pt } from "./locales/pt";
import { es } from "./locales/es";
import { zh } from "./locales/zh";

// ═══════════════════════════════════════════════════════════════════════════
// Locale registry
// ═══════════════════════════════════════════════════════════════════════════
//
// A module-level, mutable catalog of translations keyed by locale code. The
// five built-in locales (en, fr, pt, es, zh) are seeded on load and can never
// be removed — `resetRegistry()` restores exactly these five. Consumers can add
// any additional BCP-47 locale by registering a *partial* catalog: anything
// left unspecified is filled in from whatever that code already resolves to
// (its own previous registration, or English if it's brand new), so a new
// language can ship with a handful of strings and grow over time — and an
// existing language (built-in or custom) can be patched one string at a time
// — without ever crashing on a missing key or reverting untouched strings.
//
// Lookups fold case (RFC 5646: language tags are case-insensitive) while
// still reporting back the *canonical* casing a code was registered under —
// `LocaleCatalogStore` below is the single place that implements this, and
// it's reused by `I18nManager`'s instance-scoped catalogs so the two never
// drift apart.

/**
 * Keys that must never be copied out of a catalog by `clone`/`deepMerge`.
 * Assigning `__proto__` invokes the `Object.prototype` setter and reparents
 * the merged catalog (so every *unset* key would then resolve through
 * attacker-chosen data); `constructor`/`prototype` are refused for the same
 * class of reason. These are real inputs, not paranoia: `JSON.parse` produces
 * own enumerable `"__proto__"` keys, and fetching a translation catalog over
 * the network and handing it to `registerLocale` is a documented extension
 * path.
 *
 * Declared here, above the module-level seeding below, because `const` is not
 * hoisted — `seedInto()` runs `clone()` at import time and would hit the
 * temporal dead zone if this lived next to `deepMerge`.
 */
const FORBIDDEN_MERGE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Case-insensitive store mapping locale codes to translation catalogs.
 *
 * Every lookup (`has`, `resolve`, `get`) folds case per RFC 5646 — locale
 * tags are case-insensitive — via an internal `normalized -> canonical`
 * index, while `keys()` and the values returned by `resolve()` report the
 * *canonical* casing a code was originally registered under (e.g.
 * registering `"pt-BR"` and looking it up as `"PT-br"` still returns the
 * canonical `"pt-BR"`, not a lowercased form).
 *
 * @internal Shared by the module-level global registry and by
 * `I18nManager`'s instance-scoped catalogs — not part of the public
 * `@scryb-editor/core` surface.
 */
export class LocaleCatalogStore {
  private catalogs = new Map<string, TiptapTranslations>();
  /** Lowercased code -> the canonical (originally-registered) code. */
  private index = new Map<string, string>();

  /**
   * Stores `catalog` under `code`. If a differently-cased variant of the same
   * code was previously registered, it is removed first — re-registering
   * under new casing replaces the old entry rather than creating a second,
   * shadow entry that `keys()` would then report twice.
   */
  set(code: string, catalog: TiptapTranslations): void {
    const normalized = code.toLowerCase();
    const previousCanonical = this.index.get(normalized);
    if (previousCanonical !== undefined && previousCanonical !== code) {
      this.catalogs.delete(previousCanonical);
    }
    this.catalogs.set(code, catalog);
    this.index.set(normalized, code);
  }

  /** True if `code` is registered, ignoring case. */
  has(code: string): boolean {
    return this.index.has(code.toLowerCase());
  }

  /**
   * Resolves `code` to its canonical registered form: an exact
   * (case-insensitive) match, then the base subtag before the first `-`
   * (also case-insensitive), or `undefined` if neither matches anything
   * registered.
   */
  resolve(code: string): string | undefined {
    const exact = this.index.get(code.toLowerCase());
    if (exact !== undefined) return exact;

    const base = code.split("-")[0];
    if (!base) return undefined;

    return this.index.get(base.toLowerCase());
  }

  /** Returns the catalog for `code`, resolving it first (see `resolve`). */
  get(code: string): TiptapTranslations | undefined {
    const canonical = this.resolve(code);
    return canonical === undefined ? undefined : this.catalogs.get(canonical);
  }

  /** Every canonical code currently stored. */
  keys(): string[] {
    return Array.from(this.catalogs.keys());
  }

  /** Empties the store. */
  clear(): void {
    this.catalogs.clear();
    this.index.clear();
  }
}

/** Seeds `store` with frozen clones of the five built-in locales. */
function seedInto(store: LocaleCatalogStore): void {
  store.set("en", deepFreeze(clone(en)));
  store.set("fr", deepFreeze(clone(fr)));
  store.set("pt", deepFreeze(clone(pt)));
  store.set("es", deepFreeze(clone(es)));
  store.set("zh", deepFreeze(clone(zh)));
}

let registry = new LocaleCatalogStore();
seedInto(registry);

/**
 * Subscribers notified whenever the global registry changes — see
 * `subscribeToRegistry`.
 */
const registryListeners = new Set<() => void>();

/**
 * Registers `fn` to run after every global registry mutation
 * (`registerLocale`, `resetRegistry`) and returns an unsubscribe function.
 *
 * This is what lets a catalog registered *after* an editor was created reach
 * that editor: `I18nManager` resolves its locale lazily, but nothing would
 * otherwise tell a UI bound to it that the answer changed. The lazily-loaded
 * catalog chunk is the motivating case — `setLocale("de")` now, `registerLocale
 * ("de", …)` when the chunk lands.
 *
 * Listeners are held strongly, so anything subscribing for the lifetime of a
 * component must unsubscribe (`I18nManager.destroy()` does this).
 *
 * @internal Not part of the public `@scryb-editor/core` surface.
 * @param fn - Callback invoked after each registry mutation
 * @returns Cleanup function that removes the listener
 */
export function subscribeToRegistry(fn: () => void): () => void {
  registryListeners.add(fn);
  return () => {
    registryListeners.delete(fn);
  };
}

/**
 * Runs every registry listener.
 *
 * Each call is isolated because the listeners are consumer callbacks and
 * component teardowns we do not control. An unguarded `forEach` lets one
 * throwing subscriber abort the iteration, so every editor that mounted after
 * it never learns a locale was registered and stays on a stale catalog for the
 * rest of the page's life.
 */
function notifyRegistry(): void {
  registryListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // A listener that cannot handle a catalog change is that listener's
      // problem, not a reason to strand the others.
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Deep merge / clone / freeze helpers
// ═══════════════════════════════════════════════════════════════════════════

/** Returns true for plain objects (not arrays, not null) — the values we recurse into. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Deep-clones a plain-data value (translation catalogs are JSON-shaped: nested
 * objects, arrays of strings, and strings). Recurses into array elements too
 * (not just object properties), so an array of objects would deep-copy
 * correctly if the catalog shape ever grows one — today every array in
 * `TiptapTranslations` is a `string[]`, where this is equivalent to `.slice()`.
 * Never returns a reference into the input.
 */
function clone<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => clone(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      // Same guard as `deepMerge`: a consumer catalog can reach `clone`
      // directly (a subtree the base catalog has no counterpart for is cloned
      // wholesale rather than merged), so the skip has to live on both paths.
      if (FORBIDDEN_MERGE_KEYS.has(key)) continue;
      result[key] = clone((value as Record<string, unknown>)[key]);
    }
    return result as T;
  }
  return value;
}

/**
 * Recursively `Object.freeze`s a plain-data value in place and returns it.
 * Applied to every catalog at registration time (built-in seeds and
 * `registerLocale`/`mergeOverBase` alike) so a consumer accidentally
 * writing to `getCatalog(...).toolbar.bold = "x"` throws immediately in
 * strict mode (all ESM is strict) instead of silently corrupting the shared
 * catalog for every other consumer.
 */
function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    value.forEach((item) => deepFreeze(item));
    return Object.freeze(value);
  }
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    return Object.freeze(value);
  }
  return value;
}

/**
 * Deep-merges `override` onto a clone of `base`, recursing into plain objects
 * and replacing arrays wholesale (never concatenating). Neither input is
 * mutated; the result shares no object references with either argument, and
 * prototype-mutating keys (see `FORBIDDEN_MERGE_KEYS`) are skipped.
 */
function deepMerge<T>(base: T, override: DeepPartialUnknown): T {
  const result = clone(base) as Record<string, unknown>;
  for (const key of Object.keys(override)) {
    if (FORBIDDEN_MERGE_KEYS.has(key)) continue;
    const overrideValue = override[key];
    if (overrideValue === undefined) continue;
    const baseValue = result[key];
    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = deepMerge(baseValue, overrideValue as DeepPartialUnknown);
    } else {
      result[key] = clone(overrideValue);
    }
  }
  return result as T;
}

/** Loosely-typed shape used internally by `deepMerge` while walking a `LocaleCatalog`. */
type DeepPartialUnknown = { [key: string]: unknown };

// ═══════════════════════════════════════════════════════════════════════════
// Public registry API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deep-merges a partial catalog over `base` and returns the result, frozen,
 * without writing anything to a registry. `base` must already be a complete,
 * resolved `TiptapTranslations` (e.g. from `getCatalog()`, or an instance's
 * own current catalog for a code).
 *
 * This is the one merge step both the global registry (`registerLocale`
 * below) and `I18nManager`'s instance-scoped catalogs
 * (`I18nManager.registerLocale`) build on, so patching a single string in an
 * already-translated locale never silently reverts the rest of that locale
 * to English — merging always happens over what the code *currently*
 * resolves to, not over English unconditionally.
 *
 * @internal Not part of the public `@scryb-editor/core` surface.
 * @param base - The complete catalog to merge `catalog` over
 * @param catalog - A partial `TiptapTranslations` catalog
 * @returns A full, independent, deeply-frozen `TiptapTranslations` clone
 */
export function mergeOverBase(base: TiptapTranslations, catalog: LocaleCatalog): TiptapTranslations {
  return deepFreeze(deepMerge(base, catalog as DeepPartialUnknown));
}

/**
 * Resolves what `code` currently maps to in the global registry — its own
 * existing entry if one is already registered (exact match, then base
 * subtag, per `LocaleCatalogStore.resolve`), or the built-in English catalog
 * if nothing matches at all. Never `undefined`: English is always seeded.
 */
function currentOrEnglish(code: string): TiptapTranslations {
  return (registry.get(code) ?? registry.get("en")) as TiptapTranslations;
}

/**
 * Registers a locale from a partial translation catalog. The catalog is
 * deep-merged over whatever `code` **currently** resolves to in the
 * registry — its own existing catalog if already registered (built-in or
 * previously `registerLocale`d), or English only if `code` isn't registered
 * at all. Any key left out of `catalog` falls back to the value already at
 * that path (ultimately English, if never overridden).
 *
 * This means re-registering a locale **accumulates**: patching one string in
 * an already-translated locale (built-in or custom) leaves every other
 * string exactly as it was, and two successive calls for the same new code
 * both contribute to its final catalog rather than the second call
 * discarding the first. To discard everything registered for a locale and
 * start over from English, call `resetRegistry()` (test-facing — restores
 * only the five built-ins) or re-derive the full catalog yourself before
 * calling `registerLocale` again; there is no separate "reset one locale" API.
 *
 * The stored result is a full, independent, deeply-frozen clone — mutating
 * `catalog` afterwards, or reading back `getCatalog("en")`, never observes or
 * is observed by this call, and attempting to write to the returned catalog
 * throws instead of silently corrupting shared state.
 *
 * Locale codes are matched case-insensitively everywhere they're looked up
 * (`resolveLocale`, `getCatalog`, `I18nManager.setLocale`), per RFC 5646.
 *
 * @param code - A locale code, e.g. `"de"` or a region-tagged `"pt-BR"`
 * @param catalog - A partial `TiptapTranslations` catalog for this locale
 * @example
 * ```typescript
 * // Patching a single string in a built-in locale preserves the rest of it.
 * registerLocale("fr", { toolbar: { bold: "Fett" } }); // deliberately "wrong" word, just for the example
 * getCatalog("fr").toolbar.bold; // "Fett"
 * getCatalog("fr").toolbar.italic; // untouched — still "Italique"
 *
 * // Registering a brand-new code falls back to English, and accumulates
 * // across calls.
 * registerLocale("de", { toolbar: { bold: "Fett" } });
 * registerLocale("de", { common: { close: "Schliessen" } });
 * getCatalog("de").toolbar.bold; // "Fett" — preserved from the first call
 * getCatalog("de").common.close; // "Schliessen"
 * getCatalog("de").toolbar.italic; // falls back to English "Italic"
 * ```
 */
export function registerLocale(code: LocaleCode, catalog: LocaleCatalog): void {
  registry.set(code, mergeOverBase(currentOrEnglish(code), catalog));
  // A registration can change what an already-selected locale resolves to, or
  // what it reads — subscribers have to re-read either way.
  notifyRegistry();
}

/**
 * Returns every locale code currently registered, including the five
 * built-ins (`"en"`, `"fr"`, `"pt"`, `"es"`, `"zh"`) and anything added via `registerLocale`,
 * in their canonical (originally-registered) casing.
 *
 * @returns The list of registered locale codes
 */
export function getRegisteredLocales(): LocaleCode[] {
  return registry.keys();
}

/**
 * Resolves a requested locale string to a locale code that is actually
 * registered, using a three-step fallback, matched case-insensitively at
 * every step per RFC 5646 (locale tags are case-insensitive):
 * 1. An exact match (e.g. a registered region tag like `"pt-BR"`, matched
 *    against a request of any casing such as `"PT-br"`).
 * 2. The base subtag before the first `-` (e.g. `"pt-BR"` → `"pt"`, or
 *    `"pt-BR-x-private"` → `"pt"`), also case-insensitive.
 * 3. `"en"`, if nothing else matches (including an empty string).
 *
 * The returned code is always the *canonical* casing under which it was
 * registered, not the casing of `requested`.
 *
 * @param requested - The locale string to resolve, e.g. from the browser
 * @returns A locale code guaranteed to be registered
 */
export function resolveLocale(requested: string): LocaleCode {
  return registry.resolve(requested) ?? "en";
}

/**
 * Returns the full translation catalog for a locale code, resolving it first
 * (see `resolveLocale`) so this never returns `undefined`. The returned
 * catalog is deeply frozen — see `registerLocale` — so it cannot be mutated
 * by callers.
 *
 * @param code - The locale code to look up
 * @returns The resolved catalog — always a complete `TiptapTranslations`
 */
export function getCatalog(code: LocaleCode): TiptapTranslations {
  const resolved = resolveLocale(code);
  return registry.get(resolved) as TiptapTranslations;
}

/**
 * Restores the registry to only the five built-in locales (`en`, `fr`,
 * `pt`, `es`, `zh`), discarding anything registered via `registerLocale`. This is
 * test-facing: production code should never need to reset the registry, but
 * tests rely on it in `beforeEach` to avoid state leaking between cases.
 */
export function resetRegistry(): void {
  registry = new LocaleCatalogStore();
  seedInto(registry);
  notifyRegistry();
}
