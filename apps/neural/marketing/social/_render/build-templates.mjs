import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── SECTOR DATA ─────────────────────────────────────────────────────────
const SECTORS = {
  banque: {
    label: "Banque",
    emoji: "🏦",
    eyebrow: "Banque · DORA · Bâle IV",
    coverTitle: "Conformité bancaire,<br/><i>cadrée</i> dès le premier jour.",
    coverKpi: "−85% relecture manuelle",
    storyTitle: "IFRS 17, KYC,<br/>Bâle IV.",
    storySub: "Les agents qui passent la gouvernance.",
    slides: [
      { kicker: "Le constat", title: "80% des projets IA bancaires meurent en comité gouvernance.", body: "Pas un problème technique. Un problème de traçabilité." },
      { kicker: "La cause", title: "PoC sans audit trail = audit interne KO.", body: "Les directions risque exigent : qui a décidé · sur quelles données · validé par qui." },
      { kicker: "La méthode", title: "RegBankComms — chaque message, chaque décision logué.", body: "Audit trail DORA-ready · validation 4 yeux · workflow gouvernance natif." },
      { kicker: "Les KPIs", title: "−85% temps relecture.<br/>0 incident IFRS 17.", body: "Bascule absorbée pendant deux nuits, zéro erreur (CFO assureur mutualiste)." },
      { kicker: "Le forfait", title: "Business · 4 900 €/mois.<br/>Du PoC encadré au déploiement multi-pays.", body: "ROI cadré contractuellement · ajustement à J+90 si KPIs non atteints." },
      { kicker: "Le rendez-vous", title: "Cadrage 30 min, sans engagement.", body: "neural-five.vercel.app/contact" },
    ],
  },
  luxe: {
    label: "Luxe",
    emoji: "👜",
    eyebrow: "Luxe · CSRD · Brand voice",
    coverTitle: "Précision lexicale absolue.<br/><i>ESG vérifiable</i> avant publication.",
    coverKpi: "−68% temps reporting",
    storyTitle: "Brand voice,<br/>multi-maisons,<br/>ESG.",
    storySub: "Les agents qui parlent comme votre maison.",
    slides: [
      { kicker: "Le constat", title: "Une virgule, trois maisons, cinq pays.<br/>Pas de marge d'erreur.", body: "Le luxe exige une précision lexicale et ESG impossible à obtenir d'un LLM générique." },
      { kicker: "La cause", title: "Un GPT généraliste ne distingue pas Hermès de Berluti.", body: "Le brand voice se construit sur 30 ans. Il ne s'invente pas en 30 secondes." },
      { kicker: "La méthode", title: "MaisonVoiceGuard + GreenClaimChecker.", body: "Brand voice par maison · vocabulaire validé · claims ESG vérifiables avant publication." },
      { kicker: "Les KPIs", title: "−68% temps de reporting.<br/>100% claims vérifiés.", body: "« Trois semaines de reporting manuel en quatre jours » — DAF maison CAC 40." },
      { kicker: "Le forfait", title: "Business · 4 900 €/mois.<br/>3–4 branches métier.", body: "Comms · marketing · ESG · supply. Cadrage défini avec vous." },
      { kicker: "Le rendez-vous", title: "Cadrage 30 min, sans engagement.", body: "neural-five.vercel.app/contact" },
    ],
  },
  assurance: {
    label: "Assurance",
    emoji: "🛡",
    eyebrow: "Assurance · IFRS 17 · Sinistres",
    coverTitle: "IFRS 17 absorbé sans incident.<br/><i>Deux nuits, zéro erreur.</i>",
    coverKpi: "0 incident IFRS 17",
    storyTitle: "Sinistres, IFRS 17,<br/>tarification.",
    storySub: "Les agents qui ne dorment pas.",
    slides: [
      { kicker: "Le constat", title: "IFRS 17 = bascule un week-end.<br/>Pas de seconde chance.", body: "La transition représente des mois de préparation. L'erreur coûte le rapport annuel." },
      { kicker: "La cause", title: "Les équipes finance ne dorment pas pendant la bascule.", body: "Et ne peuvent pas se permettre la moindre divergence post-bascule." },
      { kicker: "La méthode", title: "Agent IFRS 17 dédié — exécution + audit + rollback.", body: "Validation humaine sur chaque step critique. Rollback instantané si divergence." },
      { kicker: "Les KPIs", title: "Zéro incident.<br/>Deux nuits de bascule.", body: "« Leur agent a absorbé la bascule pendant que mes équipes dormaient » — CFO mutualiste." },
      { kicker: "Le forfait", title: "Enterprise · à partir de 35 000 €/mois.<br/>5–7 branches · CSM dédié.", body: "Cadrage défini avec vous · déploiement multi-pays · rollback contractuel." },
      { kicker: "Le rendez-vous", title: "Cadrage 30 min, sans engagement.", body: "neural-five.vercel.app/contact" },
    ],
  },
  saas: {
    label: "SaaS",
    emoji: "💻",
    eyebrow: "SaaS · PLG · Revenue",
    coverTitle: "PLG analytics, churn, revenue intel.<br/><i>Connectés à votre stack.</i>",
    coverKpi: "+38% conversion trial→paid",
    storyTitle: "PLG, churn,<br/>revenue intel.",
    storySub: "Les agents qui parlent à votre Stripe.",
    slides: [
      { kicker: "Le constat", title: "Les SaaS croulent sous la donnée.<br/>Pas sous l'insight.", body: "Stripe, Segment, Mixpanel, Amplitude — chaque outil isolé, aucun signal consolidé." },
      { kicker: "La cause", title: "Un dashboard ne décide rien.", body: "Il faut un agent qui lit, croise, alerte et propose une action mesurable." },
      { kicker: "La méthode", title: "Revenue Intel Agent — connecteurs natifs + reasoning.", body: "Lit Stripe · Segment · Salesforce · alerte sur churn-risk · propose actions priorisées." },
      { kicker: "Les KPIs", title: "+38% conversion trial→paid.<br/>−27% churn early-stage.", body: "Action automatisée sur signaux faibles : reactivation séquences, pricing dynamique." },
      { kicker: "Le forfait", title: "Business · 4 900 €/mois.<br/>Analytics avancés · support prioritaire.", body: "Connecteurs Stripe / Segment / Salesforce / HubSpot inclus." },
      { kicker: "Le rendez-vous", title: "Cadrage 30 min, sans engagement.", body: "neural-five.vercel.app/contact" },
    ],
  },
  transport: {
    label: "Transport",
    emoji: "🚆",
    eyebrow: "Transport · Supply · OIV",
    coverTitle: "+42% précision prévisions.<br/><i>« Et voici la ligne de P&amp;L. »</i>",
    coverKpi: "+42% précision prévisions",
    storyTitle: "Supply chain<br/>temps réel.",
    storySub: "P&L par ligne de planning.",
    slides: [
      { kicker: "Le constat", title: "Une présentation IA qui finit par<br/><i>« et voici la ligne de P&amp;L »</i>.", body: "Verbatim COO transporteur européen — première fois qu'il voyait ça." },
      { kicker: "La cause", title: "Les prévisions classiques optimisent<br/>sans contextualiser le coût.", body: "L'agent doit lier planning, météo, P&L, et expliquer chaque arbitrage." },
      { kicker: "La méthode", title: "LogisticsOptimizer — prévision + P&L par ligne.", body: "+42% précision · audit-trail OIV-ready · alertes maintenance prédictive." },
      { kicker: "Les KPIs", title: "+42% précision prévisions.<br/>Réduction stocks tampon.", body: "Et chaque arbitrage est traçable jusqu'à la ligne comptable concernée." },
      { kicker: "Le forfait", title: "Business · 4 900 €/mois.<br/>3–4 branches métier.", body: "Supply · maintenance · planification · communication client temps réel." },
      { kicker: "Le rendez-vous", title: "Cadrage 30 min, sans engagement.", body: "neural-five.vercel.app/contact" },
    ],
  },
  aeronautique: {
    label: "Aéronautique",
    emoji: "✈",
    eyebrow: "Aéro · EASA · MRO",
    coverTitle: "Supply chain critique, EASA-ready.<br/><i>MRO intelligent.</i>",
    coverKpi: "MRO 100% EASA-ready",
    storyTitle: "MRO, supply,<br/>EASA.",
    storySub: "Les agents certifiables.",
    slides: [
      { kicker: "Le constat", title: "MRO + EASA + supply = no place for hallucinations.", body: "L'aéro n'a pas droit aux approximations LLM. Chaque fait doit être sourcé et certifiable." },
      { kicker: "La cause", title: "Un LLM générique ne sait pas distinguer<br/>une AD-FAA d'une SB-EASA.", body: "Il faut un agent entraîné sur les nomenclatures réglementaires aéro." },
      { kicker: "La méthode", title: "AeroComms + MRO Agent — sources tracées.", body: "Chaque réponse cite l'AD/SB/MEL d'origine · audit EASA-ready · validation humaine." },
      { kicker: "Les KPIs", title: "100% sourcing EASA.<br/>Réduction délai supply pièces critiques.", body: "Aucun message produit sans citation traçable de la source réglementaire." },
      { kicker: "Le forfait", title: "Enterprise · à partir de 35 000 €/mois.<br/>CSM dédié · cadrage avec vous.", body: "Déploiement on-prem ou VPC privé · isolation données complète." },
      { kicker: "Le rendez-vous", title: "Cadrage 30 min, sans engagement.", body: "neural-five.vercel.app/contact" },
    ],
  },
};

// ─── COVER (1584×396) ────────────────────────────────────────────────────
const coverHTML = (s) => `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/><title>NEURAL — ${s.label} cover</title>
<link rel="stylesheet" href="../_render/shared.css"/>
<style>
  body { width: 1584px; height: 396px; }
  .frame { display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 40px 64px; gap: 48px; }
  .halo-violet { top: -120px; right: -80px; width: 600px; height: 600px; }
  .halo-green { bottom: -200px; left: -100px; }
  .left { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 22px; max-width: 950px; }
  .right { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: flex-end; gap: 22px; }
  .cover-title { font-size: 52px; line-height: 1.04; }
  .cover-meta { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
  .url-line { font-size: 14px; }
</style></head>
<body><div class="frame">
  <div class="grid"></div>
  <div class="halo-violet"></div>
  <div class="halo-green"></div>
  <div class="left">
    <span class="eyebrow"><span class="dot"></span>${s.eyebrow}</span>
    <h1 class="h-display cover-title">${s.coverTitle}</h1>
    <div class="cover-meta">
      <span class="kpi-pill">●  ${s.coverKpi}</span>
      <span class="url-line">neural-five.vercel.app</span>
    </div>
  </div>
  <div class="right">
    <div class="logo">
      <div class="logo-mark">N</div>
      <div class="logo-name">NEURAL</div>
    </div>
    <span class="eyebrow"><span class="dot"></span>Opérateur IA</span>
  </div>
</div></body></html>`;

// ─── STORY (1080×1920) ───────────────────────────────────────────────────
const storyHTML = (s) => `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/><title>NEURAL — ${s.label} story</title>
<link rel="stylesheet" href="../_render/shared.css"/>
<style>
  body { width: 1080px; height: 1920px; }
  .frame { padding: 80px 64px; display: flex; flex-direction: column; }
  .halo-violet { top: -200px; right: -200px; width: 700px; height: 700px; }
  .halo-green { bottom: -100px; left: -200px; }
  header { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; }
  main { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 40px; }
  .story-title { font-size: 110px; line-height: 1; letter-spacing: -0.045em; }
  .story-sub { font-size: 32px; color: var(--white70); line-height: 1.4; max-width: 880px; }
  .story-divider { width: 80px; height: 4px; background: var(--violet); border-radius: 999px; }
  footer { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 24px; }
  .cta-block { padding: 40px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); border-radius: 24px; }
  .cta-title { font-family: var(--ff-head); font-size: 36px; font-weight: 700; color: #fff; margin-bottom: 8px; letter-spacing: -0.03em; }
  .cta-url { font-size: 22px; color: var(--violet-l); font-weight: 500; }
  .footer-meta { display: flex; align-items: center; justify-content: space-between; }
  .url-line { font-size: 16px; }
</style></head>
<body><div class="frame">
  <div class="grid"></div>
  <div class="halo-violet"></div>
  <div class="halo-green"></div>

  <header>
    <div class="logo">
      <div class="logo-mark">N</div>
      <div class="logo-name">NEURAL</div>
    </div>
    <span class="eyebrow"><span class="dot"></span>${s.label}</span>
  </header>

  <main>
    <div class="story-divider"></div>
    <h1 class="h-display story-title">${s.storyTitle}</h1>
    <p class="story-sub">${s.storySub}</p>
    <span class="kpi-pill" style="font-size:18px; padding:14px 22px; align-self:flex-start;">●  ${s.coverKpi}</span>
  </main>

  <footer>
    <div class="cta-block">
      <div class="cta-title">Cadrage 30 min, sans engagement.</div>
      <div class="cta-url">neural-five.vercel.app/contact</div>
    </div>
    <div class="footer-meta">
      <span class="url-line">${s.eyebrow}</span>
      <span class="url-line">2026</span>
    </div>
  </footer>
</div></body></html>`;

// ─── CAROUSEL (1080×1080) — 6 slides via ?slide=N param ──────────────────
const carouselHTML = (s) => `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/><title>NEURAL — ${s.label} carrousel</title>
<link rel="stylesheet" href="../_render/shared.css"/>
<style>
  body { width: 1080px; height: 1080px; }
  .frame { padding: 64px; display: flex; flex-direction: column; }
  .halo-violet { top: -150px; right: -150px; width: 500px; height: 500px; }
  .halo-green { bottom: -150px; left: -150px; }
  header { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; }
  main { position: relative; z-index: 1; flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 28px; }
  .kicker { font-family: var(--ff-sans); font-size: 16px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--violet-l); }
  .slide-title { font-family: var(--ff-head); font-size: 64px; font-weight: 700; line-height: 1.06; letter-spacing: -0.035em; }
  .slide-title i { font-style: italic; color: var(--violet-l); }
  .slide-body { font-size: 22px; line-height: 1.5; color: var(--white70); max-width: 800px; }
  footer { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; }
  .progress { display: flex; gap: 6px; }
  .progress span { width: 30px; height: 4px; border-radius: 999px; background: rgba(255,255,255,0.15); }
  .progress span.active { background: var(--violet-l); }
  .swipe-cue { font-size: 14px; color: var(--white55); letter-spacing: 0.10em; text-transform: uppercase; }
  .url-line { font-size: 14px; }

  /* Title slide variant (slide 1) — bigger title */
  body.s1 .slide-title { font-size: 80px; }
  body.s1 .kicker { color: var(--green); }

  /* Final slide variant (slide 6) — emphasized CTA */
  body.s6 main { gap: 36px; align-items: flex-start; }
  body.s6 .slide-title { font-size: 72px; }
  body.s6 .slide-body { font-size: 28px; color: var(--violet-l); font-weight: 500; }
</style>
<script>
  // Read ?slide=N to set body class
  const params = new URLSearchParams(window.location.search);
  const slide = parseInt(params.get('slide') || '1', 10);
  document.documentElement.dataset.slide = String(slide);
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('s' + slide);
    // Hide all but the active slide
    document.querySelectorAll('[data-slide]').forEach(el => {
      el.style.display = el.dataset.slide === String(slide) ? '' : 'none';
    });
    // Activate progress dots
    document.querySelectorAll('.progress span').forEach((el, idx) => {
      if (idx < slide) el.classList.add('active');
    });
  });
</script>
</head><body><div class="frame">
  <div class="grid"></div>
  <div class="halo-violet"></div>
  <div class="halo-green"></div>

  <header>
    <div class="logo">
      <div class="logo-mark">N</div>
      <div class="logo-name">NEURAL</div>
    </div>
    <span class="eyebrow"><span class="dot"></span>${s.label}</span>
  </header>

  <main>
    ${s.slides.map((sl, i) => `
    <div data-slide="${i + 1}">
      <div class="kicker" style="margin-bottom:18px;">${sl.kicker}</div>
      <h2 class="slide-title">${sl.title}</h2>
      <p class="slide-body" style="margin-top:24px;">${sl.body}</p>
    </div>`).join("\n")}
  </main>

  <footer>
    <div class="progress">
      <span></span><span></span><span></span><span></span><span></span><span></span>
    </div>
    <span class="swipe-cue">Swipe →</span>
    <span class="url-line">neural-five.vercel.app</span>
  </footer>
</div></body></html>`;

// ─── WRITE FILES ─────────────────────────────────────────────────────────
for (const [slug, s] of Object.entries(SECTORS)) {
  mkdirSync(resolve(ROOT, "covers"), { recursive: true });
  mkdirSync(resolve(ROOT, "stories"), { recursive: true });
  mkdirSync(resolve(ROOT, "carousels"), { recursive: true });

  writeFileSync(resolve(ROOT, "covers", `${slug}.html`), coverHTML(s));
  writeFileSync(resolve(ROOT, "stories", `${slug}.html`), storyHTML(s));
  writeFileSync(resolve(ROOT, "carousels", `${slug}.html`), carouselHTML(s));
  console.log("Built templates for:", slug);
}

console.log(`\n${Object.keys(SECTORS).length} sectors × 8 files (1 cover + 1 story + 6 carousel slides) = ${Object.keys(SECTORS).length * 8} renderable units`);
