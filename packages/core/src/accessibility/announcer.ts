import type { Editor } from "@tiptap/core";
import { interpolate } from "../i18n/interpolate";
import type { TiptapTranslations } from "../i18n/types";
import { en } from "../i18n/locales/en";

/** Where the character count sits relative to the limit. */
export type CharacterLimitStatus = "under" | "near" | "reached";

/** Fraction of the limit at which "approaching" is announced. */
export const CHARACTER_LIMIT_NEAR_RATIO = 0.9;

/**
 * @param count - Current character count
 * @param limit - Configured maximum, or null for none
 * @returns The limit status
 * @example characterLimitStatus(95, 100) // "near"
 */
export function characterLimitStatus(count: number, limit: number | null): CharacterLimitStatus {
  if (!limit) return "under";
  if (count >= limit) return "reached";
  return count >= Math.ceil(limit * CHARACTER_LIMIT_NEAR_RATIO) ? "near" : "under";
}

/**
 * @param status - Status to describe
 * @param limit - Configured maximum
 * @param t - `translations.editor`
 * @returns Text to announce, or null for "under"
 * @example characterLimitMessage("reached", 500, i18n.editor)
 */
export function characterLimitMessage(
  status: CharacterLimitStatus,
  limit: number,
  t: TiptapTranslations["editor"],
): string | null {
  if (status === "near") return interpolate(t.characterLimitNear ?? en.editor.characterLimitNear!, { limit });
  if (status === "reached") return interpolate(t.characterLimitReached ?? en.editor.characterLimitReached!, { limit });
  return null;
}

/**
 * Calls `onChange` when the count crosses into "near" or "reached" — never
 * per keystroke, which is what made the old live counter noise.
 *
 * @param editor - Editor with CharacterCount registered
 * @param limit - Configured maximum, or null (watcher does nothing)
 * @param onChange - Receives the new status
 * @returns Unsubscribe function
 * @example const stop = watchCharacterLimit(editor, 500, (s) => announce(region, msg(s)));
 */
export function watchCharacterLimit(
  editor: Editor,
  limit: number | null,
  onChange: (status: CharacterLimitStatus) => void,
): () => void {
  if (!limit) return () => {};
  const read = (): CharacterLimitStatus => {
    const storage = (editor.storage as unknown as Record<string, { characters?: () => number } | undefined>)[
      "characterCount"
    ];
    return characterLimitStatus(storage?.characters?.() ?? 0, limit);
  };
  let last = read();
  const handler = (): void => {
    const next = read();
    if (next !== last && next !== "under") onChange(next);
    last = next;
  };
  editor.on("update", handler);
  return () => {
    editor.off("update", handler);
  };
}

/**
 * Writes a message into a polite live region. Clears first so the same text
 * twice in a row is announced twice.
 *
 * @param region - The editor's `.scryb-editor-announcer` element
 * @param message - Text to announce
 * @example announce(regionEl, "Upload failed");
 */
export function announce(region: HTMLElement | null | undefined, message: string): void {
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => {
    region.textContent = message;
  }, 100);
}
