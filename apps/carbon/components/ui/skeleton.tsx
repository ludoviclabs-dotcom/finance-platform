"use client";

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-3 w-24 bg-[var(--color-surface-raised)] rounded-full" />
        <div className="w-9 h-9 rounded-lg bg-[var(--color-surface-raised)]" />
      </div>
      <div className="h-7 w-28 bg-[var(--color-surface-raised)] rounded-lg mb-2" />
      <div className="h-3 w-36 bg-[var(--color-surface-raised)] rounded-full" />
    </div>
  );
}

export function SkeletonChart({ height = 280 }: { height?: number }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 animate-pulse">
      <div className="h-3 w-40 bg-[var(--color-surface-raised)] rounded-full mb-1.5" />
      <div className="h-2.5 w-56 bg-[var(--color-surface-raised)] rounded-full mb-6 opacity-60" />
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-[var(--color-surface-raised)] rounded-t"
            style={{ height: `${25 + ((i * 37 + 17) % 75)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] animate-pulse">
      <div className="w-7 h-7 rounded-full bg-[var(--color-surface-raised)] flex-shrink-0" />
      <div className="w-4 h-4 rounded bg-[var(--color-surface-raised)] flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-3/4 bg-[var(--color-surface-raised)] rounded-full" />
        <div className="h-2.5 w-1/2 bg-[var(--color-surface-raised)] rounded-full opacity-60" />
      </div>
      <div className="h-2.5 w-12 bg-[var(--color-surface-raised)] rounded-full" />
    </div>
  );
}
