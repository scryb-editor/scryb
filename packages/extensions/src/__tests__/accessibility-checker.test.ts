import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { AccessibilityCheckerExtension } from "../accessibility-checker.extension";
import type { AccessibilityCheckResult } from "../types/extension.types";

describe("AccessibilityCheckerExtension", () => {
  let editor: Editor | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    editor?.destroy();
    editor = undefined;
  });

  function makeCheckResult(): AccessibilityCheckResult {
    return {
      issues: [],
      totalIssues: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      timestamp: Date.now(),
    };
  }

  function createEditor(onCheck: () => void, debounceMs?: number) {
    const options: {
      checkResult: () => AccessibilityCheckResult | null;
      onCheck: () => void;
      debounceMs?: number;
    } = {
      checkResult: () => null,
      onCheck,
    };
    if (debounceMs !== undefined) {
      options.debounceMs = debounceMs;
    }
    return new Editor({
      extensions: [StarterKit, AccessibilityCheckerExtension.configure(options)],
      content: "<p>hello</p>",
    });
  }

  // Test 1: Extension registers with default debounceMs of 500
  it("registers with default debounceMs of 500", () => {
    const onCheck = vi.fn();
    editor = createEditor(onCheck);
    const ext = editor.extensionManager.extensions.find((e) => e.name === "accessibilityChecker");
    expect(ext).toBeDefined();
    expect(ext?.options.debounceMs).toBe(500);
  });

  // Test 2: onCheck is NOT called immediately when a document-changing transaction arrives
  it("does not call onCheck immediately on a doc-changing transaction", () => {
    const onCheck = vi.fn();
    editor = createEditor(onCheck, 100);

    // Insert content to trigger a docChanged transaction
    editor.commands.insertContent(" world");

    // onCheck should NOT have been called immediately
    expect(onCheck).not.toHaveBeenCalled();
  });

  // Test 3: onCheck IS called after debounceMs elapses following last document change
  it("calls onCheck after debounceMs elapses following a document change", () => {
    const onCheck = vi.fn();
    editor = createEditor(onCheck, 100);

    editor.commands.insertContent(" world");
    expect(onCheck).not.toHaveBeenCalled();

    // Advance timer past debounce threshold
    vi.advanceTimersByTime(100);
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  // Test 4: Rapid consecutive document changes only trigger onCheck once
  it("debounces rapid consecutive doc changes — onCheck fires only once", () => {
    const onCheck = vi.fn();
    editor = createEditor(onCheck, 100);

    // Three rapid changes
    editor.commands.insertContent("a");
    vi.advanceTimersByTime(50);
    editor.commands.insertContent("b");
    vi.advanceTimersByTime(50);
    editor.commands.insertContent("c");
    // Less than debounce elapsed since last change — should not have fired yet
    expect(onCheck).not.toHaveBeenCalled();

    // Advance past debounce
    vi.advanceTimersByTime(100);
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  // Test 5: Cursor-only transactions (docChanged=false) do NOT trigger onCheck at all
  it("does not trigger onCheck on cursor-only transactions", () => {
    const onCheck = vi.fn();
    editor = createEditor(onCheck, 100);

    // Move the selection without changing the document (setTextSelection)
    editor.commands.setTextSelection(1);
    vi.advanceTimersByTime(200);

    expect(onCheck).not.toHaveBeenCalled();
  });

  // Test 6: Custom debounceMs value is respected
  it("respects a custom debounceMs value (200ms)", () => {
    const onCheck = vi.fn();
    editor = createEditor(onCheck, 200);

    editor.commands.insertContent(" world");

    // Not yet after 100ms
    vi.advanceTimersByTime(100);
    expect(onCheck).not.toHaveBeenCalled();

    // Fires after 200ms
    vi.advanceTimersByTime(100);
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  // Test 7: Debounce timer is cleared when editor is destroyed (no post-destroy calls)
  it("clears the debounce timer on editor destroy — no post-destroy calls", () => {
    const onCheck = vi.fn();
    editor = createEditor(onCheck, 100);

    editor.commands.insertContent(" world");
    // Destroy before timer fires
    editor.destroy();
    editor = undefined;

    // Advance time past debounce — onCheck must NOT be called
    vi.advanceTimersByTime(200);
    expect(onCheck).not.toHaveBeenCalled();
  });
});
