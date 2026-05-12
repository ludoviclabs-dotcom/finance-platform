"use client";

import { useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error" | "not_configured";

export function ContactForm() {
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
        body: JSON.stringify({ name, email, phone, company, need, context: scope }),
      });

      if (res.status === 503) {
        setState("not_configured");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setState("error");
        setErrorMsg(
          data.error === "validation"
            ? "Champs invalides: vérifiez nom, email, société, besoin et contexte."
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
          Merci {name}. La demande est transmise avec votre email de réponse. Je
          reviens vers vous sous 24 h ouvrées avec un premier angle de cadrage.
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
        Email obligatoire, téléphone optionnel. Pas de CRM automatisé ni de
        relance séquencée.
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
            autoComplete="name"
            className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-neural-violet/40 focus:outline-none"
            placeholder="Votre nom"
          />
        </label>
        <label className="block text-sm text-white/80">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Email
          </span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            autoComplete="email"
            className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-neural-violet/40 focus:outline-none"
            placeholder="vous@entreprise.fr"
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
            autoComplete="organization"
            className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-neural-violet/40 focus:outline-none"
            placeholder="Nom de votre société"
          />
        </label>
        <label className="block text-sm text-white/80">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
            Téléphone optionnel
          </span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            autoComplete="tel"
            className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-neural-violet/40 focus:outline-none"
            placeholder="+33..."
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
          placeholder="Exemple: Proof Audit, agent Luxe Finance, pilot banque"
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
          placeholder="Décrivez le secteur, le processus à cadrer, les données disponibles et la contrainte principale."
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

      <button
        type="submit"
        disabled={state === "submitting"}
        className="mt-6 inline-flex items-center justify-center rounded-xl bg-neural-violet px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-neural-violet-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "submitting" ? "Envoi en cours..." : "Envoyer la demande"}
      </button>
    </form>
  );
}
