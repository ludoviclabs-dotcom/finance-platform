"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ARTICLE_LENGTHS, type ArticleLength } from "@/lib/types/article";

interface SourceOption {
  id: string;
  filename: string;
  title: string | null;
  status: string;
}

interface Props {
  sources: SourceOption[];
}

const LENGTH_LABELS: Record<ArticleLength, string> = {
  short: "Court (~600 mots)",
  medium: "Moyen (~1200 mots)",
  long: "Long (~2500 mots)",
};

export function ArticleBriefForm({ sources }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [angle, setAngle] = useState("");
  const [audience, setAudience] = useState("");
  const [length, setLength] = useState<ArticleLength>("medium");
  const [tone, setTone] = useState("analytique");
  const [keywords, setKeywords] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const ready = sources.filter((s) => s.status === "READY");

  function toggleSource(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      title: title.trim(),
      angle: angle.trim(),
      audience: audience.trim(),
      length,
      tone: tone.trim() || "analytique",
      selectedSourceIds: [...selectedIds],
      keywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
    };

    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Erreur ${res.status}`);
        return;
      }
      router.push(`/articles/${data.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Titre" hint="Sert de slug et de meta-title par défaut.">
        <input
          type="text"
          required
          minLength={3}
          maxLength={160}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
          placeholder="Ex. — Pourquoi l'AI Act change tout pour les fondateurs"
        />
      </Field>

      <Field label="Angle" hint="Ce que l'article veut faire ressortir, en 2-3 phrases.">
        <textarea
          required
          minLength={10}
          maxLength={500}
          rows={3}
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          className="input"
        />
      </Field>

      <Field label="Audience">
        <input
          type="text"
          required
          minLength={3}
          maxLength={300}
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="input"
          placeholder="Ex. — Fondateurs early-stage curieux des évolutions réglementaires"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Longueur cible">
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as ArticleLength)}
            className="input"
          >
            {ARTICLE_LENGTHS.map((l) => (
              <option key={l} value={l}>
                {LENGTH_LABELS[l]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ton">
          <input
            type="text"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="input"
            placeholder="analytique"
          />
        </Field>
      </div>

      <Field
        label="Mots-clés SEO"
        hint="Séparés par des virgules. Ils nourrissent l'expansion de requête."
      >
        <input
          type="text"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          className="input"
          placeholder="ai act, transparence, modèles fondationnels"
        />
      </Field>

      <Field
        label={`Sources sélectionnées (${selectedIds.size}/${ready.length})`}
        hint="Cochez les sources qui formeront le corpus RAG. Au moins une source READY est requise."
      >
        {ready.length === 0 ? (
          <p className="text-sm text-amber-300">
            Aucune source indexée. Importe d'abord des documents sur la page Sources.
          </p>
        ) : (
          <ul className="max-h-56 overflow-y-auto rounded border border-white/10 bg-black/20 divide-y divide-white/5">
            {ready.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  id={`src-${s.id}`}
                  checked={selectedIds.has(s.id)}
                  onChange={() => toggleSource(s.id)}
                  className="size-4 accent-emerald-400"
                />
                <label htmlFor={`src-${s.id}`} className="flex-1 cursor-pointer text-sm">
                  <span className="font-medium">{s.title ?? s.filename}</span>{" "}
                  <span className="text-xs text-[color:var(--muted)]">— {s.filename}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Field>

      {error && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || ready.length === 0 || selectedIds.size === 0}
        className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Création…" : "Créer l'article"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-[color:var(--muted)]">{hint}</span>}
    </label>
  );
}
