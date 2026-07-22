"use client";

/**
 * useDemoAccess — primitive partagée « assurer une session démo, puis
 * naviguer ». Évite que GuidedDemoLink, le bouton « Se connecter à la démo »
 * (DemoShell), le lien « Explorer dans l'application » et le CTA démo de
 * /login implémentent chacun leur propre variante de la même logique
 * (POST /auth/demo via loginDemo(), état loading/erreur, navigation).
 *
 * Prend `auth`/`loginDemo` en paramètres (plutôt que d'appeler useAuth() en
 * interne) : un composant qui a déjà besoin de useAuth() pour autre chose
 * (ex. LoginClient, pour login()/verifyTotp()) ne doit PAS instancier un
 * second cycle d'hydratation indépendant — un seul useAuth() par arbre,
 * partagé avec ce hook.
 *
 * `enterDemo(destination, { strict })` :
 *   - session déjà active → navigue directement, aucun appel réseau superflu ;
 *   - sinon → loginDemo() puis navigue si succès ;
 *   - `strict` (défaut true) : sur échec, affiche l'erreur SANS naviguer
 *     (cas où la destination est protégée, ex. /resources) ;
 *     `strict: false` : navigue quand même (cas où la destination est déjà
 *     publique, ex. /demo/asterion-motion — best-effort historique de
 *     GuidedDemoLink, comportement inchangé).
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthState, LoginResult } from "./use-auth";

interface EnterDemoOptions {
  strict?: boolean;
}

export function useDemoAccess(auth: AuthState, loginDemo: () => Promise<LoginResult>) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = auth.status === "authenticated";

  /** Assure la session démo sans naviguer (reste sur l'étape courante). */
  const connect = useCallback(async () => {
    if (connected) return;
    setError(null);
    setLoading(true);
    const result = await loginDemo();
    setLoading(false);
    if (!result.ok) {
      setError("error" in result ? result.error : "Accès démo indisponible.");
    }
  }, [connected, loginDemo]);

  /** Assure la session démo puis navigue vers `destination`. */
  const enterDemo = useCallback(
    async (destination: string, options: EnterDemoOptions = {}) => {
      const { strict = true } = options;
      setError(null);

      if (connected) {
        router.push(destination);
        return;
      }

      setLoading(true);
      const result = await loginDemo();
      setLoading(false);

      if (result.ok) {
        router.push(destination);
        return;
      }

      const message = "error" in result ? result.error : "Accès démo indisponible.";
      if (strict) {
        setError(message);
      } else {
        // Destination déjà publique : on y va malgré l'échec (best-effort).
        router.push(destination);
      }
    },
    [connected, loginDemo, router],
  );

  return { connected, loading, error, connect, enterDemo };
}
