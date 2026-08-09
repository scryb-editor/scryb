import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  DEFAULT_ACCESSIBILITY_CHECKER_CONFIG,
  type AccessibilityCheckResult,
  type AccessibilityCheckerConfig,
  type AccessibilityIssue,
  type AccessibilityIssueLocation,
  type AccessibilityIssueSeverity,
  type AccessibilityIssueType,
} from "./types";

// =============================================================================
// Private helpers
// =============================================================================

/**
 * Generates a unique ID for an accessibility issue.
 */
function generateIssueId(type: AccessibilityIssueType, location: AccessibilityIssueLocation): string {
  return `${type}-${location.from}-${location.to}`;
}

/**
 * Creates an AccessibilityIssue object.
 */
function createAccessibilityIssue(
  type: AccessibilityIssueType,
  severity: AccessibilityIssueSeverity,
  message: string,
  description: string,
  location: AccessibilityIssueLocation,
  fix?: string,
  data?: Record<string, unknown>
): AccessibilityIssue {
  return {
    id: generateIssueId(type, location),
    type,
    severity,
    message,
    description,
    location,
    fix,
    data,
  };
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

      if (cfg.checkMissingAltText && (!alt || alt.trim().length === 0)) {
        issues.push(
          createAccessibilityIssue(
            "missingAltText",
            "error",
            "Image missing alt text",
            "Images must have descriptive alt text for screen readers.",
            location,
            "Add an alt attribute describing the image content.",
            { src: attrs["src"] as string }
          )
        );
      }

      if (cfg.checkEmptyAltText && alt === "") {
        issues.push(
          createAccessibilityIssue(
            "emptyAltText",
            "warning",
            "Image has empty alt text",
            "Empty alt text is only appropriate for decorative images. If the image conveys information, add descriptive alt text.",
            location,
            "Add descriptive alt text or mark the image as decorative.",
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
        "warning",
        `Heading hierarchy issue: Expected h${issue.expectedLevel}, found h${issue.actualLevel}`,
        "Headings should follow a logical hierarchy (h1 → h2 → h3, etc.) without skipping levels.",
        location,
        `Change this heading to h${issue.expectedLevel} to maintain proper hierarchy.`
      )
    );
  }

  return issues;
}

/**
 * Checks links for empty or generic link text.
 *
 * @param doc - ProseMirror document node
 * @returns Array of accessibility issues found
 */
export function checkLinkText(doc: ProseMirrorNode): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === "link") {
      const attrs = node.attrs;
      const text = node.textContent?.trim() || "";
      const location: AccessibilityIssueLocation = {
        from: pos,
        to: pos + node.nodeSize,
        nodeType: "link",
      };

      if (text.length === 0) {
        issues.push(
          createAccessibilityIssue(
            "emptyLinkText",
            "error",
            "Link has no text content",
            "Links must have descriptive text content for screen readers.",
            location,
            "Add text content to the link.",
            { href: attrs["href"] as string }
          )
        );
      }

      const genericTexts = ["click here", "here", "read more", "link", "more", "clique aqui", "aqui", "leia mais"];
      const lowerText = text.toLowerCase();
      if (genericTexts.some((generic) => lowerText.includes(generic))) {
        issues.push(
          createAccessibilityIssue(
            "genericLinkText",
            "warning",
            "Link uses generic text",
            "Links should have descriptive text that makes sense out of context.",
            location,
            "Replace generic text with descriptive link text.",
            { href: attrs["href"] as string, text }
          )
        );
      }
    }
  });

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
            "warning",
            "Table missing header cells",
            "Tables should have header cells (th) to identify column/row headers for screen readers.",
            location,
            "Add header cells to the first row or column of the table."
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
            "info",
            `Image width (${width}px) exceeds recommended maximum (${cfg.maxImageWidth}px)`,
            "Large images can cause performance issues and poor user experience on mobile devices.",
            location,
            `Resize the image to ${cfg.maxImageWidth}px or less.`,
            { width, maxWidth: cfg.maxImageWidth }
          )
        );
      }

      if (height && height > cfg.maxImageHeight!) {
        issues.push(
          createAccessibilityIssue(
            "imageTooLarge",
            "info",
            `Image height (${height}px) exceeds recommended maximum (${cfg.maxImageHeight}px)`,
            "Large images can cause performance issues and poor user experience on mobile devices.",
            location,
            `Resize the image to ${cfg.maxImageHeight}px or less.`,
            { height, maxHeight: cfg.maxImageHeight }
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
