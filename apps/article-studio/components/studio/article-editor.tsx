"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { CitationMark, CITATION_RE } from "./citation-mark";

interface Citation {
  id: string;
  sourceId: string;
  heading: string | null;
}

interface Props {
  articleId: string;
  initialBodyMd: string | null;
  initialCitations: Citation[];
}

type StreamEvent =
  | { type: "phase"; phase: string }
  | { type: "retrieval"; queryCount: number; chunkCount: number; contextTokens: number }
  | {
      type: "outline";
      outline: { title: string; sections: Array<{ id: string; title: string; summary: string }> };
    }
  | { type: "section-start"; sectionId: string; title: string; index: number; total: number }
  | { type: "section-token"; sectionId: string; delta: string }
  | { type: "section-end"; sectionId: string; markdown: string }
  | { type: "section-error"; sectionId: string; message: string }
  | { type: "infographics"; count: number }
  | {
      type: "done";
      grounding: { score: number; paragraphCount: number; citedCount: number };
    }
  | { type: "error"; message: string };

export function ArticleEditor({ articleId, initialBodyMd, initialCitations }: Props) {
  const [phase, setPhase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grounding, setGrounding] = useState<number | null>(null);
  const [costEstimate, setCostEstimate] = useState<string | null>(null);
  const [outlinePreview, setOutlinePreview] = useState<
    { title: string; summary: string }[] | null
  >(null);
  const liveBufferRef = useRef<string>("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: false }),
      CitationMark,
    ],
    immediatelyRender: false,
    content: initialBodyMd ? markdownToHtml(initialBodyMd) : "<p></p>",
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[20rem]",
      },
    },
  });

  // Re-mount editor content when initialBodyMd arrives async (rare).
  useEffect(() => {
    if (!editor) return;
    if (initialBodyMd && editor.isEmpty) {
      editor.commands.setContent(markdownToHtml(initialBodyMd));
    }
  }, [editor, initialBodyMd]);

  const citationLookup = useMemo(() => {
    const map = new Map<string, Citation>();
    initialCitations.forEach((c) => map.set(c.id, c));
    return map;
  }, [initialCitations]);

  const handleEventRef = useRef<(evt: StreamEvent) => void>(() => {});

  const generate = useCallback(async () => {
    if (!editor || busy) return;
    setBusy(true);
    setError(null);
    setPhase("retrieve");
    setGrounding(null);
    setCostEstimate(null);
    setOutlinePreview(null);
    editor.commands.setContent("<p></p>");
    liveBufferRef.current = "";

    const res = await fetch(`/api/articles/${articleId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok || !res.body) {
      setError(`HTTP ${res.status}`);
      setBusy(false);
      setPhase(null);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const segments = buffer.split("\n\n");
        buffer = segments.pop() ?? "";
        for (const seg of segments) {
          const line = seg
            .split("\n")
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "{}") continue;
          let evt: StreamEvent;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }
          handleEventRef.current(evt);
        }
      }
    } finally {
      setBusy(false);
    }
  }, [editor, articleId, busy]);

  const handleEvent = useCallback(
    (evt: StreamEvent) => {
      switch (evt.type) {
        case "phase":
          setPhase(evt.phase);
          break;
        case "outline":
          setOutlinePreview(
            evt.outline.sections.map((s) => ({ title: s.title, summary: s.summary })),
          );
          break;
        case "section-start":
          if (editor) {
            // Insert a placeholder paragraph as a separator.
            editor.commands.focus("end");
            if (!editor.isEmpty) editor.commands.insertContent("<p></p>");
          }
          break;
        case "section-token":
          liveBufferRef.current += evt.delta;
          if (editor) {
            editor.commands.insertContent(evt.delta);
          }
          break;
        case "section-end":
          // Re-render the just-finished section with citation marks applied.
          if (editor) {
            // For simplicity, rebuild the whole doc from the accumulated markdown.
            // Sprint 5 will switch to a per-section node tree update.
            const html = markdownToHtml(liveBufferRef.current);
            editor.commands.setContent(html, false);
            applyCitationMarks(editor);
          }
          break;
        case "section-error":
          setError(evt.message);
          break;
        case "done":
          setGrounding(evt.grounding.score);
          setPhase(null);
          break;
        case "error":
          setError(evt.message);
          setPhase(null);
          break;
      }
    },
    [editor],
  );

  useEffect(() => {
    handleEventRef.current = handleEvent;
  }, [handleEvent]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy ? "Génération…" : "Générer l'article"}
        </button>
        {phase && (
          <span className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
            phase : {phase}
          </span>
        )}
        {grounding !== null && (
          <span
            className={`rounded px-2 py-0.5 text-xs ${
              grounding >= 0.7
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-amber-500/10 text-amber-200"
            }`}
            title="Ratio paragraphes avec citation [S\d] ou [INFO MANQUANTE]"
          >
            grounding {(grounding * 100).toFixed(0)} %
          </span>
        )}
        {costEstimate && (
          <span className="text-xs text-[color:var(--muted)]">{costEstimate}</span>
        )}
      </div>

      {error && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      {outlinePreview && (
        <details className="rounded border border-white/10 bg-black/20 p-3 text-xs">
          <summary className="cursor-pointer text-[color:var(--muted)]">
            Plan ({outlinePreview.length} sections)
          </summary>
          <ol className="mt-2 space-y-1">
            {outlinePreview.map((s, i) => (
              <li key={i}>
                <span className="font-medium">{s.title}</span>{" "}
                <span className="text-[color:var(--muted)]">— {s.summary}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className="rounded border border-white/10 bg-black/20 p-4 article-prose">
        <EditorContent editor={editor} />
      </div>

      <CitationLegend citations={initialCitations} lookup={citationLookup} />

      <style jsx global>{`
        .citation-mark {
          color: #6ad1ff;
          font-style: normal;
          text-decoration: underline dotted;
          cursor: help;
        }
        .article-prose .ProseMirror p {
          margin: 0.75rem 0;
          line-height: 1.6;
        }
        .article-prose .ProseMirror h2 {
          margin-top: 1.75rem;
          font-size: 1.25rem;
          font-weight: 600;
        }
        .article-prose .ProseMirror h3 {
          margin-top: 1.25rem;
          font-size: 1.05rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

function CitationLegend({
  citations,
  lookup,
}: {
  citations: Citation[];
  lookup: Map<string, Citation>;
}) {
  if (citations.length === 0) return null;
  return (
    <details className="rounded border border-white/10 bg-black/20 p-3 text-xs">
      <summary className="cursor-pointer text-[color:var(--muted)]">
        Citations ({citations.length})
      </summary>
      <ul className="mt-2 space-y-1">
        {citations.map((c) => (
          <li key={c.id}>
            <span className="font-mono text-emerald-300">[{c.id}]</span>{" "}
            <span className="text-[color:var(--muted)]">
              {c.heading ?? lookup.get(c.id)?.heading ?? "(passage)"}
            </span>{" "}
            <span className="text-[10px] text-[color:var(--muted)]">
              src={c.sourceId.slice(0, 8)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Walk the editor doc, find `[Sn]` runs in text nodes, and apply the
 * `citation` mark over them. Idempotent — running twice is a no-op because
 * the existing mark span swallows the regex match.
 */
function applyCitationMarks(editor: ReturnType<typeof useEditor>): void {
  if (!editor) return;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    const text = node.text;
    const matches = [...text.matchAll(CITATION_RE)];
    for (const m of matches) {
      const from = pos + (m.index ?? 0);
      const to = from + m[0].length;
      editor.commands.setTextSelection({ from, to });
      editor.commands.setCitation({ citationId: `S${m[1]}` });
    }
    return true;
  });
  editor.commands.setTextSelection({ from: 0, to: 0 });
  editor.commands.blur();
}

/**
 * Minimal markdown→HTML for paragraphs, H2/H3 headings, and `[Sn]` citations.
 * Sprint 5 swaps this for a real remark→Tiptap mapper.
 */
function markdownToHtml(md: string): string {
  const blocks = md.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const heading = block.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const level = Math.min(6, Math.max(1, heading[1].length));
        return `<h${level}>${escapeHtml(heading[2])}</h${level}>`;
      }
      return `<p>${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
