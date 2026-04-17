"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Shield, ExternalLink } from "lucide-react";

interface MethodologyModalProps {
  open: boolean;
  onClose: () => void;
}

const SOURCES = [
  { name: "ADEME Base Carbone 2024", scope: "Facteurs d'émission France", badge: "Officiel", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { name: "IEA Emissions Factors 2024", scope: "Réseau électrique mondial", badge: "International", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { name: "Ecoinvent 3.9", scope: "Cycle de vie produits & matières", badge: "Référence", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { name: "Boavizta Cloud Impacts", scope: "Infrastructure numérique", badge: "Open Source", color: "bg-green-50 text-green-700 border-green-200" },
];

const PERIMETER = [
  "Périmètre organisationnel : contrôle opérationnel (GHG Protocol)",
  "Période de référence : janvier → décembre N-1",
  "Consolidation par filiale puis agrégation groupe",
  "Exclusions documentées : activités cédées en cours d'année",
];

export function MethodologyModal({ open, onClose }: MethodologyModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            role="dialog"
            aria-modal="true"
            aria-label="Méthodologie de calcul"
            className="fixed inset-0 z-[81] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-2xl pointer-events-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-success)]/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-[var(--color-success)]" />
                  </div>
                  <div>
                    <h2 className="font-display font-semibold text-[var(--color-foreground)] text-sm">Méthodologie de calcul</h2>
                    <p className="text-xs text-[var(--color-foreground-muted)]">Transparence & traçabilité · GHG Protocol · ESRS E1</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)] transition-colors rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-carbon-emerald/60"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="overflow-y-auto flex-1 p-6 space-y-6">
                {/* Périmètre */}
                <section>
                  <h3 className="text-xs font-bold text-[var(--color-foreground-muted)] uppercase tracking-wider mb-3">Périmètre GHG Protocol</h3>
                  <ul className="space-y-2">
                    {PERIMETER.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <CheckCircle className="w-4 h-4 text-[var(--color-success)] flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-[var(--color-foreground)]">{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Sources */}
                <section>
                  <h3 className="text-xs font-bold text-[var(--color-foreground-muted)] uppercase tracking-wider mb-3">Bases de données de référence</h3>
                  <div className="space-y-2.5">
                    {SOURCES.map((s) => (
                      <div key={s.name} className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-4 h-4 text-[var(--color-success)] flex-shrink-0" />
                          <div>
                            <div className="text-sm font-semibold text-[var(--color-foreground)]">{s.name}</div>
                            <div className="text-xs text-[var(--color-foreground-muted)]">{s.scope}</div>
                          </div>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${s.color}`}>{s.badge}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Conformité */}
                <section>
                  <h3 className="text-xs font-bold text-[var(--color-foreground-muted)] uppercase tracking-wider mb-3">Badges de conformité</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "ESRS E1", desc: "Changement climatique", ok: true },
                      { label: "ESRS E2", desc: "Pollution", ok: true },
                      { label: "ESRS S1", desc: "Effectifs propres", ok: true },
                      { label: "GHG Protocol", desc: "Scope 1-2-3", ok: true },
                      { label: "Taxonomie UE", desc: "Activités éligibles", ok: false },
                      { label: "CBAM", desc: "Carbon Border", ok: false },
                    ].map((b) => (
                      <div key={b.label} className={`rounded-lg p-2.5 border text-center ${b.ok ? "bg-[var(--color-success)]/5 border-[var(--color-success)]/20" : "bg-[var(--color-background)] border-[var(--color-border)]"}`}>
                        <div className={`text-xs font-bold mb-0.5 ${b.ok ? "text-[var(--color-success)]" : "text-[var(--color-foreground-subtle)]"}`}>{b.label}</div>
                        <div className="text-[10px] text-[var(--color-foreground-muted)]">{b.desc}</div>
                        <div className={`text-[10px] mt-1 font-semibold ${b.ok ? "text-[var(--color-success)]" : "text-[var(--color-foreground-subtle)]"}`}>{b.ok ? "✓ Conforme" : "En cours"}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* EU AI Act disclaimer */}
                <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-amber-600 text-sm font-bold flex-shrink-0">⚖️</span>
                    <div>
                      <p className="text-xs font-bold text-amber-800 mb-1">Disclaimer EU AI Act — usage responsable</p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Les suggestions et analyses générées par NEURAL sont des recommandations d&apos;aide à la décision. Elles doivent être validées par un expert avant tout usage dans un rapport officiel. La classification du système au regard du règlement UE 2024/1689 (EU AI Act) est en cours d&apos;évaluation — non auditée à ce jour. L&apos;application générale de l&apos;AI Act intervient le 2 août 2026.
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-background)] flex items-center justify-between">
                <span className="text-xs text-[var(--color-foreground-muted)]">Mis à jour le 1er mars 2026 · Version méthodo 3.2</span>
                <button className="flex items-center gap-1.5 text-xs text-carbon-emerald-light hover:underline cursor-pointer focus-visible:outline-none">
                  <ExternalLink className="w-3 h-3" />
                  Télécharger la note méthodologique
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
