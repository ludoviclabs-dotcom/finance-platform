import type { ComponentPropsWithoutRef, ReactNode } from "react";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Quote, TrendingUp } from "lucide-react";

function joinClasses(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

function isExternalUrl(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

type Tone = "signal" | "framework" | "retain" | "warning";

const CALLOUT_TONES: Record<
  Tone,
  { badge: string; panel: string; title: string }
> = {
  signal: {
    badge: "text-cyan-300",
    panel: "border-cyan-400/18 bg-cyan-400/8",
    title: "Signal faible",
  },
  framework: {
    badge: "text-emerald-300",
    panel: "border-emerald-400/18 bg-emerald-400/8",
    title: "Cadre d'exécution",
  },
  retain: {
    badge: "text-amber-300",
    panel: "border-amber-400/18 bg-amber-400/8",
    title: "À retenir",
  },
  warning: {
    badge: "text-rose-300",
    panel: "border-rose-400/18 bg-rose-400/8",
    title: "Point de vigilance",
  },
};

type HeadingProps = ComponentPropsWithoutRef<"h2">;
type HeadingLevelThreeProps = ComponentPropsWithoutRef<"h3">;
type ParagraphProps = ComponentPropsWithoutRef<"p">;
type LinkProps = ComponentPropsWithoutRef<"a">;
type ListProps = ComponentPropsWithoutRef<"ul">;
type OrderedListProps = ComponentPropsWithoutRef<"ol">;
type ListItemProps = ComponentPropsWithoutRef<"li">;
type BlockquoteProps = ComponentPropsWithoutRef<"blockquote">;
type PreProps = ComponentPropsWithoutRef<"pre">;
type CodeProps = ComponentPropsWithoutRef<"code"> & { inline?: boolean };
type TableProps = ComponentPropsWithoutRef<"table">;
type TableCellProps = ComponentPropsWithoutRef<"th">;
type TableDataProps = ComponentPropsWithoutRef<"td">;
type ImageProps = ComponentPropsWithoutRef<"img">;

export function Callout({
  children,
  tone = "signal",
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  title?: string;
}) {
  const palette = CALLOUT_TONES[tone];

  return (
    <aside className={joinClasses("my-10 rounded-[24px] border p-6", palette.panel)}>
      <div className={joinClasses("text-sm font-semibold uppercase tracking-[0.16em]", palette.badge)}>
        {title ?? palette.title}
      </div>
      <div className="mt-4 text-[15px] leading-7 text-white/80">{children}</div>
    </aside>
  );
}

export function Figure({
  src,
  alt,
  caption,
  width,
  height,
}: {
  src: string;
  alt: string;
  caption?: string;
  width: number;
  height: number;
}) {
  return (
    <figure className="my-12 overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.04]">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="h-auto w-full object-cover"
        sizes="(max-width: 1024px) 100vw, 900px"
      />
      {caption ? (
        <figcaption className="border-t border-white/10 px-5 py-4 text-sm leading-6 text-white/55">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function PullQuote({
  children,
  attribution,
}: {
  children: ReactNode;
  attribution?: string;
}) {
  return (
    <figure className="my-12 border-y border-white/10 py-8">
      <div className="flex items-start gap-4">
        <Quote className="mt-1 h-6 w-6 flex-none text-violet-300" />
        <blockquote className="font-playfair text-3xl leading-tight text-white/92 md:text-[2.1rem]">
          {children}
        </blockquote>
      </div>
      {attribution ? (
        <figcaption className="mt-5 pl-10 text-sm uppercase tracking-[0.16em] text-white/45">
          {attribution}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function StatBlock({
  value,
  label,
  source,
}: {
  value: string;
  label: string;
  source?: string;
}) {
  return (
    <section className="my-10 overflow-hidden rounded-[24px] border border-violet-400/18 bg-linear-to-br from-violet-400/14 to-transparent p-6">
      <div className="text-sm uppercase tracking-[0.16em] text-violet-300">Signal marché</div>
      <div className="mt-4 font-display text-5xl font-bold tracking-tight text-white md:text-6xl">
        {value}
      </div>
      <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/72">{label}</p>
      {source ? <p className="mt-4 text-xs uppercase tracking-[0.16em] text-white/38">{source}</p> : null}
    </section>
  );
}

export function ChartBlock({
  title,
  description,
  items = [],
}: {
  title: string;
  description?: string;
  items?: Array<{ label: string; value: number; note?: string }>;
}) {
  const maxValue = items.reduce((highest, item) => Math.max(highest, item.value), 0) || 1;

  return (
    <section className="my-10 rounded-[24px] border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-center gap-2 text-sm uppercase tracking-[0.16em] text-cyan-300">
        <TrendingUp className="h-4 w-4" />
        {title}
      </div>
      {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">{description}</p> : null}
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <div key={item.label} className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-white/76">{item.label}</span>
              <span className="font-semibold text-white">{item.value}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-linear-to-r from-cyan-300 to-violet-300"
                style={{ width: `${Math.max((item.value / maxValue) * 100, 10)}%` }}
              />
            </div>
            {item.note ? <p className="text-xs uppercase tracking-[0.14em] text-white/38">{item.note}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function DataTable({
  columns = [],
  rows = [],
}: {
  columns?: string[];
  rows?: string[][];
}) {
  return (
    <div className="my-10 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.04]">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-white/45"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={`${row[0] ?? "row"}-${rowIndex}`}
                className={joinClasses(rowIndex < rows.length - 1 && "border-b border-white/8")}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${cell}-${cellIndex}`}
                    className="px-5 py-4 align-top text-sm leading-7 text-white/72"
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InlineCta({
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="my-12 rounded-[28px] border border-white/10 bg-linear-to-r from-violet-500/12 via-transparent to-emerald-400/10 p-7 md:p-8">
      <div className="text-sm uppercase tracking-[0.16em] text-violet-300">{eyebrow}</div>
      <h3 className="mt-4 max-w-2xl font-display text-3xl font-semibold leading-tight text-white md:text-4xl">
        {title}
      </h3>
      <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/65">{description}</p>
      <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Link
          href={primaryHref}
          className="inline-flex items-center gap-2 rounded-full bg-neural-violet px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-neural-violet-dark"
        >
          {primaryLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/5 px-5 py-3 text-sm font-medium text-white/78 transition-colors hover:border-white/22 hover:bg-white/8"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export const publicationMdxComponents = {
  h2: ({ className, ...props }: HeadingProps) => (
    <h2
      className={joinClasses(
        "scroll-mt-28 font-display text-[2rem] font-semibold tracking-tight text-white md:text-[2.35rem]",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: HeadingLevelThreeProps) => (
    <h3
      className={joinClasses(
        "scroll-mt-28 font-display text-[1.35rem] font-semibold tracking-tight text-white md:text-[1.55rem]",
        className,
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }: ParagraphProps) => (
    <p className={joinClasses("text-[1.04rem] leading-8 text-white/72", className)} {...props} />
  ),
  a: ({ className, href = "#", ...props }: LinkProps) => {
    const linkClassName = joinClasses(
      "font-medium text-violet-300 underline decoration-violet-300/35 underline-offset-4 transition-colors hover:text-violet-200",
      className,
    );

    if (isExternalUrl(href)) {
      return <a className={linkClassName} href={href} target="_blank" rel="noreferrer" {...props} />;
    }

    return <Link className={linkClassName} href={href} {...props} />;
  },
  ul: ({ className, ...props }: ListProps) => (
    <ul className={joinClasses("space-y-3 pl-6 text-[1.02rem] leading-8 text-white/72", className)} {...props} />
  ),
  ol: ({ className, ...props }: OrderedListProps) => (
    <ol className={joinClasses("space-y-3 pl-6 text-[1.02rem] leading-8 text-white/72", className)} {...props} />
  ),
  li: ({ className, ...props }: ListItemProps) => (
    <li className={joinClasses("pl-1 marker:text-violet-300", className)} {...props} />
  ),
  blockquote: ({ className, ...props }: BlockquoteProps) => (
    <blockquote
      className={joinClasses(
        "my-8 border-l-2 border-violet-300/35 pl-5 text-[1.08rem] italic leading-8 text-white/76",
        className,
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }: PreProps) => (
    <pre
      className={joinClasses(
        "my-8 overflow-x-auto rounded-[22px] border border-white/10 bg-[#09111F] px-5 py-4 text-sm leading-7 text-white/82",
        className,
      )}
      {...props}
    />
  ),
  code: ({ className, inline, ...props }: CodeProps) =>
    inline ? (
      <code
        className={joinClasses(
          "rounded-md border border-white/10 bg-white/6 px-1.5 py-0.5 font-mono text-[0.92em] text-white/86",
          className,
        )}
        {...props}
      />
    ) : (
      <code className={joinClasses("font-mono text-[0.92em]", className)} {...props} />
    ),
  hr: (props: ComponentPropsWithoutRef<"hr">) => <hr className="my-12 border-white/10" {...props} />,
  strong: ({ className, ...props }: ComponentPropsWithoutRef<"strong">) => (
    <strong className={joinClasses("font-semibold text-white", className)} {...props} />
  ),
  em: ({ className, ...props }: ComponentPropsWithoutRef<"em">) => (
    <em className={joinClasses("text-white/82", className)} {...props} />
  ),
  table: ({ className, ...props }: TableProps) => (
    <div className="my-10 overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04]">
      <div className="overflow-x-auto">
        <table className={joinClasses("min-w-full border-collapse", className)} {...props} />
      </div>
    </div>
  ),
  th: ({ className, ...props }: TableCellProps) => (
    <th
      className={joinClasses(
        "border-b border-white/10 px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.16em] text-white/45",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }: TableDataProps) => (
    <td className={joinClasses("border-b border-white/8 px-5 py-4 text-sm leading-7 text-white/72", className)} {...props} />
  ),
  img: ({ className, alt = "", ...props }: ImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      className={joinClasses("my-10 w-full rounded-[24px] border border-white/10 bg-white/[0.04]", className)}
      loading="lazy"
      {...props}
    />
  ),
  Callout,
  Figure,
  PullQuote,
  StatBlock,
  ChartBlock,
  DataTable,
  InlineCta,
};
