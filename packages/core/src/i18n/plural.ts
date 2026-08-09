import type { LocaleCode } from "./types";

// =============================================================================
// Plural selection
// =============================================================================

/**
 * The set of plural categories CLDR/`Intl.PluralRules` can select between.
 * `other` is the only mandatory form — every language has one, and it is the
 * fallback when a locale's matched category has no translation supplied.
 */
export type PluralForms = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

/**
 * Cache of `Intl.PluralRules` instances keyed by locale code. Constructing
 * one is not free, and count-bearing widgets (e.g. the word counter) call
 * `selectPlural` on every keystroke — this map ensures each locale only pays
 * the construction cost once per process.
 */
const pluralRulesCache = new Map<string, Intl.PluralRules>();

/**
 * Returns a cached `Intl.PluralRules` for `locale`, constructing and caching
 * one on first use. Falls back to English rules if `locale` is not a valid
 * BCP-47 tag `Intl.PluralRules` accepts (it throws `RangeError` on those).
 */
function getPluralRules(locale: LocaleCode): Intl.PluralRules {
  const cached = pluralRulesCache.get(locale);
  if (cached !== undefined) return cached;

  let rules: Intl.PluralRules;
  try {
    rules = new Intl.PluralRules(locale);
  } catch {
    rules = new Intl.PluralRules("en");
  }

  pluralRulesCache.set(locale, rules);
  return rules;
}

/**
 * Selects the correct plural form of a translation for `count` in `locale`,
 * using `Intl.PluralRules` (a platform built-in — no dependency) to pick the
 * CLDR category (`zero` / `one` / `two` / `few` / `many` / `other`).
 *
 * `forms` may be a bare string, in which case it is returned unchanged — this
 * is what makes widening a translation key from `string` to
 * `string | PluralForms` backward compatible: every built-in catalog (en, fr,
 * pt) keeps plain strings and behaves exactly as before. Passing an object
 * unlocks languages with more than two plural categories (Russian, Polish,
 * Czech, Arabic, ...) that a `count === 1` ternary cannot express correctly.
 *
 * If the category `Intl.PluralRules` selects has no corresponding key in
 * `forms`, this falls back to `forms.other`.
 *
 * @param locale - The locale to select plural rules for
 * @param count - The quantity driving the plural selection
 * @param forms - Either a bare string (treated as `other`) or a `PluralForms` map
 * @returns The selected translation string
 * @example
 * ```typescript
 * selectPlural("en", 1, { one: "{count} issue", other: "{count} issues" }); // "{count} issue"
 * selectPlural("ru", 3, { one: "...", few: "{count} файла", many: "...", other: "..." }); // "{count} файла"
 * ```
 */
export function selectPlural(locale: LocaleCode, count: number, forms: PluralForms | string): string {
  if (typeof forms === "string") return forms;

  const rules = getPluralRules(locale);
  const category = rules.select(count);
  return forms[category] ?? forms.other;
}

/**
 * Combines a legacy singular/plural key *pair* into a single `PluralForms`
 * map suitable for `selectPlural`.
 *
 * Several catalog sections predate `PluralForms` and model plurals as two
 * sibling keys (e.g. `accessibilityChecker.foundIssue` / `foundIssues`). Both
 * are now typed `string | PluralForms`, which means a consumer registering a
 * many-category language can supply the full map on *either* key. Naively
 * reading `.other` off each and rebuilding `{ one, other }` would silently
 * drop the `few` / `many` / `two` / `zero` forms — the exact forms those
 * languages need — so this merges instead:
 *
 * - if `other` is already a `PluralForms` map, every category it declares is
 *   preserved, and `one` only fills in a gap the map left open;
 * - otherwise the two plain strings become `{ one, other }`, i.e. exactly the
 *   pre-`PluralForms` behaviour.
 *
 * @param one - The singular-form key (plain string or a `PluralForms` map)
 * @param other - The plural-form key (plain string or a `PluralForms` map)
 * @returns A `PluralForms` map to hand to `selectPlural`
 * @example
 * ```typescript
 * // Legacy two-key catalogs behave exactly as before.
 * pluralFormsFrom("Found {count} issue", "Found {count} issues");
 * // → { one: "Found {count} issue", other: "Found {count} issues" }
 *
 * // A Russian catalog supplying the full map on the plural key keeps `few`.
 * pluralFormsFrom("...", { one: "...", few: "...", many: "...", other: "..." });
 * ```
 */
export function pluralFormsFrom(
  one: PluralForms | string,
  other: PluralForms | string,
): PluralForms {
  const oneForm = typeof one === "string" ? one : (one.one ?? one.other);

  if (typeof other === "string") {
    return { one: oneForm, other };
  }

  return { ...other, one: other.one ?? oneForm };
}
