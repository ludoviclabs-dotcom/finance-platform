/**
 * ArticleAccordion — accordion des articles AI Act applicables.
 * Détails : ce que dit l'article, ce que NEURAL fait, ce que NEURAL ne fait pas.
 */

"use client";

import { useState } from "react";
import { ChevronDown, Check, X } from "lucide-react";

interface Article {
  id: string;
  number: string;
  title: string;
  summary: string;
  neuralDoes: string;
  neuralDoesNot: string;
}

interface ArticleAccordionProps {
  articles: Article[];
}

export function ArticleAccordion({ articles }: ArticleAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(articles[0]?.id || null);

  return (
    <div className="space-y-3">
      {articles.map((article) => {
        const isOpen = openId === article.id;
        return (
          <div
            key={article.id}
            className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04] transition-colors"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : article.id)}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
              aria-expanded={isOpen}
            >
              <span className="inline-flex flex-shrink-0 items-center rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-200">
                {article.number}
              </span>
              <span className="flex-1 font-display text-base font-semibold leading-snug text-white">
                {article.title}
              </span>
              <ChevronDown
                className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform duration-300 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            <div
              className="grid transition-all duration-300"
              style={{
                gridTemplateRows: isOpen ? "1fr" : "0fr",
              }}
            >
              <div className="overflow-hidden">
                <div className="space-y-4 border-t border-white/8 px-5 py-5">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                      Ce que dit l&apos;AI Act
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">{article.summary}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-300">
                          Ce que NEURAL fait
                        </p>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-white/75">
                        {article.neuralDoes}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
                      <div className="flex items-center gap-2">
                        <X className="h-4 w-4 text-amber-300" aria-hidden="true" />
                        <p className="text-[11px] uppercase tracking-[0.18em] text-amber-300">
                          Ce que NEURAL ne fait pas
                        </p>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-white/75">
                        {article.neuralDoesNot}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
