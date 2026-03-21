"use client";

import { useSimulateurStore } from "@/lib/store/simulateur-store";
import { ChevronLeft, ChevronRight, Play, RotateCcw } from "lucide-react";

/* ── helpers ─────────────────────────────────────────────────────────────── */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-foreground-muted">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-lg border border-border bg-[var(--color-surface)] px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--color-accent,#60a5fa)] transition-colors"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-[var(--color-surface)] px-3 py-2 text-sm text-foreground outline-none focus:border-[var(--color-accent,#60a5fa)] transition-colors"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ── Step 1 — Identit\u00e9 ──────────────────────────────────────────────────── */

function StepIdentite() {
  const { client, updateIdentite } = useSimulateurStore();
  const id = client.identite;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Field label="Civilit\u00e9">
        <Select
          value={id.civilite}
          onChange={(v) => updateIdentite({ civilite: v as "M" | "Mme" })}
          options={[
            { value: "M", label: "Monsieur" },
            { value: "Mme", label: "Madame" },
          ]}
        />
      </Field>
      <Field label="Nom">
        <Input value={id.nom} onChange={(v) => updateIdentite({ nom: v })} />
      </Field>
      <Field label="Pr\u00e9nom">
        <Input value={id.prenom} onChange={(v) => updateIdentite({ prenom: v })} />
      </Field>
      <Field label="Date de naissance">
        <Input
          type="date"
          value={id.dateNaissance}
          onChange={(v) => {
            const age = Math.floor(
              (Date.now() - new Date(v).getTime()) / (365.25 * 24 * 3600 * 1000),
            );
            updateIdentite({ dateNaissance: v, age });
          }}
        />
      </Field>
      <Field label="\u00C2ge">
        <Input type="number" value={id.age} onChange={(v) => updateIdentite({ age: +v })} />
      </Field>
      <Field label="Situation familiale">
        <Select
          value={id.situationFamiliale}
          onChange={(v) => {
            const sit = v as typeof id.situationFamiliale;
            let parts = 1;
            if (sit === "marie" || sit === "pacse") parts = 2;
            parts += id.nbEnfants <= 2 ? id.nbEnfants * 0.5 : 1 + (id.nbEnfants - 2);
            updateIdentite({ situationFamiliale: sit, nbParts: parts });
          }}
          options={[
            { value: "celibataire", label: "C\u00e9libataire" },
            { value: "marie", label: "Mari\u00e9(e)" },
            { value: "pacse", label: "Pacs\u00e9(e)" },
            { value: "divorce", label: "Divorc\u00e9(e)" },
            { value: "veuf", label: "Veuf/Veuve" },
          ]}
        />
      </Field>
      <Field label="Nombre d'enfants">
        <Input
          type="number"
          value={id.nbEnfants}
          onChange={(v) => {
            const nb = +v;
            const base = id.situationFamiliale === "marie" || id.situationFamiliale === "pacse" ? 2 : 1;
            const parts = base + (nb <= 2 ? nb * 0.5 : 1 + (nb - 2));
            updateIdentite({ nbEnfants: nb, nbParts: parts });
          }}
        />
      </Field>
      <Field label="Parts fiscales">
        <Input
          type="number"
          value={id.nbParts}
          onChange={(v) => updateIdentite({ nbParts: +v })}
        />
      </Field>
      <Field label="Revenu conjoint net">
        <Input
          type="number"
          value={id.conjointRevenu}
          onChange={(v) => updateIdentite({ conjointRevenu: +v })}
          placeholder="0"
        />
      </Field>
    </div>
  );
}

/* ── Step 2 — Activit\u00e9 ─────────────────────────────────────────────────── */

function StepActivite() {
  const { client, updateActivite } = useSimulateurStore();
  const a = client.activite;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Field label="Profession">
        <Select
          value={a.profession}
          onChange={(v) => updateActivite({ profession: v })}
          options={[
            { value: "M\u00e9decin", label: "M\u00e9decin" },
            { value: "Dentiste", label: "Dentiste" },
            { value: "Infirmier", label: "Infirmier(e)" },
            { value: "Kin\u00e9", label: "Kin\u00e9sith\u00e9rapeute" },
            { value: "Pharmacien", label: "Pharmacien(ne)" },
            { value: "Sage-femme", label: "Sage-femme" },
            { value: "Podologue", label: "Podologue" },
            { value: "Orthophoniste", label: "Orthophoniste" },
            { value: "Autre PL", label: "Autre PL Sant\u00e9" },
          ]}
        />
      </Field>
      <Field label="Conventionnement">
        <Select
          value={a.conventionnement}
          onChange={(v) => updateActivite({ conventionnement: v as "S1" | "S2" | "NC" })}
          options={[
            { value: "S1", label: "Secteur 1" },
            { value: "S2", label: "Secteur 2" },
            { value: "NC", label: "Non conventionn\u00e9" },
          ]}
        />
      </Field>
      <Field label="Forme juridique">
        <Select
          value={a.formeJuridique}
          onChange={(v) => updateActivite({ formeJuridique: v as typeof a.formeJuridique })}
          options={[
            { value: "EI_BNC", label: "EI / BNC" },
            { value: "EI_IS", label: "EI option IS" },
            { value: "SELARL", label: "SELARL" },
            { value: "SELAS", label: "SELAS" },
            { value: "MICRO", label: "Micro-BNC" },
          ]}
        />
      </Field>
      <Field label="BNC N-2">
        <Input type="number" value={a.bncN2} onChange={(v) => updateActivite({ bncN2: +v })} />
      </Field>
      <Field label="BNC N-1">
        <Input type="number" value={a.bncN1} onChange={(v) => updateActivite({ bncN1: +v })} />
      </Field>
      <Field label="BNC N (estim\u00e9)">
        <Input type="number" value={a.bncN} onChange={(v) => updateActivite({ bncN: +v })} />
      </Field>
      {(a.formeJuridique === "SELARL" || a.formeJuridique === "SELAS") && (
        <>
          <Field label="Capital social">
            <Input type="number" value={a.capitalSocial} onChange={(v) => updateActivite({ capitalSocial: +v })} />
          </Field>
          <Field label="Compte courant associ\u00e9">
            <Input type="number" value={a.cca} onChange={(v) => updateActivite({ cca: +v })} />
          </Field>
        </>
      )}
    </div>
  );
}

/* ── Step 3 — Patrimoine ─────────────────────────────────────────────────── */

function StepPatrimoine() {
  const { client, updatePatrimoine } = useSimulateurStore();
  const p = client.patrimoine;

  const recalcTotals = (patch: Partial<typeof p>) => {
    const merged = { ...p, ...patch };
    const totalActifs =
      merged.rpValeur + merged.locatifValeur + merged.sciValeur +
      merged.scpiValeur + merged.opciValeur + merged.livretA +
      merged.ldds + merged.av1 + merged.av2 + merged.per +
      merged.pea + merged.cto + merged.crypto;
    const totalPassifs = merged.emprunt1CRD + merged.emprunt2CRD;
    updatePatrimoine({ ...patch, totalActifs, totalPassifs, patrimoineNet: totalActifs - totalPassifs });
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-foreground-muted mb-3">Actifs immobiliers</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="R\u00e9sidence principale">
            <Input type="number" value={p.rpValeur} onChange={(v) => recalcTotals({ rpValeur: +v })} />
          </Field>
          <Field label="Locatif">
            <Input type="number" value={p.locatifValeur} onChange={(v) => recalcTotals({ locatifValeur: +v })} />
          </Field>
          <Field label="SCI">
            <Input type="number" value={p.sciValeur} onChange={(v) => recalcTotals({ sciValeur: +v })} />
          </Field>
          <Field label="SCPI">
            <Input type="number" value={p.scpiValeur} onChange={(v) => recalcTotals({ scpiValeur: +v })} />
          </Field>
          <Field label="OPCI">
            <Input type="number" value={p.opciValeur} onChange={(v) => recalcTotals({ opciValeur: +v })} />
          </Field>
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-foreground-muted mb-3">Actifs financiers</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Livret A">
            <Input type="number" value={p.livretA} onChange={(v) => recalcTotals({ livretA: +v })} />
          </Field>
          <Field label="LDDS">
            <Input type="number" value={p.ldds} onChange={(v) => recalcTotals({ ldds: +v })} />
          </Field>
          <Field label="AV n\u00b01">
            <Input type="number" value={p.av1} onChange={(v) => recalcTotals({ av1: +v })} />
          </Field>
          <Field label="AV n\u00b02">
            <Input type="number" value={p.av2} onChange={(v) => recalcTotals({ av2: +v })} />
          </Field>
          <Field label="PER">
            <Input type="number" value={p.per} onChange={(v) => recalcTotals({ per: +v })} />
          </Field>
          <Field label="PEA">
            <Input type="number" value={p.pea} onChange={(v) => recalcTotals({ pea: +v })} />
          </Field>
          <Field label="CTO">
            <Input type="number" value={p.cto} onChange={(v) => recalcTotals({ cto: +v })} />
          </Field>
          <Field label="Crypto">
            <Input type="number" value={p.crypto} onChange={(v) => recalcTotals({ crypto: +v })} />
          </Field>
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium text-foreground-muted mb-3">Passifs</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Emprunt 1 CRD">
            <Input type="number" value={p.emprunt1CRD} onChange={(v) => recalcTotals({ emprunt1CRD: +v })} />
          </Field>
          <Field label="Emprunt 1 mensualit\u00e9">
            <Input type="number" value={p.emprunt1Mensualite} onChange={(v) => updatePatrimoine({ emprunt1Mensualite: +v })} />
          </Field>
          <Field label="Emprunt 2 CRD">
            <Input type="number" value={p.emprunt2CRD} onChange={(v) => recalcTotals({ emprunt2CRD: +v })} />
          </Field>
          <Field label="Emprunt 2 mensualit\u00e9">
            <Input type="number" value={p.emprunt2Mensualite} onChange={(v) => updatePatrimoine({ emprunt2Mensualite: +v })} />
          </Field>
        </div>
      </div>
      <div className="flex gap-6 text-sm">
        <span className="text-foreground-muted">Actifs : <strong className="text-foreground tabnum">{p.totalActifs.toLocaleString("fr-FR")} \u20AC</strong></span>
        <span className="text-foreground-muted">Passifs : <strong className="text-foreground tabnum">{p.totalPassifs.toLocaleString("fr-FR")} \u20AC</strong></span>
        <span className="text-foreground-muted">Net : <strong className="text-emerald-400 tabnum">{p.patrimoineNet.toLocaleString("fr-FR")} \u20AC</strong></span>
      </div>
    </div>
  );
}

/* ── Step 4 — Contrats ───────────────────────────────────────────────────── */

function StepContrats() {
  const { client, updateContrats } = useSimulateurStore();
  const c = client.contrats;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Field label="IJ pr\u00e9voyance (\u20AC/jour)">
        <Input type="number" value={c.prevoyanceIJJour} onChange={(v) => updateContrats({ prevoyanceIJJour: +v })} />
      </Field>
      <Field label="Franchise pr\u00e9voyance (jours)">
        <Input type="number" value={c.prevoyanceFranchise} onChange={(v) => updateContrats({ prevoyanceFranchise: +v })} />
      </Field>
      <Field label="Capital d\u00e9c\u00e8s">
        <Input type="number" value={c.prevoyanceCapitalDeces} onChange={(v) => updateContrats({ prevoyanceCapitalDeces: +v })} />
      </Field>
      <Field label="Cotisation pr\u00e9voyance (\u20AC/mois)">
        <Input type="number" value={c.prevoyanceCotisation} onChange={(v) => updateContrats({ prevoyanceCotisation: +v })} />
      </Field>
      <Field label="Compl\u00e9mentaire sant\u00e9 (\u20AC/mois)">
        <Input type="number" value={c.complementaireSante} onChange={(v) => updateContrats({ complementaireSante: +v })} />
      </Field>
      <Field label="PER encours actuel">
        <Input type="number" value={c.retraiteSupplementaireEncours} onChange={(v) => updateContrats({ retraiteSupplementaireEncours: +v })} />
      </Field>
      <Field label="PER versement annuel">
        <Input type="number" value={c.retraiteSupplementaireVersement} onChange={(v) => updateContrats({ retraiteSupplementaireVersement: +v })} />
      </Field>
    </div>
  );
}

/* ── Step 5 — Objectifs ──────────────────────────────────────────────────── */

function StepObjectifs() {
  const { client, updateObjectifs } = useSimulateurStore();
  const o = client.objectifs;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Field label="\u00C2ge d\u00e9part retraite">
        <Input type="number" value={o.ageDepartRetraite} onChange={(v) => updateObjectifs({ ageDepartRetraite: +v })} />
      </Field>
      <Field label="Revenu cible retraite (\u20AC/mois)">
        <Input type="number" value={o.revenuCibleMensuel} onChange={(v) => updateObjectifs({ revenuCibleMensuel: +v })} />
      </Field>
      <Field label="% maintien revenu (pr\u00e9voyance)">
        <Input type="number" value={o.pourcentageMaintienRevenu} onChange={(v) => updateObjectifs({ pourcentageMaintienRevenu: +v })} />
      </Field>
      <Field label="Charges fixes mensuelles">
        <Input type="number" value={o.chargesFixes} onChange={(v) => updateObjectifs({ chargesFixes: +v })} />
      </Field>
      <Field label="Franchise souhait\u00e9e (jours)">
        <Input type="number" value={o.franchiseSouhaitee} onChange={(v) => updateObjectifs({ franchiseSouhaitee: +v })} />
      </Field>
      <Field label="Profil risque">
        <Select
          value={o.profilRisque}
          onChange={(v) => updateObjectifs({ profilRisque: v as typeof o.profilRisque })}
          options={[
            { value: "conservateur", label: "Conservateur" },
            { value: "equilibre", label: "\u00c9quilibr\u00e9" },
            { value: "dynamique", label: "Dynamique" },
          ]}
        />
      </Field>
      <Field label="Capacit\u00e9 \u00e9pargne (\u20AC/mois)">
        <Input type="number" value={o.capaciteEpargneMensuelle} onChange={(v) => updateObjectifs({ capaciteEpargneMensuelle: +v })} />
      </Field>
    </div>
  );
}

/* ── Main form with steps ────────────────────────────────────────────────── */

const STEPS = [
  { title: "Identit\u00e9", component: StepIdentite },
  { title: "Activit\u00e9 & Revenus", component: StepActivite },
  { title: "Patrimoine", component: StepPatrimoine },
  { title: "Contrats existants", component: StepContrats },
  { title: "Objectifs", component: StepObjectifs },
];

export function FormMultiSteps() {
  const { currentStep, setStep, runAllCalculations, resetAll, calculsDone } =
    useSimulateurStore();

  const StepComponent = STEPS[currentStep]?.component ?? StepIdentite;

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* Step indicators */}
      <div className="flex border-b border-border overflow-x-auto">
        {STEPS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => setStep(i)}
            className={`flex-1 min-w-[120px] px-4 py-3 text-xs font-medium transition-colors ${
              i === currentStep
                ? "text-foreground border-b-2 border-[var(--color-accent,#60a5fa)]"
                : "text-foreground-muted hover:text-foreground"
            }`}
          >
            <span className="opacity-50 mr-1">{i + 1}.</span> {s.title}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="p-6">
        <StepComponent />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between p-4 border-t border-border">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="flex items-center gap-1 px-4 py-2 text-sm text-foreground-muted hover:text-foreground disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Pr\u00e9c\u00e9dent
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetAll}
            className="flex items-center gap-1 px-4 py-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> R\u00e9initialiser
          </button>

          {currentStep === STEPS.length - 1 ? (
            <button
              type="button"
              onClick={runAllCalculations}
              className="flex items-center gap-1 px-5 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
            >
              <Play className="h-4 w-4" /> Lancer les calculs
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep(Math.min(STEPS.length - 1, currentStep + 1))}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-[var(--color-accent,#60a5fa)] hover:opacity-90 text-white rounded-lg transition-colors"
            >
              Suivant <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {calculsDone && (
        <div className="px-4 pb-4">
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-sm text-emerald-400">
            Calculs termin\u00e9s avec succ\u00e8s. Faites d\u00e9filer pour voir les r\u00e9sultats.
          </div>
        </div>
      )}
    </div>
  );
}
