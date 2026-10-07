/**
 * APG tabs keyboard model: ArrowRight/ArrowLeft move to the next/previous tab
 * and wrap, Home/End jump to the first/last tab.
 *
 * @param key - `KeyboardEvent.key` pressed on the tablist
 * @param index - Index of the currently selected tab
 * @param count - Number of tabs
 * @returns Index of the tab to select and focus, or null when the key is not a tabs key
 * @example nextTabIndex("ArrowRight", 1, 2) // 0
 */
export function nextTabIndex(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}
