/**
 * NEURAL — Generic RSS / Atom fetcher (Sprint 7)
 *
 * Fetches and parses RSS 2.0 + Atom feeds using fast-xml-parser.
 * Returns a normalized array of items with title, link, pubDate, description.
 * Timeout: 10 s (regulatory sites can be slow).
 */

import { XMLParser } from "fast-xml-parser";

const FETCH_TIMEOUT_MS = 10_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export type FeedItem = {
  title: string;
  link: string;
  publishedAt: Date;
  description: string;
};

// ── XML parser setup ──────────────────────────────────────────────────────────

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Treat single items as arrays for consistent access
  isArray: (tagName) =>
    tagName === "item" || tagName === "entry",
});

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeDate(raw: unknown): Date {
  if (!raw) return new Date();
  if (typeof raw === "string") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date();
}

function normalizeString(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object" && raw !== null) {
    // Some feeds use CDATA or nested elements
    const r = raw as Record<string, unknown>;
    if (typeof r["#text"] === "string") return r["#text"].trim();
    if (typeof r["_"] === "string") return r["_"].trim();
  }
  return "";
}

/** Extract href from Atom link element (can be string or {href: string} or array) */
function extractLink(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    // Atom may have multiple <link> — prefer alternate
    const alt = raw.find(
      (l: unknown) =>
        typeof l === "object" &&
        l !== null &&
        ((l as Record<string, unknown>)["@_rel"] === "alternate" ||
          !(l as Record<string, unknown>)["@_rel"]),
    );
    return extractLink(alt ?? raw[0]);
  }
  if (typeof raw === "object" && raw !== null) {
    const r = raw as Record<string, unknown>;
    return (r["@_href"] as string) ?? (r["#text"] as string) ?? "";
  }
  return "";
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseRssItems(parsed: Record<string, unknown>): FeedItem[] {
  // RSS 2.0
  const rss = parsed["rss"] as Record<string, unknown> | undefined;
  if (rss) {
    const channel = rss["channel"] as Record<string, unknown>;
    const items = (channel?.["item"] as unknown[]) ?? [];
    return items.map((item) => {
      const i = item as Record<string, unknown>;
      return {
        title: normalizeString(i["title"]),
        link: normalizeString(i["link"]),
        publishedAt: normalizeDate(i["pubDate"] ?? i["dc:date"]),
        description: normalizeString(i["description"] ?? i["dc:description"] ?? ""),
      };
    });
  }

  // Atom
  const feed = parsed["feed"] as Record<string, unknown> | undefined;
  if (feed) {
    const entries = (feed["entry"] as unknown[]) ?? [];
    return entries.map((entry) => {
      const e = entry as Record<string, unknown>;
      return {
        title: normalizeString(e["title"]),
        link: extractLink(e["link"]),
        publishedAt: normalizeDate(e["published"] ?? e["updated"]),
        description: normalizeString(e["summary"] ?? e["content"] ?? ""),
      };
    });
  }

  return [];
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch a RSS/Atom feed URL and return normalized items.
 * Returns an empty array on network or parse errors (never throws).
 */
export async function fetchFeed(url: string): Promise<FeedItem[]> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        "User-Agent": "NEURAL-RegulatoryWatch/1.0 (neural-ai.fr)",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[regulatory/rss] ${url} → ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const parsed = parser.parse(xml) as Record<string, unknown>;
    return parseRssItems(parsed);
  } catch (err) {
    console.warn(
      `[regulatory/rss] Failed to fetch ${url}:`,
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
