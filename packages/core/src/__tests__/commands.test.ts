import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EditorCommands,
  isActive,
  canExecute,
  toggleBold,
  toggleItalic,
  toggleUnderline,
  toggleStrike,
  toggleCode,
  toggleSuperscript,
  toggleSubscript,
  toggleHeading,
  toggleBulletList,
  toggleOrderedList,
  toggleBlockquote,
  insertHorizontalRule,
  setTextAlign,
  setTextColor,
  unsetTextColor,
  getTextColor,
  setFontFamily,
  unsetFontFamily,
  getFontFamily,
  setFontSize,
  toggleLink,
  insertTable,
  addColumnBefore,
  addColumnAfter,
  deleteColumn,
  addRowBefore,
  addRowAfter,
  deleteRow,
  deleteTable,
  mergeCells,
  splitCell,
  toggleHeaderColumn,
  toggleHeaderRow,
  toggleHeaderCell,
  undo,
  redo,
  clearContent,
  clearFormatting,
  setContent,
  setEditable,
  focusEditor,
  blurEditor,
} from "../commands";
import type { Editor } from "@tiptap/core";

// =============================================================================
// Mock helpers
// =============================================================================

/**
 * Creates a mock editor with a chain builder pattern.
 * Every method on the chain returns the chain itself (fluent API),
 * except `.run()` which is a terminal that returns void.
 */
function createMockEditor(overrides: Record<string, unknown> = {}) {
  const runFn = vi.fn();

  const chain: Record<string, unknown> = {};
  const chainProxy = new Proxy(chain, {
    get(_target, prop) {
      if (prop === "run") return runFn;
      // Return a function that returns the proxy itself (fluent chain)
      return vi.fn().mockReturnValue(chainProxy);
    },
  });

  const canChain: Record<string, unknown> = {};
  const canRunFn = vi.fn().mockReturnValue(true);
  const canChainProxy = new Proxy(canChain, {
    get(_target, prop) {
      if (prop === "run") return canRunFn;
      return vi.fn().mockReturnValue(canChainProxy);
    },
  });

  const canObj = {
    chain: vi.fn().mockReturnValue(canChainProxy),
  };

  const editor = {
    chain: vi.fn().mockReturnValue(chainProxy),
    can: vi.fn().mockReturnValue(canObj),
    isActive: vi.fn().mockReturnValue(false),
    getAttributes: vi.fn().mockReturnValue({}),
    setEditable: vi.fn(),
    state: {
      doc: { descendants: vi.fn() },
      selection: { $from: { depth: 0, node: vi.fn() }, from: 0, to: 0 },
    },
    ...overrides,
  } as unknown as Editor;

  return { editor, runFn, canRunFn };
}

// =============================================================================
// EditorCommands class tests
// =============================================================================

describe("EditorCommands class", () => {
  let commands: EditorCommands;
  let editor: Editor;
  let runFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    commands = new EditorCommands();
    const mock = createMockEditor();
    editor = mock.editor;
    runFn = mock.runFn;
  });

  // ── State Queries ──────────────────────────────────────────────────────────

  describe("isActive", () => {
    it("delegates to editor.isActive", () => {
      (editor.isActive as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const result = commands.isActive(editor, "bold");
      expect(editor.isActive).toHaveBeenCalledWith("bold", undefined);
      expect(result).toBe(true);
    });

    it("passes attributes when provided", () => {
      commands.isActive(editor, "heading", { level: 2 });
      expect(editor.isActive).toHaveBeenCalledWith("heading", { level: 2 });
    });

    it("returns false when mark is not active", () => {
      (editor.isActive as ReturnType<typeof vi.fn>).mockReturnValue(false);
      expect(commands.isActive(editor, "bold")).toBe(false);
    });
  });

  describe("canExecute", () => {
    it("returns true for a valid command that can execute", () => {
      expect(commands.canExecute(editor, "toggleBold")).toBe(true);
    });

    it("returns false for an invalid command name", () => {
      expect(commands.canExecute(editor, "nonExistentCommand")).toBe(false);
    });

    it("returns false when editor is falsy", () => {
      expect(commands.canExecute(null as unknown as Editor, "toggleBold")).toBe(false);
    });
  });

  // ── Text Formatting Commands ───────────────────────────────────────────────

  describe("text formatting commands", () => {
    it("toggleBold calls the correct chain", () => {
      commands.toggleBold(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleItalic calls the correct chain", () => {
      commands.toggleItalic(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleUnderline calls the correct chain", () => {
      commands.toggleUnderline(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleStrike calls the correct chain", () => {
      commands.toggleStrike(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleCode calls the correct chain", () => {
      commands.toggleCode(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleSuperscript calls the correct chain", () => {
      commands.toggleSuperscript(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleSubscript calls the correct chain", () => {
      commands.toggleSubscript(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });
  });

  // ── Heading Commands ───────────────────────────────────────────────────────

  describe("toggleHeading", () => {
    it("calls chain with level 1", () => {
      commands.toggleHeading(editor, 1);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("calls chain with level 2", () => {
      commands.toggleHeading(editor, 2);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("calls chain with level 3", () => {
      commands.toggleHeading(editor, 3);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });
  });

  // ── List Commands ──────────────────────────────────────────────────────────

  describe("list commands", () => {
    it("toggleBulletList calls the correct chain", () => {
      commands.toggleBulletList(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleOrderedList calls the correct chain", () => {
      commands.toggleOrderedList(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });
  });

  // ── Block Commands ─────────────────────────────────────────────────────────

  describe("block commands", () => {
    it("toggleBlockquote calls the correct chain", () => {
      commands.toggleBlockquote(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("insertHorizontalRule calls the correct chain", () => {
      commands.insertHorizontalRule(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });
  });

  // ── Text Alignment ─────────────────────────────────────────────────────────

  describe("setTextAlign", () => {
    it("calls chain with 'left' alignment", () => {
      commands.setTextAlign(editor, "left");
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("calls chain with 'center' alignment", () => {
      commands.setTextAlign(editor, "center");
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("calls chain with 'right' alignment", () => {
      commands.setTextAlign(editor, "right");
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("calls chain with 'justify' alignment", () => {
      commands.setTextAlign(editor, "justify");
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });
  });

  // ── Indentation ────────────────────────────────────────────────────────────

  describe("indentation commands", () => {
    it("indent calls the correct chain", () => {
      commands.indent(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("outdent calls the correct chain", () => {
      commands.outdent(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });
  });

  // ── Color Commands ─────────────────────────────────────────────────────────

  describe("color commands", () => {
    it("setTextColor calls the correct chain", () => {
      commands.setTextColor(editor, "#ff0000");
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("unsetTextColor calls the correct chain", () => {
      commands.unsetTextColor(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("getTextColor returns color from textStyle attributes", () => {
      (editor.getAttributes as ReturnType<typeof vi.fn>).mockReturnValue({ color: "#ff0000" });
      expect(commands.getTextColor(editor)).toBe("#ff0000");
    });

    it("getTextColor returns null when no color is set", () => {
      (editor.getAttributes as ReturnType<typeof vi.fn>).mockReturnValue({});
      expect(commands.getTextColor(editor)).toBeNull();
    });
  });

  // ── Font Commands ──────────────────────────────────────────────────────────

  describe("font commands", () => {
    it("setFontFamily calls the correct chain with a font name", () => {
      commands.setFontFamily(editor, "Arial");
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("setFontFamily with null unsets the font family", () => {
      commands.setFontFamily(editor, null);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("unsetFontFamily calls the correct chain", () => {
      commands.unsetFontFamily(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("getFontFamily returns font from textStyle attributes", () => {
      (editor.getAttributes as ReturnType<typeof vi.fn>).mockReturnValue({ fontFamily: "Arial" });
      expect(commands.getFontFamily(editor)).toBe("Arial");
    });

    it("getFontFamily returns null when no font is set", () => {
      (editor.getAttributes as ReturnType<typeof vi.fn>).mockReturnValue({});
      expect(commands.getFontFamily(editor)).toBeNull();
    });

    it("setFontSize calls the correct chain", () => {
      commands.setFontSize(editor, "16px");
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });
  });

  // ── Table Commands ─────────────────────────────────────────────────────────

  describe("table commands", () => {
    it("insertTable with defaults (3x3)", () => {
      commands.insertTable(editor);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("insertTable with custom rows and cols", () => {
      commands.insertTable(editor, 5, 4);
      expect(editor.chain).toHaveBeenCalled();
      expect(runFn).toHaveBeenCalled();
    });

    it("addColumnBefore calls the correct chain", () => {
      commands.addColumnBefore(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("addColumnAfter calls the correct chain", () => {
      commands.addColumnAfter(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("deleteColumn calls the correct chain", () => {
      commands.deleteColumn(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("addRowBefore calls the correct chain", () => {
      commands.addRowBefore(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("addRowAfter calls the correct chain", () => {
      commands.addRowAfter(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("deleteRow calls the correct chain", () => {
      commands.deleteRow(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("deleteTable calls the correct chain", () => {
      commands.deleteTable(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("mergeCells calls the correct chain", () => {
      commands.mergeCells(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("splitCell calls the correct chain", () => {
      commands.splitCell(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleHeaderColumn calls the correct chain", () => {
      commands.toggleHeaderColumn(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleHeaderRow calls the correct chain", () => {
      commands.toggleHeaderRow(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleHeaderCell calls the correct chain", () => {
      commands.toggleHeaderCell(editor);
      expect(runFn).toHaveBeenCalled();
    });
  });

  // ── History Commands ───────────────────────────────────────────────────────

  describe("history commands", () => {
    it("undo calls the correct chain", () => {
      commands.undo(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("redo calls the correct chain", () => {
      commands.redo(editor);
      expect(runFn).toHaveBeenCalled();
    });
  });

  // ── Editor Control Commands ────────────────────────────────────────────────

  describe("editor control commands", () => {
    it("clearContent calls the correct chain", () => {
      commands.clearContent(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("clearFormatting calls the correct chain", () => {
      commands.clearFormatting(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("setContent calls the correct chain", () => {
      commands.setContent(editor, "<p>Hello</p>");
      expect(runFn).toHaveBeenCalled();
    });

    it("setEditable calls editor.setEditable", () => {
      commands.setEditable(editor, false);
      expect(editor.setEditable).toHaveBeenCalledWith(false);
    });

    it("focus calls the correct chain", () => {
      commands.focus(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("blur calls the correct chain", () => {
      commands.blur(editor);
      expect(runFn).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// Standalone functional API tests
// =============================================================================

describe("standalone functional API", () => {
  let editor: Editor;
  let runFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const mock = createMockEditor();
    editor = mock.editor;
    runFn = mock.runFn;
  });

  describe("isActive (function)", () => {
    it("delegates to editor.isActive", () => {
      (editor.isActive as ReturnType<typeof vi.fn>).mockReturnValue(true);
      expect(isActive(editor, "bold")).toBe(true);
      expect(editor.isActive).toHaveBeenCalledWith("bold", undefined);
    });

    it("passes attributes", () => {
      isActive(editor, "heading", { level: 1 });
      expect(editor.isActive).toHaveBeenCalledWith("heading", { level: 1 });
    });
  });

  describe("canExecute (function)", () => {
    it("returns true for valid executable commands", () => {
      expect(canExecute(editor, "toggleBold")).toBe(true);
    });

    it("returns false for invalid command names", () => {
      expect(canExecute(editor, "fakeCommand")).toBe(false);
    });

    it("returns false for null editor", () => {
      expect(canExecute(null as unknown as Editor, "toggleBold")).toBe(false);
    });
  });

  describe("text formatting functions", () => {
    it("toggleBold calls chain", () => {
      toggleBold(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleItalic calls chain", () => {
      toggleItalic(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleUnderline calls chain", () => {
      toggleUnderline(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleStrike calls chain", () => {
      toggleStrike(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleCode calls chain", () => {
      toggleCode(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleSuperscript calls chain", () => {
      toggleSuperscript(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleSubscript calls chain", () => {
      toggleSubscript(editor);
      expect(runFn).toHaveBeenCalled();
    });
  });

  describe("heading functions", () => {
    it("toggleHeading with level 1", () => {
      toggleHeading(editor, 1);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleHeading with level 2", () => {
      toggleHeading(editor, 2);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleHeading with level 3", () => {
      toggleHeading(editor, 3);
      expect(runFn).toHaveBeenCalled();
    });
  });

  describe("list functions", () => {
    it("toggleBulletList calls chain", () => {
      toggleBulletList(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleOrderedList calls chain", () => {
      toggleOrderedList(editor);
      expect(runFn).toHaveBeenCalled();
    });
  });

  describe("block functions", () => {
    it("toggleBlockquote calls chain", () => {
      toggleBlockquote(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("insertHorizontalRule calls chain", () => {
      insertHorizontalRule(editor);
      expect(runFn).toHaveBeenCalled();
    });
  });

  describe("alignment functions", () => {
    it.each(["left", "center", "right", "justify"] as const)("setTextAlign('%s') calls chain", (alignment) => {
      setTextAlign(editor, alignment);
      expect(runFn).toHaveBeenCalled();
    });
  });

  describe("color functions", () => {
    it("setTextColor calls chain", () => {
      setTextColor(editor, "#ff0000");
      expect(runFn).toHaveBeenCalled();
    });

    it("unsetTextColor calls chain", () => {
      unsetTextColor(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("getTextColor returns color string", () => {
      (editor.getAttributes as ReturnType<typeof vi.fn>).mockReturnValue({ color: "#333" });
      expect(getTextColor(editor)).toBe("#333");
    });

    it("getTextColor returns null when empty", () => {
      (editor.getAttributes as ReturnType<typeof vi.fn>).mockReturnValue({});
      expect(getTextColor(editor)).toBeNull();
    });
  });

  describe("font functions", () => {
    it("setFontFamily with a font name", () => {
      setFontFamily(editor, "Roboto");
      expect(runFn).toHaveBeenCalled();
    });

    it("setFontFamily with null calls unsetFontFamily", () => {
      setFontFamily(editor, null);
      expect(runFn).toHaveBeenCalled();
    });

    it("unsetFontFamily calls chain", () => {
      unsetFontFamily(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("getFontFamily returns font family", () => {
      (editor.getAttributes as ReturnType<typeof vi.fn>).mockReturnValue({ fontFamily: "Roboto" });
      expect(getFontFamily(editor)).toBe("Roboto");
    });

    it("getFontFamily returns null when empty", () => {
      (editor.getAttributes as ReturnType<typeof vi.fn>).mockReturnValue({});
      expect(getFontFamily(editor)).toBeNull();
    });

    it("setFontSize calls chain", () => {
      setFontSize(editor, "18px");
      expect(runFn).toHaveBeenCalled();
    });
  });

  describe("link functions", () => {
    it("toggleLink with URL calls chain", () => {
      toggleLink(editor, "https://example.com");
      expect(runFn).toHaveBeenCalled();
    });
  });

  describe("table functions", () => {
    it("insertTable with defaults", () => {
      insertTable(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("insertTable with custom dimensions", () => {
      insertTable(editor, 5, 4);
      expect(runFn).toHaveBeenCalled();
    });

    it("addColumnBefore calls chain", () => {
      addColumnBefore(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("addColumnAfter calls chain", () => {
      addColumnAfter(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("deleteColumn calls chain", () => {
      deleteColumn(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("addRowBefore calls chain", () => {
      addRowBefore(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("addRowAfter calls chain", () => {
      addRowAfter(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("deleteRow calls chain", () => {
      deleteRow(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("deleteTable calls chain", () => {
      deleteTable(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("mergeCells calls chain", () => {
      mergeCells(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("splitCell calls chain", () => {
      splitCell(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleHeaderColumn calls chain", () => {
      toggleHeaderColumn(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleHeaderRow calls chain", () => {
      toggleHeaderRow(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("toggleHeaderCell calls chain", () => {
      toggleHeaderCell(editor);
      expect(runFn).toHaveBeenCalled();
    });
  });

  describe("history functions", () => {
    it("undo calls chain", () => {
      undo(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("redo calls chain", () => {
      redo(editor);
      expect(runFn).toHaveBeenCalled();
    });
  });

  describe("editor control functions", () => {
    it("clearContent calls chain", () => {
      clearContent(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("clearFormatting calls chain", () => {
      clearFormatting(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("setContent calls chain", () => {
      setContent(editor, "<p>test</p>");
      expect(runFn).toHaveBeenCalled();
    });

    it("setEditable delegates to editor.setEditable", () => {
      setEditable(editor, true);
      expect(editor.setEditable).toHaveBeenCalledWith(true);
    });

    it("focusEditor calls chain", () => {
      focusEditor(editor);
      expect(runFn).toHaveBeenCalled();
    });

    it("blurEditor calls chain", () => {
      blurEditor(editor);
      expect(runFn).toHaveBeenCalled();
    });
  });
});
