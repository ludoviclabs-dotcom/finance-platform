"use client";

/**
 * /verify — Page publique d'entrée : saisie d'un hash SHA-256 pour vérification.
 * Redirige vers /verify/{hash} à la soumission.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VerifyEntryPage() {
  const router = useRouter();
  const [hash, setHash] = useState("");
  const [error, setError] = useState<string | null>(null);

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
