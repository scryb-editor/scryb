import { describe, expect, it } from "vitest";
import { createUploadProgressHtml } from "../utils/upload-progress-ui.utils";

describe("createUploadProgressHtml", () => {
  it("renders the spinner ligature as hidden, untranslated decoration", () => {
    const host = document.createElement("div");
    host.innerHTML = createUploadProgressHtml("Uploading…", 40);
    const icon = host.querySelector(".upload-icon .material-symbols-outlined");
    expect(icon?.getAttribute("translate")).toBe("no");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });
});
