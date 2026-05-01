"use client";

/**
 * Formulaire d'inscription newsletter réutilisable.
 *
 * Variantes :
 *   - "card"   : carte autonome, fond gradient (footer landing)
 *   - "inline" : compact horizontal (à intégrer dans une section existante)
 *
 * Soumission asynchrone vers /api/newsletter avec fail-soft.
 */

import { useState } from "react";

type Variant = "card" | "inline";
type Status = "idle" | "submitting" | "success" | "error";

interface Props {
  variant?: Variant;
  source?: string;
  className?: string;
}

export function NewsletterForm({ variant = "card", source = "landing", className = "" }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("submitting");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("success");
        setMessage(data.message ?? "Inscription enregistrée. À très vite.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Une erreur est survenue, réessayez dans un instant.");
      }
    } catch {
      setStatus("error");
      setMessage("Connexion impossible. Réessayez dans un instant.");
    }
  }

  if (variant === "inline") {
    return (
      <form onSubmit={onSubmit} className={`flex items-center gap-2 ${className}`}>
        <input
          type="email"
          required
          placeholder="vous@société.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 text-sm focus:border-green-500 focus:outline-none"
          aria-label="Adresse email pour la newsletter"
          disabled={status === "submitting"}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50"
        >
          {status === "submitting" ? "…" : "S'inscrire"}
        </button>
        {message && (
          <span
            role="status"
            className={`text-xs ${status === "success" ? "text-green-700" : "text-red-600"}`}
          >
            {message}
          </span>
        )}
      </form>
    );
  }

  return (
    <div className={`rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white p-8 ${className}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-2">
        Newsletter mensuelle CarbonCo
      </p>
      <p className="font-bold text-xl mb-1">Une analyse, un cas concret, zéro spam.</p>
      <p className="text-sm text-neutral-300 mb-5">
        Recevez chaque mois un décryptage CSRD/ESRS et un cas client anonymisé. Désabonnement
        en un clic.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          required
          placeholder="vous@société.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/50 text-sm focus:border-green-400 focus:outline-none"
          aria-label="Adresse email pour la newsletter"
          disabled={status === "submitting"}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="px-5 py-3 rounded-lg bg-green-500 text-white text-sm font-semibold hover:bg-green-400 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {status === "submitting" ? "Inscription…" : "S'inscrire"}
        </button>
      </form>

      {message && (
        <p
          role="status"
          className={`mt-3 text-sm ${status === "success" ? "text-green-300" : "text-red-300"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
