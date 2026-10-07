import { describe, expect, expectTypeOf, it } from "vitest";
import { accessibilitySeverityLabel, localizeAccessibilityIssue } from "../accessibility/localize";
import { characterLimitMessage } from "../accessibility/announcer";
import { tableGripLabel } from "../table-menu/grip-label";
import { en } from "../i18n/locales/en";
import type { TiptapTranslations } from "../i18n/types";
import type { AccessibilityIssue } from "../accessibility/types";

/**
 * Final fix wave F8: keys added by the a11y work are optional in the public
 * types, so a consumer's full custom catalog (typed as TiptapTranslations)
 * written before them still compiles; every read site falls back to English.
 */

type Strip<T, K extends PropertyKey> = Omit<T, K & keyof T>;

/** A catalog as a consumer typed it before the a11y keys existed. */
const legacy = {
  ...en,
  table: en.table as Strip<TiptapTranslations["table"], "columnActions" | "rowActions">,
  editor: en.editor as Strip<TiptapTranslations["editor"], "characterLimit" | "characterLimitNear" | "characterLimitReached">,
  accessibilityChecker: { ...en.accessibilityChecker, severity: undefined, issues: undefined },
} satisfies TiptapTranslations;

const issue: AccessibilityIssue = {
  id: "x",
  type: "missingAltText",
  messageId: "imageTooWide",
  severity: "info",
  message: "m",
  description: "d",
  location: { from: 0, to: 1, nodeType: "image" },
  data: { width: 3000, max: 1920 },
};

describe("optional a11y catalog keys", () => {
  it("are optional in the public types", () => {
    expectTypeOf<TiptapTranslations["table"]["columnActions"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TiptapTranslations["imageUpload"]["altText"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TiptapTranslations["imageBubbleMenu"]["editAltText"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TiptapTranslations["editor"]["characterLimit"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<AccessibilityIssue["messageId"]>().toEqualTypeOf<
      "missingAltText" | "emptyAltText" | "missingHeadingHierarchy" | "emptyLinkText" | "genericLinkText" | "missingTableHeaders" | "imageTooWide" | "imageTooTall" | undefined
    >();
  });

  it("are all shipped by the English catalog", () => {
    for (const value of [
      en.table.columnActions, en.table.rowActions,
      en.imageUpload.altText, en.imageUpload.altTextHint, en.imageUpload.decorative,
      en.imageBubbleMenu.editAltText,
      en.editor.characterLimit, en.editor.characterLimitNear, en.editor.characterLimitReached,
      en.accessibilityChecker.severity, en.accessibilityChecker.issues,
    ]) expect(value).toBeTruthy();
  });

  it("fall back to English when a catalog omits them", () => {
    expect(localizeAccessibilityIssue(issue, legacy.accessibilityChecker).message).toBe(
      "Image width (3000px) exceeds recommended maximum (1920px)",
    );
    expect(accessibilitySeverityLabel("warning", legacy.accessibilityChecker)).toBe("Warning");
    expect(tableGripLabel(legacy.table, "column", 1)).toBe("Column 2 actions");
    expect(characterLimitMessage("reached", 10, legacy.editor)).toBe(
      characterLimitMessage("reached", 10, en.editor),
    );
  });

  it("keeps a consumer-built issue's own texts when it has no messageId", () => {
    const { messageId: _omit, ...own } = issue;
    expect(localizeAccessibilityIssue({ ...own, fix: "f" }, en.accessibilityChecker)).toEqual({ message: "m", description: "d", fix: "f" });
  });
});
