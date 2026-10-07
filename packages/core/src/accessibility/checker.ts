import type { Editor } from "@tiptap/core";
import type { Mark, Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  DEFAULT_ACCESSIBILITY_CHECKER_CONFIG,
  type AccessibilityCheckResult,
  type AccessibilityCheckerConfig,
  type AccessibilityIssue,
  type AccessibilityIssueLocation,
  type AccessibilityIssueSeverity,
  type AccessibilityIssueType,
  type AccessibilityMessageId,
} from "./types";
import { en } from "../i18n/locales/en";
import { localizeAccessibilityIssue } from "./localize";

// =============================================================================
// Private helpers
// =============================================================================

/**
 * Generates a unique ID for an accessibility issue. Keyed on the message id so
 * an image both too wide and too tall yields two distinct ids.
 */
function generateIssueId(messageId: AccessibilityMessageId, location: AccessibilityIssueLocation): string {
  return `${messageId}-${location.from}-${location.to}`;
}

/**
 * Creates an AccessibilityIssue object. Its English message, description and
 * fix come from the `en` catalog, interpolated with `data`.
 */
function createAccessibilityIssue(
  type: AccessibilityIssueType,
  messageId: AccessibilityMessageId,
  severity: AccessibilityIssueSeverity,
  location: AccessibilityIssueLocation,
  data?: Record<string, unknown>
): AccessibilityIssue {
  const issue = {
    id: generateIssueId(messageId, location),
    type,
    messageId,
    severity,
    location,
    data,
  };
  return { ...issue, ...localizeAccessibilityIssue(issue as AccessibilityIssue, en.accessibilityChecker) };
}

/**
 * Checks heading hierarchy for skipped levels.
 */
function checkHeadingHierarchyHelper(
  headings: Array<{ level: number; from: number }>
): Array<{ from: number; expectedLevel: number; actualLevel: number }> {
  const issues: Array<{ from: number; expectedLevel: number; actualLevel: number }> = [];
  let lastLevel = 0;

  for (const heading of headings) {
    const { level, from } = heading;

    if (lastLevel === 0 && level !== 1) {
      issues.push({ from, expectedLevel: 1, actualLevel: level });
    } else if (level > lastLevel + 1) {
      issues.push({ from, expectedLevel: lastLevel + 1, actualLevel: level });
    }

    lastLevel = level;
  }

  return issues;
}

// =============================================================================
// Individual check functions
// =============================================================================

/**
 * Checks images for missing or empty alt text.
 *
 * @param doc - ProseMirror document node
 * @param config - Accessibility checker configuration
 * @returns Array of accessibility issues found
 */
export function checkImageAltText(
  doc: ProseMirrorNode,
  config: Partial<AccessibilityCheckerConfig> = {}
): AccessibilityIssue[] {
  const cfg = { ...DEFAULT_ACCESSIBILITY_CHECKER_CONFIG, ...config };
  const issues: AccessibilityIssue[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === "resizableImage" || node.type.name === "image") {
      const attrs = node.attrs;
      const location: AccessibilityIssueLocation = {
        from: pos,
        to: pos + node.nodeSize,
        nodeType: node.type.name,
      };

      const alt = attrs["alt"] as string | undefined;

      // `alt=""` marks a decorative image (sanctioned; `emptyAltText` warns below);
      // only an absent or whitespace-only alt is an error.
      if (cfg.checkMissingAltText && (alt == null || (alt !== "" && alt.trim().length === 0))) {
        issues.push(
          createAccessibilityIssue(
            "missingAltText",
            "missingAltText",
            "error",
            location,
            { src: attrs["src"] as string }
          )
        );
      }

      if (cfg.checkEmptyAltText && alt === "") {
        issues.push(
          createAccessibilityIssue(
            "emptyAltText",
            "emptyAltText",
            "warning",
            location,
            { src: attrs["src"] as string }
          )
        );
      }
    }
  });

  return issues;
}

/**
 * Checks headings for hierarchy issues (skipped levels, wrong first level).
 *
 * @param doc - ProseMirror document node
 * @returns Array of accessibility issues found
 */
export function checkHeadingHierarchy(doc: ProseMirrorNode): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  const headings: Array<{ level: number; from: number }> = [];

  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      const level = (node.attrs["level"] as number | undefined) || 1;
      headings.push({ level, from: pos });
    }
  });

  const hierarchyIssues = checkHeadingHierarchyHelper(headings);
  for (const issue of hierarchyIssues) {
    const location: AccessibilityIssueLocation = {
      from: issue.from,
      to: issue.from + 1,
      nodeType: "heading",
    };

    issues.push(
      createAccessibilityIssue(
        "missingHeadingHierarchy",
        "missingHeadingHierarchy",
        "warning",
        location,
        { expected: issue.expectedLevel, actual: issue.actualLevel }
      )
    );
  }

  return issues;
}

/** Whole link texts (normalised) that say nothing about the destination out of context. */
const GENERIC_LINK_TEXTS: Record<string, true> = {
  "click here": true,
  here: true,
  "read more": true,
  link: true,
  more: true,
  "clique aqui": true,
  aqui: true,
  "leia mais": true,
};

/** Lowercases, collapses inner whitespace and drops trailing punctuation so "Read more…" matches "read more". */
function normalizeLinkText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .replace(/[\s.!?…:;,]+$/u, "");
}

/**
 * Checks links for empty or generic link text. Links are marks, so each link
 * is the run of adjacent text nodes carrying an equal `link` mark.
 *
 * @param doc - ProseMirror document node
 * @returns Array of accessibility issues found
 */
export function checkLinkText(doc: ProseMirrorNode): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  const links: Array<{ mark: Mark; from: number; to: number; text: string }> = [];

  doc.descendants((node, pos) => {
    if (!node.isText) return;
    const mark = node.marks.find((m) => m.type.name === "link");
    if (!mark) return;
    const last = links[links.length - 1];
    if (last && last.to === pos && last.mark.eq(mark)) {
      last.to = pos + node.nodeSize;
      last.text += node.text ?? "";
    } else {
      links.push({ mark, from: pos, to: pos + node.nodeSize, text: node.text ?? "" });
    }
  });

  for (const link of links) {
    const href = link.mark.attrs["href"] as string;
    const text = link.text.trim();
    const location: AccessibilityIssueLocation = { from: link.from, to: link.to, nodeType: "link" };

    if (text.length === 0) {
      issues.push(
        createAccessibilityIssue(
          "emptyLinkText",
          "emptyLinkText",
          "error",
          location,
          { href }
        )
      );
    }

    if (GENERIC_LINK_TEXTS[normalizeLinkText(text)] === true) {
      issues.push(
        createAccessibilityIssue(
          "genericLinkText",
          "genericLinkText",
          "warning",
          location,
          { href, text }
        )
      );
    }
  }

  return issues;
}

/**
 * Checks tables for missing header cells.
 *
 * @param doc - ProseMirror document node
 * @returns Array of accessibility issues found
 */
export function checkTableAccessibility(doc: ProseMirrorNode): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === "table") {
      const location: AccessibilityIssueLocation = {
        from: pos,
        to: pos + node.nodeSize,
        nodeType: "table",
      };

      let hasHeaders = false;
      node.descendants((cellNode) => {
        if (cellNode.type.name === "tableHeader") {
          hasHeaders = true;
          return false;
        }
        return true;
      });

      if (!hasHeaders) {
        issues.push(
          createAccessibilityIssue(
            "missingTableHeaders",
            "missingTableHeaders",
            "warning",
            location
          )
        );
      }
    }
  });

  return issues;
}

/**
 * Checks images for oversized dimensions.
 *
 * @param doc - ProseMirror document node
 * @param config - Accessibility checker configuration (uses maxImageWidth / maxImageHeight)
 * @returns Array of accessibility issues found
 */
export function checkImageDimensions(
  doc: ProseMirrorNode,
  config: Partial<AccessibilityCheckerConfig> = {}
): AccessibilityIssue[] {
  const cfg = { ...DEFAULT_ACCESSIBILITY_CHECKER_CONFIG, ...config };
  const issues: AccessibilityIssue[] = [];

  if (!cfg.maxImageWidth || !cfg.maxImageHeight) {
    return issues;
  }

  doc.descendants((node, pos) => {
    if (node.type.name === "resizableImage" || node.type.name === "image") {
      const attrs = node.attrs;
      const location: AccessibilityIssueLocation = {
        from: pos,
        to: pos + node.nodeSize,
        nodeType: node.type.name,
      };

      const width = attrs["width"] ? parseInt(String(attrs["width"]), 10) : null;
      const height = attrs["height"] ? parseInt(String(attrs["height"]), 10) : null;

      if (width && width > cfg.maxImageWidth!) {
        issues.push(
          createAccessibilityIssue(
            "imageTooLarge",
            "imageTooWide",
            "info",
            location,
            { width, max: cfg.maxImageWidth }
          )
        );
      }

      if (height && height > cfg.maxImageHeight!) {
        issues.push(
          createAccessibilityIssue(
            "imageTooLarge",
            "imageTooTall",
            "info",
            location,
            { height, max: cfg.maxImageHeight }
          )
        );
      }
    }
  });

  return issues;
}

// =============================================================================
// Main accessibility check function
// =============================================================================

/**
 * Runs a full accessibility check on the editor content.
 *
 * Pure function — takes an Editor instance, returns a typed result.
 * No class instantiation, no DI, no Angular lifecycle.
 *
 * @param editor - The Tiptap editor instance
 * @param config - Optional partial configuration to override defaults
 * @returns AccessibilityCheckResult with all issues found
 *
 * @example
 * ```typescript
 * const result = checkAccessibility(editor);
 * console.log(`Found ${result.totalIssues} issues`);
 * result.issues.forEach(issue => console.log(issue.message));
 * ```
 */
export function checkAccessibility(
  editor: Editor,
  config: Partial<AccessibilityCheckerConfig> = {}
): AccessibilityCheckResult {
  const cfg = { ...DEFAULT_ACCESSIBILITY_CHECKER_CONFIG, ...config };
  const issues: AccessibilityIssue[] = [];
  const doc = editor.state.doc;

  if (cfg.checkMissingAltText || cfg.checkEmptyAltText) {
    issues.push(...checkImageAltText(doc, cfg));
  }

  if (cfg.checkHeadingHierarchy) {
    issues.push(...checkHeadingHierarchy(doc));
  }

  if (cfg.checkLinkText) {
    issues.push(...checkLinkText(doc));
  }

  if (cfg.checkTableAccessibility) {
    issues.push(...checkTableAccessibility(doc));
  }

  if (cfg.checkImageDimensions) {
    issues.push(...checkImageDimensions(doc, cfg));
  }

  return {
    issues,
    totalIssues: issues.length,
    errorCount: issues.filter((i) => i.severity === "error").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
    infoCount: issues.filter((i) => i.severity === "info").length,
    timestamp: Date.now(),
  };
}

/**
 * Gets all issues at or overlapping a given document position.
 *
 * @param result - A previously computed AccessibilityCheckResult
 * @param pos - Document position to check
 * @returns Issues whose location spans the given position
 */
export function getIssuesAtPosition(
  result: AccessibilityCheckResult,
  pos: number
): readonly AccessibilityIssue[] {
  return result.issues.filter((issue) => issue.location.from <= pos && issue.location.to >= pos);
}

/**
 * Gets all issues of a given type from a result.
 *
 * @param result - A previously computed AccessibilityCheckResult
 * @param type - The issue type to filter by
 * @returns Issues matching the given type
 */
export function getIssuesByType(
  result: AccessibilityCheckResult,
  type: AccessibilityIssueType
): readonly AccessibilityIssue[] {
  return result.issues.filter((issue) => issue.type === type);
}
