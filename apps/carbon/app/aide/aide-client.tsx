"use client";

/**
 * Centre d'aide CarbonCo — recherche client-side full-text + filtre catégorie.
 *
 * On garde le composant 100 % côté client pour éviter un round-trip serveur
 * sur chaque frappe. Avec ~12 entrées la performance n'est pas un sujet, mais
 * cette structure permettra de scaler à 50-100 entrées sans changer l'UX.
 *
 * Pas d'effet de bord : aucune métrique envoyée, aucun cookie, aucun appel
 * réseau.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronDown } from "lucide-react";
import {
  FAQ_ENTRIES,
  FAQ_CATEGORIES,
  type FaqCategory,
} from "@/lib/faq-entries";

export function AideClient() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FaqCategory | "Tous">("Tous");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FAQ_ENTRIES.filter((e) => {
      if (activeCategory !== "Tous" && e.category !== activeCategory) return false;
      if (!q) return true;
      return (
        e.question.toLowerCase().includes(q) ||
        e.answer.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    });
  }, [query, activeCategory]);

  return (
    <main className="bg-white min-h-screen">
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-sm font-extrabold tracking-tighter text-black">
            Carbon<span className="text-green-600">&amp;</span>Co
          </Link>
          <Link href="/" className="text-sm text-neutral-600 hover:text-neutral-900">
            ← Accueil
          </Link>
        </div>
      </div>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-green-600 mb-4">
          Centre d&apos;aide
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tighter text-neutral-900 mb-4">
          Comment pouvons-nous vous aider&nbsp;?
        </h1>
        <p className="text-lg text-neutral-600 mb-10 leading-relaxed">
          Réponses rapides aux questions les plus fréquentes. Pour un sujet spécifique,
          écrivez-nous à{" "}
          <a
            href="mailto:contact@carbonco.fr"
            className="text-green-700 hover:underline"
          >
            contact@carbonco.fr
          </a>
          .
        </p>

        {/* Barre de recherche */}
        <div className="relative mb-6">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Rechercher dans l'aide…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-neutral-300 text-base focus:border-green-500 focus:outline-none"
            aria-label="Rechercher dans le centre d'aide"
          />
        </div>

        {/* Filtres catégories */}
        <div className="flex flex-wrap gap-2 mb-8">
          {(["Tous", ...FAQ_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                activeCategory === c
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Résultats */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 p-8 text-center">
            <p className="text-base text-neutral-700 mb-2">Aucun résultat pour cette recherche.</p>
            <p className="text-sm text-neutral-500">
              Écrivez-nous à{" "}
              <a href="mailto:contact@carbonco.fr" className="text-green-700 hover:underline">
                contact@carbonco.fr
              </a>{" "}
              — réponse sous 24 h ouvrées.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((e) => {
              const isOpen = openId === e.id;
              return (
                <li
                  key={e.id}
                  id={e.id}
                  className={`rounded-2xl border ${
                    isOpen ? "border-green-500" : "border-neutral-200"
                  } overflow-hidden transition-colors`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : e.id)}
                    aria-expanded={isOpen}
                    className="w-full flex items-start justify-between gap-4 p-5 text-left hover:bg-neutral-50 transition-colors cursor-pointer"
                  >
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-1">
                        {e.category}
                      </p>
                      <p className="font-bold text-neutral-900">{e.question}</p>
                    </div>
                    <ChevronDown
                      className={`w-5 h-5 text-neutral-500 mt-0.5 flex-shrink-0 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-base text-neutral-700 leading-relaxed">
                      {e.answer}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Contact */}
        <div className="mt-16 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white p-8 flex items-center justify-between gap-6 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-green-400 mb-2">
              Vous n&apos;avez pas trouvé&nbsp;?
            </p>
            <p className="font-bold text-lg mb-1">contact@carbonco.fr</p>
            <p className="text-sm text-neutral-300">Réponse sous 24 h ouvrées.</p>
          </div>
          <a
            href="mailto:contact@carbonco.fr"
            className="px-5 py-3 rounded-lg bg-white text-neutral-900 text-sm font-semibold hover:bg-neutral-100 transition-colors"
          >
            Nous écrire
          </a>
        </div>
      </section>
    </main>
  );
}
