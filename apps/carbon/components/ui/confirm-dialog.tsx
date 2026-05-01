"use client";

/**
 * <ConfirmDialog> — modale de confirmation pour actions destructives.
 *
 * Usage typique :
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Supprimer ce datapoint ?", tone: "danger" })) {
 *     await deleteRow();
 *   }
 *
 * On expose à la fois :
 *   - <ConfirmDialogProvider> à monter une fois en haut du tree
 *   - useConfirm() qui retourne une promesse <boolean>
 *   - <ConfirmDialog> en mode contrôlé pour les cas avancés
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Tone = "default" | "danger" | "warning";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpts(null);
  }, []);

  // Fermeture clavier (Esc / Enter)
  useEffect(() => {
    if (!opts) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      if (e.key === "Enter") close(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [opts, close]);

  const value = useMemo(() => confirm, [confirm]);

  const tone = opts?.tone ?? "default";
  const accent =
    tone === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : tone === "warning"
        ? "bg-amber-600 hover:bg-amber-700"
        : "bg-green-600 hover:bg-green-700";

  return (
    <ConfirmCtx.Provider value={value}>
      {children}
      {opts && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[170] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-neutral-950/70 backdrop-blur-sm" onClick={() => close(false)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-neutral-200 p-6">
            <h2 className="font-extrabold text-lg text-neutral-900 mb-2">{opts.title}</h2>
            {opts.description && (
              <p className="text-sm text-neutral-600 leading-relaxed mb-5">{opts.description}</p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => close(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 cursor-pointer"
              >
                {opts.cancelLabel ?? "Annuler"}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer transition-colors ${accent}`}
              >
                {opts.confirmLabel ?? "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) {
    throw new Error("useConfirm doit être appelé sous <ConfirmDialogProvider>.");
  }
  return ctx;
}
