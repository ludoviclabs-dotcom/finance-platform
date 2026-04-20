import { CheckCircle2, CircleSlash2 } from "lucide-react";

export function ScopeCard({
  title,
  does,
  doesnt,
}: {
  title: string;
  does: string[];
  doesnt: string[];
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
      <h3 className="font-display text-2xl font-bold tracking-tight text-white">
        {title}
      </h3>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.05] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-200">
            <CheckCircle2 className="h-4 w-4" />
            Ce qui est deja operationnel
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/65">
            {does.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-400/10 bg-amber-400/[0.05] p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-200">
            <CircleSlash2 className="h-4 w-4" />
            Ce qui n&apos;est pas encore promis
          </div>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-white/65">
            {doesnt.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
