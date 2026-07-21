"use client";

/**
 * GuidedDemoLink — entrée publique discrète vers le cockpit guidé
 * (/demo/asterion-motion), en overlay de la démo cinématique existante.
 *
 * N'altère PAS DemoExperience (moteur cinématique) : rendu en sibling fixe,
 * dans un coin libre (bas-gauche — le header cinématique occupe le haut, le
 * CTA de fin de parcours est centré). Authentifie silencieusement via
 * POST /auth/demo (session démo, aucun secret client) avant de rediriger.
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FlaskConical } from "lucide-react";

import { useAuth } from "@/lib/hooks/use-auth";

export function GuidedDemoLink() {
  const router = useRouter();
  const { loginDemo } = useAuth();
  const [loading, setLoading] = useState(false);

  const go = useCallback(async () => {
    setLoading(true);
    await loginDemo(); // best-effort : le cockpit fonctionne aussi hors session
    router.push("/demo/asterion-motion");
  }, [loginDemo, router]);

  return (
    <button
      type="button"
      onClick={go}
      disabled={loading}
      data-testid="guided-demo-link"
      aria-label="Voir la démo guidée — cockpit Asterion Motion"
      className="fixed bottom-4 left-4 z-[70] inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
    >
      <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
      {loading ? "Ouverture…" : "Voir la démo guidée"}
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
