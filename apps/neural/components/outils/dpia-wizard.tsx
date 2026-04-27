"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw, Mail, FileSignature } from "lucide-react";

import { WizardShell, ChoiceList } from "./wizard-shell";

interface DpiaInputs {
  projectName?: string;
  finalite?: string;
  baseLegale?: string;
  donnees?: string;
  art22?: string;
  conservation?: string;
  destinataires?: string;
  transferts?: string;
}

const QUESTIONS = [
  {
    id: "projectName" as const,
    label: "Nom du projet ou de l'agent IA",
    help: "Ex : \"Onboarding client banque DORA\", \"Validation press release luxe\".",
    type: "text" as const,
    placeholder: "Onboarding client banque DORA",
  },
  {
    id: "finalite" as const,
    label: "Quelle est la finalité du traitement ?",
    help: "Pourquoi traitez-vous des données personnelles dans ce projet ?",
    type: "single" as const,
    options: [
      { id: "execution-contrat", label: "Exécution d'un contrat avec la personne concernée" },
      { id: "obligation-legale", label: "Respect d'une obligation légale (DORA, Sapin II, etc.)" },
      { id: "interet-legitime", label: "Intérêt légitime (sécurité, fraude, qualité de service)" },
      { id: "consentement", label: "Consentement explicite recueilli" },
      { id: "mission-publique", label: "Mission d'intérêt public" },
    ],
  },
  {
    id: "baseLegale" as const,
    label: "Base légale principale (article 6 RGPD)",
    help: "Tout traitement doit reposer sur l'une des 6 bases légales de l'article 6.",
    type: "single" as const,
    options: [
      { id: "art-6-1-a", label: "Art. 6.1.a — Consentement" },
      { id: "art-6-1-b", label: "Art. 6.1.b — Exécution contractuelle" },
      { id: "art-6-1-c", label: "Art. 6.1.c — Obligation légale" },
      { id: "art-6-1-d", label: "Art. 6.1.d — Sauvegarde intérêts vitaux" },
      { id: "art-6-1-e", label: "Art. 6.1.e — Mission d'intérêt public" },
      { id: "art-6-1-f", label: "Art. 6.1.f — Intérêts légitimes" },
    ],
  },
  {
    id: "donnees" as const,
    label: "Quelles catégories de données traitez-vous ?",
    help: "Sensibilité maximale traitée par l'agent.",
    type: "single" as const,
    options: [
      { id: "publiques", label: "Données publiques uniquement" },
      { id: "identifiantes", label: "Identifiantes (nom, email, téléphone)" },
      { id: "professionnelles", label: "Professionnelles (poste, employeur, transactions)" },
      { id: "sensibles", label: "Sensibles (article 9 RGPD : santé, biométrie, opinions, etc.)" },
      { id: "infractions", label: "Infractions / condamnations (article 10 RGPD)" },
    ],
  },
  {
    id: "art22" as const,
    label: "Le traitement implique-t-il une décision automatisée article 22 RGPD ?",
    help: "Décision produisant un effet juridique ou similaire (recrutement, crédit, accès services).",
    type: "single" as const,
    options: [
      { id: "non", label: "Non — l'agent assiste mais ne décide pas" },
      { id: "oui-supervised", label: "Oui mais avec supervision humaine systématique" },
      { id: "oui-auto", label: "Oui en mode automatique (à reconsidérer)" },
    ],
  },
  {
    id: "conservation" as const,
    label: "Durée de conservation des données traitées par l'agent",
    help: "Le RGPD impose une durée limitée et justifiée.",
    type: "single" as const,
    options: [
      { id: "session", label: "Session uniquement (pas de persistance)" },
      { id: "30j", label: "30 jours" },
      { id: "6m", label: "6 mois" },
      { id: "1an", label: "1 an" },
      { id: "5ans", label: "5 ans (durée légale obligation comptable)" },
      { id: "10ans", label: "10 ans (DORA, Sapin II)" },
    ],
  },
  {
    id: "destinataires" as const,
    label: "Qui sont les destinataires des données ?",
    help: "Liste des personnes/équipes/systèmes qui accèdent aux données traitées.",
    type: "single" as const,
    options: [
      { id: "interne", label: "Équipe interne uniquement (RBAC)" },
      { id: "interne-tiers", label: "Équipe interne + sous-traitants documentés" },
      { id: "interne-clients", label: "Équipe interne + clients finaux" },
      { id: "regulateur", label: "Inclut transmission au régulateur (ACPR, AMF, etc.)" },
    ],
  },
  {
    id: "transferts" as const,
    label: "Y a-t-il des transferts de données hors UE ?",
    help: "Transfert hors EEE = obligations supplémentaires (clauses contractuelles types, etc.).",
    type: "single" as const,
    options: [
      { id: "non", label: "Non — données restent en UE/EEE" },
      { id: "oui-clauses", label: "Oui avec clauses contractuelles types EU 2021" },
      { id: "oui-decision", label: "Oui pays avec décision d'adéquation" },
      { id: "oui-no-frame", label: "Oui sans cadre formalisé (à reconsidérer)" },
    ],
  },
];

function generateDpiaDocument(inputs: DpiaInputs) {
  const sections = [
    {
      title: "1. Description du traitement",
      content: `**Projet** : ${inputs.projectName || "Non spécifié"}\n\n**Finalité** : ${
        inputs.finalite || "Non précisée"
      }\n\n**Base légale (article 6 RGPD)** : ${inputs.baseLegale || "Non précisée"}`,
    },
    {
      title: "2. Données traitées",
      content: `**Catégories** : ${inputs.donnees || "Non précisé"}\n\n**Durée de conservation** : ${
        inputs.conservation || "Non précisée"
      }\n\n**Destinataires** : ${inputs.destinataires || "Non précisé"}`,
    },
    {
      title: "3. Décision automatisée (article 22 RGPD)",
      content:
        inputs.art22 === "oui-auto"
          ? "⚠️ Le traitement implique une décision automatisée à effet juridique ou similaire **sans supervision humaine systématique**. Cette configuration nécessite : (a) consentement explicite OU exécution contractuelle nécessaire OU autorisation EU/EM, (b) information explicite des personnes concernées sur la logique sous-jacente, (c) droit d'opposition et de réexamen humain garantis. Reconsidérer le passage en mode supervisé."
          : inputs.art22 === "oui-supervised"
          ? "Le traitement implique une décision automatisée article 22 mais avec **supervision humaine systématique**. Conformité requise : information article 13/14 sur la logique, possibilité de réexamen humain, droit d'opposition."
          : "Le traitement n'implique pas de décision automatisée article 22 — l'agent assiste sans décider seul.",
    },
    {
      title: "4. Transferts hors UE",
      content:
        inputs.transferts === "non"
          ? "Aucun transfert hors UE/EEE — pas d'obligation supplémentaire au-delà du RGPD général."
          : inputs.transferts === "oui-decision"
          ? "Transfert vers pays bénéficiant d'une décision d'adéquation de la Commission EU. Documenter la décision applicable."
          : inputs.transferts === "oui-clauses"
          ? "Transfert encadré par les clauses contractuelles types EU 2021. Documenter les clauses signées et l'évaluation de l'impact (TIA — Transfer Impact Assessment)."
          : "⚠️ Transfert hors UE sans cadre formalisé — non conforme article 44+ RGPD. Mettre en place clauses contractuelles types ou alternative immédiatement.",
    },
    {
      title: "5. Mesures de sécurité (article 32 RGPD)",
      content:
        "Mesures techniques recommandées :\n• Chiffrement transit (TLS 1.3) et stockage (AES-256)\n• RBAC strict par tenant — cloisonnement physique base de données\n• Audit trail signé sur les décisions agent\n• Rate-limiting et monitoring continu\n• Vulnerability disclosure policy + bug bounty\n• Tests de résilience et bascule fournisseur LLM\n\nMesures organisationnelles : formation équipes, procédures incident, registre RGPD article 30, désignation DPO si requis.",
    },
    {
      title: "6. Droits des personnes concernées",
      content:
        "Procédures à mettre en place :\n• Information article 13/14 (notice de traitement)\n• Droit d'accès (article 15) — délai 1 mois\n• Droit de rectification (article 16)\n• Droit à l'effacement (article 17) — sous réserve obligations légales\n• Droit à la portabilité (article 20) si traitement automatisé sur consentement/contrat\n• Droit d'opposition (article 21)\n• Information sur les décisions automatisées (article 22)",
    },
    {
      title: "7. Risques résiduels & plan d'action",
      content: `Niveau de risque résiduel : ${
        inputs.donnees === "sensibles" || inputs.donnees === "infractions"
          ? "ÉLEVÉ — données sensibles ou infractions"
          : inputs.art22 === "oui-auto"
          ? "ÉLEVÉ — décision automatisée à effet juridique"
          : inputs.transferts === "oui-no-frame"
          ? "ÉLEVÉ — transferts hors UE non encadrés"
          : "MOYEN — traitement standard avec mesures appropriées"
      }\n\nActions recommandées avant déploiement :\n• Validation par DPO\n• Consultation préalable CNIL si risque élevé persistant (article 36)\n• Tests de pénétration sur l'environnement\n• Formation des équipes opérationnelles`,
    },
  ];

  return sections;
}

export function DpiaWizard() {
  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState<DpiaInputs>({});
  const [showResult, setShowResult] = useState(false);

  const totalSteps = QUESTIONS.length;
  const currentQuestion = QUESTIONS[step];
  const isLastQuestion = step === totalSteps - 1;
  const currentValue = inputs[currentQuestion.id];

  const document = useMemo(() => {
    if (!showResult) return null;
    return generateDpiaDocument(inputs);
  }, [showResult, inputs]);

  const handleNext = () => {
    if (isLastQuestion) setShowResult(true);
    else setStep((s) => s + 1);
  };

  const handleReset = () => {
    setStep(0);
    setInputs({});
    setShowResult(false);
  };

  if (showResult && document) {
    return (
      <div className="space-y-6">
        <div className="rounded-[28px] border border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.04] to-violet-500/[0.06] p-6 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                <FileSignature className="h-3 w-3" />
                Brouillon AIPD/DPIA
              </span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white">
                Brouillon généré pour {inputs.projectName || "votre projet"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Document de cadrage RGPD — à valider par votre DPO avant usage opérationnel.
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:bg-white/[0.10]"
            >
              <RotateCcw className="h-3 w-3" /> Refaire
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {document.map((section) => (
            <div
              key={section.title}
              className="rounded-[20px] border border-white/10 bg-white/[0.04] p-6"
            >
              <h3 className="font-display text-lg font-bold tracking-tight text-violet-200">
                {section.title}
              </h3>
              <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-white/75">
                {section.content}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300/70">
            Limites de cet outil
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-white/65">
            <li>• Brouillon généré côté client — aucune donnée stockée par NEURAL</li>
            <li>• Ne remplace pas une vraie AIPD validée par votre DPO</li>
            <li>• Ne remplace pas la consultation préalable CNIL si risque élevé (article 36)</li>
            <li>• Sortie illustrative — ne constitue pas un avis juridique</li>
          </ul>
        </div>

        <div className="rounded-[28px] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.10] via-white/[0.04] to-violet-500/[0.06] p-6 md:p-8">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 text-emerald-300">
                <Mail className="h-4 w-4" />
                <span className="text-[11px] uppercase tracking-[0.18em]">AIPD complète</span>
              </div>
              <h3 className="mt-2 font-display text-xl font-bold tracking-tight text-white">
                Recevoir le brouillon par email
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                Format Word/PDF + checklist DPO + consultation 30 min pour cadrer la suite.
              </p>
            </div>
            <Link
              href="/contact?source=dpia-generator"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500/90 px-6 py-3 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400"
            >
              Recevoir par email
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (currentQuestion.type === "text") {
    return (
      <WizardShell
        currentStep={step}
        totalSteps={totalSteps}
        title={currentQuestion.label}
        helpText={currentQuestion.help}
        onPrev={step > 0 ? () => setStep((s) => s - 1) : undefined}
        onNext={handleNext}
        canGoNext={Boolean((currentValue as string)?.trim())}
        canGoPrev={step > 0}
        isLastStep={isLastQuestion}
      >
        <input
          type="text"
          value={(currentValue as string) || ""}
          onChange={(e) =>
            setInputs((p) => ({ ...p, [currentQuestion.id]: e.target.value }))
          }
          placeholder={currentQuestion.placeholder}
          className="w-full rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-base text-white placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
        />
      </WizardShell>
    );
  }

  return (
    <WizardShell
      currentStep={step}
      totalSteps={totalSteps}
      title={currentQuestion.label}
      helpText={currentQuestion.help}
      onPrev={step > 0 ? () => setStep((s) => s - 1) : undefined}
      onNext={handleNext}
      canGoNext={Boolean(currentValue)}
      canGoPrev={step > 0}
      isLastStep={isLastQuestion}
      nextLabel={isLastQuestion ? "Générer le brouillon" : undefined}
    >
      <ChoiceList
        options={currentQuestion.options || []}
        value={currentValue as string | undefined}
        onChange={(id) => setInputs((p) => ({ ...p, [currentQuestion.id]: id }))}
      />
    </WizardShell>
  );
}
