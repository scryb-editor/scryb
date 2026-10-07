import { describe, it, expect, vi } from "vitest";
import {
  BLOCK_TYPES,
  isBlockNode,
  getBlockTypePriority,
  getBlockFromResolvedPos,
} from "../block-menu/detection";
import type { Editor } from "@tiptap/core";
import type { ResolvedPos } from "@tiptap/pm/model";

// =============================================================================
// BLOCK_TYPES
// =============================================================================

describe("BLOCK_TYPES", () => {
  it("contains exactly 12 entries", () => {
    expect(BLOCK_TYPES.size).toBe(12);
  });

  const expectedTypes = [
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "listItem",
    "taskList",
    "taskItem",
    "blockquote",
    "codeBlock",
    "table",
    "image",
    "horizontalRule",
  ];

  for (const typeName of expectedTypes) {
    it(`contains "${typeName}"`, () => {
      expect(BLOCK_TYPES.has(typeName)).toBe(true);
    });
  }
});

// =============================================================================
// isBlockNode
// =============================================================================

describe("isBlockNode", () => {
  const blockNodeTypes = [
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "listItem",
    "blockquote",
    "codeBlock",
    "table",
    "image",
    "horizontalRule",
  ];

  for (const typeName of blockNodeTypes) {
    it(`returns true for "${typeName}"`, () => {
      expect(isBlockNode(typeName)).toBe(true);
    });
  }

  it("returns false for unknown type 'text'", () => {
    expect(isBlockNode("text")).toBe(false);
  });

  it("returns false for unknown type 'hardBreak'", () => {
    expect(isBlockNode("hardBreak")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isBlockNode("")).toBe(false);
  });
});

// =============================================================================
// getBlockTypePriority
// =============================================================================

describe("getBlockTypePriority", () => {
  it("returns 0 for listItem (highest priority)", () => {
    expect(getBlockTypePriority("listItem")).toBe(0);
  });

  it("returns 0 for taskItem, like listItem", () => {
    expect(getBlockTypePriority("taskItem")).toBe(0);
  });

  it("returns 1 for blockquote", () => {
    expect(getBlockTypePriority("blockquote")).toBe(1);
  });

  it("returns 2 for codeBlock", () => {
    expect(getBlockTypePriority("codeBlock")).toBe(2);
  });

  it("returns 3 for table", () => {
    expect(getBlockTypePriority("table")).toBe(3);
  });

  it("returns 4 for image", () => {
    expect(getBlockTypePriority("image")).toBe(4);
  });

  it("returns 5 for heading", () => {
    expect(getBlockTypePriority("heading")).toBe(5);
  });

  it("returns 6 for paragraph", () => {
    expect(getBlockTypePriority("paragraph")).toBe(6);
  });

  it("returns 7 for bulletList", () => {
    expect(getBlockTypePriority("bulletList")).toBe(7);
  });

  it("returns 7 for orderedList", () => {
    expect(getBlockTypePriority("orderedList")).toBe(7);
  });

  it("returns 7 for taskList, like the other lists", () => {
    expect(getBlockTypePriority("taskList")).toBe(7);
  });

  it("returns 8 for horizontalRule", () => {
    expect(getBlockTypePriority("horizontalRule")).toBe(8);
  });

  it("returns 99 for unknown types", () => {
    expect(getBlockTypePriority("unknown")).toBe(99);
    expect(getBlockTypePriority("text")).toBe(99);
    expect(getBlockTypePriority("")).toBe(99);
  });

  it("ordering: listItem < blockquote < codeBlock < table < image < heading < paragraph < bulletList/orderedList < horizontalRule", () => {
    const priorities = [
      getBlockTypePriority("listItem"),
      getBlockTypePriority("blockquote"),
      getBlockTypePriority("codeBlock"),
      getBlockTypePriority("table"),
      getBlockTypePriority("image"),
      getBlockTypePriority("heading"),
      getBlockTypePriority("paragraph"),
      getBlockTypePriority("bulletList"),
      getBlockTypePriority("horizontalRule"),
    ];

    for (let i = 0; i < priorities.length - 1; i++) {
      expect(priorities[i]!).toBeLessThanOrEqual(priorities[i + 1]!);
    }
  });
});

// =============================================================================
// getBlockFromResolvedPos
// =============================================================================

describe("getBlockFromResolvedPos", () => {
  function createMockResolvedPos(
    depth: number,
    nodes: Array<{ typeName: string; pos: number }>,
  ): ResolvedPos {
    return {
      depth,
      node: vi.fn().mockImplementation((d: number) => {
        const nodeInfo = nodes[d];
        if (!nodeInfo) return null;
        return { type: { name: nodeInfo.typeName }, isTextblock: false, content: { size: 5 } };
      }),
      before: vi.fn().mockImplementation((d: number) => {
        return nodes[d]?.pos ?? 0;
      }),
    } as unknown as ResolvedPos;
  }

  function createMockEditorWithDOM(nodeDomMap: Map<number, HTMLElement | null>) {
    return {
      view: {
        nodeDOM: vi.fn().mockImplementation((pos: number) => nodeDomMap.get(pos) ?? null),
      },
    } as unknown as Editor;
  }

  it("returns null when no block candidates found (depth 0)", () => {
    const resolvedPos = {
      depth: 0,
      node: vi.fn(),
      before: vi.fn(),
    } as unknown as ResolvedPos;

    const editor = createMockEditorWithDOM(new Map());
    const result = getBlockFromResolvedPos(editor, resolvedPos);
    expect(result).toBeNull();
  });

  it("returns null when no block candidates found (unknown type)", () => {
    const resolvedPos = createMockResolvedPos(2, [
      { typeName: "doc", pos: 0 },
      { typeName: "text", pos: 1 },
      { typeName: "hardBreak", pos: 2 },
    ]);

    const editor = createMockEditorWithDOM(new Map());
    const result = getBlockFromResolvedPos(editor, resolvedPos);
    expect(result).toBeNull();
  });

  it("returns block info when a block node is found", () => {
    const mockEl = document.createElement("div");
    const resolvedPos = createMockResolvedPos(2, [
      { typeName: "doc", pos: 0 },
      { typeName: "paragraph", pos: 10 },
      { typeName: "text", pos: 12 },
    ]);

    const editor = createMockEditorWithDOM(new Map([[10, mockEl]]));
    const result = getBlockFromResolvedPos(editor, resolvedPos);

    expect(result).not.toBeNull();
    expect(result!.pos).toBe(10);
    expect(result!.element).toBe(mockEl);
  });

  it("returns the highest-priority block when multiple candidates exist", () => {
    const paragraphEl = document.createElement("div");
    const listItemEl = document.createElement("li");

    const resolvedPos = createMockResolvedPos(3, [
      { typeName: "doc", pos: 0 },
      { typeName: "bulletList", pos: 5 },
      { typeName: "listItem", pos: 7 },
      { typeName: "paragraph", pos: 9 },
    ]);

    const domMap = new Map([
      [5, null],
      [7, listItemEl],
      [9, paragraphEl],
    ]);

    const editor = createMockEditorWithDOM(domMap);
    const result = getBlockFromResolvedPos(editor, resolvedPos);

    // listItem has priority 0 (highest), so it should win
    expect(result).not.toBeNull();
    expect(result!.pos).toBe(7);
    expect(result!.element).toBe(listItemEl);
  });

  it("skips nodes whose DOM element is not an HTMLElement", () => {
    const paragraphEl = document.createElement("p");
    const resolvedPos = createMockResolvedPos(2, [
      { typeName: "doc", pos: 0 },
      { typeName: "codeBlock", pos: 5 },  // no DOM element
      { typeName: "paragraph", pos: 10 },
    ]);

    const domMap = new Map<number, HTMLElement | null>([[5, null], [10, paragraphEl]]);
    const editor = createMockEditorWithDOM(domMap);
    const result = getBlockFromResolvedPos(editor, resolvedPos);

    expect(result).not.toBeNull();
    expect(result!.pos).toBe(10);
  });
});
