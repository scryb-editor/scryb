import { describe, it, expect } from "vitest";
import { filterMentionItems } from "../mention/search";
import type { MentionItem } from "../mention/callback-store";

const USERS: readonly MentionItem[] = [
  { id: "1", label: "Ada Lovelace" },
  { id: "2", label: "Alan Turing" },
  { id: "3", label: "Grace Hopper" },
  { id: "4", label: "Margaret Hamilton" },
  { id: "5", label: "Katherine Johnson" },
];

describe("filterMentionItems", () => {
  it("returns the first `limit` items on empty query (cold start)", () => {
    const matches = filterMentionItems(USERS, "", 3);
    expect(matches).toHaveLength(3);
    expect(matches[0].label).toBe("Ada Lovelace");
  });

  it("returns all items when empty query and dataset fits under limit", () => {
    const matches = filterMentionItems(USERS, "", 100);
    expect(matches).toBe(USERS);
  });

  it("filters case-insensitively by label substring", () => {
    const matches = filterMentionItems(USERS, "ada", 10);
    expect(matches).toHaveLength(1);
    expect(matches[0].label).toBe("Ada Lovelace");
  });

  it("matches by id as well as label", () => {
    const matches = filterMentionItems(USERS, "3", 10);
    expect(matches).toHaveLength(1);
    expect(matches[0].label).toBe("Grace Hopper");
  });

  it("returns an empty array when nothing matches", () => {
    const matches = filterMentionItems(USERS, "zzz", 10);
    expect(matches).toHaveLength(0);
  });

  it("early-exits once `limit` matches are collected", () => {
    const many: MentionItem[] = Array.from({ length: 50 }, (_, i) => ({
      id: String(i),
      label: `User ${i}`,
    }));
    const matches = filterMentionItems(many, "user", 5);
    expect(matches).toHaveLength(5);
  });

  it("returns empty on non-positive limit", () => {
    expect(filterMentionItems(USERS, "ada", 0)).toHaveLength(0);
    expect(filterMentionItems(USERS, "ada", -1)).toHaveLength(0);
  });

  it("reuses the cached index across calls on the same dataset reference", () => {
    // Two calls on the same array ref should return consistent results
    const first = filterMentionItems(USERS, "alan", 10);
    const second = filterMentionItems(USERS, "alan", 10);
    expect(first).toEqual(second);
    expect(first[0].label).toBe("Alan Turing");
  });
});
