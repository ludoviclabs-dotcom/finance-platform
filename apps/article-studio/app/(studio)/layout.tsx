import Link from "next/link";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/sources", label: "Sources" },
  { href: "/articles/new", label: "Nouvel article" },
  { href: "/settings", label: "Paramètres" },
];

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr]">
      <aside className="border-r border-[color:var(--border)] px-5 py-6">
        <div className="mb-8">
          <span className="block text-xs font-semibold uppercase tracking-widest text-[color:var(--muted)]">
            Article Studio
          </span>
          <span className="mt-1 block text-sm text-[color:var(--foreground)]">
            Studio éditorial privé
          </span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded px-3 py-2 text-sm text-[color:var(--foreground)] hover:bg-white/5"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="px-10 py-8">{children}</main>
    </div>
  );
}
