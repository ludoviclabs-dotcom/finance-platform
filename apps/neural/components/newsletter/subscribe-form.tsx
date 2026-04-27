"use client";

import { useState } from "react";
import { Mail, Send, CheckCircle2, AlertTriangle } from "lucide-react";

type Status = "idle" | "submitting" | "success" | "error";

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setMessage("Adresse email invalide.");
      return;
    }
    setStatus("submitting");

    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("success");
        setMessage("Inscription enregistrée. Vérifiez votre boîte email pour confirmer.");
        setEmail("");
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setMessage(data.message || "Erreur lors de l'inscription. Réessayez plus tard.");
      }
    } catch {
      setStatus("error");
      setMessage("Erreur réseau. Réessayez plus tard.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 md:p-8"
    >
      <div className="flex items-center gap-2 text-violet-300">
        <Mail className="h-4 w-4" />
        <span className="text-[11px] uppercase tracking-[0.18em]">S&apos;inscrire</span>
      </div>
      <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-white">
        Recevoir la newsletter NEURAL
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-white/65">
        Une édition par mois. Cadrage AI Act, retours d&apos;expérience secteurs régulés EU,
        nouveautés produit. Pas de relance commerciale.
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@entreprise.fr"
          disabled={status === "submitting"}
          className="flex-1 rounded-2xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none focus:ring-2 focus:ring-violet-400/30 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-neural-violet px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-neural-violet/20 transition-all hover:bg-neural-violet-dark disabled:opacity-50 disabled:hover:bg-neural-violet"
        >
          {status === "submitting" ? "Envoi..." : "S'inscrire"}
          {status !== "submitting" ? <Send className="h-4 w-4" /> : null}
        </button>
      </div>

      {status === "success" ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
          <p className="text-sm leading-relaxed text-emerald-100/85">{message}</p>
        </div>
      ) : null}
      {status === "error" ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
          <p className="text-sm leading-relaxed text-amber-100/85">{message}</p>
        </div>
      ) : null}

      <ul className="mt-6 space-y-2 border-t border-white/8 pt-4 text-xs text-white/55">
        <li>• Désinscription en 1 clic dans chaque email</li>
        <li>• Données stockées chez Resend (région EU)</li>
        <li>• Pas de partage avec des tiers, jamais</li>
        <li>• Pas de retargeting publicitaire</li>
      </ul>
    </form>
  );
}
