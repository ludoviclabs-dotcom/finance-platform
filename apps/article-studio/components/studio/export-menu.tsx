"use client";

import { EXPORT_FORMATS, FORMAT_LABELS, type ExportFormat } from "@/lib/export";

interface Props {
  articleId: string;
  /** Hide PDF when running in environments without Chromium. */
  hidePdf?: boolean;
}

export function ExportMenu({ articleId, hidePdf }: Props) {
  const formats = (hidePdf ? EXPORT_FORMATS.filter((f) => f !== "pdf") : EXPORT_FORMATS) as
    ExportFormat[];

  return (
    <div className="rounded border border-white/10 bg-black/20 p-4 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
        Exporter
      </h2>
      <ul className="space-y-1.5">
        {formats.map((f) => (
          <li key={f}>
            <a
              href={`/api/export/${articleId}/${f}`}
              download
              className="block rounded px-2 py-1.5 text-sm hover:bg-white/5"
            >
              {FORMAT_LABELS[f]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
