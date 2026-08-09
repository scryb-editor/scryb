import { describe, it, expect } from "vitest";
import { renderToHTML } from "../render-html";
import type { JSONContent } from "@tiptap/core";

describe("renderToHTML", () => {
  it("renders a simple paragraph to HTML", () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello world" }],
        },
      ],
    };
    const html = renderToHTML(content);
    expect(html).toContain("<p");
    expect(html).toContain("Hello world");
    expect(html).toContain("</p>");
  });

  it("renders a heading to HTML", () => {
    const content: JSONContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
      ],
    };
    const html = renderToHTML(content);
    expect(html).toContain("<h1");
    expect(html).toContain("Title");
    expect(html).toContain("</h1>");
  });

  it("handles empty document", () => {
    const content: JSONContent = {
      type: "doc",
      content: [],
    };
    const html = renderToHTML(content);
    expect(typeof html).toBe("string");
    expect(html.startsWith('<div class="scryb-content">')).toBe(true);
    expect(html.endsWith("</div>")).toBe(true);
  });

  it("is exported as a function", () => {
    expect(typeof renderToHTML).toBe("function");
  });

  it("wraps output in a .scryb-content container by default", () => {
    const content: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
    };
    const html = renderToHTML(content);
    expect(html.startsWith('<div class="scryb-content">')).toBe(true);
    expect(html.endsWith("</div>")).toBe(true);
    expect(html).toContain("Hi");
  });

  it("wraps output when wrapper is explicitly true", () => {
    const content: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
    };
    const html = renderToHTML(content, { wrapper: true });
    expect(html.startsWith('<div class="scryb-content">')).toBe(true);
  });

  it("emits bare HTML when wrapper is false", () => {
    const content: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
    };
    const html = renderToHTML(content, { wrapper: false });
    expect(html.startsWith('<div class="scryb-content">')).toBe(false);
    expect(html).toContain("<p");
  });

  it("wraps in an outer theme container when theme is set", () => {
    const content: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
    };
    const html = renderToHTML(content, { theme: "dark" });
    // Theme ancestor must be OUTSIDE the content root so `.scryb-theme-dark .scryb-content`
    // descendant rules and the theme's design tokens both resolve.
    expect(html.startsWith('<div class="scryb-theme-dark"><div class="scryb-content">')).toBe(true);
    expect(html.endsWith("</div></div>")).toBe(true);
  });

  it("does not add a theme container when theme is omitted", () => {
    const content: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
    };
    const html = renderToHTML(content);
    expect(html.startsWith('<div class="scryb-theme-')).toBe(false);
  });

  it("ignores theme when wrapper is false", () => {
    const content: JSONContent = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
    };
    const html = renderToHTML(content, { wrapper: false, theme: "dark" });
    expect(html.startsWith("<div")).toBe(false);
    expect(html).toContain("<p");
  });
});
