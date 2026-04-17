/**
 * /verify/[hash] — Page PUBLIQUE de vérification d'un package d'export.
 *
 * Un auditeur externe visite cette URL avec le hash d'un ZIP/manifest qu'il
 * détient. Si le hash est enregistré côté CarbonCo, la page affiche les
 * métadonnées publiques (nom de l'entreprise, date, comptages). Sinon,
 * message "hash inconnu".
 *
 * Pas de login requis. Rate limit côté API : 30 / 60s / IP.
 *
 * Accepte indifféremment :
 *   - package_hash (SHA-256 du ZIP complet)
 *   - manifest_hash (SHA-256 canonique du manifest.json)
 *
 * L'API /verify cherche d'abord dans package_hash. Pour lookup par manifest_hash
 * voir TODO Phase 3.C (alternative : /verify/manifest/{hash}).
 */

import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

interface VerifyPageProps {
  params: Promise<{ hash: string }>;
}

interface VerifyApiResponse {
  verified: boolean;
  package_hash: string;
  manifest_hash: string | null;
  domain: string | null;
  filename: string | null;
  size_bytes: number | null;
  event_count: number | null;
  frozen_count: number | null;
  generated_at: string | null;
  company_name: string | null;
  message: string;
}

// Rendu SSR pour éviter tout rendu statique stale d'un hash inconnu → connu
export const dynamic = "force-dynamic";

async function fetchVerify(hash: string): Promise<VerifyApiResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/verify/${encodeURIComponent(hash)}`, {
      cache: "no-store",
    });
    if (res.status === 400) {
      return null;
    }
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as VerifyApiResponse;
  } catch {
    return null;
  }
}

export default async function VerifyHashPage({ params }: VerifyPageProps) {
  const { hash } = await params;
  const invalid = hash.length !== 64 || !/^[0-9a-f]{64}$/i.test(hash);
  const apiRes = invalid ? null : await fetchVerify(hash.toLowerCase());

  return (
    <main className="min-h-screen bg-[var(--color-background)] py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Branding */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] inline-flex items-center gap-1"
          >
            ← CarbonCo
          </Link>
        </div>

        <h1 className="font-display text-3xl font-bold text-[var(--color-foreground)] mb-2">
          Vérification de package
        </h1>
        <p className="text-sm text-[var(--color-foreground-muted)] mb-8">
          Cette page permet de vérifier qu&apos;un hash correspond à un package
          d&apos;export auditable enregistré par CarbonCo.
        </p>

        {/* Hash input pane */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 mb-6">
          <div className="text-xs uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)] mb-2">
            Hash vérifié
          </div>
          <code
            className="block font-mono text-xs break-all bg-[var(--color-surface-muted)] p-3 rounded"
            data-testid="verify-hash-display"
          >
            {hash}
          </code>
        </div>

        {invalid && <InvalidHash />}
        {!invalid && apiRes === null && <ApiUnreachable />}
        {apiRes && apiRes.verified && <VerifiedCard data={apiRes} />}
        {apiRes && !apiRes.verified && <UnknownHash message={apiRes.message} />}

        {/* Footer info */}
        <div className="mt-12 pt-6 border-t border-[var(--color-border)] text-xs text-[var(--color-foreground-muted)] space-y-2">
          <p>
            <strong>Comment vérifier moi-même ?</strong>
          </p>
          <p>
            Le fichier <code className="font-mono">manifest.json</code> du ZIP reçu doit
            avoir un SHA-256 égal au <em>hash manifest</em> affiché ci-dessus (si
            vérifié). Calcul en ligne de commande :
          </p>
          <pre className="bg-[var(--color-surface-muted)] p-2 rounded text-[10px] overflow-x-auto">
{`# Linux / macOS
sha256sum manifest.json

# PowerShell (Windows)
Get-FileHash manifest.json -Algorithm SHA256`}
          </pre>
          <p className="pt-2">
            <Link href="/methodologie" className="underline hover:text-[var(--color-foreground)]">
              Méthodologie d&apos;audit complète →
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function InvalidHash() {
  return (
    <div
      className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-5"
      data-testid="verify-invalid"
    >
      <h2 className="font-semibold text-[var(--color-danger)] mb-2">
        Hash invalide
      </h2>
      <p className="text-sm text-[var(--color-foreground-muted)]">
        Le hash fourni n&apos;est pas un SHA-256 hexadécimal (64 caractères attendus,
        chaque caractère entre 0-9 ou a-f).
      </p>
    </div>
  );
}

function ApiUnreachable() {
  return (
    <div
      className="rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/5 p-5"
      data-testid="verify-api-unreachable"
    >
      <h2 className="font-semibold text-[var(--color-warning)] mb-2">
        Service indisponible
      </h2>
      <p className="text-sm text-[var(--color-foreground-muted)]">
        Impossible de contacter le service de vérification. Réessayez dans quelques
        minutes.
      </p>
    </div>
  );
}

function UnknownHash({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      data-testid="verify-unknown"
    >
      <h2 className="font-semibold text-[var(--color-foreground-muted)] mb-2">
        Hash non reconnu
      </h2>
      <p className="text-sm text-[var(--color-foreground-muted)]">
        {message}
      </p>
      <p className="text-xs text-[var(--color-foreground-subtle)] mt-3">
        Si vous avez reçu ce hash par un tiers, vérifiez qu&apos;il s&apos;agit bien du
        <strong> SHA-256 du fichier ZIP complet</strong> (pas d&apos;un autre fichier interne).
      </p>
    </div>
  );
}

function VerifiedCard({ data }: { data: VerifyApiResponse }) {
  const formattedDate = data.generated_at
    ? new Date(data.generated_at).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const formattedSize = data.size_bytes
    ? `${(data.size_bytes / 1024).toFixed(1)} Ko`
    : "—";

  return (
    <div
      className="rounded-xl border-2 border-[var(--color-success)] bg-[var(--color-success)]/5 p-6"
      data-testid="verify-success"
    >
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-[var(--color-success)]/15 flex items-center justify-center text-[var(--color-success)] text-xl flex-shrink-0">
          ✓
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-[var(--color-success)]">
            Package vérifié
          </h2>
          <p className="text-sm text-[var(--color-foreground-muted)] mt-1">
            Ce hash correspond à un export officiel enregistré par CarbonCo.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Entreprise" value={data.company_name ?? "—"} />
        <Field label="Domaine" value={data.domain ?? "—"} />
        <Field label="Généré le" value={formattedDate} />
        <Field label="Taille" value={formattedSize} />
        <Field
          label="Events tracés"
          value={data.event_count !== null ? String(data.event_count) : "—"}
        />
        <Field
          label="Datapoints gelés"
          value={data.frozen_count !== null ? String(data.frozen_count) : "—"}
        />
        <Field
          label="Hash manifest"
          value={data.manifest_hash ?? "—"}
          mono
          fullWidth
        />
        <Field label="Nom de fichier" value={data.filename ?? "—"} mono fullWidth />
      </dl>
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
  fullWidth = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "sm:col-span-2" : undefined}>
      <dt className="text-[10px] uppercase tracking-wide font-semibold text-[var(--color-foreground-muted)]">
        {label}
      </dt>
      <dd
        className={`mt-1 text-[var(--color-foreground)] ${
          mono ? "font-mono text-xs break-all" : "text-sm"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
