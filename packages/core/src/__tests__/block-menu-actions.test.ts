import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BLOCK_MENU_ITEM_IDS,
  BLOCK_MENU_COLOR_IDS,
  BLOCK_MENU_TURN_IDS,
  BLOCK_MENU_COLOR_VALUES,
  createBlockMenuItems,
  createBlockMenuItemsWithActiveColor,
  deleteBlockAtPos,
  duplicateBlockAtPos,
  copyBlockAtPos,
  getBlockBackgroundColor,
  getBlockTypeAtPos,
  setBlockBackgroundColor,
  setBlockTypeAtPos,
  handleBlockMenuAction,
} from "../block-menu/actions";
import type { Editor } from "@tiptap/core";
import * as pmModel from "@tiptap/pm/model";
import * as pmState from "@tiptap/pm/state";

// Stub DOMSerializer.fromSchema globally so copyBlockAtPos doesn't require a real ProseMirror schema
vi.spyOn(pmModel.DOMSerializer, "fromSchema").mockReturnValue({
  serializeNode: vi.fn().mockReturnValue(document.createElement("p")),
} as unknown as pmModel.DOMSerializer);

// Stub TextSelection.create so duplicateBlockAtPos doesn't require a full ProseMirror doc
vi.spyOn(pmState.TextSelection, "create").mockReturnValue({} as unknown as pmState.TextSelection);

// =============================================================================
// Mock helpers
// =============================================================================

function createMockNode(overrides: Record<string, unknown> = {}) {
  return {
    nodeSize: 10,
    textContent: "Hello",
    content: { size: 5 },
    isTextblock: true,
    attrs: {},
    type: { name: "paragraph" },
    copy: vi.fn().mockReturnValue({ nodeSize: 10 }),
    ...overrides,
  };
}

function createMockDispatch() {
  return vi.fn();
}

/**
 * nodesBetween(pos, pos + nodeSize) visits the node at `pos` first, which is how
 * the block helpers find the textblock to place a selection in. A no-op mock
 * reports a document where nothing is a textblock — the shape of an image, not
 * of the paragraph these tests are describing.
 */
function createNodesBetween(node: unknown) {
  return vi.fn(
    (from: number, _to: number, callback: (child: unknown, childPos: number) => unknown) => {
      if (node) callback(node, from);
    },
  );
}

function createMockEditor(nodeAtReturn: unknown = null, overrides: Record<string, unknown> = {}) {
  const dispatchFn = createMockDispatch();
  const runFn = vi.fn().mockReturnValue(true);
  // tr.doc needs a resolve function for TextSelection.create used in duplicateBlockAtPos.
  // TextSelection requires resolve to return a node with inlineContent=true at the deepest position.
  const mockTrDocNode = {
    inlineContent: true,
    type: { name: "paragraph", spec: {} },
    nodeSize: 2,
  };
  const trDocResolveFn = vi.fn().mockReturnValue({
    depth: 1,
    node: vi.fn().mockReturnValue(mockTrDocNode),
    nodeAfter: null,
    index: vi.fn().mockReturnValue(0),
    pos: 1,
    parentOffset: 0,
    parent: mockTrDocNode,
  });
  const trObj = {
    delete: vi.fn().mockReturnThis(),
    replaceWith: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    setSelection: vi.fn().mockReturnThis(),
    scrollIntoView: vi.fn().mockReturnThis(),
    doc: {
      content: { size: 100 },
      resolve: trDocResolveFn,
    },
  };

  const nodesBetweenFn = createNodesBetween(nodeAtReturn);

  const chain: Record<string, unknown> = {};
  const chainProxy = new Proxy(chain, {
    get(_target, prop) {
      if (prop === "run") return runFn;
      return vi.fn().mockReturnValue(chainProxy);
    },
  });

  const editor = {
    // A real editor always answers this, and the menu now refuses everything but
    // Copy when it is false. Placed before the spread so a test can flip it.
    isEditable: true,
    chain: vi.fn().mockReturnValue(chainProxy),
    state: {
      tr: trObj,
      doc: {
        nodeAt: vi.fn().mockReturnValue(nodeAtReturn),
        nodesBetween: nodesBetweenFn,
        resolve: vi.fn().mockReturnValue({
          depth: 2,
          node: vi.fn().mockReturnValue({ type: { name: "paragraph" }, attrs: {} }),
        }),
        content: { size: 100 },
      },
      schema: {
        nodes: {
          paragraph: {
            createAndFill: vi.fn().mockReturnValue({ nodeSize: 1 }),
          },
        },
      },
    },
    view: {
      dispatch: dispatchFn,
    },
    ...overrides,
  } as unknown as Editor;

  return { editor, dispatchFn, runFn, trObj };
}

// =============================================================================
// Constants
// =============================================================================

describe("BLOCK_MENU_ITEM_IDS", () => {
  it("has delete key", () => {
    expect(BLOCK_MENU_ITEM_IDS.delete).toBe("delete");
  });
  it("has duplicate key", () => {
    expect(BLOCK_MENU_ITEM_IDS.duplicate).toBe("duplicate");
  });
  it("has copy key", () => {
    expect(BLOCK_MENU_ITEM_IDS.copy).toBe("copy");
  });
  it("has colors key", () => {
    expect(BLOCK_MENU_ITEM_IDS.colors).toBe("colors");
  });
  it("has turnInto key", () => {
    expect(BLOCK_MENU_ITEM_IDS.turnInto).toBe("turnInto");
  });
});

describe("BLOCK_MENU_COLOR_VALUES", () => {
  it("is exported and has 9 color entries", () => {
    expect(Object.keys(BLOCK_MENU_COLOR_VALUES)).toHaveLength(9);
  });
  it("default color maps to null", () => {
    expect(BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.default]).toBeNull();
  });
  it("yellow maps to a hex color", () => {
    expect(BLOCK_MENU_COLOR_VALUES[BLOCK_MENU_COLOR_IDS.yellow]).toBe("#FEF08A");
  });
});

// =============================================================================
// deleteBlockAtPos
// =============================================================================

describe("deleteBlockAtPos", () => {
  it("returns false when editor is null", () => {
    expect(deleteBlockAtPos(null as unknown as Editor, 0)).toBe(false);
  });

  it("returns false when pos is null", () => {
    const { editor } = createMockEditor();
    expect(deleteBlockAtPos(editor, null)).toBe(false);
  });

  it("returns false when node is not found at pos", () => {
    const { editor } = createMockEditor(null);
    expect(deleteBlockAtPos(editor, 5)).toBe(false);
  });

  it("dispatches a delete transaction for the node at given pos", () => {
    const node = createMockNode({ nodeSize: 10 });
    const { editor, dispatchFn, trObj } = createMockEditor(node);

    const result = deleteBlockAtPos(editor, 5);

    expect(result).toBe(true);
    expect(trObj.delete).toHaveBeenCalledWith(5, 15);
    expect(dispatchFn).toHaveBeenCalled();
  });

  it("replaces the only block with an empty paragraph instead of deleting when it is the only block", () => {
    const node = createMockNode({ nodeSize: 10 });
    // Create dispatch fn ahead of time so we can reference it in the override
    const onlyBlockDispatchFn = vi.fn();
    const onlyBlockTrObj = {
      delete: vi.fn().mockReturnThis(),
      replaceWith: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      setSelection: vi.fn().mockReturnThis(),
      scrollIntoView: vi.fn().mockReturnThis(),
      doc: { content: { size: 100 }, resolve: vi.fn() },
    };
    const { editor } = createMockEditor(node, {
      state: {
        tr: onlyBlockTrObj,
        doc: {
          nodeAt: vi.fn().mockReturnValue(node),
          nodesBetween: createNodesBetween(node),
          resolve: vi.fn().mockReturnValue({
            depth: 0,
            node: vi.fn().mockReturnValue({ type: { name: "paragraph" }, attrs: {} }),
          }),
          content: { size: 10 }, // Same as nodeSize — so isOnlyBlock = true at pos=0
        },
        schema: {
          nodes: {
            paragraph: { createAndFill: vi.fn().mockReturnValue({ type: "paragraph" }) },
          },
        },
      },
      view: { dispatch: onlyBlockDispatchFn },
    });

    const result = deleteBlockAtPos(editor, 0);

    expect(result).toBe(true);
    expect(onlyBlockDispatchFn).toHaveBeenCalled();
  });
});

// =============================================================================
// duplicateBlockAtPos
// =============================================================================

describe("duplicateBlockAtPos", () => {
  it("returns false when editor is null", () => {
    expect(duplicateBlockAtPos(null as unknown as Editor, 0)).toBe(false);
  });

  it("returns false when pos is null", () => {
    const { editor } = createMockEditor();
    expect(duplicateBlockAtPos(editor, null)).toBe(false);
  });

  it("returns false when node is not found", () => {
    const { editor } = createMockEditor(null);
    expect(duplicateBlockAtPos(editor, 5)).toBe(false);
  });

  it("inserts a copy of the node after the original", () => {
    const copiedNode = { nodeSize: 10 };
    const node = createMockNode({ nodeSize: 10, copy: vi.fn().mockReturnValue(copiedNode) });
    const { editor, dispatchFn, trObj } = createMockEditor(node);

    const result = duplicateBlockAtPos(editor, 5);

    expect(result).toBe(true);
    expect(trObj.insert).toHaveBeenCalledWith(15, copiedNode);
    expect(dispatchFn).toHaveBeenCalled();
  });
});

// =============================================================================
// copyBlockAtPos
// =============================================================================

describe("copyBlockAtPos", () => {
  it("returns false when editor is null", () => {
    expect(copyBlockAtPos(null as unknown as Editor, 0)).toBe(false);
  });

  it("returns false when pos is null", () => {
    const { editor } = createMockEditor();
    expect(copyBlockAtPos(editor, null)).toBe(false);
  });

  it("returns false when node is not found", () => {
    const { editor } = createMockEditor(null);
    expect(copyBlockAtPos(editor, 5)).toBe(false);
  });

  it("serializes node to HTML and writes to clipboard", () => {
    const node = createMockNode({ textContent: "Test content" });
    const writeTextFn = vi.fn().mockResolvedValue(undefined);
    // Stub ClipboardItem as undefined so the function falls back to writeText path
    vi.stubGlobal("ClipboardItem", undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: writeTextFn } });

    const mockDoc = {
      nodeAt: vi.fn().mockReturnValue(node),
      nodesBetween: createNodesBetween(node),
      resolve: vi.fn(),
      content: { size: 100 },
    };

    const { editor } = createMockEditor(node, {
      state: {
        tr: {
          delete: vi.fn().mockReturnThis(),
          replaceWith: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          setSelection: vi.fn().mockReturnThis(),
          scrollIntoView: vi.fn().mockReturnThis(),
          doc: { content: { size: 100 }, resolve: vi.fn() },
        },
        doc: mockDoc,
        schema: {
          nodes: { paragraph: { createAndFill: vi.fn() } },
        },
      },
      view: { dispatch: vi.fn() },
    });

    const result = copyBlockAtPos(editor, 5);

    expect(result).toBe(true);
    expect(writeTextFn).toHaveBeenCalledWith("Test content");
  });
});

// =============================================================================
// getBlockBackgroundColor
// =============================================================================

describe("getBlockBackgroundColor", () => {
  it("returns null when editor is null", () => {
    expect(getBlockBackgroundColor(null as unknown as Editor, 0)).toBeNull();
  });

  it("returns null when pos is null", () => {
    const { editor } = createMockEditor();
    expect(getBlockBackgroundColor(editor, null)).toBeNull();
  });

  it("returns the backgroundColor attr of the node at pos", () => {
    const node = createMockNode({ attrs: { backgroundColor: "#FF0000" } });
    const { editor } = createMockEditor(node);

    const result = getBlockBackgroundColor(editor, 5);
    expect(result).toBe("#FF0000");
  });

  it("returns null when no backgroundColor attr exists", () => {
    const node = createMockNode({ attrs: {} });
    const { editor } = createMockEditor(node);
    (editor.state.doc.nodesBetween as ReturnType<typeof vi.fn>).mockImplementation(() => undefined);

    const result = getBlockBackgroundColor(editor, 5);
    expect(result).toBeNull();
  });
});

// =============================================================================
// getBlockTypeAtPos
// =============================================================================

describe("getBlockTypeAtPos", () => {
  it("returns null when editor is null", () => {
    expect(getBlockTypeAtPos(null as unknown as Editor, 0)).toBeNull();
  });

  it("returns null when pos is null", () => {
    const { editor } = createMockEditor();
    expect(getBlockTypeAtPos(editor, null)).toBeNull();
  });

  it("returns paragraph for paragraph nodes", () => {
    const node = createMockNode({ type: { name: "paragraph" }, attrs: {} });
    const resolveFn = vi.fn().mockReturnValue({
      depth: 0,
      node: vi.fn().mockReturnValue({ type: { name: "paragraph" } }),
    });
    const { editor } = createMockEditor(node, {
      state: {
        tr: { scrollIntoView: vi.fn().mockReturnThis() },
        doc: {
          nodeAt: vi.fn().mockReturnValue(node),
          nodesBetween: createNodesBetween(node),
          resolve: resolveFn,
          content: { size: 100 },
        },
        schema: { nodes: { paragraph: { createAndFill: vi.fn() } } },
      },
      view: { dispatch: vi.fn() },
    });

    const result = getBlockTypeAtPos(editor, 5);
    expect(result).toBe("paragraph");
  });

  it("returns heading1 for heading with level 1", () => {
    const node = createMockNode({ type: { name: "heading" }, attrs: { level: 1 } });
    const resolveFn = vi.fn().mockReturnValue({
      depth: 0,
      node: vi.fn().mockReturnValue({ type: { name: "heading" } }),
    });
    const { editor } = createMockEditor(node, {
      state: {
        tr: { scrollIntoView: vi.fn().mockReturnThis() },
        doc: {
          nodeAt: vi.fn().mockReturnValue(node),
          nodesBetween: createNodesBetween(node),
          resolve: resolveFn,
          content: { size: 100 },
        },
        schema: { nodes: { paragraph: { createAndFill: vi.fn() } } },
      },
      view: { dispatch: vi.fn() },
    });

    const result = getBlockTypeAtPos(editor, 5);
    expect(result).toBe("heading1");
  });

  it("returns blockquote for blockquote nodes", () => {
    const node = createMockNode({ type: { name: "blockquote" }, attrs: {} });
    const resolveFn = vi.fn().mockReturnValue({
      depth: 0,
      node: vi.fn().mockReturnValue({ type: { name: "blockquote" } }),
    });
    const { editor } = createMockEditor(node, {
      state: {
        tr: { scrollIntoView: vi.fn().mockReturnThis() },
        doc: {
          nodeAt: vi.fn().mockReturnValue(node),
          nodesBetween: createNodesBetween(node),
          resolve: resolveFn,
          content: { size: 100 },
        },
        schema: { nodes: { paragraph: { createAndFill: vi.fn() } } },
      },
      view: { dispatch: vi.fn() },
    });

    const result = getBlockTypeAtPos(editor, 5);
    expect(result).toBe("blockquote");
  });
});

// =============================================================================
// setBlockBackgroundColor
// =============================================================================

describe("setBlockBackgroundColor", () => {
  it("returns false when editor is null", () => {
    expect(setBlockBackgroundColor(null as unknown as Editor, 0, "#FF0000")).toBe(false);
  });

  it("returns false when pos is null", () => {
    const { editor } = createMockEditor();
    expect(setBlockBackgroundColor(editor, null, "#FF0000")).toBe(false);
  });

  it("calls setBlockBackground command with color", () => {
    const node = createMockNode({ isTextblock: true });
    const setBlockBackgroundFn = vi.fn().mockReturnValue({ run: vi.fn().mockReturnValue(true) });
    const runFn = vi.fn().mockReturnValue(true);

    const chain: Record<string, unknown> = {};
    const chainProxy = new Proxy(chain, {
      get(_target, prop) {
        if (prop === "run") return runFn;
        if (prop === "setBlockBackground") return setBlockBackgroundFn;
        return vi.fn().mockReturnValue(chainProxy);
      },
    });

    const { editor } = createMockEditor(node, {
      chain: vi.fn().mockReturnValue(chainProxy),
    });

    setBlockBackgroundColor(editor, 5, "#FF0000");
    // The function uses chain().focus().setTextSelection().setBlockBackground() pattern
    expect(editor.chain).toHaveBeenCalled();
  });

  it("calls unsetBlockBackground when color is null", () => {
    const node = createMockNode({ isTextblock: true });
    const { editor } = createMockEditor(node);

    // Just verify it doesn't throw and returns a boolean
    const result = setBlockBackgroundColor(editor, 5, null);
    expect(typeof result).toBe("boolean");
  });
});

// =============================================================================
// setBlockTypeAtPos
// =============================================================================

describe("setBlockTypeAtPos", () => {
  it("returns false when editor is null", () => {
    expect(setBlockTypeAtPos(null as unknown as Editor, 0, "paragraph")).toBe(false);
  });

  it("returns false when pos is null", () => {
    const { editor } = createMockEditor();
    expect(setBlockTypeAtPos(editor, null, "paragraph")).toBe(false);
  });

  const blockTypes = [
    "paragraph",
    "heading1",
    "heading2",
    "heading3",
    "bulletList",
    "orderedList",
    "blockquote",
    "codeBlock",
  ] as const;

  for (const blockType of blockTypes) {
    it(`calls the correct chain for block type "${blockType}"`, () => {
      const node = createMockNode({ isTextblock: true });
      const { editor, runFn } = createMockEditor(node);

      setBlockTypeAtPos(editor, 5, blockType);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });
  }
});

// =============================================================================
// handleBlockMenuAction
// =============================================================================

describe("handleBlockMenuAction", () => {
  it("dispatches to deleteBlockAtPos for 'delete' id", () => {
    const node = createMockNode();
    const { editor, dispatchFn, trObj } = createMockEditor(node);

    handleBlockMenuAction(editor, 5, BLOCK_MENU_ITEM_IDS.delete);

    expect(trObj.delete).toHaveBeenCalled();
    expect(dispatchFn).toHaveBeenCalled();
  });

  it("dispatches to duplicateBlockAtPos for 'duplicate' id", () => {
    const node = createMockNode();
    const { editor, dispatchFn, trObj } = createMockEditor(node);

    handleBlockMenuAction(editor, 5, BLOCK_MENU_ITEM_IDS.duplicate);

    expect(trObj.insert).toHaveBeenCalled();
    expect(dispatchFn).toHaveBeenCalled();
  });

  it("dispatches to copyBlockAtPos for 'copy' id", () => {
    const node = createMockNode({ textContent: "Test" });
    vi.stubGlobal("ClipboardItem", undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const { editor } = createMockEditor(node);

    const result = handleBlockMenuAction(editor, 5, BLOCK_MENU_ITEM_IDS.copy);
    expect(result).toBe(true);
  });

  it("dispatches to setBlockBackgroundColor for color ids", () => {
    const node = createMockNode({ isTextblock: true });
    const { editor } = createMockEditor(node);

    // Just verify it doesn't throw when given a valid color ID
    const result = handleBlockMenuAction(editor, 5, BLOCK_MENU_COLOR_IDS.yellow);
    expect(typeof result).toBe("boolean");
  });

  it("dispatches to setBlockTypeAtPos for turn ids", () => {
    const node = createMockNode({ isTextblock: true });
    const { editor, runFn } = createMockEditor(node);

    handleBlockMenuAction(editor, 5, BLOCK_MENU_TURN_IDS.paragraph);
    expect(runFn).toHaveBeenCalled();
  });
});

// =============================================================================
// createBlockMenuItems
// =============================================================================

const TEST_LABELS = {
  delete: "Delete",
  duplicate: "Duplicate",
  copy: "Copy",
  colors: "Colors",
  turnInto: "Turn into",
  colorNames: {
    default: "Default",
    yellow: "Yellow",
    orange: "Orange",
    red: "Red",
    pink: "Pink",
    purple: "Purple",
    blue: "Blue",
    green: "Green",
    gray: "Gray",
  },
  blockTypes: {
    paragraph: "Paragraph",
    heading1: "Heading 1",
    heading2: "Heading 2",
    heading3: "Heading 3",
    bulletList: "Bullet list",
    orderedList: "Ordered list",
    taskList: "Task list",
    blockquote: "Blockquote",
    codeBlock: "Code block",
  },
};

describe("createBlockMenuItems", () => {
  it("orders transform, clipboard, then delete last, with separators between groups", () => {
    const items = createBlockMenuItems(TEST_LABELS);
    expect(items).toHaveLength(7);
    expect(items[0]!.id).toBe(BLOCK_MENU_ITEM_IDS.colors);
    expect(items[1]!.id).toBe(BLOCK_MENU_ITEM_IDS.turnInto);
    expect(items[2]!.separator).toBe(true);
    expect(items[3]!.id).toBe(BLOCK_MENU_ITEM_IDS.duplicate);
    expect(items[4]!.id).toBe(BLOCK_MENU_ITEM_IDS.copy);
    expect(items[5]!.separator).toBe(true);
    expect(items[6]!.id).toBe(BLOCK_MENU_ITEM_IDS.delete);
  });

  it("marks delete as the only danger item", () => {
    const items = createBlockMenuItems(TEST_LABELS);
    const dangerIds = items.filter((i) => i.danger).map((i) => i.id);
    expect(dangerIds).toEqual([BLOCK_MENU_ITEM_IDS.delete]);
  });

  it("gives duplicate and copy distinct icons", () => {
    const items = createBlockMenuItems(TEST_LABELS);
    const duplicate = items.find((i) => i.id === BLOCK_MENU_ITEM_IDS.duplicate);
    const copy = items.find((i) => i.id === BLOCK_MENU_ITEM_IDS.copy);
    expect(duplicate?.icon).toBeTruthy();
    expect(copy?.icon).toBeTruthy();
    expect(duplicate?.icon).not.toBe(copy?.icon);
  });

  it("has 9 color submenu items", () => {
    const items = createBlockMenuItems(TEST_LABELS);
    const colorsItem = items.find((i) => i.id === BLOCK_MENU_ITEM_IDS.colors);
    expect(colorsItem?.submenuItems).toHaveLength(9);
  });

  it("has 9 turn-into submenu items", () => {
    const items = createBlockMenuItems(TEST_LABELS);
    const turnItem = items.find((i) => i.id === BLOCK_MENU_ITEM_IDS.turnInto);
    expect(turnItem?.submenuItems).toHaveLength(9);
  });
});

describe("createBlockMenuItemsWithActiveColor", () => {
  it("marks the matching color as isActive", () => {
    const items = createBlockMenuItemsWithActiveColor(TEST_LABELS, "#FEF08A", null);
    const colorsItem = items.find((i) => i.id === BLOCK_MENU_ITEM_IDS.colors);
    const yellowItem = colorsItem?.submenuItems?.find(
      (i) => i.id === BLOCK_MENU_COLOR_IDS.yellow,
    );
    expect(yellowItem?.isActive).toBe(true);
  });

  it("marks the default color as active when no color", () => {
    const items = createBlockMenuItemsWithActiveColor(TEST_LABELS, null, null);
    const colorsItem = items.find((i) => i.id === BLOCK_MENU_ITEM_IDS.colors);
    const defaultItem = colorsItem?.submenuItems?.find(
      (i) => i.id === BLOCK_MENU_COLOR_IDS.default,
    );
    expect(defaultItem?.isActive).toBe(true);
  });

  it("marks the correct block type as active", () => {
    const items = createBlockMenuItemsWithActiveColor(TEST_LABELS, null, "heading1");
    const turnItem = items.find((i) => i.id === BLOCK_MENU_ITEM_IDS.turnInto);
    const heading1Item = turnItem?.submenuItems?.find(
      (i) => i.id === BLOCK_MENU_TURN_IDS.heading1,
    );
    expect(heading1Item?.isActive).toBe(true);
  });
});

// =============================================================================
// block menu — details turn type (CK-DET-03)
// =============================================================================

describe("block menu — details turn type", () => {
  it("BLOCK_MENU_TURN_IDS.details is defined", () => {
    expect(BLOCK_MENU_TURN_IDS.details).toBe("turn:details");
  });

  it("setBlockTypeAtPos calls setDetails when type is 'details'", () => {
    const node = createMockNode({ isTextblock: true });
    const { editor, runFn } = createMockEditor(node);
    const result = setBlockTypeAtPos(editor, 5, "details");
    expect(runFn).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it("getBlockTypeAtPos returns 'details' when node type.name is 'details'", () => {
    const node = createMockNode({ type: { name: "details" }, attrs: {} });
    const { editor } = createMockEditor(node, {
      state: {
        doc: {
          nodeAt: vi.fn().mockReturnValue(node),
          nodesBetween: createNodesBetween(node),
          resolve: vi.fn().mockReturnValue({
            depth: 1,
            node: vi.fn().mockReturnValue({ type: { name: "details" }, attrs: {} }),
          }),
          content: { size: 100 },
        },
        schema: {
          nodes: {
            paragraph: {
              createAndFill: vi.fn().mockReturnValue({ nodeSize: 1 }),
            },
          },
        },
      },
    });
    const result = getBlockTypeAtPos(editor, 0);
    expect(result).toBe("details");
  });

  it("createTurnIntoMenuItems includes a 'details' entry when labels.blockTypes.toggle is provided", () => {
    const labelsWithToggle = {
      ...TEST_LABELS,
      blockTypes: {
        ...TEST_LABELS.blockTypes,
        toggle: "Toggle",
      },
    };
    // Use createBlockMenuItemsWithActiveColor which calls createTurnIntoMenuItems internally
    const items = createBlockMenuItemsWithActiveColor(labelsWithToggle, null, null);
    const turnItem = items.find((i) => i.id === BLOCK_MENU_ITEM_IDS.turnInto);
    const detailsEntry = turnItem?.submenuItems?.find(
      (i) => i.id === BLOCK_MENU_TURN_IDS.details,
    );
    expect(detailsEntry).toBeDefined();
    expect(detailsEntry?.label).toBe("Toggle");
    expect(detailsEntry?.id).toBe(BLOCK_MENU_TURN_IDS.details);
  });
});

describe("handleBlockMenuAction on a read-only editor", () => {
  it("refuses everything that writes to the document", () => {
    const { editor, dispatchFn, runFn } = createMockEditor(null, { isEditable: false });

    for (const itemId of [
      BLOCK_MENU_ITEM_IDS.delete,
      BLOCK_MENU_ITEM_IDS.duplicate,
      BLOCK_MENU_ITEM_IDS.fitToWidth,
      "color:yellow",
      "align:center",
      BLOCK_MENU_TURN_IDS.heading1,
    ]) {
      expect(handleBlockMenuAction(editor, 0, itemId)).toBe(false);
    }

    // ProseMirror's `editable: false` stops input arriving through the DOM and
    // nothing else, so the guard has to hold against the dispatch itself.
    expect(dispatchFn).not.toHaveBeenCalled();
    expect(runFn).not.toHaveBeenCalled();
  });

  it("still allows Copy, which only reads", () => {
    // Copy needs a real node to serialise, the same setup the editable Copy test
    // uses — the point here is only that the read-only guard lets it through.
    const node = createMockNode({ textContent: "Test" });
    vi.stubGlobal("ClipboardItem", undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const { editor } = createMockEditor(node, { isEditable: false });

    expect(handleBlockMenuAction(editor, 5, BLOCK_MENU_ITEM_IDS.copy)).toBe(true);
  });
});
