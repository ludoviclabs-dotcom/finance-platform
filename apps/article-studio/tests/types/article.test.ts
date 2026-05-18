import { describe, expect, it } from "vitest";
import { slugify, articleBriefSchema } from "@/lib/types/article";

describe("slugify", () => {
  it("lowercases, deburrs, and hyphenates", () => {
    expect(slugify("Pourquoi l'AI Act change tout pour les fondateurs")).toBe(
      "pourquoi-l-ai-act-change-tout-pour-les-fondateurs",
    );
  });

  it("strips diacritics", () => {
    expect(slugify("Éthique des modèles génératifs")).toBe(
      "ethique-des-modeles-generatifs",
    );
  });

  it("collapses multiple separators", () => {
    expect(slugify("a — b -- c")).toBe("a-b-c");
  });

  it("caps length to 80 chars", () => {
    const long = "a".repeat(200);
    expect(slugify(long).length).toBeLessThanOrEqual(80);
  });
});

describe("articleBriefSchema", () => {
  it("accepts a minimal valid brief", () => {
    const result = articleBriefSchema.safeParse({
      title: "Mon titre",
      angle: "Un angle suffisamment long pour passer la validation.",
      audience: "Devs FR",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBe("medium");
      expect(result.data.tone).toBe("analytique");
      expect(result.data.selectedSourceIds).toEqual([]);
    }
  });

  it("rejects briefs with too-short title", () => {
    const result = articleBriefSchema.safeParse({
      title: "X",
      angle: "Angle valide qui dépasse 10 caractères.",
      audience: "Devs",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown length values", () => {
    const result = articleBriefSchema.safeParse({
      title: "Titre valide",
      angle: "Angle valide qui dépasse 10 caractères.",
      audience: "Devs",
      length: "epic",
    });
    expect(result.success).toBe(false);
  });
});
