# Kit social NEURAL — Mode d'emploi

**STATUT : EN ATTENTE DE PUBLICATION** — aucun asset n'a été publié sur LinkedIn ou ailleurs. Tout est local. Tu publies toi-même quand prêt.

## Inventaire

48 PNGs prêts à publier, 6 secteurs × 8 unités :

| Format | Dimensions | Quantité | Localisation |
| --- | --- | --- | --- |
| LinkedIn cover (page entreprise) | 1584 × 396 | 6 | `covers/` |
| LinkedIn / Instagram story | 1080 × 1920 | 6 | `stories/` |
| LinkedIn carousel (PDF document post) | 1080 × 1080 | 6 × 6 slides = 36 | `carousels/<secteur>/` |

Secteurs couverts : `banque`, `luxe`, `assurance`, `saas`, `transport`, `aeronautique`.

Tous les PNGs sont rendus à `deviceScaleFactor: 2` (retina), palette midnight + violet + vert NEURAL.

## Comment publier

### Cover LinkedIn (page entreprise)

1. LinkedIn → Page entreprise → "Modifier la page" → "Bannière"
2. Upload `covers/<secteur>.png` (1584×396 — format natif LinkedIn)
3. Roter chaque mois ou à chaque campagne sectorielle

### Carrousel LinkedIn

LinkedIn n'accepte pas un dossier d'images comme carrousel — il faut **un PDF assemblé** des 6 slides. Pour un secteur donné :

```bash
# Depuis carousels/<secteur>/ (nécessite ImageMagick ou similaire)
cd carousels/banque
magick slide-1.png slide-2.png slide-3.png slide-4.png slide-5.png slide-6.png banque-carousel.pdf
```

Puis sur LinkedIn : "Créer une publication" → "Document" → upload du PDF → publier.

Si pas d'ImageMagick : utiliser https://www.ilovepdf.com/jpg_to_pdf en uploadant les 6 PNGs dans l'ordre.

### Story (LinkedIn / Instagram)

LinkedIn : "Créer une publication" → image → upload `stories/<secteur>.png`.
Instagram (depuis mobile) : Stories → galerie → sélectionner le PNG.

## Régénérer le kit

Si tu modifies les données ou le design :

```bash
cd apps/neural/marketing/social/_render
npm install playwright
npx playwright install chromium
node build-templates.mjs    # régénère les HTML depuis les données sectorielles
node generate-social.mjs    # rend tous les PNG via Playwright
```

Données sources : `_render/build-templates.mjs` — objet `SECTORS` (label, eyebrow, slides, KPIs).

## Garde-fous appliqués

- ✓ Aucune publication automatique vers LinkedIn ou autre réseau social
- ✓ Aucun appel API sortant (l'outil tourne 100% local + chromium headless)
- ✓ Palette NEURAL imposée : `#0A1628 / #7C3AED / #10B981 / #FAF8F5`
- ✓ Typo : Inter (corps) + Space Grotesk (titres) — chargées via Google Fonts
- ✓ Aucune image générée IA / aucun visage humain
- ✓ Tous les KPIs cités sont sourcés sur les vrais témoignages clients (LVMH/ADP/AXA)

## Cadence de publication suggérée

- **Carrousel sectoriel** : 1 par semaine, rotation sur les 6 secteurs (cycle 6 semaines)
- **Story** : ponctuelle, à l'occasion de la sortie d'un nouvel article ou d'un cas client
- **Cover entreprise** : aligner sur le secteur de la semaine ou la campagne en cours

Aucune obligation — c'est ton calendrier éditorial.
