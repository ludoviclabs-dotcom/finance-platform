/**
 * NEURAL — Regulatory feed configurations (Sprint 7)
 *
 * Each entry defines a source, its RSS/Atom URL and how to derive a stable
 * externalId from a feed item (critical for deduplication).
 *
 * Adding a new source:
 *   1. Add an entry to REGULATORY_FEEDS
 *   2. Ensure externalId is deterministic (derived from URL or feed ID)
 *   3. Deploy — the next cron run picks it up automatically
 */

import type { RegulatorySource, RawPublication } from "../types";
import { fetchFeed, type FeedItem } from "./rss";

// ── Feed config ───────────────────────────────────────────────────────────────

type FeedConfig = {
  source: RegulatorySource;
  /** Label shown in logs. */
  label: string;
  /** RSS / Atom feed URL. */
  url: string;
  /** Derive a stable unique ID from a feed item. */
  externalId: (item: FeedItem) => string;
};

const REGULATORY_FEEDS: FeedConfig[] = [
  // ── EUR-Lex — financial regulation (OJ L series)
  {
    source: "eur-lex",
    label: "EUR-Lex OJ L (financial)",
    url: "https://eur-lex.europa.eu/RSSEU.html?locale=fr&type=journal_oj&journalTypes=L&domains=banking,finance",
    externalId: (item) =>
      `eurlex:${item.link.replace(/[^a-zA-Z0-9]/g, "-").slice(-40)}`,
  },

  // ── EUR-Lex — DORA / digital finance
  {
    source: "eur-lex",
    label: "EUR-Lex OJ L (digital/DORA)",
    url: "https://eur-lex.europa.eu/search.html?type=advanced&lang=fr&scope=EURLEX&or0=DTT%3ARL%2CDTT%3ARR&qid=1700000000000&sortOne=DD&sortOneOrder=desc&RSSoutput=true",
    externalId: (item) =>
      `eurlex-digital:${item.link.replace(/[^a-zA-Z0-9]/g, "-").slice(-40)}`,
  },

  // ── BOFiP — Bulletin Officiel des Finances Publiques
  {
    source: "bofip",
    label: "BOFiP actualités",
    url: "https://bofip.impots.gouv.fr/bofip/flux-rss/flux-rss-actualites.xml",
    externalId: (item) =>
      `bofip:${item.link.replace(/[^a-zA-Z0-9]/g, "-").slice(-40)}`,
  },

  // ── EBA — European Banking Authority
  {
    source: "eba",
    label: "EBA News",
    url: "https://www.eba.europa.eu/rss.xml",
    externalId: (item) =>
      `eba:${item.link.replace(/[^a-zA-Z0-9]/g, "-").slice(-40)}`,
  },

  // ── IFRS Foundation — standards and amendments
  {
    source: "ifrs-foundation",
    label: "IFRS Foundation News",
    url: "https://www.ifrs.org/news-and-events/rss/?title=All%20news",
    externalId: (item) =>
      `ifrs:${item.link.replace(/[^a-zA-Z0-9]/g, "-").slice(-40)}`,
  },

  // ── ANC — Autorité des Normes Comptables
  {
    source: "anc",
    label: "ANC Actualités",
    url: "https://www.anc.gouv.fr/index.php?option=com_content&view=category&id=8&format=feed&type=rss",
    externalId: (item) =>
      `anc:${item.link.replace(/[^a-zA-Z0-9]/g, "-").slice(-40)}`,
  },
];

// ── Fetcher ───────────────────────────────────────────────────────────────────

/**
 * Fetch all configured feeds and return normalized RawPublication[].
 * Only publications from the last `lookbackDays` days are returned.
 */
export async function fetchAllSources(lookbackDays = 3): Promise<RawPublication[]> {
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1_000);
  const results: RawPublication[] = [];

  await Promise.allSettled(
    REGULATORY_FEEDS.map(async (feed) => {
      const items = await fetchFeed(feed.url);
      for (const item of items) {
        if (!item.title || !item.link) continue;
        if (item.publishedAt < cutoff) continue;

        results.push({
          externalId: feed.externalId(item),
          source: feed.source,
          publishedAt: item.publishedAt,
          title: item.title,
          url: item.link,
          abstract: item.description
            ? item.description.replace(/<[^>]+>/g, "").slice(0, 500)
            : undefined,
        });
      }
    }),
  );

  return results;
}

/** Fetch a single source by name. Useful for targeted re-runs. */
export async function fetchSource(
  source: RegulatorySource,
  lookbackDays = 7,
): Promise<RawPublication[]> {
  const feeds = REGULATORY_FEEDS.filter((f) => f.source === source);
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1_000);
  const results: RawPublication[] = [];

  for (const feed of feeds) {
    const items = await fetchFeed(feed.url);
    for (const item of items) {
      if (!item.title || !item.link) continue;
      if (item.publishedAt < cutoff) continue;
      results.push({
        externalId: feed.externalId(item),
        source: feed.source,
        publishedAt: item.publishedAt,
        title: item.title,
        url: item.link,
        abstract: item.description?.replace(/<[^>]+>/g, "").slice(0, 500),
      });
    }
  }

  return results;
}
