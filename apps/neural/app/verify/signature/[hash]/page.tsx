import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  ArrowLeft,
  Hash,
  Database,
} from "lucide-react";

import { lookupSignature, type LookupOutcome } from "@/lib/gateway/lookup";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ hash: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { hash } = await params;
  return {
    title: `Vérification signature ${hash.slice(0, 8)}… — NEURAL`,
    description: "Vérification publique d'une signature Operator Gateway.",
    robots: { index: false, follow: false },
  };
}

const FR_DATE = new Intl.DateTimeFormat("fr-FR", {
  year: "numeric",
  month: "long",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const DECISION_LABELS: Record<string, string> = {
  ALLOW: "Autorisé",
  REVIEW: "Mis en revue",
  BLOCK: "Bloqué",
};

export default async function VerifySignaturePage({ params }: PageProps) {
  const { hash } = await params;
  const result = await lookupSignature(hash);
  return renderOutcome(result, hash);
}

function renderOutcome(result: LookupOutcome, rawHash: string) {
  switch (result.kind) {
    case "invalid-format":
      return <InvalidFormat raw={rawHash} />;
    case "db-unavailable":
      return <DbUnavailable hash={rawHash.trim().toLowerCase()} />;
    case "unknown":
      return <UnknownHash hash={rawHash.trim().toLowerCase()} />;
    case "tampered":
      return <Tampered row={result.row} recomputed={result.recomputed} />;
    case "verified":
      return <Verified row={result.row} />;
  }
}

function Verified({ row }: { row: import("@/lib/gateway/lookup").SignatureRow }) {
  return (
    <Shell>
      <Badge tone="emerald" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
        Signature vérifiée
      </Badge>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">
        Cette décision est intègre.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
        La signature recalculée à partir des données stockées est identique à celle enregistrée :
        l&apos;évènement n&apos;a pas été altéré depuis son écriture dans le registre.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Card label="Agent" value={`${row.agentId} · ${row.agentVersion}`} />
        <Card label="Décision" value={DECISION_LABELS[row.decision] ?? row.decision} />
        <Card label="Modèle" value={row.model ?? "—"} />
        <Card label="Tenant" value={row.tenantId} />
        <Card
          label="Séquence"
          value={`#${row.sequence}`}
          icon={<Database className="h-4 w-4 text-emerald-300" aria-hidden="true" />}
        />
        <Card
          label="Enregistré le"
          value={`${FR_DATE.format(row.recordedAt)} UTC`}
        />
        <Card label="Outcome" value={row.outcome} fullWidth />
        <Card
          label="Signature SHA-256"
          value={row.signature}
          mono
          icon={<Hash className="h-4 w-4 text-emerald-300" aria-hidden="true" />}
          fullWidth
        />
        <Card label="Signature précédente" value={row.prevSignature || "(genesis)"} mono fullWidth />
      </div>
      <BackToIndex />
    </Shell>
  );
}

function Tampered({
  row,
  recomputed,
}: {
  row: import("@/lib/gateway/lookup").SignatureRow;
  recomputed: string;
}) {
  return (
    <Shell>
      <Badge tone="red" icon={<ShieldX className="h-3.5 w-3.5" />}>
        Signature corrompue
      </Badge>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">
        Cet évènement a été altéré.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
        L&apos;évènement existe dans le registre mais la signature recalculée à partir de ses
        champs stockés ne correspond pas à la signature enregistrée. Cela signifie qu&apos;au moins
        un champ a été modifié après l&apos;écriture — la chaîne est compromise.
      </p>
      <div className="mt-6 space-y-3">
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-red-300/70">Signature stockée</p>
          <p className="mt-1 break-all font-mono text-xs text-white/80">{row.signature}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Signature recalculée</p>
          <p className="mt-1 break-all font-mono text-xs text-white/80">{recomputed}</p>
        </div>
      </div>
      <BackToIndex />
    </Shell>
  );
}

function UnknownHash({ hash }: { hash: string }) {
  return (
    <Shell>
      <Badge tone="amber" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
        Signature inconnue
      </Badge>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">
        Aucun évènement trouvé pour cette signature.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
        Le format est valide mais aucune décision portant cette signature n&apos;est enregistrée
        dans le registre NEURAL.
      </p>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Hash vérifié</p>
        <p className="mt-1 break-all font-mono text-xs text-white/60">{hash}</p>
      </div>
      <BackToIndex />
    </Shell>
  );
}

function DbUnavailable({ hash }: { hash: string }) {
  return (
    <Shell>
      <Badge tone="amber" icon={<ShieldAlert className="h-3.5 w-3.5" />}>
        Registre indisponible
      </Badge>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">
        Le registre Operator Gateway n&apos;est pas joignable.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
        Le format du hash est valide mais le registre signé n&apos;est pas disponible pour
        confirmer cette signature. Ressayez dans quelques minutes ou consultez le statut public.
      </p>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Hash fourni</p>
        <p className="mt-1 break-all font-mono text-xs text-white/60">{hash}</p>
      </div>
      <Link
        href="/status"
        className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08]"
      >
        Voir le statut public
      </Link>
      <BackToIndex />
    </Shell>
  );
}

function InvalidFormat({ raw }: { raw: string }) {
  return (
    <Shell>
      <Badge tone="red" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
        Format invalide
      </Badge>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">
        Cette signature ne respecte pas le format SHA-256.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
        Une signature SHA-256 valide compte exactement 64 caractères hexadécimaux (0-9, a-f).
        Recopiez précisément la valeur depuis le journal Operator Gateway.
      </p>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Valeur reçue</p>
        <p className="mt-1 break-all font-mono text-xs text-white/60">{raw.slice(0, 256)}</p>
      </div>
      <BackToIndex />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-hidden bg-gradient-neural text-white">
      <div className="absolute -left-40 top-20 h-[360px] w-[360px] rounded-full bg-emerald-500/10 blur-[140px]" />
      <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-violet-500/8 blur-[120px]" />
      <section className="relative px-8 pb-24 pt-30 md:px-12 lg:pt-36">
        <div className="mx-auto max-w-[820px]">{children}</div>
      </section>
    </div>
  );
}

function Badge({
  tone,
  icon,
  children,
}: {
  tone: "emerald" | "amber" | "red";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-400/40 bg-emerald-400/[0.12] text-emerald-200"
      : tone === "amber"
        ? "border-amber-400/30 bg-amber-400/[0.10] text-amber-200"
        : "border-red-500/30 bg-red-500/[0.10] text-red-200";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${cls}`}
    >
      {icon}
      {children}
    </span>
  );
}

function Card({
  label,
  value,
  mono,
  icon,
  fullWidth,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border border-white/10 bg-white/[0.04] p-5 ${
        fullWidth ? "md:col-span-2" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">{label}</p>
      </div>
      <p
        className={`mt-3 text-base font-semibold text-white ${
          mono ? "break-all font-mono text-sm" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function BackToIndex() {
  return (
    <Link
      href="/verify/signature"
      className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08]"
    >
      <ArrowLeft className="h-3 w-3" />
      Vérifier une autre signature
    </Link>
  );
}
