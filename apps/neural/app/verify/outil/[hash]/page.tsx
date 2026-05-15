import Link from "next/link";
import { ShieldCheck, ShieldAlert, AlertTriangle, ArrowLeft, Clock, Hash } from "lucide-react";

import { lookupReceipt } from "@/lib/outils/receipts";
import { OUTIL_ROUTES } from "@/lib/outils/sign";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ hash: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { hash } = await params;
  return {
    title: `Vérification ${hash.slice(0, 8)}… — NEURAL`,
    description: "Vérification publique d'une synthèse signée NEURAL.",
    robots: { index: false, follow: false },
  };
}

const HASH_RE = /^[a-f0-9]{64}$/;

const FR_DATE = new Intl.DateTimeFormat("fr-FR", {
  year: "numeric",
  month: "long",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function VerifyOutilHashPage({ params }: PageProps) {
  const { hash } = await params;
  const normalized = hash.trim().toLowerCase();

  if (!HASH_RE.test(normalized)) {
    return <InvalidFormat raw={hash} />;
  }

  const receipt = await lookupReceipt(normalized);

  if (!receipt) {
    return <UnknownHash hash={normalized} />;
  }

  return <VerifiedReceipt receipt={receipt} hash={normalized} />;
}

function VerifiedReceipt({
  receipt,
  hash,
}: {
  receipt: NonNullable<Awaited<ReturnType<typeof lookupReceipt>>>;
  hash: string;
}) {
  const generatedAt = FR_DATE.format(receipt.generatedAt);
  const storedAt = FR_DATE.format(receipt.createdAt);
  const toolHref = OUTIL_ROUTES[receipt.tool];

  return (
    <Shell>
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/[0.12] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
        <ShieldCheck className="h-3.5 w-3.5" />
        Synthèse vérifiée
      </span>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">
        Ce hash a bien été émis par NEURAL.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
        La synthèse correspondante a été générée par l&apos;outil ci-dessous. Les données
        d&apos;origine (vos réponses) ne sont jamais stockées — seul un résumé non sensible
        l&apos;est, pour permettre cette vérification.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Card label="Outil" value={receipt.toolLabel} action={{ href: toolHref, label: "Refaire l'outil" }} />
        <Card label="Résultat" value={receipt.resultLabel} />
        <Card
          label="Généré le"
          value={`${generatedAt} UTC`}
          icon={<Clock className="h-4 w-4 text-emerald-300" aria-hidden="true" />}
        />
        <Card
          label="Hash SHA-256"
          value={hash}
          mono
          icon={<Hash className="h-4 w-4 text-emerald-300" aria-hidden="true" />}
        />
      </div>

      <p className="mt-6 text-xs text-white/40">
        Enregistré dans le registre NEURAL le {storedAt} UTC.
      </p>

      <BackToIndex />
    </Shell>
  );
}

function UnknownHash({ hash }: { hash: string }) {
  return (
    <Shell>
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
        <ShieldAlert className="h-3.5 w-3.5" />
        Hash inconnu
      </span>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">
        Aucune synthèse trouvée pour ce hash.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
        Le format est valide mais le hash n&apos;apparaît pas dans le registre NEURAL. Plusieurs
        explications possibles :
      </p>
      <ul className="mt-4 space-y-2 text-sm leading-relaxed text-white/65">
        <li className="flex gap-2">
          <span className="text-amber-300">•</span>
          La synthèse a été générée avant la mise en place du registre public (mai 2026).
        </li>
        <li className="flex gap-2">
          <span className="text-amber-300">•</span>
          Le hash a été altéré ou recopié avec une erreur. Vérifiez chaque caractère.
        </li>
        <li className="flex gap-2">
          <span className="text-amber-300">•</span>
          Le PDF n&apos;a pas été émis par NEURAL — il ne porte donc pas de garantie de
          provenance.
        </li>
      </ul>
      <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Hash vérifié</p>
        <p className="mt-1 break-all font-mono text-xs text-white/60">{hash}</p>
      </div>
      <BackToIndex />
    </Shell>
  );
}

function InvalidFormat({ raw }: { raw: string }) {
  return (
    <Shell>
      <span className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-400/[0.10] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-red-200">
        <AlertTriangle className="h-3.5 w-3.5" />
        Format invalide
      </span>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight md:text-5xl">
        Ce hash ne respecte pas le format SHA-256.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
        Un hash SHA-256 valide compte exactement 64 caractères hexadécimaux (0-9, a-f). La valeur
        reçue ne correspond pas à ce format — recopiez-la précisément depuis le pied de page de la
        synthèse.
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

function Card({
  label,
  value,
  mono,
  icon,
  action,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5">
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
      {action ? (
        <Link
          href={action.href}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
        >
          {action.label} →
        </Link>
      ) : null}
    </div>
  );
}

function BackToIndex() {
  return (
    <Link
      href="/verify/outil"
      className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.08]"
    >
      <ArrowLeft className="h-3 w-3" />
      Vérifier un autre hash
    </Link>
  );
}
