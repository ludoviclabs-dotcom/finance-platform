/**
 * Shared markdown → HTML pipeline.
 *
 * Used by:
 *   - lib/export/html.ts        (sanitized HTML download + PDF source)
 *   - components/studio/article-editor.tsx (Tiptap setContent() at load time)
 *
 * Both call sites expect the same fidelity: headings, lists, tables (GFM),
 * code blocks, blockquotes, inline emphasis — and inline [Sn] tokens
 * preserved as plain text so the citation marker pass can find them.
 *
 * `allowDangerousHtml: false` ensures raw <script>/<iframe>/etc. embedded
 * in the markdown source are dropped at the AST stage. DOMPurify is a
 * second line of defense applied by the HTML exporter.
 */

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

let processor: ReturnType<typeof buildProcessor> | null = null;

function buildProcessor() {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeStringify);
}

export async function markdownToHtml(md: string): Promise<string> {
  if (!md.trim()) return "<p><em>(vide)</em></p>";
  if (!processor) processor = buildProcessor();
  const file = await processor.process(md);
  return String(file);
}

/** Wrap `[Sn]` tokens in <cite data-citation-id="Sn"> spans. */
export function wrapCitationTokens(html: string): string {
  return html.replace(
    /\[S(\d+)\]/g,
    (_match, n: string) =>
      `<cite data-citation-id="S${n}" class="citation-mark">[S${n}]</cite>`,
  );
}
