/**
 * Inngest client + types d'événements — Chantier E.
 *
 * Centralise la création du client Inngest et déclare les payloads
 * typés pour chaque événement métier (ingestion bulk, extraction batch).
 *
 * Pourquoi Inngest plutôt qu'un cron + DB :
 *   - Steps idempotents avec retry automatique (utile pour Voyage/Anthropic 5xx)
 *   - Fan-out natif via `step.sendEvent` (un événement parent → N événements enfants)
 *   - Dashboard observability inclus (eventId, durée, exceptions)
 *   - Compatible Vercel Fluid Compute, pas d'infra à gérer
 *
 * Variables d'environnement requises (set via Vercel Marketplace) :
 *   - INNGEST_EVENT_KEY (write)
 *   - INNGEST_SIGNING_KEY (verify webhook)
 *   - en dev local : `npx inngest-cli@latest dev` lance un dev server sur :8288
 */

import { Inngest } from "inngest";

/** Identifiant logique de l'app Inngest (apparaît dans le dashboard). */
const APP_ID = "carbon-co";

// ---------------------------------------------------------------------------
// Payloads d'événements
// ---------------------------------------------------------------------------

/**
 * Événement parent : on veut ingérer un lot de documents pour un tenant.
 * Le handler décompose en N événements `rag/document.ingest` (fan-out).
 */
export interface RagBatchIngestEvent {
  data: {
    cid: string;
    /** ID applicatif libre (ex. UUID) pour suivre le batch côté UI. */
    batchId: string;
    documents: Array<{
      blobUrl: string;
      filename: string;
      mimeType?: string;
    }>;
    /** Acteur qui a déclenché le batch (audit trail). */
    actorSub: string;
  };
}

/**
 * Événement enfant : un document précis à parser/embed/upsert.
 * Émis par le handler de `rag/batch.ingest` pour chaque document.
 */
export interface RagDocumentIngestEvent {
  data: {
    cid: string;
    batchId: string;
    blobUrl: string;
    filename: string;
    mimeType?: string;
  };
}

/**
 * Événement parent : extraire un lot de datapoints ESRS pour un tenant.
 * Le handler décompose en N événements `datapoints/extract.one`.
 */
export interface DatapointsBatchExtractEvent {
  data: {
    cid: string;
    batchId: string;
    datapointIds: string[];
    actorSub: string;
  };
}

/** Événement enfant : extraire UN datapoint précis. */
export interface DatapointExtractOneEvent {
  data: {
    cid: string;
    batchId: string;
    datapointId: string;
  };
}

// ---------------------------------------------------------------------------
// Schéma global d'événements (pour l'inférence de types côté functions)
// ---------------------------------------------------------------------------

export interface CarbonEvents extends Record<string, { data: unknown }> {
  "rag/batch.ingest": RagBatchIngestEvent;
  "rag/document.ingest": RagDocumentIngestEvent;
  "datapoints/batch.extract": DatapointsBatchExtractEvent;
  "datapoints/extract.one": DatapointExtractOneEvent;
}

// ---------------------------------------------------------------------------
// Client Inngest
// ---------------------------------------------------------------------------

/**
 * Client Inngest typé. Importer depuis ce module dans :
 *   - les routes API qui *envoient* des événements
 *   - les fonctions Inngest dans `inngest/functions/*`
 */
export const inngest = new Inngest({
  id: APP_ID,
  // Inngest lit INNGEST_EVENT_KEY automatiquement, pas de config supplémentaire.
});

// ---------------------------------------------------------------------------
// Helpers utilitaires
// ---------------------------------------------------------------------------

/**
 * Génère un batchId compact basé sur le timestamp + 4 char aléatoires.
 * Utilisable comme identifiant lisible dans les logs ou en clé Redis.
 */
export function newBatchId(prefix: string = "batch"): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${ts}_${rnd}`;
}
