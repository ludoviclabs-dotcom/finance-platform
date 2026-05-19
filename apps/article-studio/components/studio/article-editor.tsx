"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";

import { markdownToHtml, wrapCitationTokens } from "@/lib/markdown/to-html";
import { CitationMark } from "./citation-mark";
import { CitationPopover } from "./citation-popover";

export interface Citation {
  id: string;
  sourceId: string;
  sourceTitle: string;
  sourceFilename: string;
  sourceAuthor: string | null;
  heading: string | null;
  pageNumber: number | null;
  quote: string;
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
    content: "<p></p>",
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[20rem]",
      },
    },
  });

  // Hydrate the editor with the persisted markdown body once it's mounted.
  // The full remark→HTML pipeline runs client-side here so that lists, tables,
  // code blocks, and inline citations all round-trip back to ProseMirror nodes.
  useEffect(() => {
    if (!editor || !initialBodyMd?.trim()) return;
    let cancelled = false;
    void (async () => {
      const html = await markdownToHtml(initialBodyMd);
      const withCitations = wrapCitationTokens(html);
      if (!cancelled) editor.commands.setContent(withCitations, false);
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, initialBodyMd]);

  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number } | null>(null);

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
          // Rebuild the doc from the accumulated markdown so lists/tables/code
          // blocks re-materialize as proper nodes and [Sn] citations get
          // wrapped in <cite> tags (CitationMark's parseHTML picks them up).
          if (editor) {
            void (async () => {
              const html = await markdownToHtml(liveBufferRef.current);
              const withCitations = wrapCitationTokens(html);
              editor.commands.setContent(withCitations, false);
            })();
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

  const onEditorClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const cite = target.closest("cite[data-citation-id]") as HTMLElement | null;
      if (!cite) {
        setActiveCitationId(null);
        setPopoverAnchor(null);
        return;
      }
      const id = cite.getAttribute("data-citation-id");
      if (!id) return;
      const rect = cite.getBoundingClientRect();
      setActiveCitationId(id);
      setPopoverAnchor({
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 4,
      });
    },
    [],
  );

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

      <div
        className="rounded border border-white/10 bg-black/20 p-4 article-prose"
        onClick={onEditorClick}
      >
        <EditorContent editor={editor} />
      </div>

      {activeCitationId && popoverAnchor && (
        <CitationPopover
          citation={citationLookup.get(activeCitationId) ?? null}
          anchor={popoverAnchor}
          onClose={() => {
            setActiveCitationId(null);
            setPopoverAnchor(null);
          }}
        />
      )}

      <style jsx global>{`
        .citation-mark {
          color: #6ad1ff;
          font-style: normal;
          text-decoration: underline dotted;
          cursor: pointer;
        }
        .article-prose .ProseMirror p { margin: 0.75rem 0; line-height: 1.6; }
        .article-prose .ProseMirror h1 { margin-top: 2rem; font-size: 1.5rem; font-weight: 700; }
        .article-prose .ProseMirror h2 { margin-top: 1.75rem; font-size: 1.25rem; font-weight: 600; }
        .article-prose .ProseMirror h3 { margin-top: 1.25rem; font-size: 1.05rem; font-weight: 600; }
        .article-prose .ProseMirror ul, .article-prose .ProseMirror ol {
          margin: 0.75rem 0; padding-left: 1.5rem;
        }
        .article-prose .ProseMirror li { margin: 0.25rem 0; }
        .article-prose .ProseMirror blockquote {
          border-left: 3px solid rgba(255,255,255,0.12);
          padding-left: 1rem; color: var(--muted); margin: 1rem 0;
        }
        .article-prose .ProseMirror table {
          border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem;
        }
        .article-prose .ProseMirror th, .article-prose .ProseMirror td {
          border: 1px solid rgba(255,255,255,0.12); padding: 0.35rem 0.6rem;
        }
        .article-prose .ProseMirror code {
          background: rgba(255,255,255,0.06); padding: 0.1em 0.35em; border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
