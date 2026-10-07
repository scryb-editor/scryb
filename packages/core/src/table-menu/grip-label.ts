import { interpolate } from "../i18n/interpolate";
import type { TiptapTranslations } from "../i18n/types";
import { en } from "../i18n/locales/en";

/**
 * Accessible name of a row/column grip ("Column 2 actions").
 *
 * @param t - `translations.table`
 * @param orientation - Which kind of line the grip selects
 * @param index - 0-based line index
 * @returns Localised grip name
 * @example tableGripLabel(i18n.table, "column", 1) // "Column 2 actions"
 */
export function tableGripLabel(t: TiptapTranslations["table"], orientation: "row" | "column", index: number): string {
  const template = orientation === "row" ? (t.rowActions ?? en.table.rowActions) : (t.columnActions ?? en.table.columnActions);
  return interpolate(template!, { index: index + 1 });
}
