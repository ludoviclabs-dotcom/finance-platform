/**
 * Abstraction du fournisseur IA (T6.0 du PLAN_ACTION_CARBONCO).
 *
 * `NEURAL_MODE` pilote TOUS les appels IA du front :
 *   - "demo" (défaut) : réponses scriptées, clairement étiquetées, ZÉRO appel à
 *     une API payante. C'est le mode conforme à la contrainte budgétaire
 *     « aucune API payante hors P6 » tant qu'aucune clé/budget n'est décidé.
 *   - "live"          : appel réel au modèle (Vercel AI Gateway / Anthropic),
 *     coût à l'usage. À n'activer qu'avec une décision budgétaire explicite.
 *
 * Par défaut on reste en "demo" : le copilote (et l'extraction de datapoints)
 * fonctionnent sans coût, et le mode live s'active par variable d'environnement.
 */

import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

export type NeuralMode = "demo" | "live";

export function neuralMode(): NeuralMode {
  return process.env.NEURAL_MODE === "live" ? "live" : "demo";
}

/** Vrai uniquement quand l'appel IA réel (payant) est explicitement autorisé. */
export function isLiveAi(): boolean {
  return neuralMode() === "live";
}

/** Découpe un texte en petits morceaux pour un rendu progressif côté client. */
function chunkText(text: string, size = 18): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks.length > 0 ? chunks : [text];
}

/**
 * Construit une `Response` au protocole « UI message stream » du AI SDK à partir
 * d'un texte déjà calculé (réponse scriptée de démonstration). Compatible avec
 * `useChat` (@ai-sdk/react) — même format que
 * `streamText().toUIMessageStreamResponse()`, mais sans appel modèle.
 */
export function demoStreamResponse(text: string): Response {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const id = "demo-0";
      writer.write({ type: "text-start", id });
      for (const delta of chunkText(text)) {
        writer.write({ type: "text-delta", id, delta });
      }
      writer.write({ type: "text-end", id });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
