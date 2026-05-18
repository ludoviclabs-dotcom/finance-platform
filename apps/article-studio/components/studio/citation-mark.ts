/**
 * Tiptap inline mark for `[Sn]` citations rendered in the editor.
 *
 * The model emits citations as bare bracketed tokens in the markdown stream:
 *   « Selon les déclarations officielles [S1], le déploiement est prévu… »
 *
 * On commit, we wrap these tokens with this `<cite data-citation-id="S1">`
 * mark so the editor can:
 *   • style them distinctly (blue underline)
 *   • surface a popover with the source title + verbatim quote on hover
 *
 * The mark is intentionally minimal — no commands, no shortcuts, no input
 * rule. Tokens are inserted programmatically when a generation event lands.
 */

import { Mark, mergeAttributes } from "@tiptap/core";

export const CITATION_RE = /\[S(\d+)\]/g;

export interface CitationAttributes {
  citationId: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    citation: {
      setCitation: (attrs: CitationAttributes) => ReturnType;
      unsetCitation: () => ReturnType;
    };
  }
}

export const CitationMark = Mark.create({
  name: "citation",
  inclusive: false,
  exitable: true,

  addAttributes() {
    return {
      citationId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-citation-id"),
        renderHTML: (attrs: CitationAttributes) => {
          if (!attrs.citationId) return {};
          return { "data-citation-id": attrs.citationId };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: "cite[data-citation-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "cite",
      mergeAttributes(HTMLAttributes, { class: "citation-mark" }),
      0,
    ];
  },

  addCommands() {
    return {
      setCitation:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetCitation:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
