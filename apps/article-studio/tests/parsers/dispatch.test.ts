import { describe, expect, it } from "vitest";
import {
  parseSource,
  UnsupportedFormatError,
  EmptyDocumentError,
} from "@/lib/parsers";

describe("parseSource dispatcher", () => {
  it("routes markdown to the markdown parser", async () => {
    const parsed = await parseSource({
      buffer: Buffer.from("# Hello\n\nWorld\n", "utf8"),
      filename: "x.md",
      mimeType: "text/markdown",
    });
    expect(parsed.mimeType).toBe("text/markdown");
    expect(parsed.blocks.length).toBe(2);
  });

  it("throws UnsupportedFormatError for unknown mime + extension", async () => {
    await expect(
      parseSource({
        buffer: Buffer.from("anything"),
        filename: "data.bin",
        mimeType: "application/octet-stream",
      }),
    ).rejects.toBeInstanceOf(UnsupportedFormatError);
  });

  it("throws EmptyDocumentError when the parser produces zero blocks", async () => {
    await expect(
      parseSource({
        buffer: Buffer.from("\n\n", "utf8"),
        filename: "blank.md",
        mimeType: "text/markdown",
      }),
    ).rejects.toBeInstanceOf(EmptyDocumentError);
  });
});
