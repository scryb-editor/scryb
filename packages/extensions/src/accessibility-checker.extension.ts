import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState, Transaction } from "prosemirror-state";
import type { AccessibilityCheckResult, AccessibilityCheckerConfig } from "./types/extension.types";

/**
 * Options for the AccessibilityChecker extension
 */
export interface AccessibilityCheckerOptions {
  /** Function that returns the current check result */
  readonly checkResult: () => AccessibilityCheckResult | null;
  /** Function that triggers a new accessibility check */
  readonly onCheck?: () => void;
  /**
   * Debounce delay in milliseconds before invoking onCheck after a document-changing transaction.
   * Cursor-only transactions (tr.docChanged === false) never schedule onCheck.
   * @default 500
   */
  readonly debounceMs?: number;
  /** Configuration for the checker */
  readonly config?: AccessibilityCheckerConfig;
}

/**
 * Internal state for the accessibility checker plugin
 */
interface AccessibilityCheckerPluginState {
  readonly decorations: DecorationSet;
  readonly checkResult: AccessibilityCheckResult | null;
}

/** Plugin key for identifying the accessibility checker plugin */
const ACCESSIBILITY_CHECKER_PLUGIN_KEY = new PluginKey<AccessibilityCheckerPluginState>("accessibilityChecker");

/**
 * Creates the initial plugin state
 */
function createInitialState(): AccessibilityCheckerPluginState {
  return {
    decorations: DecorationSet.empty,
    checkResult: null,
  };
}

/**
 * Creates decorations for accessibility issues
 */
function createIssueDecorations(tr: Transaction, checkResult: AccessibilityCheckResult | null): DecorationSet {
  if (!checkResult || checkResult.issues.length === 0) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];

  for (const issue of checkResult.issues) {
    const { from, to } = issue.location;

    // Map positions through transaction if document changed
    const mappedFrom = tr.mapping.map(from);
    const mappedTo = tr.mapping.map(to);

    // Create a decoration with a class based on severity
    const decoration = Decoration.inline(mappedFrom, mappedTo, {
      class: `tiptap-accessibility-issue tiptap-accessibility-issue--${issue.severity}`,
      "data-issue-id": issue.id,
      "data-issue-type": issue.type,
      title: issue.message,
    });

    decorations.push(decoration);
  }

  return DecorationSet.create(tr.doc, decorations);
}

/**
 * Creates the state apply function for the plugin.
 * Schedules onCheck via a debounced setTimeout only when tr.docChanged is true.
 * Cursor-only transactions are ignored — they do not trigger onCheck at all.
 * The debounceTimer reference is shared with the plugin's destroy() method so it
 * can be cleared on editor teardown to prevent post-destroy invocations.
 */
function createStateApply(options: AccessibilityCheckerOptions, getDebounceTimer: () => ReturnType<typeof setTimeout> | null, setDebounceTimer: (id: ReturnType<typeof setTimeout> | null) => void) {
  const debounceMs = options.debounceMs ?? 500;

  return (tr: Transaction, state: AccessibilityCheckerPluginState, _oldState: EditorState): AccessibilityCheckerPluginState => {
    // Schedule onCheck only when document content changed (not on cursor moves)
    if (tr.docChanged && options.onCheck) {
      const existing = getDebounceTimer();
      if (existing !== null) {
        clearTimeout(existing);
      }
      const timerId = setTimeout(() => {
        setDebounceTimer(null);
        options.onCheck!();
      }, debounceMs);
      setDebounceTimer(timerId);
    }

    const currentResult = options.checkResult();

    // Only update decorations if result changed
    if (currentResult === state.checkResult) {
      return state;
    }

    return {
      decorations: createIssueDecorations(tr, currentResult),
      checkResult: currentResult,
    };
  };
}

/**
 * Creates the decorations prop function for the plugin
 */
function createDecorationsGetter() {
  return function (this: Plugin<AccessibilityCheckerPluginState>, editorState: EditorState) {
    const pluginState = this.getState(editorState);
    return pluginState ? pluginState.decorations : DecorationSet.empty;
  };
}

/**
 * Creates the ProseMirror plugin for accessibility checker.
 * Uses a closure-based debounce timer so the timer reference is shared between
 * the apply() handler and the destroy() method, enabling safe cleanup on teardown.
 */
function createAccessibilityCheckerPlugin(options: AccessibilityCheckerOptions): Plugin<AccessibilityCheckerPluginState> {
  // Debounce timer shared between apply() and destroy()
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const getDebounceTimer = () => debounceTimer;
  const setDebounceTimer = (id: ReturnType<typeof setTimeout> | null) => {
    debounceTimer = id;
  };

  return new Plugin({
    key: ACCESSIBILITY_CHECKER_PLUGIN_KEY,
    state: {
      init: (_, state) => {
        const result = options.checkResult();
        // Create decorations for initial state
        if (!result || result.issues.length === 0) {
          return {
            decorations: DecorationSet.empty,
            checkResult: result,
          };
        }
        const decorations: Decoration[] = [];
        for (const issue of result.issues) {
          const { from, to } = issue.location;
          const decoration = Decoration.inline(from, to, {
            class: `tiptap-accessibility-issue tiptap-accessibility-issue--${issue.severity}`,
            "data-issue-id": issue.id,
            "data-issue-type": issue.type,
            title: issue.message,
          });
          decorations.push(decoration);
        }
        return {
          decorations: DecorationSet.create(state.doc, decorations),
          checkResult: result,
        };
      },
      apply: createStateApply(options, getDebounceTimer, setDebounceTimer),
    },
    props: {
      decorations: createDecorationsGetter(),
    },
    view: () => ({
      destroy: () => {
        // Clear any pending debounce timer to prevent post-destroy invocations
        const existing = getDebounceTimer();
        if (existing !== null) {
          clearTimeout(existing);
          setDebounceTimer(null);
        }
      },
    }),
  });
}

/**
 * TipTap extension for accessibility checking
 *
 * Highlights accessibility issues in the editor content with visual decorations.
 * Issues are marked with different styles based on severity (error, warning, info).
 *
 * @example
 * ```typescript
 * const editor = new Editor({
 *   extensions: [
 *     AccessibilityCheckerExtension.configure({
 *       checkResult: () => accessibilityService.checkResult(),
 *       onCheck: () => accessibilityService.checkAccessibility(),
 *     }),
 *   ],
 * });
 * ```
 */
export const AccessibilityCheckerExtension = Extension.create<AccessibilityCheckerOptions>({
  name: "accessibilityChecker",

  addOptions() {
    return {
      checkResult: () => null,
      onCheck: undefined,
      debounceMs: 500,
      config: undefined,
    };
  },

  addProseMirrorPlugins() {
    return [createAccessibilityCheckerPlugin(this.options)];
  },
});
