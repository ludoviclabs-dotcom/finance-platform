"use client";

import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
  eta?: string;
}

export function PlaceholderPage({ title, description, eta }: PlaceholderPageProps) {
  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <div className="max-w-lg text-center space-y-4">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-carbon-emerald/15 text-carbon-emerald-light items-center justify-center">
          <Construction className="w-8 h-8" />
        </div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-foreground)]">{title}</h1>
        <p className="text-sm text-[var(--color-foreground-muted)]">{description}</p>
        {eta && (
          <p className="text-xs text-[var(--color-foreground-subtle)] uppercase tracking-wide">
            Disponible : {eta}
          </p>
        )}
      </div>
    </div>
  );
}
