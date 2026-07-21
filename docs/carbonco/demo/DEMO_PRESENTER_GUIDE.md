# DEMO_PRESENTER_GUIDE — guide de l'animateur « Asterion Motion »

> **100 % FICTIF · IA SIMULÉE · ZÉRO APPEL EXTERNE.** Guide pratique pour présenter la
> démonstration `asterion-motion-v1` : prérequis, lancement, raccourcis, discours,
> objections, reset, et marche à suivre si les données ne sont pas seedées.
> Voir aussi : [`DEMO_SCRIPT_2_MINUTES.md`](./DEMO_SCRIPT_2_MINUTES.md),
> [`DEMO_SCRIPT_5_MINUTES.md`](./DEMO_SCRIPT_5_MINUTES.md),
> [`DEMO_ARCHITECTURE.md`](./DEMO_ARCHITECTURE.md).

## 1. Prérequis

**Le cockpit fonctionne en autonomie.** La route `/demo/asterion-motion` rend des données
Asterion **figées** (dérivées du scénario) dans les vrais composants produit. Elle
**fonctionne hors-ligne, sans base de données ni seed** : pour une présentation « écran »,
aucun prérequis.

**Le seed n'est requis que pour « Explorer dans l'application ».** Les boutons « Explorer »
de chaque étape ouvrent la vraie page du tenant démo (`/dashboard`, `/scopes`, `/iro`,
`/water`, `/intelligence/sources`…). Pour que ces pages soient peuplées, il faut avoir
**exécuté le seed au préalable** :

1. Lancer le workflow GitHub **`demo-scenario`** (`.github/workflows/demo-scenario.yml`),
   action **`seed`** (déclenchement manuel). Puis, idéalement, action **`verify`** pour
   confirmer la parité.
2. S'assurer que l'application tourne avec **`AI_REVIEW_MODE=demo`** (valeur par défaut).

> Le seed est **idempotent** : le relancer ne duplique rien. Il n'écrit que dans le tenant
> démo `asterion-motion-demo`. **Aucune écriture automatique au déploiement** — c'est un geste
> opérateur explicite.

**Accès à la vraie application.** L'exploration s'authentifie via `POST /auth/demo`, qui émet
un **JWT court** (rôle `analyst`, claim `demo:true`, sans refresh cookie → auto-expiration).
Aucun mot de passe démo n'est à saisir ni à partager. L'endpoint **ne seed pas** ; il garantit
seulement que l'entreprise et l'utilisateur démo existent.

## 2. Lancer la démonstration

- **URL** : `/demo/asterion-motion` (route sœur, **distincte** de la route cinématique
  existante `/demo` — ne pas confondre).
- **Trois modes** :
  - **`guided`** — pas-à-pas, vous contrôlez le rythme (idéal en réunion, ~5 min).
  - **`director`** — lecture automatique d'environ deux minutes (idéal en accueil/boucle).
  - **`explore`** — libre, le visiteur navigue les étapes à sa guise.
- **Badges permanents** à l'écran : **IA SIMULÉE · ZÉRO APPEL EXTERNE · DÉMONSTRATION
  FICTIVE**. Ne jamais les masquer.

### Raccourcis clavier

| Touche | Action |
|---|---|
| **→** / **Espace** | Étape suivante |
| **←** | Étape précédente |
| **R** | **Recommencer** — retour à l'étape 1 (état local du cockpit) |
| **?** | Afficher / masquer l'aide raccourcis |
| **Échap** | Fermer l'aide raccourcis |

En mode `director`, **Précédent** (ou ←) met l'enchaînement en pause ; les contrôles
**Lecture/Pause** pilotent l'avancement automatique. La navigation reste interruptible à tout moment.
Les animations respectent **`prefers-reduced-motion`** : si le poste réduit les animations, la
démonstration reste parfaitement lisible (transitions neutralisées).

## 3. Fil narratif (rappel express)

Situation (12 000 moteurs) → Import (5,8 M€) → Scope 3 (aimants 61,8 %) → CRMA (dépendance
92 % `estimated`) → Scope 2 (LB 1 860 / MB 1 090, couverture 54 %) → Eau/nature (72 000 m³,
stress élevé, confiance 0,81) → IRO (exposition 1,4 M€) → **IA citée (4 cas)** → Décision
humaine → Evidence Pack.

Le **cœur** est la revue IA : quatre affirmations, quatre statuts **calculés** — soutenu,
partiellement soutenu, contredit, non étayé — puis la **gate de revue humaine**.

## 4. Objections fréquentes et réponses

**« Est-ce que l'IA prend les décisions ? »**
> Non. L'IA est **consultative** : elle sélectionne des preuves, résout des citations et
> propose des brouillons *étiquetés*. Chaque proposition passe par une **gate de revue
> humaine** (accepter / rejeter / modifier + justification) avant tout effet métier. Accepter
> crée au mieux un IRO *candidate* — jamais une publication automatique. L'humain décide,
> toujours.

**« Ces chiffres sont-ils réels ? »**
> Non. Tout est **100 % fictif et synthétique** : l'entreprise Asterion Motion, le produit
> E-Drive X4, les sites, les fournisseurs, les montants. Chaque donnée seedée porte
> `synthetic=true` et un statut explicite. Aucune donnée client, aucun cas réel. Les badges à
> l'écran le rappellent en permanence.

**« Est-ce que ça appelle un modèle payant ? »**
> Non. La revue tourne en **mode `demo` déterministe** (`AI_REVIEW_MODE=demo`) : réponse
> reproductible construite à partir du reference pack, **aucun modèle payant, aucun appel
> réseau externe**. Le mode `live` n'est **jamais** activé dans la démonstration. Rejouer le
> même parcours donne exactement le même résultat.

**« Comment un statut peut-il être fiable si c'est de l'IA ? »**
> Parce que le statut n'est **pas déclaré par le modèle** : il est **calculé** par le service
> d'entailment à partir des preuves. Le modèle propose une affirmation et des citations ; le
> backend confronte et tranche : soutenu (corroboré par un calcul), partiel (preuve estimée),
> contredit (écart chiffré prouvé), non étayé (aucune preuve). C'est vérifiable et
> reproductible.

**« Pourquoi "estimé" et "vérifié" sont-ils distingués ? »**
> Parce que confondre les deux est la première source d'erreur ESG. La dépendance terres rares
> à 92 % est `estimated` : l'assistant ne peut donc, au mieux, que *partiellement* la soutenir
> (cas 2). *Estimé ≠ vérifié*, jusque dans le statut de support.

**« Et la confidentialité des sources ? »**
> La trace montre le **filtrage** : la grille tarifaire (`confidential`) et le benchmark sous
> licence sans droit d'affichage sont **exclus** du reference pack. Seules les preuves
> autorisées et affichables sont citées.

## 5. Le reset

- Appuyer sur **R** ramène le tour à l'**étape 1**.
- Côté données, le reset applicatif est **borné au tenant démo** : le script
  `demo_reset.py` (et l'action `reset` du workflow) purge **uniquement** `asterion-motion-demo`
  puis peut re-seeder. **Aucune donnée réelle n'est jamais touchée** (garde-slug).
- Bonne pratique en boucle d'accueil : `reset` du workflow entre deux sessions publiques pour
  repartir d'un état propre et identique.

## 6. Si les données ne sont pas seedées

Symptôme : les boutons **« Explorer dans l'application »** mènent à des pages **vides** (le
cockpit figé, lui, reste complet).

1. **Continuer la présentation sur le cockpit** — il est autonome et suffit pour tout le
   discours ; l'exploration est un *bonus*, pas un prérequis.
2. En parallèle ou après, lancer le workflow **`demo-scenario` → `seed`**, puis **`verify`**
   (rapport de parité : sommes Scope 3 = 3 480, part aimants 61,8 %, couverture 54 %).
3. Vérifier que l'app cible tourne en **`AI_REVIEW_MODE=demo`** et que le tenant
   `asterion-motion-demo` existe (sinon `POST /auth/demo` le crée à la volée pour l'accès,
   mais **ne peuple pas** les données — c'est le rôle du seed).
4. Rafraîchir la page « Explorer ».

> Rappel d'honnêteté : il n'y a **pas de PostgreSQL local** dans cet environnement. Le
> comportement du seed/verify (idempotence, garde-slug, parité) est **prouvé en CI**. En
> présentation locale sans base, **restez sur le cockpit figé** — c'est le mode nominal hors
> connexion.

## 7. À ne jamais faire

- Ne pas masquer les badges **IA SIMULÉE · ZÉRO APPEL EXTERNE · DÉMONSTRATION FICTIVE**.
- Ne pas présenter les chiffres comme réels, ni Asterion comme un client.
- Ne pas activer `AI_REVIEW_MODE=live`.
- Ne pas promettre que l'IA « décide » : elle **cite et propose**, l'humain **décide**.
- Ne pas confondre `/demo` (route cinématique existante) et `/demo/asterion-motion` (ce
  cockpit).

*Fin de DEMO_PRESENTER_GUIDE.md.*
