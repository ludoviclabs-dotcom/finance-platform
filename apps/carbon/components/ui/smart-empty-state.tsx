"use client";

import type { ReactNode } from "react";
import Link from "next/link";

interface SmartEmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  severity?: "info" | "warning" | "error";
  compact?: boolean;
}

const SEVERITY_STYLES = {
  info: {
    border: "border-blue-200",
    bg: "bg-blue-50",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-500",
    title: "text-blue-900",
    desc: "text-blue-700",
    btn: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  warning: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-500",
    title: "text-amber-900",
    desc: "text-amber-700",
    btn: "bg-amber-500 hover:bg-amber-600 text-white",
  },
  error: {
    border: "border-red-200",
    bg: "bg-red-50",
    iconBg: "bg-red-100",
    iconColor: "text-red-500",
    title: "text-red-900",
    desc: "text-red-700",
    btn: "bg-red-600 hover:bg-red-700 text-white",
  },
};

const DefaultIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
);

export function SmartEmptyState({
  icon,
  title,
  description,
  action,
  severity = "info",
  compact = false,
}: SmartEmptyStateProps) {
  const s = SEVERITY_STYLES[severity];

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${s.border} ${s.bg}`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
          {icon ?? <DefaultIcon className={`w-4 h-4 ${s.iconColor}`} />}
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-semibold ${s.title}`}>{title}</span>
          <span className={`text-xs ${s.desc} ml-1.5`}>{description}</span>
        </div>
        {action && (
          action.href ? (
            <Link href={action.href}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${s.btn}`}>
              {action.label}
            </Link>
          ) : (
            <button onClick={action.onClick}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 cursor-pointer ${s.btn}`}>
              {action.label}
            </button>
          )
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} p-8 text-center`}>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${s.iconBg}`}>
        {icon ?? <DefaultIcon className={`w-7 h-7 ${s.iconColor}`} />}
      </div>
      <h3 className={`font-bold text-base mb-2 ${s.title}`}>{title}</h3>
      <p className={`text-sm leading-relaxed max-w-sm mx-auto mb-5 ${s.desc}`}>{description}</p>
      {action && (
        action.href ? (
          <Link href={action.href}
            className={`inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors ${s.btn}`}>
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick}
            className={`inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors cursor-pointer ${s.btn}`}>
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
