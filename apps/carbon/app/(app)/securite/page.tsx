"use client";

/**
 * Page Sécurité — gestion de la double authentification (2FA TOTP, T1.4).
 *
 * Permet à l'utilisateur connecté d'ACTIVER la 2FA (enrôlement : clé secrète +
 * URI otpauth à ajouter dans une application d'authentification, puis
 * confirmation par code → 8 codes de récupération affichés une seule fois) et de
 * la DÉSACTIVER. Branche les endpoints /auth/totp/* déjà disponibles côté API.
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import {
  totpActivateRequest,
  totpDisableRequest,
  totpEnrollRequest,
  totpStatusRequest,
  type TotpEnrollResponse,
} from "@/lib/api";

type Phase = "loading" | "disabled" | "enrolling" | "recovery" | "enabled";

export default function SecuritePage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [enroll, setEnroll] = useState<TotpEnrollResponse | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(() => {
    setError(null);
    totpStatusRequest()
      .then((s) => setPhase(s.enabled ? "enabled" : "disabled"))
      .catch(() => {
        setError("Connexion au backend requise pour gérer la 2FA.");
        setPhase("disabled");
      });
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const startEnroll = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await totpEnrollRequest();
      setEnroll(data);
      setPhase("enrolling");
    } catch {
      setError("Impossible de démarrer l'enrôlement (backend requis).");
    } finally {
      setBusy(false);
    }
  };

  const confirmActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const codes = await totpActivateRequest(code.trim());
      setRecoveryCodes(codes);
      setCode("");
      setPhase("recovery");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code invalide.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError(null);
    try {
      await totpDisableRequest();
      setEnroll(null);
      setRecoveryCodes([]);
      setPhase("disabled");
    } catch {
      setError("Échec de la désactivation.");
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async () => {
    if (!enroll) return;
    try {
      await navigator.clipboard.writeText(enroll.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* silencieux */
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <ShieldCheck className="w-6 h-6 text-carbon-emerald" aria-hidden />
        <h1 className="text-xl font-display font-bold text-[var(--color-foreground)]">
          Double authentification (2FA)
        </h1>
      </div>
      <p className="text-sm text-[var(--color-foreground-muted)] mb-6">
        Ajoutez un second facteur (code temporel TOTP) pour protéger l&apos;accès à votre espace.
        Compatible avec Google Authenticator, Authy, 1Password, etc.
      </p>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/5 p-3 text-sm text-[var(--color-danger)]">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        {phase === "loading" && (
          <p className="flex items-center gap-2 text-sm text-[var(--color-foreground-muted)]">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Chargement…
          </p>
        )}

        {phase === "enabled" && (
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-success)]">
              <CheckCircle2 className="w-5 h-5" aria-hidden />
              La double authentification est activée.
            </p>
            <p className="mt-2 text-sm text-[var(--color-foreground-muted)]">
              Un code temporel vous sera demandé à chaque connexion.
            </p>
            <button
              type="button"
              onClick={disable}
              disabled={busy}
              className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[var(--color-danger)]/40 px-4 py-2 text-sm font-semibold text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
              Désactiver la 2FA
            </button>
          </div>
        )}

        {phase === "disabled" && (
          <div>
            <p className="text-sm text-[var(--color-foreground-muted)]">
              La 2FA n&apos;est pas activée sur votre compte.
            </p>
            <button
              type="button"
              onClick={startEnroll}
              disabled={busy}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-carbon-emerald px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <KeyRound className="w-4 h-4" aria-hidden />
              )}
              Activer la 2FA
            </button>
          </div>
        )}

        {phase === "enrolling" && enroll && (
          <form onSubmit={confirmActivate}>
            <ol className="space-y-4 text-sm text-[var(--color-foreground)]">
              <li>
                <p className="font-medium">1. Ajoutez la clé dans votre application</p>
                <p className="text-[var(--color-foreground-muted)] mt-1">
                  Scannez l&apos;URI ci-dessous, ou saisissez la clé manuellement :
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 break-all rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 font-mono text-xs">
                    {enroll.secret}
                  </code>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-xs hover:bg-[var(--color-surface-muted)]"
                    aria-label="Copier la clé secrète"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="mt-2 break-all font-mono text-[10px] text-[var(--color-foreground-subtle)]">
                  {enroll.otpauthUri}
                </p>
              </li>
              <li>
                <label htmlFor="totp-confirm" className="font-medium block">
                  2. Saisissez le code généré
                </label>
                <input
                  id="totp-confirm"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="mt-2 w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-center text-lg tracking-[0.3em] focus:outline-none focus:border-carbon-emerald"
                />
              </li>
            </ol>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="submit"
                disabled={busy || code.trim().length < 6}
                className="inline-flex items-center gap-2 rounded-lg bg-carbon-emerald px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
                Confirmer &amp; activer
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhase("disabled");
                  setEnroll(null);
                  setCode("");
                  setError(null);
                }}
                className="text-sm text-[var(--color-foreground-muted)] hover:text-[var(--color-foreground)]"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        {phase === "recovery" && (
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-success)]">
              <CheckCircle2 className="w-5 h-5" aria-hidden /> 2FA activée.
            </p>
            <p className="mt-3 text-sm text-[var(--color-foreground)]">
              Conservez vos <strong>codes de récupération</strong> en lieu sûr — ils ne seront plus
              affichés. Chacun est utilisable une seule fois si vous perdez votre application.
            </p>
            <ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">
              {recoveryCodes.map((c) => (
                <li
                  key={c}
                  className="rounded-md bg-[var(--color-surface-muted)] px-3 py-2 text-center text-[var(--color-foreground)]"
                >
                  {c}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setPhase("enabled")}
              className="mt-5 rounded-lg bg-carbon-emerald px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              J&apos;ai enregistré mes codes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
