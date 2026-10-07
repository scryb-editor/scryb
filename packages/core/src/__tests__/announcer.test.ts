import { afterEach, describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { createScrybEditor } from "../editor-factory";
import { announce, characterLimitMessage, characterLimitStatus, watchCharacterLimit } from "../accessibility/announcer";
import { en } from "../i18n/locales/en";

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
  vi.useRealTimers();
});

describe("character limit", () => {
  it("classifies counts", () => {
    expect(characterLimitStatus(5, null)).toBe("under");
    expect(characterLimitStatus(89, 100)).toBe("under");
    expect(characterLimitStatus(90, 100)).toBe("near");
    expect(characterLimitStatus(100, 100)).toBe("reached");
  });
  it("messages", () => {
    expect(characterLimitMessage("near", 100, en.editor)).toBe("Approaching the 100-character limit");
    expect(characterLimitMessage("under", 100, en.editor)).toBeNull();
  });
  it("fires once per transition, not per keystroke", () => {
    editor = createScrybEditor({ content: "<p></p>", maxCharacters: 10 });
    const seen: string[] = [];
    const stop = watchCharacterLimit(editor, 10, (s) => seen.push(s));
    editor.commands.insertContent("123456789");
    editor.commands.insertContent("0");
    editor.commands.insertContent("x");
    stop();
    expect(seen).toEqual(["near", "reached"]);
  });
});

describe("announce", () => {
  it("clears then writes so repeats are re-announced", () => {
    vi.useFakeTimers();
    const region = document.createElement("div");
    region.textContent = "old";
    announce(region, "Upload failed");
    expect(region.textContent).toBe("");
    vi.advanceTimersByTime(100);
    expect(region.textContent).toBe("Upload failed");
  });
});
