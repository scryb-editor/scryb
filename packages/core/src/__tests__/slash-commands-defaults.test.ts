import { describe, it, expect } from "vitest";
import { defaultSlashCommands, DEFAULT_TABLE_DIMENSIONS } from "../slash-commands/defaults";
import { createEmojiCallbackStore } from "../emoji/callback-store";
import type { SlashCommandItem } from "../slash-commands/types";

// =============================================================================
// defaultSlashCommands — factory function tests
// =============================================================================

describe("DEFAULT_TABLE_DIMENSIONS", () => {
  it("is exported with rows=3 and cols=3", () => {
    expect(DEFAULT_TABLE_DIMENSIONS).toEqual({ rows: 3, cols: 3 });
  });

  it("is read-only (as const)", () => {
    // TypeScript enforces this; at runtime we just confirm the value is stable
    expect(DEFAULT_TABLE_DIMENSIONS.rows).toBe(3);
    expect(DEFAULT_TABLE_DIMENSIONS.cols).toBe(3);
  });
});

describe("defaultSlashCommands()", () => {
  it("is a function (not an array export)", () => {
    expect(typeof defaultSlashCommands).toBe("function");
  });

  it("returns 11 commands when called with no args", () => {
    const cmds = defaultSlashCommands();
    expect(cmds).toHaveLength(11);
  });

  it("returns SlashCommandItem[] (each item has title, description, command)", () => {
    const cmds = defaultSlashCommands();
    for (const cmd of cmds) {
      expect(typeof cmd.title).toBe("string");
      expect(typeof cmd.description).toBe("string");
      expect(typeof cmd.command).toBe("function");
    }
  });

  it("includes English heading1 title by default", () => {
    const cmds = defaultSlashCommands();
    const h1 = cmds.find((c) => c.icon === "format_h1");
    expect(h1).toBeDefined();
    expect(h1!.title).toBe("Heading 1");
    expect(h1!.description).toBe("Large section heading");
  });

  it("includes all 5 keyword variants for heading1 by default", () => {
    const cmds = defaultSlashCommands();
    const h1 = cmds.find((c) => c.icon === "format_h1");
    expect(h1!.keywords).toEqual(expect.arrayContaining(["heading", "h1", "title", "1", "header"]));
  });

  it("includes table command in advanced group", () => {
    const cmds = defaultSlashCommands();
    const table = cmds.find((c) => c.icon === "table_view");
    expect(table).toBeDefined();
    expect(table!.group).toBe("advanced");
    expect(table!.title).toBe("Table");
    expect(table!.description).toBe("Insert a table");
  });

  it("includes horizontal rule in advanced group", () => {
    const cmds = defaultSlashCommands();
    const hr = cmds.find((c) => c.icon === "horizontal_rule");
    expect(hr).toBeDefined();
    expect(hr!.group).toBe("advanced");
  });

  it("includes image in media group with no-op command", () => {
    const cmds = defaultSlashCommands();
    const img = cmds.find((c) => c.icon === "image");
    expect(img).toBeDefined();
    expect(img!.group).toBe("media");
    // No-op — should not throw
    expect(() => (img!.command as (e: unknown) => void)(undefined)).not.toThrow();
  });

  it("omits youtube until config.youtube.enabled, then lists it in the media group", () => {
    // The entry chains onto setYoutubeVideo, which only exists once the
    // extension is registered — listing it unconditionally prompted for a URL
    // and then discarded it.
    expect(defaultSlashCommands().find((c) => c.icon === "smart_display")).toBeUndefined();

    const cmds = defaultSlashCommands(undefined, undefined, undefined, undefined, { enabled: true });
    const yt = cmds.find((c) => c.icon === "smart_display");
    expect(yt).toBeDefined();
    expect(yt!.group).toBe("media");
    expect(yt!.title).toBe("YouTube video");
    expect(yt!.keywords).toEqual(expect.arrayContaining(["youtube", "video", "embed"]));
  });

  it("keeps youtube in its media slot rather than appending it", () => {
    const cmds = defaultSlashCommands(undefined, undefined, undefined, undefined, { enabled: true });
    const titles = cmds.map((c) => c.title);
    expect(titles.indexOf("YouTube video")).toBe(titles.indexOf("Image") + 1);
  });

  it("includes taskList in lists group with checklist icon", () => {
    const cmds = defaultSlashCommands();
    const task = cmds.find((c) => c.icon === "checklist");
    expect(task).toBeDefined();
    expect(task!.group).toBe("lists");
    expect(task!.title).toBe("Task List");
    expect(task!.keywords).toEqual(expect.arrayContaining(["task", "todo", "checklist"]));
  });

  describe("groups coverage", () => {
    it("has text group commands (heading1, heading2, heading3, blockquote, code)", () => {
      const cmds = defaultSlashCommands();
      const textGroup = cmds.filter((c) => c.group === "text");
      expect(textGroup).toHaveLength(5);
    });

    it("has lists group commands (bulletList, orderedList, taskList)", () => {
      const cmds = defaultSlashCommands();
      const listsGroup = cmds.filter((c) => c.group === "lists");
      expect(listsGroup).toHaveLength(3);
    });

    it("has media group commands (image only until youtube is enabled)", () => {
      const cmds = defaultSlashCommands();
      expect(cmds.filter((c) => c.group === "media")).toHaveLength(1);

      const withYoutube = defaultSlashCommands(undefined, undefined, undefined, undefined, {
        enabled: true,
      });
      expect(withYoutube.filter((c) => c.group === "media")).toHaveLength(2);
    });

    it("has advanced group commands (horizontalRule, table)", () => {
      const cmds = defaultSlashCommands();
      const advancedGroup = cmds.filter((c) => c.group === "advanced");
      expect(advancedGroup).toHaveLength(2);
    });
  });
});

describe("defaultSlashCommands(translations)", () => {
  it("overrides heading1 title with French label", () => {
    const cmds = defaultSlashCommands({
      heading1: { title: "Titre 1", description: "Grand titre de section", keywords: ["titre", "h1"] },
    });
    const h1 = cmds.find((c) => c.icon === "format_h1");
    expect(h1!.title).toBe("Titre 1");
    expect(h1!.description).toBe("Grand titre de section");
  });

  it("overrides table label with French", () => {
    const cmds = defaultSlashCommands({
      table: { title: "Tableau", description: "Insérer un tableau", keywords: ["tableau", "grille"] },
    });
    const table = cmds.find((c) => c.icon === "table_view");
    expect(table!.title).toBe("Tableau");
    expect(table!.description).toBe("Insérer un tableau");
  });

  it("does not affect other commands when partial override provided", () => {
    const cmds = defaultSlashCommands({
      heading1: { title: "Titre 1", description: "Grand titre", keywords: [] },
    });
    // heading2 should still be English
    const h2 = cmds.find((c) => c.icon === "format_h2");
    expect(h2!.title).toBe("Heading 2");
  });

  it("still returns 11 commands with partial override", () => {
    const cmds = defaultSlashCommands({
      code: { title: "Bloc de code", description: "Ajouter un bloc de code", keywords: ["code"] },
    });
    expect(cmds).toHaveLength(11);
  });
});

// =============================================================================
// defaultSlashCommands — Insert emoji (opt-in via config.emoji.enabled)
// =============================================================================

describe("slash commands — insert emoji", () => {
  it("includes insertEmoji entry when emoji.enabled === true", () => {
    const callbacks = createEmojiCallbackStore();
    const cmds = defaultSlashCommands(undefined, undefined, undefined, { enabled: true, callbacks });
    const emojiCmd = cmds.find((c) => c.icon === "emoji_emotions");
    expect(emojiCmd).toBeDefined();
    expect(emojiCmd!.group).toBe("text");
  });

  it("insertEmoji entry has correct titleKey value (emoji.slash.label EN default)", () => {
    const callbacks = createEmojiCallbackStore();
    const cmds = defaultSlashCommands(undefined, undefined, undefined, { enabled: true, callbacks });
    const emojiCmd = cmds.find((c) => c.icon === "emoji_emotions");
    expect(emojiCmd!.title).toBe("Insert emoji");
    expect(emojiCmd!.description).toBe("Search and insert an emoji");
  });

  it("does NOT include insertEmoji when emoji config is omitted (CK-EMO-05)", () => {
    const cmds = defaultSlashCommands();
    const emojiCmd = cmds.find((c) => c.icon === "emoji_emotions");
    expect(emojiCmd).toBeUndefined();
  });

  it("does NOT include insertEmoji when emoji.enabled === false", () => {
    const cmds = defaultSlashCommands(undefined, undefined, undefined, { enabled: false });
    const emojiCmd = cmds.find((c) => c.icon === "emoji_emotions");
    expect(emojiCmd).toBeUndefined();
  });

  it("returns 11 commands when emoji is omitted (byte-identical baseline)", () => {
    const cmds = defaultSlashCommands();
    expect(cmds).toHaveLength(11);
  });

  it("returns 12 commands when emoji is enabled (11 default + insertEmoji)", () => {
    const callbacks = createEmojiCallbackStore();
    const cmds = defaultSlashCommands(undefined, undefined, undefined, { enabled: true, callbacks });
    expect(cmds).toHaveLength(12);
  });

  it("uses translated label when emoji slash translations provided", () => {
    const callbacks = createEmojiCallbackStore();
    const cmds = defaultSlashCommands(
      { emoji: { slash: { label: "Inserir emoji", description: "Buscar e inserir um emoji" } } },
      undefined,
      undefined,
      { enabled: true, callbacks },
    );
    const emojiCmd = cmds.find((c) => c.icon === "emoji_emotions");
    expect(emojiCmd!.title).toBe("Inserir emoji");
    expect(emojiCmd!.description).toBe("Buscar e inserir um emoji");
  });
});
