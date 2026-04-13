"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface SafeMarkdownProps {
  children: string;
  className?: string;
}

/**
 * Rendu Markdown sanitizé pour les sorties IA.
 * Bloque tout HTML brut, scripts, et attributs dangereux.
 */
export function SafeMarkdown({ children, className }: SafeMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          strong: ({ children }) => (
            <strong className="text-[var(--color-foreground)] font-semibold">{children}</strong>
          ),
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-1 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-1 my-2">{children}</ol>,
          li: ({ children }) => (
            <li className="text-sm text-[var(--color-foreground-muted)]">{children}</li>
          ),
          h1: ({ children }) => (
            <h2 className="font-display font-bold text-base text-[var(--color-foreground)] mt-3 mb-1">
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h3 className="font-display font-bold text-[var(--color-foreground)] mt-2 mb-1">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="font-display font-semibold text-[var(--color-foreground)] mt-2 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-sm text-[var(--color-foreground-muted)] leading-relaxed">
              {children}
            </p>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded bg-[var(--color-surface-raised)] text-[var(--color-primary)] text-xs font-mono">
              {children}
            </code>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-[var(--color-primary)] underline hover:opacity-80"
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
