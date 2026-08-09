/**
 * The supported bubble menu types in the Scryb editor.
 */
export type BubbleMenuType = "text" | "image" | "table" | "cell";

/**
 * Configuration for a single bubble menu registration.
 */
export interface BubbleMenuConfig {
  /** The type identifier for this bubble menu. */
  readonly type: BubbleMenuType;
  /**
   * Priority used to resolve conflicts when multiple menus could show.
   * Higher numbers win. E.g., "image" (priority 20) beats "text" (priority 10).
   */
  readonly priority: number;
  /** Predicate returning true when this menu should be visible. */
  readonly shouldShow: (state: { editor: unknown; from: number; to: number }) => boolean;
}
