import { describe, expect, it } from "vitest";
import { detectFormat } from "@/lib/types/source";

describe("detectFormat", () => {
  it("resolves markdown by mime", () => {
    expect(detectFormat("text/markdown", "x")).toBe("markdown");
    expect(detectFormat("text/x-markdown", "x")).toBe("markdown");
  });

  it("resolves pdf by mime", () => {
    expect(detectFormat("application/pdf", "x")).toBe("pdf");
  });

  it("resolves docx by mime", () => {
    expect(
      detectFormat(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "x",
      ),
    ).toBe("docx");
  });

  it("falls back to extension when mime is generic", () => {
    expect(detectFormat("application/octet-stream", "note.md")).toBe("markdown");
    expect(detectFormat("application/octet-stream", "report.pdf")).toBe("pdf");
    expect(detectFormat("application/octet-stream", "draft.docx")).toBe("docx");
  });

  it("returns null when neither mime nor extension match", () => {
    expect(detectFormat("image/png", "photo.png")).toBeNull();
    expect(detectFormat(null, null)).toBeNull();
  });
});
