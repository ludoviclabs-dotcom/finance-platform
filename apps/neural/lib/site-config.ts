const FALLBACK_SITE_URL = "https://neural-five.vercel.app";

export function getSiteUrl(): string {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    FALLBACK_SITE_URL;

  if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
    return candidate;
  }

  return `https://${candidate}`;
}

export const SITE_URL = getSiteUrl();
