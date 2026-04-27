"use client";

import { useEffect, useRef } from "react";

interface CalEmbedProps {
  /**
   * Format Cal.com : "username/event-slug" (ex : "neural-ai/cadrage-30min").
   * À remplacer par votre URL Cal.com réelle quand le compte est configuré.
   */
  calLink: string;
  height?: number;
}

/**
 * CalEmbed — wrapper minimal pour intégrer un Cal.com inline.
 * Charge le script Cal.com et initialise le widget une seule fois.
 *
 * Pour activer en prod : remplacer calLink par votre URL Cal.com réelle
 * (ex : "neural-ai-consulting/cadrage-30min").
 */
export function CalEmbed({ calLink, height = 680 }: CalEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Build iframe URL avec params Cal.com inline
    const iframe = document.createElement("iframe");
    iframe.src = `https://cal.com/${calLink}?embed=true&theme=dark&hideEventTypeDetails=false`;
    iframe.style.width = "100%";
    iframe.style.height = `${height}px`;
    iframe.style.border = "none";
    iframe.style.borderRadius = "20px";
    iframe.style.backgroundColor = "transparent";
    iframe.title = "Réserver un créneau via Cal.com";
    iframe.loading = "lazy";

    container.replaceChildren(iframe);

    return () => {
      container.replaceChildren();
    };
  }, [calLink, height]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04]"
      style={{ minHeight: height }}
    >
      {/* Loading state */}
      <div className="flex h-full min-h-[400px] items-center justify-center p-8">
        <p className="text-sm text-white/50">Chargement du calendrier Cal.com...</p>
      </div>
    </div>
  );
}
