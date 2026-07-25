# Water Intelligence — Paquet de décision humaine

Dix décisions restent ouvertes. **Aucune n'est technique**, et aucune ne peut
être prise par un modèle : chacune engage une responsabilité — juridique,
éditoriale, financière ou d'exploitation — que seul un humain porte.

Les formulaires ci-dessous sont **non signés**. Un formulaire sans nom, sans
date et sans décision explicite vaut « non décidé », jamais « accepté par
défaut ».

Ce paquet accompagne [`FINAL_TRACEABILITY.md`](./FINAL_TRACEABILITY.md), qui
décrit l'état vérifié du chantier.

---

## Comment remplir

1. Une décision par formulaire. Ne pas grouper : « on publie les sources
   Hub'Eau » ne dit pas laquelle, ni pour quelle période, ni sous quelle
   attribution.
2. Écrire le **motif**, pas seulement le verdict. Un « oui » sans motif est
   inexploitable dans six mois.
3. Reporter chaque décision signée dans [`DECISION_LOG.md`](./DECISION_LOG.md).
4. Une décision **refusée** ou **ajournée** est une décision : la consigner
   aussi.

---

## 1. Publication EEA WEI+

**Objet** — Autoriser ou non la publication des observations issues de la source
`EEA_WEI_PLUS` sur la surface publique.

**État actuel** — Licence vérifiée. Exclusion active :
`decision_proposed_not_reviewed`. Aucune valeur n'atteint la page publique.

**À savoir avant de décider** — Le WEI+ est un ratio ; le connecteur ne produit
**aucune moyenne inter-bassins** (elle supposerait une pondération que la
release ne publie pas). L'agrégat est une distribution de comptes. La conversion
depuis le classeur officiel reste un geste opérateur documenté : les noms de
colonnes du classeur n'ont pas pu être vérifiés, et rien n'a été deviné.

| Champ | Valeur |
|---|---|
| Décision (publier / refuser / ajourner) | |
| Périmètre autorisé (unités spatiales, période) | |
| Attribution à afficher | |
| Motif | |
| Décidé par (nom) | |
| Date | |
| Signature | |

---

## 2. Publication des sources Hub'Eau

Quatre sources distinctes. **Un formulaire par source** — elles n'ont ni la même
granularité, ni les mêmes angles morts.

**À savoir pour les quatre** — Une absence de déclaration n'est pas un zéro :
les usages exonérés de redevance sont inconnus et les volumes inférieurs à
10 000 m³ ne sont pas déclarés. Publier ces séries sans porter cette limite
laisserait lire des creux là où il n'y a que du non-déclaré.

### 2.1 `HUBEAU_HYDROMETRIE`

| Champ | Valeur |
|---|---|
| Décision (publier / refuser / ajourner) | |
| Périmètre autorisé | |
| Attribution à afficher | |
| Motif | |
| Décidé par (nom) | |
| Date | |
| Signature | |

### 2.2 `HUBEAU_ADES` (piézométrie)

| Champ | Valeur |
|---|---|
| Décision (publier / refuser / ajourner) | |
| Périmètre autorisé | |
| Attribution à afficher | |
| Motif | |
| Décidé par (nom) | |
| Date | |
| Signature | |

### 2.3 `HUBEAU_BNPE_PRELEVEMENTS`

| Champ | Valeur |
|---|---|
| Décision (publier / refuser / ajourner) | |
| Périmètre autorisé | |
| Mention du non-déclaré à afficher | |
| Motif | |
| Décidé par (nom) | |
| Date | |
| Signature | |

### 2.4 `HUBEAU_QUALITE_SURFACE`

**Spécifique** — Aucun classement sanitaire, aucune conclusion de conformité et
aucun seuil réglementaire ne sont encodés dans le connecteur. Publier ces
paramètres sans réviseur juridique reviendrait à laisser un lecteur en tirer une
conformité que le produit n'énonce pas.

| Champ | Valeur |
|---|---|
| Décision (publier / refuser / ajourner) | |
| Paramètres SANDRE autorisés | |
| Attribution à afficher | |
| Motif | |
| Décidé par (nom) | |
| Date | |
| Signature | |

---

## 3. WRI Aqueduct

**Objet** — Effectuer, ou non, l'enregistrement exigé par WRI, puis autoriser la
publication.

**État actuel** — Licence CC BY 4.0 vérifiée. Exclusion active :
`decision_refused`. **L'obstacle n'est pas la licence** : WRI exige en outre un
enregistrement pour partager ou adapter les données, et cet enregistrement n'a
pas été effectué.

**Ce que le modèle ne peut pas faire** — S'enregistrer auprès d'un tiers au nom
de l'organisation.

| Champ | Valeur |
|---|---|
| Enregistrement WRI effectué (oui / non) | |
| Identifiant ou référence d'enregistrement | |
| Décision de publication (publier / refuser / ajourner) | |
| Attribution CC BY à afficher | |
| Motif | |
| Décidé par (nom) | |
| Date | |
| Signature | |

---

## 4. Copernicus EDO

**Objet** — Trancher le décodage raster.

**État actuel** — Statut formel `source_verified_decoder_deferred`. Identité de
source vérifiée (CDI v4.1, décade, EPSG:4326, classes 0-6, licence CEMS). Le
portail ne distribue que GeoTIFF et NetCDF ; aucun export tabulaire n'existe.
Aucune couche n'est simulée, aucune valeur n'est produite.

**Trois voies, à choisir explicitement**

| Voie | Ce qu'elle engage |
|---|---|
| A — ADR + dépendance raster | GDAL/rasterio ou netCDF4/h5py/xarray : poids, licence, maintenance, surface d'attaque |
| B — service officiel WMS/WCS | vérifier endpoint, couche, paramètres et format ; enregistrer les artefacts opérateur |
| C — renoncement documenté | le CDI ne fait pas partie du produit public ; l'écrire plutôt que de le laisser en suspens |

| Champ | Valeur |
|---|---|
| Voie retenue (A / B / C) | |
| Si A : dépendance et justification | |
| Si B : endpoint et couche vérifiés | |
| Si C : portée du renoncement | |
| Motif | |
| Décidé par (nom) | |
| Date | |
| Signature | |

---

## 5. Désignation du réviseur juridique

**Objet** — Désigner la personne qui instruira les neuf textes du registre.

**État actuel** — Le registre **nomme** neuf textes et n'en **instruit aucun**.
Chaque règle reste `unknown`. Ce n'est pas un défaut du moteur : c'est
l'absence de réviseur, et le produit le dit plutôt que de conclure à sa place.

**Conséquence de ne pas décider** — Le registre reste un index de textes à
examiner. Il ne dit pas le droit, et ne le dira pas.

| Champ | Valeur |
|---|---|
| Réviseur désigné (nom, qualité) | |
| Périmètre confié (textes, juridictions) | |
| Échéance d'instruction | |
| Motif | |
| Décidé par (nom) | |
| Date | |
| Signature | |

---

## 6. Validation éditoriale

**Objet** — Valider les contenus éditoriaux (secteurs, événements, innovations)
avant publication.

**État actuel** — **Aucun contenu éditorial n'a été rédigé ni revu.** Les
sections correspondantes affichent leur absence et son motif. Aucun classement
de secteurs n'est publié : sans méthode objective et sourcée, un classement
présenterait une intuition comme un fait.

| Champ | Valeur |
|---|---|
| Décision (valider / refuser / ajourner) | |
| Contenus concernés | |
| Méthode retenue pour tout classement | |
| Relecteur éditorial | |
| Motif | |
| Décidé par (nom) | |
| Date | |
| Signature | |

---

## 7. Hypothèses financières

**Objet** — Décider si l'organisation publie des hypothèses financières de
référence (taux d'actualisation, probabilités, amplitudes de sensibilité).

**État actuel** — **Le produit n'en propose aucune, délibérément.** Le
formulaire s'ouvre vide, aucun champ n'a de `placeholder` chiffré, et l'origine
de chaque grandeur (observée / hypothèse) n'est pas pré-cochée.

**Ce que décider « oui » engagerait** — Un taux proposé par l'outil devient un
taux de la maison. Il sera repris, cité, et personne ne saura plus qui l'a
choisi. Si des valeurs de référence sont retenues, elles doivent porter un
auteur, une date et une base — au même titre que celles saisies par un
utilisateur.

| Champ | Valeur |
|---|---|
| Décision (proposer des valeurs / ne rien proposer) | |
| Si proposer : valeurs, auteur, base, date de revue | |
| Motif | |
| Décidé par (nom) | |
| Date | |
| Signature | |

---

## 8. Politique d'exécution des E2E authentifiés

**Objet** — Décider si l'environnement `e2e-preview` est créé et qui l'approuve.

**État actuel** — `prepared_not_executed_environment_not_configured`. Le
workflow, sa configuration Playwright et neuf scénarios sont écrits. **Rien n'a
été exécuté.** Le modèle n'a créé ni l'environnement, ni les secrets, ni leurs
valeurs, ni les reviewers.

**Procédure** — [`E2E_AUTHENTICATED_RUNBOOK.md`](./E2E_AUTHENTICATED_RUNBOOK.md).

| Champ | Valeur |
|---|---|
| Décision (créer l'environnement / ne pas le créer) | |
| Compte de test retenu | |
| Reviewers désignés | |
| Cadence de rotation des secrets | |
| Motif | |
| Décidé par (nom) | |
| Date | |
| Signature | |

---

## 9. Vérification visuelle

**Objet** — Attester qu'un humain a **regardé** les trois surfaces.

**État actuel** — **Aucune vérification visuelle n'a été réalisée.** Aucune page
n'a été affichée, aucune capture n'existe. Les tests contrôlent la structure du
DOM et des ratios de contraste calculés depuis les variables CSS — pas une
apparence.

### Checklist visuelle — à cocher par un humain, après avoir regardé

Aucune case ci-dessous n'est cochée, et aucune ne doit l'être par un outil.

- [ ] Ordinateur — `/water-intelligence`
- [ ] Ordinateur — `/water`
- [ ] Ordinateur — `/water/decision`
- [ ] Tablette — les trois surfaces
- [ ] Téléphone — les trois surfaces
- [ ] Thème clair — les trois surfaces
- [ ] Thème sombre — les trois surfaces
- [ ] Navigation au clavier seul, du premier au dernier élément
- [ ] Zoom à 200 % sans perte de contenu ni défilement horizontal
- [ ] Surface publique — état « rien n'est publié » lisible et non ambigu
- [ ] Surface authentifiée — les six facettes et leurs états
- [ ] Calculateur — les quatre étapes, le retour arrière, la réinitialisation
- [ ] États d'erreur — accès refusé, schéma non disponible, erreur inattendue
- [ ] Navigation — passage entre `/water`, `/water/decision` et le lien de retour

| Champ | Valeur |
|---|---|
| Vérification effectuée (oui / non) | |
| Surfaces et combinaisons réellement regardées | |
| Anomalies constatées | |
| Vérifié par (nom) | |
| Date | |
| Signature | |

---

## 10. Décision de production

**Objet** — Autoriser ou non la mise en production.

**À lire avant de signer** — Les neuf décisions précédentes sont indépendantes de
celle-ci, mais elles la conditionnent. En particulier, signer celle-ci alors que
le formulaire 9 est vide reviendrait à mettre en production une interface que
personne n'a regardée.

**Ce que la PR #159 apporte, vérifié** — Vitest 652/652, pytest contre un vrai
PostgreSQL vert en CI, E2E publics 108/108 sur six combinaisons, TypeScript,
lint, build, gitleaks et security-audit verts, quatre endpoints vérifiés sur la
Preview (ETag, 304, 401), aucune migration, aucune dépendance ajoutée.

**Ce qu'elle n'apporte pas** — Aucune vérification visuelle, aucun E2E
authentifié, aucune source publiée, aucun texte juridique instruit.

| Champ | Valeur |
|---|---|
| Décision (mettre en production / refuser / ajourner) | |
| Formulaires 1 à 9 dont la signature est exigée au préalable | |
| Périmètre mis en production | |
| Fenêtre et procédure de retour arrière retenue | |
| Motif | |
| Décidé par (nom) | |
| Date | |
| Signature | |
