"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Leaf, ArrowRight, Eye, EyeOff, Shield, Lock, CheckCircle, AlertCircle } from "lucide-react";

interface LoginScreenProps {
  onLogin: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onDemo: () => void;
}

export function LoginScreen({ onLogin, onDemo }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await onLogin(email, password);
      if (!result.ok) {
        setError(result.error ?? "Erreur de connexion.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden">

      {/* ═══ COLONNE GAUCHE — Illustration & bénéfices ═══ */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0a0f0a] flex-col justify-between p-16 overflow-hidden">

        {/* Fond mesh animé */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Grille subtile */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "linear-gradient(rgba(22,163,74,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(22,163,74,0.8) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          {/* Orbs */}
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-green-600/10 blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-cyan-500/8 blur-[100px] animate-pulse [animation-delay:3s]" />
          {/* Points décoratifs */}
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-green-400/30"
              style={{
                left: `${10 + (i * 37) % 80}%`,
                top: `${5 + (i * 53) % 90}%`,
              }}
              animate={{ opacity: [0.2, 0.8, 0.2] }}
              transition={{ duration: 3 + (i % 3), repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-white text-xl font-extrabold tracking-tighter">CarbonCo</span>
          </div>
        </div>

        {/* Contenu central */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-16">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-600/15 border border-green-500/20 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-400 font-semibold tracking-wide uppercase">Plateforme ESG & CSRD</span>
            </div>

            <h2 className="text-white font-extrabold text-4xl leading-tight tracking-tighter mb-6">
              Pilotez votre<br />
              <span
                style={{
                  background: "linear-gradient(135deg, #4ade80 0%, #22d3ee 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                conformité ESG
              </span><br />
              en toute sérénité.
            </h2>

            <p className="text-white/50 text-base leading-relaxed max-w-sm mb-12">
              Rejoignez 120+ entreprises qui automatisent leur reporting CSRD et génèrent leurs rapports ESRS en quelques clics.
            </p>

            {/* Bénéfices */}
            <div className="space-y-4">
              {[
                { icon: CheckCircle, text: "Conformité ESRS 2025 garantie", color: "text-green-400" },
                { icon: Shield, text: "Audit trail et traçabilité totale", color: "text-cyan-400" },
                { icon: Lock, text: "Hébergement souverain en France", color: "text-green-400" },
              ].map(({ icon: Icon, text, color }) => (
                <div key={text} className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
                  <span className="text-white/70 text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Stats bas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="relative z-10 grid grid-cols-3 gap-6 border-t border-white/10 pt-8"
        >
          {[
            { val: "120+", label: "Entreprises" },
            { val: "−78%", label: "Temps de reporting" },
            { val: "99.9%", label: "Disponibilité" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-extrabold text-white">{s.val}</div>
              <div className="text-xs text-white/40 uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* ═══ COLONNE DROITE — Formulaire ═══ */}
      <div className="w-full lg:w-1/2 bg-gradient-carbon flex items-center justify-center p-8 relative overflow-hidden">

        {/* Fond orbs mobile (visible seulement sur mobile) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none lg:hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-carbon-emerald/10 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cyan-500/8 rounded-full blur-3xl animate-pulse-slow [animation-delay:2s]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Logo mobile uniquement */}
          <div className="text-center mb-8 lg:hidden">
            <div className="w-16 h-16 rounded-2xl bg-gradient-esg flex items-center justify-center mx-auto mb-4">
              <Leaf className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-3xl font-bold text-white">CarbonCo</h1>
            <p className="mt-2 text-carbon-emerald-light/70 text-sm">
              Plateforme de pilotage ESG & CSRD
            </p>
          </div>

          {/* Titre formulaire */}
          <div className="mb-8">
            <h2 className="font-display text-2xl font-bold text-white mb-1">Bon retour 👋</h2>
            <p className="text-white/50 text-sm">Connectez-vous à votre espace CarbonCo</p>
          </div>

          {/* Card formulaire */}
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Email */}
              <div>
                <label htmlFor="login-email" className="block text-sm text-white/80 mb-1.5 font-medium">
                  Email professionnel
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@entreprise.fr"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "login-error" : undefined}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/40 transition-colors"
                />
              </div>

              {/* Mot de passe */}
              <div>
                <label htmlFor="login-password" className="block text-sm text-white/80 mb-1.5 font-medium">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    aria-invalid={error ? "true" : undefined}
                    aria-describedby={error ? "login-error" : undefined}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-white/40 text-sm focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/40 pr-11 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    aria-pressed={Boolean(showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Message d'erreur */}
              {error && (
                <div
                  id="login-error"
                  role="alert"
                  aria-live="polite"
                  className="flex items-center gap-2 p-3 rounded-xl bg-red-500/15 border border-red-500/30"
                >
                  <AlertCircle className="w-4 h-4 text-red-300 flex-shrink-0" />
                  <span className="text-xs text-red-200">{error}</span>
                </div>
              )}

              {/* Bouton connexion */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-esg text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all hover:scale-[1.01] cursor-pointer shadow-lg shadow-green-900/30 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-transparent"
              >
                {loading ? "Connexion…" : "Se connecter"}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>

          {/* CTA démo secondaire */}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 text-center">
            <p className="text-xs text-white/40 mb-3">Pas encore client ?</p>
            <button
              type="button"
              onClick={onDemo}
              className="w-full py-3 rounded-xl border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-all hover:scale-[1.01] cursor-pointer flex items-center justify-center gap-2"
            >
              Accès démo (sans compte)
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Trust signals */}
          <div className="mt-6 flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-1.5 text-white/30">
              <span className="text-base">🇫🇷</span>
              <span className="text-xs">Hébergé en France</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/30">
              <Lock className="w-3.5 h-3.5" />
              <span className="text-xs">AES-256</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/30">
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="text-xs">RGPD natif</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
