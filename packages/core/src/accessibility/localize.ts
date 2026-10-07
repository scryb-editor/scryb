import { interpolate } from "../i18n/interpolate";
import { pluralFormsFrom, selectPlural } from "../i18n/plural";
import type { LocaleCode, TiptapTranslations } from "../i18n/types";
import { en } from "../i18n/locales/en";
import type { AccessibilityCheckResult, AccessibilityIssue, AccessibilityIssueSeverity } from "./types";

type CheckerStrings = TiptapTranslations["accessibilityChecker"];

function params(issue: AccessibilityIssue): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(issue.data ?? {})) {
    if (typeof value === "string" || typeof value === "number") out[key] = value;
  }
  return out;
}

/**
 * Issue texts in the active locale, interpolating `issue.data`. A catalog
 * without `issues` (optional for custom catalogs) falls back to English; an
 * issue without a `messageId` (built by consumer code) keeps its own texts.
 *
 * @param issue - Issue from `checkAccessibility`
 * @param t - `translations.accessibilityChecker`
 * @returns Localised message, description and fix
 * @example localizeAccessibilityIssue(issue, i18n.accessibilityChecker).message
 */
export function localizeAccessibilityIssue(
  issue: AccessibilityIssue,
  t: CheckerStrings
): { message: string; description: string; fix: string } {
  const id = issue.messageId;
  const texts = id ? (t.issues?.[id] ?? en.accessibilityChecker.issues?.[id]) : undefined;
  if (!texts) return { message: issue.message, description: issue.description, fix: issue.fix ?? "" };
  const p = params(issue);
  return {
    message: interpolate(texts.message, p),
    description: interpolate(texts.description, p),
    fix: interpolate(texts.fix, p),
  };
}

/**
 * Visible severity label.
 *
 * @param severity - Issue severity
 * @param t - `translations.accessibilityChecker`
 * @returns e.g. "Error"
 * @example accessibilitySeverityLabel("error", t)
 */
export function accessibilitySeverityLabel(severity: AccessibilityIssueSeverity, t: CheckerStrings): string {
  return (t.severity ?? en.accessibilityChecker.severity!)[severity];
}

/**
 * The checker's status line, shared by both adapters.
 *
 * @param result - Check result
 * @param t - `translations.accessibilityChecker`
 * @param locale - Active locale for plural rules
 * @returns e.g. "Found 3 issues — 1 error, 2 warnings, 0 info"
 * @example formatAccessibilitySummary(result, i18n.accessibilityChecker, i18n.locale)
 */
export function formatAccessibilitySummary(
  result: AccessibilityCheckResult,
  t: CheckerStrings,
  locale: LocaleCode
): string {
  const tally = (count: number, forms: CheckerStrings["errors"]): string =>
    interpolate(selectPlural(locale, count, forms), { count });
  const heading = interpolate(
    selectPlural(locale, result.totalIssues, pluralFormsFrom(t.foundIssue, t.foundIssues)),
    { count: result.totalIssues }
  );
  return `${heading} — ${result.errorCount} ${tally(result.errorCount, t.errors)}, ${result.warningCount} ${tally(result.warningCount, t.warnings)}, ${result.infoCount} ${t.info}`;
}
