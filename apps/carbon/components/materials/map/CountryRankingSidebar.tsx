"use client";

/**
 * Classement des pays producteurs, en regard de la carte.
 *
 * La version précédente rejouait en boucle une animation « révélation →
 * pause avec halo sur le n°1 → dissolution ». La refonte la supprime : le
 * tableau est statique et lisible d'emblée, la seule animation restante étant
 * la croissance des barres à la première pose. Sélectionner une ligne pilote
 * la carte (et réciproquement) et ouvre le détail de la matière sous le
 * tableau.
 */

import type { CountryWeight } from "@/lib/crm/countryWeights";

interface Props {
  weights: CountryWeight[];
  selectedCountry: string | null;
  onSelectCountry: (country: string | null) => void;
}

const RANK_SIZE = 10;
const DETAIL_SIZE = 6;

export default function CountryRankingSidebar({ weights, selectedCountry, onSelectCountry }: Props) {
  const top = weights.slice(0, RANK_SIZE);
  const maxTotal = top[0]?.total || 1;
  const selected = weights.find(w => w.country === selectedCountry) ?? null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-heading)",
            fontWeight: 600,
            fontSize: 22,
            lineHeight: "24px",
            letterSpacing: ".02em",
            textTransform: "uppercase",
          }}
        >
          Classement des pays
        </h3>
        <span style={{ fontSize: 12, color: "var(--ink-70)" }}>poids cumulé, pts</span>
      </div>

      {/* Quatre colonnes égales : c'est ce que la maquette affiche. Son
          <colgroup> (36px / 38 % / auto / 52px) n'atteint jamais le DOM rendu
          par son runtime, et la table fixe répartit alors la largeur à parts
          égales — noms longs tronqués compris (« Afrique d… »). */}
      <table className="ind-table" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th scope="col">№</th>
            <th scope="col">Pays</th>
            <th scope="col">Poids</th>
            <th scope="col" style={{ textAlign: "right" }}>pts</th>
          </tr>
        </thead>
        <tbody>
          {top.map((c, i) => {
            const isOn = selectedCountry === c.country;
            return (
              <tr
                key={c.country}
                // Le clic sur la ligne entière est un confort de pointage ; la
                // commande réelle est le bouton de la cellule « Pays », qui
                // porte le focus et les sémantiques Entrée/Espace. Sans lui,
                // sélectionner un pays redeviendrait impossible au clavier.
                onClick={() => onSelectCountry(isOn ? null : c.country)}
                style={{
                  cursor: "pointer",
                  background: isOn ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "transparent",
                }}
              >
                <td style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".08em", color: "var(--color-accent-700)", fontFeatureSettings: "'tnum' 1" }}>
                  {String(i + 1).padStart(2, "0")}
                </td>
                <td>
                  <button
                    type="button"
                    aria-pressed={isOn}
                    // Le clic est déjà traité ici : le laisser remonter au <tr>
                    // rejouerait la bascule et annulerait la sélection.
                    onClick={event => {
                      event.stopPropagation();
                      onSelectCountry(isOn ? null : c.country);
                    }}
                    className="whitespace-nowrap overflow-hidden text-ellipsis w-full text-left"
                    // `font: inherit` en ligne remettait la graisse à 400 malgré
                    // `font-medium` : la graisse 500 de la maquette est posée après.
                    style={{ border: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: 500, padding: 0, cursor: "pointer" }}
                  >
                    {c.country}
                  </button>
                </td>
                <td>
                  <div style={{ height: 4, background: "var(--color-divider)" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.max(2, (c.total / maxTotal) * 100)}%`,
                        // Le premier est tracé à l'encre, les suivants à
                        // l'accent : un seul repère de tête, pas une échelle
                        // de couleurs de plus.
                        background: i === 0 ? "var(--color-text)" : "var(--color-accent)",
                        transition: "width .9s cubic-bezier(.16,1,.3,1)",
                      }}
                    />
                  </div>
                </td>
                <td style={{ textAlign: "right", fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 18, letterSpacing: ".02em", fontFeatureSettings: "'tnum' 1" }}>
                  {Math.round(c.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selected && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--color-divider)" }}>
          <div className="flex items-baseline justify-between gap-3">
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                fontSize: 22,
                lineHeight: "24px",
                letterSpacing: ".02em",
                textTransform: "uppercase",
              }}
            >
              {selected.country}
            </p>
            <button
              type="button"
              className="ind-btn ind-btn-ghost"
              onClick={() => onSelectCountry(null)}
              style={{ padding: "0 6px" }}
            >
              Fermer
            </button>
          </div>
          <p style={{ margin: "2px 0 12px", fontSize: 13, color: "var(--color-accent-700)", fontWeight: 600, letterSpacing: ".04em", fontFeatureSettings: "'tnum' 1" }}>
            {selected.materials.length} matière(s) · poids cumulé {Math.round(selected.total)} pts
          </p>
          <div className="flex flex-col gap-2">
            {selected.materials.slice(0, DETAIL_SIZE).map(m => (
              <div key={m.id} className="grid grid-cols-[minmax(0,1fr)_80px_44px] gap-3 items-center" style={{ fontSize: 14 }}>
                <span className="whitespace-nowrap overflow-hidden text-ellipsis">{m.name_fr}</span>
                <div style={{ height: 3, background: "var(--color-divider)" }}>
                  <div style={{ height: "100%", width: `${m.share_pct}%`, background: "var(--color-accent)" }} />
                </div>
                <span style={{ textAlign: "right", fontWeight: 600, color: "var(--ink-70)", fontFeatureSettings: "'tnum' 1" }}>
                  {m.share_pct} %
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ margin: "24px 0 0", fontSize: 13, lineHeight: "20px", color: "var(--ink-70)" }}>
        Stade de production agrégé — extraction, raffinage et transformation non distingués.
      </p>
    </div>
  );
}
