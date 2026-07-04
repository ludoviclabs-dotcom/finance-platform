# Activer la carte Mapbox sur /materials

La page `/materials` embarque une choroplèthe Mapbox GL (pays colorés par poids
d'approvisionnement, popup au clic) **désactivée par défaut**. Sans token, la
carte SVG statique actuelle reste affichée — aucune régression.

L'activation se fait uniquement par variable d'environnement : **aucun code à
modifier**.

## 1. Créer le token (5 min, gratuit)

1. Créer un compte sur <https://account.mapbox.com> (free tier : 50 000
   chargements de carte/mois — largement suffisant).
2. Menu **Tokens** → **Create a token**.
3. Nom : `carbonco-materials`.
4. Scopes : laisser les **scopes publics par défaut** (`styles:read`,
   `fonts:read`, etc.) — ne cocher aucun scope secret.
5. **URL restrictions** (recommandé, empêche le vol du token) :
   - `https://carbon-snowy-nine.vercel.app`
   - `http://localhost:3003`
   - l'éventuel domaine custom.
6. Copier le token — il commence par `pk.` (token **public**, conçu pour être
   exposé côté navigateur ; c'est la restriction d'URL qui le protège).

## 2. Poser le token sur Vercel (prod + previews)

Dashboard Vercel → projet **carbon** → **Settings** → **Environment Variables** :

| Champ | Valeur |
|---|---|
| Key | `NEXT_PUBLIC_MAPBOX_TOKEN` |
| Value | `pk.…` |
| Environments | Production + Preview |

Puis **redéployer** (Deployments → ⋯ → Redeploy) : les variables `NEXT_PUBLIC_*`
sont inlinées au build, un simple restart ne suffit pas.

Alternative CLI :

```bash
vercel env add NEXT_PUBLIC_MAPBOX_TOKEN production
vercel env add NEXT_PUBLIC_MAPBOX_TOKEN preview
```

## 3. En local

```bash
# apps/carbon/.env.local (jamais commité)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.…
```

Puis relancer `npm run dev`.

## Comment ça bascule

- `lib/mapbox.ts` : `isMapboxEnabled()` = le token existe et commence par `pk.`.
- `components/materials/GlobalMapSection.tsx` : token présent →
  `InteractiveGlobalMap` (chargé dynamiquement, `ssr:false`, le chunk mapbox-gl
  ~1,5 Mo n'est téléchargé que dans ce cas) ; sinon → `GlobalMap` (SVG statique).
- Token invalide/expiré : warning console, la page ne casse pas.

## Données affichées

`lib/crm/countryWeights.ts` agrège les `top_producers` du snapshot CRM par pays
(38 pays mappés FR → ISO 3166-1 alpha-2) et alimente le tileset Mapbox
`country-boundaries-v1`. Intensité rouge ∝ poids cumulé ; clic sur un pays →
popup avec les matières produites et leurs parts.
