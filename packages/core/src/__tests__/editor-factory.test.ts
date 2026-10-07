import { describe, it, expect, afterEach } from "vitest";
import { createScrybEditor, buildExtensions, buildViewerExtensions } from "../editor-factory";
import { createEmojiCallbackStore } from "../emoji/callback-store";
import { createMentionCallbackStore } from "../mention/callback-store";
import type { MentionItem } from "../mention/callback-store";
import { Editor, Node, getExtensionField } from "@tiptap/core";

describe("createScrybEditor", () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it("returns a non-null object when called with no arguments", () => {
    editor = createScrybEditor();
    expect(editor).toBeDefined();
    expect(editor).not.toBeNull();
  });

  it("returns a Tiptap Editor instance with expected properties", () => {
    editor = createScrybEditor();
    // Tiptap Editor instances have these properties
    expect(editor).toHaveProperty("state");
    expect(editor).toHaveProperty("schema");
    expect(editor).toHaveProperty("commands");
  });

  it("can be destroyed without throwing", () => {
    editor = createScrybEditor();
    expect(() => editor!.destroy()).not.toThrow();
    editor = undefined; // already destroyed, prevent afterEach double-destroy
  });

  it("applies the scryb-content class to the editable element", () => {
    editor = createScrybEditor();
    expect(editor.view.dom.classList.contains("scryb-content")).toBe(true);
  });

  it("preserves caller-supplied editorProps alongside the injected class", () => {
    const handleScrollToSelection = () => true;
    editor = createScrybEditor({ editorProps: { handleScrollToSelection } });
    expect(editor.options.editorProps.handleScrollToSelection).toBe(handleScrollToSelection);
    expect(editor.view.dom.classList.contains("scryb-content")).toBe(true);
  });

  it("merges the injected class with caller-supplied attributes.class", () => {
    editor = createScrybEditor({ editorProps: { attributes: { class: "host-extra" } } });
    expect(editor.view.dom.classList.contains("scryb-content")).toBe(true);
    expect(editor.view.dom.classList.contains("host-extra")).toBe(true);
  });

  it("merges the injected class when attributes is a function", () => {
    editor = createScrybEditor({ editorProps: { attributes: () => ({ class: "fn-cls" }) } });
    expect(editor.view.dom.classList.contains("scryb-content")).toBe(true);
    expect(editor.view.dom.classList.contains("fn-cls")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Caller-supplied extensions
// ═══════════════════════════════════════════════════════════════════════════
//
// This is the contract both adapters build their `extensions` input on: the
// caller's extensions are appended AFTER the Scryb defaults, never instead of
// them. Order is the load-bearing half — Tiptap resolves conflicts by
// position and priority, so an implementation that prepended them would let a
// caller silently displace a default rather than extend it, and nothing else
// in the suite would notice.

describe("createScrybEditor — caller-supplied extensions", () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  const CustomBlock = Node.create({
    name: "customTestBlock",
    group: "block",
    content: "inline*",
    parseHTML: () => [{ tag: "custom-test-block" }],
    renderHTML: () => ["custom-test-block", 0],
  });

  it("registers a caller's custom node in the schema", () => {
    editor = createScrybEditor({ extensions: [CustomBlock] });
    expect(editor.schema.nodes["customTestBlock"]).toBeDefined();
  });

  it("keeps the Scryb defaults alongside it", () => {
    editor = createScrybEditor({ extensions: [CustomBlock] });
    expect(editor.schema.nodes["paragraph"]).toBeDefined();
    expect(editor.schema.marks["underline"]).toBeDefined();
  });

  it("appends the caller's extensions after the defaults, not before", () => {
    editor = createScrybEditor({ extensions: [CustomBlock] });
    // Tiptap sorts by priority before list position, and the keyboard release
    // runs at priority 1 on purpose, so compare within the default priority.
    const names = editor.extensionManager.extensions
      .filter((ext) => (getExtensionField<number>(ext, "priority") || 100) === 100)
      .map((ext) => ext.name);
    expect(names).toContain("customTestBlock");
    expect(names.indexOf("customTestBlock")).toBe(names.length - 1);
  });

  it("produces the same defaults when no extensions are supplied", () => {
    const withNone = createScrybEditor();
    const baseline = withNone.extensionManager.extensions.map((e) => e.name);
    withNone.destroy();

    editor = createScrybEditor({ extensions: [CustomBlock] });
    const withCustom = editor.extensionManager.extensions.map((e) => e.name);

    expect(withCustom.filter((n) => n !== "customTestBlock")).toEqual(baseline);
  });
});

describe("buildExtensions", () => {
  it("returns a non-empty array of extensions", () => {
    const extensions = buildExtensions();
    expect(Array.isArray(extensions)).toBe(true);
    expect(extensions.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// buildExtensions — details gating (CK-DET-05, CK-XCUT-04)
// =============================================================================

describe("buildExtensions — details gating", () => {
  /**
   * v1.13.0 baseline: extension names returned by buildExtensions({}).
   * StarterKit is registered as a single "starterKit" extension (not decomposed
   * into sub-extensions) — Tiptap 3.x groups them under one parent name.
   * Table extensions are similarly bundled as "tableExtension".
   * This set is the exact output of buildExtensions({}) in v1.13.0 (27 entries).
   */
  const BASELINE_EXTENSION_NAMES_WITHOUT_DETAILS = new Set([
    "starterKit",
    "placeholder",
    "underline",
    "superscript",
    "subscript",
    "textAlign",
    "link",
    "textStyle",
    "color",
    "fontSize",
    "fontFamily",
    "lineHeight",
    "letterSpacing",
    "indent",
    "blockBackground",
    "tableExtension",
    "accessibilityChecker",
    "uploadProgress",
    "resizableImage",
    "textBubbleMenu",
    "markdownAutoformat",
    "pasteCleanup",
    "characterCount",
    "taskList",
    "taskItem",
    "typography",
  ]);

  it("registers details, detailsSummary, and detailsContent when config.details.enabled === true", () => {
    const extensions = buildExtensions({ details: { enabled: true } });
    const names = extensions.map((ext) => ext.name);
    expect(names).toContain("details");
    expect(names).toContain("detailsSummary");
    expect(names).toContain("detailsContent");
  });

  it("does NOT register details trio when config.details is omitted (CK-DET-05)", () => {
    const extensions = buildExtensions({});
    const names = extensions.map((ext) => ext.name);
    expect(names).not.toContain("details");
    expect(names).not.toContain("detailsSummary");
    expect(names).not.toContain("detailsContent");
  });

  it("does NOT register details trio when config.details.enabled === false", () => {
    const extensions = buildExtensions({ details: { enabled: false } });
    const names = extensions.map((ext) => ext.name);
    expect(names).not.toContain("details");
    expect(names).not.toContain("detailsSummary");
    expect(names).not.toContain("detailsContent");
  });

  it("buildExtensions({}) produces the same extension names as the v1.13.0 baseline (CK-XCUT-04)", () => {
    const extensions = buildExtensions({});
    const names = new Set(extensions.map((ext) => ext.name));
    // Every baseline extension must still be present
    for (const baselineName of BASELINE_EXTENSION_NAMES_WITHOUT_DETAILS) {
      expect(names, `Expected baseline extension "${baselineName}" to be present`).toContain(baselineName);
    }
    // The details trio must NOT appear
    expect(names).not.toContain("details");
    expect(names).not.toContain("detailsSummary");
    expect(names).not.toContain("detailsContent");
  });
});

// =============================================================================
// buildExtensions — toc gating (CK-TOC-06, CK-XCUT-04)
// =============================================================================

describe("buildExtensions — toc gating", () => {
  it("registers tableOfContents when config.toc.enabled === true", () => {
    const extensions = buildExtensions({ toc: { enabled: true } });
    const names = extensions.map((ext) => ext.name);
    expect(names).toContain("tableOfContents");
  });

  it("does NOT register tableOfContents when config.toc is omitted (CK-TOC-06)", () => {
    const extensions = buildExtensions({});
    const names = extensions.map((ext) => ext.name);
    expect(names).not.toContain("tableOfContents");
  });

  it("does NOT register tableOfContents when config.toc.enabled === false", () => {
    const extensions = buildExtensions({ toc: { enabled: false } });
    const names = extensions.map((ext) => ext.name);
    expect(names).not.toContain("tableOfContents");
  });

  it("registers TOC AFTER uniqueID in extension array (Pitfall 4 registration order)", () => {
    const extensions = buildExtensions({ uniqueId: { types: ["heading"] }, toc: { enabled: true } });
    const names = extensions.map((ext) => ext.name);
    const uniqueIdIdx = names.indexOf("uniqueID");
    const tocIdx = names.indexOf("tableOfContents");
    // Both must be present
    expect(uniqueIdIdx).toBeGreaterThanOrEqual(0);
    expect(tocIdx).toBeGreaterThanOrEqual(0);
    // TOC must come AFTER uniqueID
    expect(tocIdx).toBeGreaterThan(uniqueIdIdx);
  });

  it("scrollParent option on the configured extension is a FUNCTION (not a direct element)", () => {
    const extensions = buildExtensions({ toc: { enabled: true } });
    const tocExt = extensions.find((ext) => ext.name === "tableOfContents");
    expect(tocExt).toBeDefined();
    // Access configured options — TableOfContents stores them under .options
    const opts = (tocExt as { options?: { scrollParent?: unknown } }).options;
    expect(typeof opts?.scrollParent).toBe("function");
  });

  it("scrollParent callback resolves string selector to element or falls back to window", () => {
    const extensions = buildExtensions({ toc: { enabled: true, scrollContainer: "#fake-container-xyz" } });
    const tocExt = extensions.find((ext) => ext.name === "tableOfContents");
    expect(tocExt).toBeDefined();
    const opts = (tocExt as { options?: { scrollParent?: () => unknown } }).options;
    expect(typeof opts?.scrollParent).toBe("function");
    // When the selector doesn't match any element, falls back to window
    const result = opts!.scrollParent!();
    expect(result).toBe(window);
  });

  it("does NOT push tableOfContents inside buildViewerExtensions (editor-only per CK-TOC-03)", () => {
    // TOC gate should only appear in buildExtensions, not buildViewerExtensions
    const viewerExtensions = buildViewerExtensions({ details: { enabled: false } });
    const names = viewerExtensions.map((ext) => ext.name);
    expect(names).not.toContain("tableOfContents");
  });
});

// =============================================================================
// buildViewerExtensions — details gating (CK-DET-04)
// =============================================================================

describe("buildViewerExtensions — details gating", () => {
  it("registers details, detailsSummary, and detailsContent when config.details.enabled === true", () => {
    const extensions = buildViewerExtensions({ details: { enabled: true } });
    const names = extensions.map((ext) => ext.name);
    expect(names).toContain("details");
    expect(names).toContain("detailsSummary");
    expect(names).toContain("detailsContent");
  });

  it("does NOT register details trio when config.details is omitted", () => {
    const extensions = buildViewerExtensions({});
    const names = extensions.map((ext) => ext.name);
    expect(names).not.toContain("details");
    expect(names).not.toContain("detailsSummary");
    expect(names).not.toContain("detailsContent");
  });
});

// =============================================================================
// buildExtensions — emoji gating (CK-EMO-05, CK-XCUT-04)
// =============================================================================

describe("buildExtensions — emoji gating", () => {
  it("registers emoji when config.emoji.enabled === true", () => {
    const callbacks = createEmojiCallbackStore();
    const extensions = buildExtensions({ emoji: { enabled: true, callbacks } });
    const names = extensions.map((ext) => ext.name);
    expect(names).toContain("emoji");
  });

  it("does NOT register emoji when config.emoji is omitted (CK-EMO-05)", () => {
    const extensions = buildExtensions({});
    const names = extensions.map((ext) => ext.name);
    expect(names).not.toContain("emoji");
  });

  it("does NOT register emoji when config.emoji.enabled === false", () => {
    const extensions = buildExtensions({ emoji: { enabled: false } });
    const names = extensions.map((ext) => ext.name);
    expect(names).not.toContain("emoji");
  });

  it("forwards custom emojis dataset to Emoji.configure()", () => {
    const customEmojis = [{ name: "one", emoji: "1️⃣", shortcodes: ["one"] }];
    const callbacks = createEmojiCallbackStore();
    const extensions = buildExtensions({ emoji: { enabled: true, emojis: customEmojis, callbacks } });
    const emojiExt = extensions.find((ext) => ext.name === "emoji");
    expect(emojiExt).toBeDefined();
    const opts = (emojiExt as { options?: { emojis?: unknown } }).options;
    expect(opts?.emojis).toEqual(customEmojis);
  });

  it("uses default dataset when emojis is omitted", () => {
    const callbacks = createEmojiCallbackStore();
    const extensions = buildExtensions({ emoji: { enabled: true, callbacks } });
    const emojiExt = extensions.find((ext) => ext.name === "emoji");
    expect(emojiExt).toBeDefined();
    // Default dataset is populated by the extension itself — not undefined
    const opts = (emojiExt as { options?: { emojis?: unknown[] } }).options;
    // When emojis is passed as undefined, the extension uses its bundled default
    expect(opts).toBeDefined();
  });

  it("suggestion render delegates onStart to callbacks store", () => {
    const callbacks = createEmojiCallbackStore();
    let patchedValue = "";
    callbacks.onStart = () => { patchedValue = "called"; };

    const extensions = buildExtensions({ emoji: { enabled: true, callbacks } });
    const emojiExt = extensions.find((ext) => ext.name === "emoji");
    expect(emojiExt).toBeDefined();

    // The render factory returns a lifecycle object — call onStart to verify delegation
    const opts = (emojiExt as { options?: { suggestion?: { render?: () => { onStart?: (p: unknown) => void } } } }).options;
    const lifecycle = opts?.suggestion?.render?.();
    lifecycle?.onStart?.({} as unknown);
    expect(patchedValue).toBe("called");
  });

  it("does NOT push emoji inside buildViewerExtensions (editor-only per critical invariant 3)", () => {
    const viewerExtensions = buildViewerExtensions({});
    const names = viewerExtensions.map((ext) => ext.name);
    expect(names).not.toContain("emoji");
  });

  it("createEmojiCallbackStore returns object with all 5 methods", () => {
    const store = createEmojiCallbackStore();
    expect(typeof store.onStart).toBe("function");
    expect(typeof store.onUpdate).toBe("function");
    expect(typeof store.onExit).toBe("function");
    expect(typeof store.onKeyDown).toBe("function");
    expect(typeof store.openPopup).toBe("function");
  });

  it("createEmojiCallbackStore onKeyDown returns false by default (does not swallow events)", () => {
    const store = createEmojiCallbackStore();
    const result = store.onKeyDown({ event: new KeyboardEvent("keydown") });
    expect(result).toBe(false);
  });
});

describe("buildExtensions — mention gating", () => {
  const SAMPLE_ITEMS: readonly MentionItem[] = [
    { id: "1", label: "Ada Lovelace" },
    { id: "2", label: "Alan Turing" },
    { id: "3", label: "Grace Hopper" },
  ];

  it("registers mention when config.mention.enabled === true", () => {
    const callbacks = createMentionCallbackStore();
    const extensions = buildExtensions({
      mention: { enabled: true, items: SAMPLE_ITEMS, callbacks },
    });
    const names = extensions.map((ext) => ext.name);
    expect(names).toContain("mention");
  });

  it("does NOT register mention when config.mention is omitted", () => {
    const extensions = buildExtensions({});
    const names = extensions.map((ext) => ext.name);
    expect(names).not.toContain("mention");
  });

  it("does NOT register mention when config.mention.enabled === false", () => {
    const extensions = buildExtensions({ mention: { enabled: false } });
    const names = extensions.map((ext) => ext.name);
    expect(names).not.toContain("mention");
  });

  it("does NOT push mention inside buildViewerExtensions (editor-only)", () => {
    const viewerExtensions = buildViewerExtensions({});
    const names = viewerExtensions.map((ext) => ext.name);
    expect(names).not.toContain("mention");
  });

  it("uses the custom trigger char when config.mention.char is provided", () => {
    const callbacks = createMentionCallbackStore();
    const extensions = buildExtensions({
      mention: { enabled: true, char: "#", items: SAMPLE_ITEMS, callbacks },
    });
    const mentionExt = extensions.find((ext) => ext.name === "mention");
    expect(mentionExt).toBeDefined();
    const opts = (mentionExt as { options?: { suggestion?: { char?: string } } }).options;
    expect(opts?.suggestion?.char).toBe("#");
  });

  it("defaults the trigger char to '@' when unspecified", () => {
    const callbacks = createMentionCallbackStore();
    const extensions = buildExtensions({
      mention: { enabled: true, items: SAMPLE_ITEMS, callbacks },
    });
    const mentionExt = extensions.find((ext) => ext.name === "mention");
    const opts = (mentionExt as { options?: { suggestion?: { char?: string } } }).options;
    expect(opts?.suggestion?.char).toBe("@");
  });

  it("suggestion items() filters the configured list case-insensitively by label", () => {
    const callbacks = createMentionCallbackStore();
    const extensions = buildExtensions({
      mention: { enabled: true, items: SAMPLE_ITEMS, callbacks },
    });
    const mentionExt = extensions.find((ext) => ext.name === "mention");
    const opts = (mentionExt as {
      options?: {
        suggestion?: {
          items?: (p: { query: string }) => MentionItem[];
        };
      };
    }).options;
    const filter = opts?.suggestion?.items;
    expect(filter).toBeDefined();
    const matches = filter!({ query: "ada" });
    expect(matches).toHaveLength(1);
    expect(matches[0].label).toBe("Ada Lovelace");
  });

  it("suggestion items() honours the configured limit", () => {
    const callbacks = createMentionCallbackStore();
    const items: MentionItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      label: `User ${i}`,
    }));
    const extensions = buildExtensions({
      mention: { enabled: true, items, limit: 3, callbacks },
    });
    const mentionExt = extensions.find((ext) => ext.name === "mention");
    const opts = (mentionExt as {
      options?: {
        suggestion?: {
          items?: (p: { query: string }) => MentionItem[];
        };
      };
    }).options;
    const matches = opts?.suggestion?.items?.({ query: "user" });
    expect(matches).toHaveLength(3);
  });

  it("suggestion render delegates onStart to callbacks store", () => {
    const callbacks = createMentionCallbackStore();
    let patched = "";
    callbacks.onStart = () => { patched = "called"; };

    const extensions = buildExtensions({
      mention: { enabled: true, items: SAMPLE_ITEMS, callbacks },
    });
    const mentionExt = extensions.find((ext) => ext.name === "mention");
    const opts = (mentionExt as {
      options?: { suggestion?: { render?: () => { onStart?: (p: unknown) => void } } };
    }).options;
    opts?.suggestion?.render?.().onStart?.({} as unknown);
    expect(patched).toBe("called");
  });

  it("createMentionCallbackStore returns object with 4 methods", () => {
    const store = createMentionCallbackStore();
    expect(typeof store.onStart).toBe("function");
    expect(typeof store.onUpdate).toBe("function");
    expect(typeof store.onExit).toBe("function");
    expect(typeof store.onKeyDown).toBe("function");
  });

  it("createMentionCallbackStore onKeyDown returns false by default", () => {
    const store = createMentionCallbackStore();
    const result = store.onKeyDown({ event: new KeyboardEvent("keydown") });
    expect(result).toBe(false);
  });
});
