export default function SourcesPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Sources</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Bibliothèque de documents indexés. Implémentation : Semaine 1 (ingestion + parsing).
      </p>
      <div className="mt-8 rounded border border-dashed border-[color:var(--border)] p-8 text-center text-sm text-[color:var(--muted)]">
        Upload de fichiers <code className="font-mono">.md / .pdf / .docx</code> à venir.
      </div>
    </div>
  );
}
