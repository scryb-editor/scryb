/**
 * Curated "popular emojis" constant for the Scryb emoji picker.
 *
 * POPULAR_EMOJIS is returned by the `items()` suggestion filter when the user
 * has not typed a query yet (cold-start / empty-query state).
 *
 * Ordering follows Slack's open-sourced frequency data (most-used first).
 *
 * Each shortcode is looked up against the bundled `@tiptap/extension-emoji`
 * dataset. Shortcodes missing from the dataset are silently skipped — emojibase
 * versions may rename entries, so the final length is <= POPULAR_EMOJI_SHORTCODES.length.
 */

import { emojis as DEFAULT_EMOJIS } from "@tiptap/extension-emoji";
import type { EmojiItem } from "@tiptap/extension-emoji";

// =============================================================================
// Curated shortcode list (ordered by frequency)
// =============================================================================

/**
 * Ordered list of emoji shortcodes for the popular picker.
 * Position 0 = most frequently used.
 *
 * Source: Slack frequency data + Scryb editorial curation.
 */
export const POPULAR_EMOJI_SHORTCODES: readonly string[] = [
  "grinning",
  "smiley",
  "smile",
  "grin",
  "laughing",
  "slightly_smiling_face",
  "wink",
  "blush",
  "heart_eyes",
  "kissing_heart",
  "thinking_face",
  "sunglasses",
  "cry",
  "sob",
  "angry",
  "exploding_head",
  "thumbsup",
  "thumbsdown",
  "ok_hand",
  "v",
  "pray",
  "clap",
  "handshake",
  "muscle",
  "heart",
  "yellow_heart",
  "green_heart",
  "blue_heart",
  "purple_heart",
  "broken_heart",
  "100",
  "fire",
  "tada",
  "confetti_ball",
  "sparkles",
  "star",
  "star2",
  "bulb",
  "ballot_box_with_check",
  "white_check_mark",
  "x",
  "warning",
  "rocket",
  "dart",
  "pushpin",
  "paperclip",
  "speech_balloon",
  "thought_balloon",
  "eyes",
  "see_no_evil",
  "hear_no_evil",
  "speak_no_evil",
] as const;

// =============================================================================
// POPULAR_EMOJIS constant
// =============================================================================

function buildPopularEmojis(): readonly EmojiItem[] {
  const byName = new Map<string, EmojiItem>();
  for (const emoji of DEFAULT_EMOJIS as EmojiItem[]) {
    byName.set(emoji.name, emoji);
  }

  const result: EmojiItem[] = [];
  for (const shortcode of POPULAR_EMOJI_SHORTCODES) {
    const found = byName.get(shortcode);
    if (found !== undefined) {
      result.push(found);
    }
  }
  return result;
}

/**
 * Curated list of popular emojis for the cold-start picker.
 *
 * Referentially stable — built once at module load from the bundled emojibase
 * dataset. Adapters and tests may compare by identity.
 *
 * @example
 * ```typescript
 * import { POPULAR_EMOJIS } from "@scryb-editor/core";
 * // POPULAR_EMOJIS[0].name === "grinning"
 * ```
 */
export const POPULAR_EMOJIS: readonly EmojiItem[] = buildPopularEmojis();
