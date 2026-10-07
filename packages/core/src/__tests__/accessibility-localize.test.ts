import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { checkAccessibility, checkHeadingHierarchy } from "../accessibility/checker";
import { accessibilitySeverityLabel, formatAccessibilitySummary, localizeAccessibilityIssue } from "../accessibility/localize";
import { en } from "../i18n/locales/en";
import { fr } from "../i18n/locales/fr";
import { es } from "../i18n/locales/es";
import { pt } from "../i18n/locales/pt";
import { zh } from "../i18n/locales/zh";

describe("checker localisation", () => {
  const editor = new Editor({ extensions: [StarterKit], content: "<h1>A</h1><h3>B</h3>" });
  const [issue] = checkHeadingHierarchy(editor.state.doc);

  it("carries a message id and placeholder data", () => {
    expect(issue?.messageId).toBe("missingHeadingHierarchy");
    expect(issue?.data).toMatchObject({ expected: 2, actual: 3 });
  });

  it("localises message, description and fix", () => {
    const text = localizeAccessibilityIssue(issue!, fr.accessibilityChecker);
    expect(text.message).toBe("Problème de hiérarchie des titres : h2 attendu, h3 trouvé");
    expect(text.fix).toContain("h2");
  });

  it("formats the summary with plurals", () => {
    const summary = formatAccessibilitySummary(
      { issues: [], totalIssues: 1, errorCount: 1, warningCount: 0, infoCount: 0 } as never,
      en.accessibilityChecker,
      "en",
    );
    expect(summary).toBe("Found 1 issue — 1 error, 0 warnings, 0 info");
  });

  it("labels severity", () => {
    expect(accessibilitySeverityLabel("warning", fr.accessibilityChecker)).toBe("Avertissement");
  });

  it("resolves every emitted issue to a catalog entry with no unresolved placeholder", () => {
    const doc = new Editor({
      extensions: [StarterKit, Image, TableKit],
      content: [
        "<h2>Skip</h2>",
        '<img src="a.png">',
        '<img src="b.png" alt="">',
        '<img src="c.png" alt="wide" width="3000" height="2000">',
        '<p><a href="/x">click here</a></p>',
        '<p>a<a href="/y"> </a>b</p>',
        "<table><tr><td>a</td></tr></table>",
      ].join(""),
    });
    const issues = checkAccessibility(doc).issues;
    expect(new Set(issues.map((i) => i.messageId))).toEqual(new Set(Object.keys(en.accessibilityChecker.issues ?? {})));
    for (const locale of [en, es, fr, pt, zh]) {
      for (const i of issues) {
        const text = localizeAccessibilityIssue(i, locale.accessibilityChecker);
        expect(`${text.message} ${text.description} ${text.fix}`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("emits the English catalog texts as the issue's own message, description and fix", () => {
    const doc = new Editor({
      extensions: [StarterKit, Image, TableKit],
      content: [
        "<h2>Skip</h2>",
        '<img src="a.png">',
        '<img src="b.png" alt="">',
        '<img src="c.png" alt="wide" width="3000" height="2000">',
        '<p><a href="/x">click here</a></p>',
        '<p>a<a href="/y"> </a>b</p>',
        "<table><tr><td>a</td></tr></table>",
      ].join(""),
    });
    for (const i of checkAccessibility(doc).issues) {
      expect({ message: i.message, description: i.description, fix: i.fix }).toEqual(
        localizeAccessibilityIssue(i, en.accessibilityChecker),
      );
    }
  });

  it("emits the English catalog wording", () => {
    const [heading] = checkHeadingHierarchy(new Editor({ extensions: [StarterKit], content: "<h1>A</h1><h3>B</h3>" }).state.doc);
    expect(heading?.message).toBe("Heading hierarchy issue: expected h2, found h3");
    expect(en.accessibilityChecker.issues?.missingAltText?.fix).toBe("Add alt text describing the image, or mark it as decorative.");
  });
});
