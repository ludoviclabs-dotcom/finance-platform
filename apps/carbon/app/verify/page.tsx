"use client";

/**
 * /verify — Page publique d'entrée : saisie d'un hash SHA-256 pour vérification.
 * Redirige vers /verify/{hash} à la soumission.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

type Recompute = {
  status: string; // authentic | altered | unknown | invalid | error
  message: string;
  package_hash?: string;
  manifest_hash?: string;
  company_name?: string | null;
};

const STATUS_TONE: Record<string, string> = {
  authentic: "bg-emerald-50 text-emerald-700 border-emerald-200",
  altered: "bg-red-50 text-red-700 border-red-200",
  unknown: "bg-amber-50 text-amber-700 border-amber-200",
  invalid: "bg-neutral-50 text-neutral-600 border-neutral-200",
  error: "bg-neutral-50 text-neutral-600 border-neutral-200",
};

const STATUS_LABEL: Record<string, string> = {
  authentic: "Authentique",
  altered: "Altéré",
  unknown: "Inconnu",
  invalid: "Non reconnu",
  error: "Erreur",
};

export default function VerifyEntryPage() {
  const router = useRouter();
  const [hash, setHash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Recompute | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = hash.trim().toLowerCase();
    if (trimmed.length !== 64 || !/^[0-9a-f]{64}$/.test(trimmed)) {
      setError(
        "Le hash doit être un SHA-256 hexadécimal (64 caractères, 0-9 et a-f).",
      );
      return;
    }
    setError(null);
    router.push(`/verify/${trimmed}`);
  };

  const onVerifyFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(`${API}/verify/recompute`, { method: "POST", body: fd });
      setResult((await r.json()) as Recompute);
    } catch {
      setResult({ status: "error", message: "API injoignable." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-4">
      <div className="max-w-xl mx-auto">
        <Link
          href="/"
          className="text-sm text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] inline-flex items-center gap-1 mb-8"
        >
          ← CarbonCo
        </Link>

        <h1 className="font-display text-3xl font-bold text-[var(--color-foreground)] mb-2">
          Vérifier un package auditable
        </h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mb-8">
          Collez le hash SHA-256 d&apos;un package ZIP pour vérifier qu&apos;il correspond
          à un export officiel enregistré par CarbonCo. Aucune authentification
          requise — les métadonnées publiques ne révèlent aucune donnée sensible.
        </p>

        <form onSubmit={onSubmit} className="space-y-4" data-testid="verify-form">
          <div>
            <label
              htmlFor="hash-input"
              className="block text-sm font-medium text-[var(--color-foreground)] mb-2"
            >
              Hash SHA-256 du package
            </label>
            <input
              id="hash-input"
              name="hash"
              type="text"
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="a1b2c3d4e5f6... (64 caractères hex)"
              className="w-full px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-xs text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-carbon-emerald/40"
              data-testid="verify-hash-input"
              maxLength={64}
              autoComplete="off"
              spellCheck={false}
            />
            {error && (
              <p className="mt-2 text-xs text-[var(--color-danger)]" data-testid="verify-hash-error">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full px-4 py-2.5 rounded-md bg-carbon-emerald text-white font-medium hover:opacity-90 transition-opacity"
            data-testid="verify-submit"
          >
            Vérifier
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
          <h2 className="font-display text-lg font-bold text-[var(--color-foreground)] mb-2">
            Ou vérifiez le fichier ZIP directement
          </h2>
          <p className="text-xs text-[var(--color-foreground-muted)] mb-4">
            Le serveur recalcule les empreintes et compare à l&apos;export officiel —
            il détecte la moindre modification d&apos;un octet (statut «&nbsp;altéré&nbsp;»).
          </p>
          <form onSubmit={onVerifyFile} className="space-y-4" data-testid="verify-file-form">
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
              }}
              className="block w-full text-xs text-[var(--color-foreground-muted)] file:mr-3 file:px-3 file:py-2 file:rounded-md file:border-0 file:bg-[var(--color-surface-muted)] file:text-[var(--color-foreground)] file:cursor-pointer"
              data-testid="verify-file-input"
            />
            <button
              type="submit"
              disabled={!file || busy}
              className="w-full px-4 py-2.5 rounded-md border border-[var(--color-border)] text-[var(--color-foreground)] font-medium hover:bg-[var(--color-surface-muted)] transition-colors disabled:opacity-40"
              data-testid="verify-file-submit"
            >
              {busy ? "Vérification…" : "Vérifier le fichier"}
            </button>
          </form>

          {result && (
            <div
              className={`mt-4 rounded-md border p-4 ${STATUS_TONE[result.status] ?? STATUS_TONE.error}`}
              data-testid="verify-file-result"
            >
              <p className="text-sm font-bold mb-1">{STATUS_LABEL[result.status] ?? result.status}</p>
              <p className="text-xs">{result.message}</p>
              {result.company_name && <p className="text-xs mt-2">Organisation : {result.company_name}</p>}
              {result.manifest_hash && (
                <p className="text-[10px] font-mono mt-2 break-all opacity-70">
                  manifest {result.manifest_hash.slice(0, 32)}…
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-8 pt-6 border-t border-[var(--color-border)] space-y-3 text-xs text-[var(--color-foreground-muted)]">
          <p>
            <strong className="text-[var(--color-foreground)]">
              Où trouver le hash ?
            </strong>
          </p>
          <p>
            Dans le fichier <code className="font-mono">README.txt</code> à la racine
            du ZIP reçu, ou en calculant :
          </p>
          <pre className="bg-[var(--color-surface-muted)] p-2 rounded text-[10px] overflow-x-auto">
{`sha256sum package.zip             # Linux/macOS
Get-FileHash package.zip          # PowerShell`}
          </pre>
        </div>
      </div>
    </main>
  );
}
