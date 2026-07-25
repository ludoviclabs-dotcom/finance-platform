# Water Intelligence — Traçabilité finale

Dossier de clôture du chantier CarbonCo Water Intelligence.

Ce document décrit **ce qui existe et comment on le vérifie**. Il ne conclut pas
que le produit est prêt pour la production : cette conclusion appartient à un
humain, et le [paquet de décision](./HUMAN_DECISION_PACKET.md) en liste les
pièces manquantes.

Deux limites structurent tout ce qui suit, et il faut les lire avant les
tableaux :

- **Aucune vérification visuelle humaine n'a été réalisée.** Aucune page n'a été
  regardée. Les tests contrôlent la structure du DOM et des ratios calculés, pas
  une apparence.
- **Aucun E2E authentifié n'a été exécuté.** Le workflow est préparé ; son
  statut est `prepared_not_executed_environment_not_configured`.

---

## 1. Historique des pull requests

| PR | Objet | État |
|---|---|---|
| #141 | Registre de sources + scaffold de pilotage | fusionnée |
| #142 | Baseline audit P00 | fusionnée |
| #143 | Handoff P00 → P01 | fusionnée |
| #144 | Catalogue de sources (P01) | fusionnée |
| #145 | Parseur + tests du catalogue (P01b) | fusionnée |
| #146 | Contrats P02 — read model public | fusionnée |
| #147 | Pipeline opérateur P03 | fusionnée |
| #148 | Shell public P04 | fusionnée |
| #149 | Retrait des chiffres fictifs visibles (P04B) | fusionnée |
| #150 | Connecteur WRI Aqueduct (P05) | fusionnée |
| #151 | Décodage des sources rendu injectable | fusionnée |
| #152 | Frontière d'erreur des connecteurs sécurisée | fusionnée |
| #153 | Wave A — connecteurs européens (P06 + P09) | fusionnée |
| #154 | Blueprint UX/UI Wave C (documentaire) | fusionnée |
| #155 | Wave B — famille Hub'Eau (P07 + P08) | fusionnée |
| #156 | Wave C — produit public (P10 + P11 + P12) | fusionnée |
| #157 | Wave D — couche décisionnelle (P13 + P14 + P15) | fusionnée |
| #158 | Wave E-Core — finalisation fonctionnelle | fusionnée |
| **#159** | **Wave E-Interface & Closeout — cette PR** | **Draft, non fusionnée** |

### Commits de la PR finale

| Étape | SHA | Objet |
|---|---|---|
| F0 | `e25a98b` | Pilotage réaligné avant l'étape UI |
| F1 | `12c067c` | Clients TypeScript/Zod des quatre endpoints |
| F2 | `e97c8c0` | Cockpit décisionnel authentifié `/water/decision` |
| F3 | `b208a59` | E2E publics sans secret |
| F4 | `78c6fa2` | E2E authentifiés protégés, préparés |
| F5 | `27f2a15` | Audit qualité — sept corrections mesurées |
| F6 | *ce commit* | Preview, traçabilité et clôture |

## 2. Architecture

Trois surfaces, trois régimes d'accès, aucune ne masquant les autres.

```
PUBLIC (aucune authentification)
  /water-intelligence ............ Server Component intégral, aucun îlot client
      │
      ├── GET /water-intelligence/public-snapshot ....... ETag + 304
      └── GET /water-intelligence/regulatory-registry ... ETag + 304

AUTHENTIFIÉ (groupe `(app)`, garde unique dans app/(app)/layout.tsx)
  /water ......................... cockpit opérationnel existant, inchangé
  /water/decision ................ cockpit décisionnel, ajouté par cette PR
      │
      ├── GET  /water/decision-synthesis .............. 6 facettes, jeton seul
      └── POST /water/financial-scenarios/evaluate .... sans état, sans écriture
```

Le périmètre tenant est résolu **exclusivement côté serveur**, depuis le jeton.
Aucun identifiant d'entreprise n'est accepté en query, en body ou en header, et
aucun n'est rendu dans le DOM du cockpit.

## 3. Routes

| Route | Régime | Rendu | Fichier |
|---|---|---|---|
| `/water-intelligence` | public | Server Component | `apps/carbon/app/water-intelligence/page.tsx` |
| `/water` | authentifié | client (groupe `(app)`) | `apps/carbon/app/(app)/water/page.tsx` |
| `/water/decision` | authentifié | client (groupe `(app)`) | `apps/carbon/app/(app)/water/decision/page.tsx` |

Le groupe `(app)` est intégralement client : sa garde d'authentification vit
dans son layout. `/water/decision` s'appuie dessus et **n'écrit aucune seconde
logique d'authentification** — une garde locale supplémentaire divergerait tôt
ou tard de celle du groupe.

## 4. Endpoints — vérifiés sur la Preview

Relevés le 2026-07-25 contre la Preview `carbonco-api` de la branche
(commit `78c6fa2`), accessible sans authentification d'équipe.

| Endpoint | Attendu | Observé |
|---|---|---|
| `GET /health` | 200 | **200** |
| `GET /water-intelligence/public-snapshot` | 200 + ETag | **200**, `ETag: W/"wi-caa59e6c25bb39657e569da3c7da0de4"`, 5 074 octets |
| ↳ avec `If-None-Match` identique | 304 | **304** |
| ↳ avec `If-None-Match` erroné | 200 | **200** |
| `GET /water-intelligence/regulatory-registry` | 200 + ETag | **200**, `ETag: W/"wi-legal-cd67e0e611600c83a5299abd0e6d5082"` |
| ↳ avec `If-None-Match` identique | 304 | **304** |
| `GET /water/decision-synthesis` sans jeton | 401 | **401** |
| `POST /water/financial-scenarios/evaluate` sans jeton | 401 | **401** |
| `GET /water/activities` sans jeton | 401 | **401** |
| Champ tenant dans le snapshot public | aucun | **aucun** (`company_id`, `tenant_id`, `site_id` absents) |

Le 304 du registre juridique est la preuve directe du défaut corrigé en F5 : cet
endpoint sert bien un validateur, et le client le traitait comme une erreur.

## 5. Previews

| Projet | État du déploiement | Contenu HTTP vérifié |
|---|---|---|
| `carbonco-api` | **READY** | **oui** — tableau ci-dessus |
| `carbon` | **READY** | **non** |
| `finance-platform` | **READY** | **non** |

Les deux Previews frontales redirigent (302) vers `vercel.com/sso-api` : elles
sont protégées par le SSO d'équipe Vercel. Leur contenu n'a donc pas pu être
relevé depuis cet environnement, et **aucune tentative d'authentification n'a
été faite**. L'état `READY` provient de l'API de déploiements, pas d'une lecture
de page.

Ce qui est vérifié à leur sujet sans dépendre du SSO : le build Next.js émet
bien `/water/decision`, et le job E2E public construit puis sert l'application
en CI, où 108 tests passent contre elle. Les journaux d'exécution des Previews
elles-mêmes n'ont pas été inspectés.

## 6. Connecteurs, licences et exclusions

Sept sources instrumentées. **Sept licences vérifiées. Zéro source publiée.**

Ce n'est pas un retard : c'est le gate de publication qui fonctionne. Une
licence permissive autorise un usage ; elle ne constitue pas la décision
éditoriale de publier.

| Source | Licence vérifiée | Exclusion | Motif |
|---|---|---|---|
| `EEA_WEI_PLUS` | oui | oui | `decision_proposed_not_reviewed` |
| `HUBEAU_HYDROMETRIE` | oui | oui | `decision_proposed_not_reviewed` |
| `HUBEAU_ADES` | oui | oui | `decision_proposed_not_reviewed` |
| `HUBEAU_BNPE_PRELEVEMENTS` | oui | oui | `decision_proposed_not_reviewed` |
| `HUBEAU_QUALITE_SURFACE` | oui | oui | `decision_proposed_not_reviewed` |
| `WRI_AQUEDUCT` | oui | oui | `decision_refused` — enregistrement WRI non effectué |
| `COPERNICUS_EDO` | oui | oui | `decision_refused` — décodage raster volontairement reporté |

Le registre juridique nomme **neuf textes** et n'en instruit **aucun** : sans
réviseur juridique désigné, chaque règle reste `unknown`. Le registre nomme les
textes à examiner ; il n'énonce pas le droit.

## 7. Contrats

| Contrat | Source de vérité | Miroir front | Parité |
|---|---|---|---|
| Snapshot public | `services/water_intelligence/` | `lib/water-intelligence/public-snapshot.ts` | testée |
| Registre juridique | `docs/…/contracts/` | `lib/water-intelligence/regulatory-registry.json` | testée à l'octet |
| Ponts de modules | `docs/…/contracts/` | `lib/water-intelligence/module-bridges.json` | testée à l'octet |
| Moteur financier | `docs/…/contracts/FINANCIAL_ENGINE.json` | `lib/water-intelligence/financial-engine.json` | testée à l'octet |

Le calculateur lit ses **unités et son caractère obligatoire** dans
`FINANCIAL_ENGINE` plutôt que de les réécrire : la saisie ne peut pas dériver du
moteur sans casser le build.

## 8. Tests

| Suite | Résultat | Où |
|---|---|---|
| Vitest (carbon) | **652 / 652** | local + CI `Carbon CI` |
| Pytest (api), sans base | **1 828 passés, 729 ignorés** | local |
| Pytest contre PostgreSQL réel | **vert** (`migration-tests`) | CI, sur cette PR |
| E2E publics Playwright | **108 / 108**, six projets | CI, run `30174671984` |
| E2E authentifiés | **non exécutés** | `prepared_not_executed_environment_not_configured` |
| TypeScript | 0 erreur | local + CI |
| ESLint | 0 erreur (24 avertissements préexistants) | local + CI |
| Build Next.js | succès, `/water/decision` émise | local + CI |
| gitleaks | vert | CI |
| security-audit | vert | CI |

Les 729 tests ignorés en local sont conditionnés à une base PostgreSQL réelle.
Ils **ne sont pas perdus** : le job `migration-tests` les exécute en CI contre un
vrai PostgreSQL, et il est vert sur cette PR. C'est ce même job qui, en Wave
E-Core, avait trouvé un défaut d'isolation tenant réel (822 passés, 0 ignoré).

Le cockpit est **réellement monté** dans les tests (React 19 `act` +
`createRoot`), pas seulement rendu en chaîne : « l'appel n'a lieu qu'au clic » et
« le retour arrière ne perd rien » sont des affirmations sur le comportement,
qu'un rendu statique ne vérifierait pas.

## 9. Isolation tenant

Quatre barrières, dont trois côté serveur :

1. **Le contrat client ne propose aucun `company_id`.** `fetchDecisionSynthesis`
   ne prend qu'un `AbortSignal` : sa signature interdit d'en passer un.
2. **Le modèle de requête refuse tout champ inconnu** (`extra="forbid"`).
3. **Le service résout le périmètre depuis le jeton**, jamais depuis l'appelant.
4. **Chaque entrée de synthèse est estampillée avec le tenant de SA ligne.**

La quatrième est née d'un défaut réel : elle estampillait initialement le tenant
*demandé* et non celui de la ligne lue — elle ne pouvait donc jamais se
déclencher. Trouvé par le test A/B contre un vrai PostgreSQL, corrigé en #158.

Côté interface : le `company_id` que la réponse contient n'est **jamais rendu**
dans le DOM, et un test le vérifie sur une réponse qui en porte un.

## 10. Sécurité

| Point | État |
|---|---|
| Authentification | garde unique du groupe `(app)` ; 401 vérifié sur les deux endpoints privés |
| Anti-IDOR | quatre barrières, section 9 |
| Champ tenant côté public | aucun, vérifié sur la Preview et en E2E |
| Rate limiting | 4 surfaces sur 4 depuis F5 (`decision-synthesis` ne l'était pas) |
| Validation | `extra="forbid"`, bornes strictes, 422 sur hypothèse mal formée |
| Limite de payload | 16 Mo (`apps/api/main.py`) |
| CSP | inchangée — `connect-src` couvrait déjà l'API |
| SSRF | aucun appel sortant dans le chemin des quatre endpoints |
| gitleaks | vert |
| npm audit | allowlist inchangée ; **aucune dépendance ajoutée** par cette PR |
| GHSA-mh99-v99m-4gvg | documentée, réévaluation **2026-08-08** conservée |

## 11. Performance — mesurée

JavaScript non compressé, calculé depuis les scripts référencés par le HTML
prérendu.

| Route | Scripts | JS | HTML |
|---|---|---|---|
| `/water-intelligence` | 12 | 767 kB | 150 kB |
| `/water` | 14 | 896 kB | 20 kB |
| `/water/decision` | 15 | **1 148 kB** | 21 kB |
| référence groupe `(app)` (`/pricing`, `/securite`) | 14 | 841–846 kB | — |

Sur les ~300 kB propres à `/water/decision`, **265 kB sont zod** et 45 kB sont le
code de la page. zod est chargé parce que les réponses sont validées à
l'exécution : le retirer supprimerait la garantie de contrat posée par la
Wave E. Ce n'est pas un défaut, c'est un arbitrage — mesuré et consigné plutôt
que corrigé en douce. **Un humain peut le trancher autrement.**

Réseau : une requête au chargement (`decision-synthesis`), et **aucune pendant
la saisie**. Le moteur n'est appelé qu'au clic sur « Calculer ». Les deux
endpoints publics servent un ETag et répondent 304.

## 12. Accessibilité

Corrigé en F5, sur mesure et non sur impression :

- trois couleurs de texte sous le seuil AA (3,07 / 3,58 / 4,41 pour 4,5 requis)
  remplacées par des variantes destinées au texte (6,84 / 7,60 / 7,29) ;
- lien de retour à 3,77 et marqueur « obligatoire » à 3,03 en thème sombre,
  ramenés à la couleur de texte courante ;
- second `h1` supprimé — l'en-tête du groupe en rendait déjà un, avec le même
  texte ; les niveaux descendent d'un cran, sans saut ;
- transition de thème neutralisée sous `prefers-reduced-motion`.

Tenu par construction : labels explicites, erreurs reliées aux champs par
`aria-describedby` et `aria-invalid`, `aria-live` assertive pour les erreurs et
polie pour les résultats, `aria-current` sur l'étape active, éléments
nativement focalisables uniquement, table alternative sur la surface publique,
aucune information portée par la seule couleur, aucune animation perpétuelle.

**Non vérifié :** le rendu réel avec un lecteur d'écran, le zoom à 200 % sur un
écran physique, et l'apparence en clair comme en sombre. Ces trois points
figurent dans la checklist visuelle du paquet de décision, **non cochés**.

## 13. Migrations

**Aucune.** Cette PR n'ajoute, ne modifie et ne supprime aucune migration. Le
schéma attendu est celui déjà en place ; `migrations_expected: false` dans le
pilotage.

Le cockpit gère explicitement le cas où les migrations ne sont pas appliquées :
un 503 `schema_not_ready` produit un état « schéma non disponible » par facette,
distinct d'une absence de données.

## 14. Dépendances

**Aucune ajoutée.** Le seul changement de `package.json` depuis F1 est une ligne
de script (`e2e:public`). Aucun appel réseau externe n'est introduit ni au build
ni au runtime.

## 15. Rollback

Rien à défaire côté données : aucune migration, aucune écriture, aucun état
persisté par les surfaces ajoutées.

| Portée | Geste | Effet |
|---|---|---|
| Tout | ne pas fusionner #159 | l'état de production reste `7ea6772` |
| Après fusion | `git revert` du merge | supprime `/water/decision`, les deux workflows E2E et les corrections F5 |
| Cockpit seul | supprimer `app/(app)/water/decision/` | `/water` et `/water-intelligence` intacts |
| E2E publics seuls | supprimer `.github/workflows/e2e-public.yml` | aucun effet applicatif |
| Correctifs F5 | reverter `27f2a15` | **réintroduit les défauts de contraste, le second `h1` et le 304 traité comme une erreur** |

Le rollback des correctifs F5 est le seul qui dégrade quelque chose : les autres
retirent des ajouts.

## 16. Gestes opérateur

Aucun geste n'est requis pour que cette PR fonctionne : elle n'ajoute ni
migration, ni variable d'environnement, ni secret.

Gestes **optionnels**, chacun décrit ailleurs :

1. Créer l'environnement `e2e-preview` et ses secrets pour exécuter les E2E
   authentifiés → [`E2E_AUTHENTICATED_RUNBOOK.md`](./E2E_AUTHENTICATED_RUNBOOK.md).
2. Signer une décision de publication, source par source →
   [`HUMAN_DECISION_PACKET.md`](./HUMAN_DECISION_PACKET.md).
3. Désigner un réviseur juridique, sans lequel le registre reste `unknown`
   partout.

## 17. Limites de ce dossier

- Aucune page n'a été **regardée**. Aucune capture n'existe.
- Les E2E authentifiés n'ont **jamais tourné**.
- Les Previews frontales n'ont pas été lues (SSO d'équipe).
- Les journaux runtime des Previews n'ont pas été inspectés.
- `--color-muted-foreground` est employée dans 37 fichiers et déclarée nulle
  part : la hiérarchie « texte atténué » est perdue dans toute l'application, y
  compris sur `/water`. Constat **non corrigé** — le correctif tient en une
  ligne mais change l'apparence de 36 pages hors périmètre audité, qu'aucun
  humain n'a regardées. Le contraste n'en souffre pas, il est plus élevé : le
  défaut est cosmétique, et sa correction relève d'une décision visuelle.

## 18. Décisions humaines ouvertes

Aucune n'est technique. Toutes figurent, sous forme de formulaires non signés,
dans [`HUMAN_DECISION_PACKET.md`](./HUMAN_DECISION_PACKET.md).

1. Publication EEA WEI+.
2. Publication de chaque source Hub'Eau (quatre).
3. WRI Aqueduct — l'enregistrement WRI reste à effectuer.
4. Copernicus EDO — dépendance raster, service officiel, ou renoncement.
5. Désignation du réviseur juridique.
6. Validation éditoriale.
7. Hypothèses financières de référence.
8. Politique d'exécution des E2E authentifiés.
9. Vérification visuelle.
10. Décision de production.

## 19. P18 — URL publique

Décision **documentaire**, inchangée par cette PR :

- `/water-intelligence` est **conservée** ;
- `/water` est **conservée** ;
- `/water/decision` est **conservée** ;
- `/eau` **n'est pas créée** ;
- **aucun redirect n'est créé** ;
- réévaluation seulement avec des analytics et des retours utilisateurs réels —
  pas sur une intuition de nommage.
