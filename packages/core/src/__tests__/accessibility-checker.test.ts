import { describe, it, expect } from "vitest";
import {
  checkAccessibility,
  checkImageAltText,
  checkHeadingHierarchy,
  checkLinkText,
  checkTableAccessibility,
  checkImageDimensions,
  getIssuesAtPosition,
  getIssuesByType,
} from "../accessibility/checker";
import type { AccessibilityCheckResult } from "../accessibility/types";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

// =============================================================================
// Mock helpers
// =============================================================================

/**
 * Creates a mock ProseMirror node that calls the callback for each child
 * defined in `children`. Each child has `type.name`, `attrs`, `nodeSize`,
 * `textContent`, and optionally a nested `descendants` callback.
 */
function createMockDoc(
  children: Array<{
    typeName: string;
    attrs?: Record<string, unknown>;
    nodeSize?: number;
    textContent?: string;
    nestedChildren?: Array<{ typeName: string }>;
  }>
): ProseMirrorNode {
  const doc = {
    type: { name: "doc" },
    descendants(callback: (node: ProseMirrorNode, pos: number) => boolean | void) {
      let pos = 0;
      for (const child of children) {
        const nodeSize = child.nodeSize ?? 10;
        const childNode = {
          type: { name: child.typeName },
          attrs: child.attrs ?? {},
          nodeSize,
          textContent: child.textContent ?? "",
          descendants(innerCb: (node: ProseMirrorNode, pos: number) => boolean | void) {
            if (child.nestedChildren) {
              for (const nested of child.nestedChildren) {
                const nestedNode = {
                  type: { name: nested.typeName },
                  attrs: {},
                  nodeSize: 5,
                  textContent: "",
                } as unknown as ProseMirrorNode;
                innerCb(nestedNode, 0);
              }
            }
          },
        } as unknown as ProseMirrorNode;

        callback(childNode, pos);
        pos += nodeSize;
      }
    },
  } as unknown as ProseMirrorNode;

  return doc;
}

function createMockEditor(doc: ProseMirrorNode): Editor {
  return {
    state: { doc },
  } as unknown as Editor;
}

// =============================================================================
// checkImageAltText
// =============================================================================

describe("checkImageAltText", () => {
  it("flags images without alt text", () => {
    const doc = createMockDoc([
      { typeName: "image", attrs: { src: "photo.jpg" } },
    ]);
    const issues = checkImageAltText(doc);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("missingAltText");
    expect(issues[0].severity).toBe("error");
  });

  it("flags images with empty alt text", () => {
    const doc = createMockDoc([
      { typeName: "image", attrs: { src: "photo.jpg", alt: "" } },
    ]);
    const issues = checkImageAltText(doc);
    // Should have both missingAltText (empty trim) and emptyAltText
    const emptyAltIssues = issues.filter((i) => i.type === "emptyAltText");
    expect(emptyAltIssues.length).toBe(1);
    expect(emptyAltIssues[0].severity).toBe("warning");
  });

  it("does not flag images with valid alt text", () => {
    const doc = createMockDoc([
      { typeName: "image", attrs: { src: "photo.jpg", alt: "A photo of a sunset" } },
    ]);
    const issues = checkImageAltText(doc);
    expect(issues).toHaveLength(0);
  });

  it("flags resizableImage nodes without alt text", () => {
    const doc = createMockDoc([
      { typeName: "resizableImage", attrs: { src: "photo.jpg" } },
    ]);
    const issues = checkImageAltText(doc);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].type).toBe("missingAltText");
  });

  it("respects config to disable missing alt text check", () => {
    const doc = createMockDoc([
      { typeName: "image", attrs: { src: "photo.jpg" } },
    ]);
    const issues = checkImageAltText(doc, { checkMissingAltText: false });
    const missingAlt = issues.filter((i) => i.type === "missingAltText");
    expect(missingAlt).toHaveLength(0);
  });

  it("ignores non-image nodes", () => {
    const doc = createMockDoc([
      { typeName: "paragraph", attrs: {} },
      { typeName: "heading", attrs: { level: 1 } },
    ]);
    const issues = checkImageAltText(doc);
    expect(issues).toHaveLength(0);
  });
});

// =============================================================================
// checkHeadingHierarchy
// =============================================================================

describe("checkHeadingHierarchy", () => {
  it("returns empty array for valid hierarchy h1 -> h2 -> h3", () => {
    const doc = createMockDoc([
      { typeName: "heading", attrs: { level: 1 } },
      { typeName: "heading", attrs: { level: 2 } },
      { typeName: "heading", attrs: { level: 3 } },
    ]);
    const issues = checkHeadingHierarchy(doc);
    expect(issues).toHaveLength(0);
  });

  it("flags when first heading is not h1", () => {
    const doc = createMockDoc([
      { typeName: "heading", attrs: { level: 2 } },
    ]);
    const issues = checkHeadingHierarchy(doc);
    expect(issues.length).toBe(1);
    expect(issues[0].type).toBe("missingHeadingHierarchy");
    expect(issues[0].message).toContain("Expected h1");
    expect(issues[0].message).toContain("found h2");
  });

  it("flags skipped heading levels h1 -> h3", () => {
    const doc = createMockDoc([
      { typeName: "heading", attrs: { level: 1 } },
      { typeName: "heading", attrs: { level: 3 }, nodeSize: 10 },
    ]);
    const issues = checkHeadingHierarchy(doc);
    expect(issues.length).toBe(1);
    expect(issues[0].message).toContain("Expected h2");
    expect(issues[0].message).toContain("found h3");
  });

  it("returns empty array when no headings are present", () => {
    const doc = createMockDoc([
      { typeName: "paragraph" },
      { typeName: "paragraph" },
    ]);
    const issues = checkHeadingHierarchy(doc);
    expect(issues).toHaveLength(0);
  });

  it("flags multiple hierarchy violations", () => {
    const doc = createMockDoc([
      { typeName: "heading", attrs: { level: 3 }, nodeSize: 10 },
      { typeName: "heading", attrs: { level: 1 }, nodeSize: 10 },
      { typeName: "heading", attrs: { level: 3 }, nodeSize: 10 },
    ]);
    const issues = checkHeadingHierarchy(doc);
    // First heading should be h1 but is h3, then h1 to h3 skips h2
    expect(issues.length).toBe(2);
  });
});

// =============================================================================
// checkLinkText
// =============================================================================

describe("checkLinkText", () => {
  it("flags links with empty text", () => {
    const doc = createMockDoc([
      { typeName: "link", attrs: { href: "https://example.com" }, textContent: "" },
    ]);
    const issues = checkLinkText(doc);
    const emptyLinks = issues.filter((i) => i.type === "emptyLinkText");
    expect(emptyLinks.length).toBe(1);
    expect(emptyLinks[0].severity).toBe("error");
  });

  it("flags links with generic text like 'click here'", () => {
    const doc = createMockDoc([
      { typeName: "link", attrs: { href: "https://example.com" }, textContent: "Click here" },
    ]);
    const issues = checkLinkText(doc);
    const genericLinks = issues.filter((i) => i.type === "genericLinkText");
    expect(genericLinks.length).toBe(1);
    expect(genericLinks[0].severity).toBe("warning");
  });

  it("flags 'read more' as generic text", () => {
    const doc = createMockDoc([
      { typeName: "link", attrs: { href: "https://example.com" }, textContent: "Read more" },
    ]);
    const issues = checkLinkText(doc);
    const genericLinks = issues.filter((i) => i.type === "genericLinkText");
    expect(genericLinks.length).toBe(1);
  });

  it("does not flag links with descriptive text", () => {
    const doc = createMockDoc([
      { typeName: "link", attrs: { href: "https://example.com" }, textContent: "Visit our documentation" },
    ]);
    const issues = checkLinkText(doc);
    expect(issues).toHaveLength(0);
  });

  it("ignores non-link nodes", () => {
    const doc = createMockDoc([
      { typeName: "paragraph", textContent: "hello" },
    ]);
    const issues = checkLinkText(doc);
    expect(issues).toHaveLength(0);
  });
});

// =============================================================================
// checkTableAccessibility
// =============================================================================

describe("checkTableAccessibility", () => {
  it("flags tables without header cells", () => {
    const doc = createMockDoc([
      {
        typeName: "table",
        nestedChildren: [{ typeName: "tableCell" }],
      },
    ]);
    const issues = checkTableAccessibility(doc);
    expect(issues.length).toBe(1);
    expect(issues[0].type).toBe("missingTableHeaders");
    expect(issues[0].severity).toBe("warning");
  });

  it("does not flag tables with header cells", () => {
    const doc = createMockDoc([
      {
        typeName: "table",
        nestedChildren: [{ typeName: "tableHeader" }],
      },
    ]);
    const issues = checkTableAccessibility(doc);
    expect(issues).toHaveLength(0);
  });

  it("ignores non-table nodes", () => {
    const doc = createMockDoc([
      { typeName: "paragraph" },
    ]);
    const issues = checkTableAccessibility(doc);
    expect(issues).toHaveLength(0);
  });
});

// =============================================================================
// checkImageDimensions
// =============================================================================

describe("checkImageDimensions", () => {
  it("flags images that exceed max width", () => {
    const doc = createMockDoc([
      { typeName: "image", attrs: { src: "photo.jpg", width: "2500", alt: "test" } },
    ]);
    const issues = checkImageDimensions(doc, { maxImageWidth: 1920, maxImageHeight: 1080 });
    const widthIssues = issues.filter((i) => i.message.includes("width"));
    expect(widthIssues.length).toBe(1);
    expect(widthIssues[0].type).toBe("imageTooLarge");
    expect(widthIssues[0].severity).toBe("info");
  });

  it("flags images that exceed max height", () => {
    const doc = createMockDoc([
      { typeName: "image", attrs: { src: "photo.jpg", height: "2000", alt: "test" } },
    ]);
    const issues = checkImageDimensions(doc, { maxImageWidth: 1920, maxImageHeight: 1080 });
    const heightIssues = issues.filter((i) => i.message.includes("height"));
    expect(heightIssues.length).toBe(1);
  });

  it("does not flag images within limits", () => {
    const doc = createMockDoc([
      { typeName: "image", attrs: { src: "photo.jpg", width: "800", height: "600", alt: "test" } },
    ]);
    const issues = checkImageDimensions(doc, { maxImageWidth: 1920, maxImageHeight: 1080 });
    expect(issues).toHaveLength(0);
  });

  it("returns empty when maxImageWidth/maxImageHeight are not set", () => {
    const doc = createMockDoc([
      { typeName: "image", attrs: { src: "photo.jpg", width: "5000", alt: "test" } },
    ]);
    const issues = checkImageDimensions(doc, { maxImageWidth: undefined, maxImageHeight: undefined });
    expect(issues).toHaveLength(0);
  });
});

// =============================================================================
// checkAccessibility (main function)
// =============================================================================

describe("checkAccessibility", () => {
  it("returns an AccessibilityCheckResult with correct structure", () => {
    const doc = createMockDoc([{ typeName: "paragraph" }]);
    const editor = createMockEditor(doc);
    const result = checkAccessibility(editor);

    expect(result).toHaveProperty("issues");
    expect(result).toHaveProperty("totalIssues");
    expect(result).toHaveProperty("errorCount");
    expect(result).toHaveProperty("warningCount");
    expect(result).toHaveProperty("infoCount");
    expect(result).toHaveProperty("timestamp");
    expect(typeof result.timestamp).toBe("number");
  });

  it("returns empty issues for valid content", () => {
    const doc = createMockDoc([
      { typeName: "heading", attrs: { level: 1 } },
      { typeName: "paragraph" },
      { typeName: "image", attrs: { src: "photo.jpg", alt: "A proper description" } },
    ]);
    const editor = createMockEditor(doc);
    const result = checkAccessibility(editor);
    expect(result.totalIssues).toBe(0);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
    expect(result.issues).toHaveLength(0);
  });

  it("aggregates issues from multiple checks", () => {
    const doc = createMockDoc([
      { typeName: "image", attrs: { src: "photo.jpg" } },
      { typeName: "heading", attrs: { level: 3 } },
    ]);
    const editor = createMockEditor(doc);
    const result = checkAccessibility(editor);
    // Should have at least image alt text issue + heading hierarchy issue
    expect(result.totalIssues).toBeGreaterThanOrEqual(2);
    expect(result.errorCount).toBeGreaterThanOrEqual(1); // missing alt text is an error
    expect(result.warningCount).toBeGreaterThanOrEqual(1); // heading hierarchy is a warning
  });

  it("respects config to disable specific checks", () => {
    const doc = createMockDoc([
      { typeName: "image", attrs: { src: "photo.jpg" } },
    ]);
    const editor = createMockEditor(doc);
    const result = checkAccessibility(editor, {
      checkMissingAltText: false,
      checkEmptyAltText: false,
    });
    const altIssues = result.issues.filter(
      (i) => i.type === "missingAltText" || i.type === "emptyAltText"
    );
    expect(altIssues).toHaveLength(0);
  });

  it("counts severities correctly", () => {
    const doc = createMockDoc([
      { typeName: "image", attrs: { src: "a.jpg" } },
      { typeName: "image", attrs: { src: "b.jpg" } },
      { typeName: "heading", attrs: { level: 3 } },
    ]);
    const editor = createMockEditor(doc);
    const result = checkAccessibility(editor);

    expect(result.totalIssues).toBe(result.errorCount + result.warningCount + result.infoCount);
  });
});

// =============================================================================
// getIssuesAtPosition
// =============================================================================

describe("getIssuesAtPosition", () => {
  it("returns issues that span the given position", () => {
    const result: AccessibilityCheckResult = {
      issues: [
        {
          id: "test-0-10",
          type: "missingAltText",
          severity: "error",
          message: "Image missing alt text",
          description: "desc",
          location: { from: 0, to: 10, nodeType: "image" },
        },
        {
          id: "test-20-30",
          type: "missingAltText",
          severity: "error",
          message: "Another image",
          description: "desc",
          location: { from: 20, to: 30, nodeType: "image" },
        },
      ],
      totalIssues: 2,
      errorCount: 2,
      warningCount: 0,
      infoCount: 0,
      timestamp: Date.now(),
    };

    const issuesAt5 = getIssuesAtPosition(result, 5);
    expect(issuesAt5).toHaveLength(1);
    expect(issuesAt5[0].id).toBe("test-0-10");
  });

  it("returns empty array for positions with no issues", () => {
    const result: AccessibilityCheckResult = {
      issues: [
        {
          id: "test-0-10",
          type: "missingAltText",
          severity: "error",
          message: "msg",
          description: "desc",
          location: { from: 0, to: 10, nodeType: "image" },
        },
      ],
      totalIssues: 1,
      errorCount: 1,
      warningCount: 0,
      infoCount: 0,
      timestamp: Date.now(),
    };

    const issues = getIssuesAtPosition(result, 50);
    expect(issues).toHaveLength(0);
  });
});

// =============================================================================
// getIssuesByType
// =============================================================================

describe("getIssuesByType", () => {
  it("filters issues by type", () => {
    const result: AccessibilityCheckResult = {
      issues: [
        {
          id: "alt-0-10",
          type: "missingAltText",
          severity: "error",
          message: "msg",
          description: "desc",
          location: { from: 0, to: 10, nodeType: "image" },
        },
        {
          id: "heading-20-21",
          type: "missingHeadingHierarchy",
          severity: "warning",
          message: "msg",
          description: "desc",
          location: { from: 20, to: 21, nodeType: "heading" },
        },
        {
          id: "alt-30-40",
          type: "missingAltText",
          severity: "error",
          message: "msg2",
          description: "desc",
          location: { from: 30, to: 40, nodeType: "image" },
        },
      ],
      totalIssues: 3,
      errorCount: 2,
      warningCount: 1,
      infoCount: 0,
      timestamp: Date.now(),
    };

    const altIssues = getIssuesByType(result, "missingAltText");
    expect(altIssues).toHaveLength(2);

    const headingIssues = getIssuesByType(result, "missingHeadingHierarchy");
    expect(headingIssues).toHaveLength(1);

    const linkIssues = getIssuesByType(result, "emptyLinkText");
    expect(linkIssues).toHaveLength(0);
  });
});
