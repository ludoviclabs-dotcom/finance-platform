"use client";

/**
 * Formulaire de candidature partenaire (T7.5) — POST /partners/apply.
 * Champ honeypot invisible (« website ») : les bots qui le remplissent sont
 * silencieusement ignorés côté API.
 */

import { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const CLIENT_RANGES = ["1 à 5 dossiers", "5 à 20 dossiers", "Plus de 20 dossiers"];

export function PartnerApplyForm() {
  const [cabinetName, setCabinetName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [siret, setSiret] = useState("");
  const [clientsEstimate, setClientsEstimate] = useState(CLIENT_RANGES[0]);
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cabinetName.trim() || !email.trim()) {
      setErrorMsg("Le nom du cabinet et l'adresse e-mail sont obligatoires.");
      return;
    }
    setState("sending");
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/partners/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cabinet_name: cabinetName.trim(),
          contact_name: contactName.trim() || null,
          email: email.trim(),
          siret: siret.trim() || null,
          clients_estimate: clientsEstimate,
          message: message.trim() || null,
          website: website || null,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null);
        throw new Error(
          Array.isArray(detail?.detail)
            ? detail.detail[0]?.msg ?? "Vérifiez les champs saisis."
            : detail?.detail ?? "Vérifiez les champs saisis."
        );
      }
      setState("done");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Envoi impossible — réessayez.");
    }
  };

  if (state === "done") {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 p-6">
        <p className="font-bold text-neutral-900 mb-1">Candidature bien reçue ✓</p>
        <p className="text-sm text-neutral-700">
          Merci — nous revenons vers vous sous quelques jours ouvrés à l&apos;adresse indiquée.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-neutral-200 p-6 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <label className="text-xs font-semibold text-neutral-600">
          Nom du cabinet *
          <input
            type="text"
            value={cabinetName}
            onChange={(e) => setCabinetName(e.target.value)}
            required
            className="block mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800 font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-neutral-600">
          E-mail professionnel *
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="block mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800 font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-neutral-600">
          Votre nom
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="block mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800 font-normal"
          />
        </label>
        <label className="text-xs font-semibold text-neutral-600">
          SIRET (optionnel)
          <input
            type="text"
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            inputMode="numeric"
            placeholder="14 chiffres"
            className="block mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800 font-normal"
          />
        </label>
      </div>

      <label className="block text-xs font-semibold text-neutral-600">
        Dossiers clients concernés par l&apos;ESG
        <select
          value={clientsEstimate}
          onChange={(e) => setClientsEstimate(e.target.value)}
          className="block mt-1 w-full md:w-64 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800 font-normal bg-white"
        >
          {CLIENT_RANGES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-semibold text-neutral-600">
        Votre contexte (optionnel)
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Typologie de clients, demandes ESG reçues, outils actuels…"
          className="block mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-800 font-normal"
        />
      </label>

      {/* Honeypot — invisible pour les humains, rempli par les bots */}
      <input
        type="text"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}

      <button
        type="submit"
        disabled={state === "sending"}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-40"
      >
        {state === "sending" ? "Envoi…" : "Envoyer ma candidature"}
      </button>
    </form>
  );
}
