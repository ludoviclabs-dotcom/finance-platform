/**
 * Webhook Inngest — endpoint de syncing pour la plateforme Inngest.
 *
 * Inngest appelle CE endpoint pour :
 *   1. Découvrir les fonctions enregistrées (PUT pendant le deploy / sync)
 *   2. Déclencher l'exécution d'une fonction (POST quand un événement matche)
 *   3. Vérifier la santé (GET)
 *
 * Sécurité : la signature HMAC est vérifiée via INNGEST_SIGNING_KEY.
 * Pas besoin d'auth utilisateur ici — les routes API qui *envoient* des
 * événements ont déjà fait l'auth JWT, et Inngest signe ses webhooks.
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/queue/client";
import {
  ragBatchIngest,
  ragDocumentIngest,
  datapointsBatchExtract,
  datapointExtractOne,
} from "@/inngest/functions";

export const runtime = "nodejs";
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ragBatchIngest,
    ragDocumentIngest,
    datapointsBatchExtract,
    datapointExtractOne,
  ],
});
