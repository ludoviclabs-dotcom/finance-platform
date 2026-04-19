"use client";

import { useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error" | "not_configured";

/**
 * NEURAL contact form.
 *
 * Sprint P0 — ne poste plus en mailto (code client) mais en POST /api/contact
 * (Resend côté serveur). L'adresse destinataire n'est plus exposée dans le bundle.
 *
 * États UI :
 *   idle           → formulaire actif
 *   submitting     → bouton disabled
 *   success        → bloc confirmation, bouton disabled
 *   error          → bannière erreur, re-submit possible
 *   not_configured → 503 : Resend non configuré, proposer fallback email manuel
 */
export function ContactForm() {
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [need, setNeed] = useState("");
  const [scope, setScope] = useState("");
  const [state, setState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state === "submitting" || state === "success") return;

    setState("submitting");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, company, need, context: scope }),
      });

      if (res.status === 503) {
        setState("not_configured");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          issues?: unknown;
        };
        setState("error");
        setErrorMsg(
          data.error === "validation"
            ? "Champs invalides — vérifiez nom (≥2), société, besoin (≥2) et contexte (≥10 car.)."
            : "L'envoi a échoué. Réessayez dans un instant.",
        );
        return;
      }
      setState("success");
    } catch {
      setState("error");
      setErrorMsg("Connexion interrompue. Réessayez dans un instant.");
    }
  };

  if (state === "success") {
    return (
      <div className="rounded-[24px] border border-emerald-400/25 bg-emerald-400/[0.06] p-6">
        <h2 className="font-display text-2xl font-bold tracking-tight text-white">
          Message reçu.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/75">
          Merci {name}. Je reviens vers vous sous 24 h ouvrées avec un premier angle de
          cadrage et la suite proposée.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6"
    >
      <h2 className="font-display text-2xl font-bold tracking-tight text-white">
        Demander un cadrage
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-white/65">
        Un formulaire, une réponse sous 24 h ouvrées. Pas de back-office imposé,
        pas de relance automatisée.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-white/80">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Nom
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={2}
            className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-neural-violet/40 focus:outline-none"
            placeholder="Votre nom"
          />
        </label>
        <label className="block text-sm text-white/80">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Société
          </span>
          <input
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            required
            className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-neural-violet/40 focus:outline-none"
            placeholder="Nom de votre société"
          />
        </label>
      </div>

      <label className="mt-4 block text-sm text-white/80">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
          Besoin prioritaire
        </span>
        <input
          value={need}
          onChange={(event) => setNeed(event.target.value)}
          required
          minLength={2}
          className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-neural-violet/40 focus:outline-none"
          placeholder="Exemple : cadrage Luxe Finance, démo transport, audit du projet"
        />
      </label>

      <label className="mt-4 block text-sm text-white/80">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
          Contexte
        </span>
        <textarea
          value={scope}
          onChange={(event) => setScope(event.target.value)}
          required
          minLength={10}
          rows={6}
          className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-neural-violet/40 focus:outline-none"
          placeholder="Décrivez le secteur, le processus à automatiser ou la verticale prioritaire."
        />
      </label>

      {state === "error" && errorMsg ? (
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      ) : null}

      {state === "not_configured" ? (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3 text-sm text-amber-100">
          Envoi indisponible pour le moment. Écrivez directement à{" "}
          <a
            href="mailto:ludoviclabs@gmail.com"
            className="font-semibold underline decoration-amber-300/60 hover:decoration-amber-200"
          >
            ludoviclabs@gmail.com
          </a>
          .
        </div>
      ) : null}

      <div className="mt-6">
        <button
          type="submit"
          disabled={state === "submitting"}
          className="inline-flex items-center justify-center rounded-xl bg-neural-violet px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-neural-violet-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "submitting" ? "Envoi en cours…" : "Envoyer"}
        </button>
      </div>
    </form>
  );
}
