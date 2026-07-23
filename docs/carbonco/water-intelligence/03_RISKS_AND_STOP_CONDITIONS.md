# P00 — Risques et conditions d'arrêt

Complète [`RISK_REGISTER.md`](./RISK_REGISTER.md) (registre générique acté au démarrage du chantier) avec les risques concrets identifiés par l'audit P00, et fixe les conditions qui doivent stopper une mission en cours plutôt que la laisser contourner un problème.

## Risques de collision `/water` ↔ `/water-intelligence`

| Risque | Probabilité constatée | Preuve | Mitigation |
|---|---|---|---|
| Collision de route (deux pages sur la même URL) | **Nulle actuellement** | Recherche exhaustive : zéro occurrence de « water-intelligence » dans `apps/carbon`/`apps/api`/`apps/neural` | `/water-intelligence` doit rester un segment `apps/carbon/app/water-intelligence/`, jamais imbriqué sous `(app)/water/` |
| Collision de nom de composant/hook | Faible | Aucun composant `Water*` public trouvé hors du cockpit ; `lib/api/water.ts` sert déjà `/water` et `/sites-geo` sans conflit | Nommer les nouveaux modules publics distinctement (ex. `lib/api/water-intelligence.ts`), ne pas étendre `lib/api/water.ts` |
| Fuite de donnée tenant via un composant partagé | Moyenne si un composant du cockpit est réutilisé sans revue | `water/page.tsx` et ses données viennent d'endpoints authentifiés (`get_current_user`/`require_analyst`) | Tout composant partagé entre `/water` et `/water-intelligence` doit être audité pour confirmer qu'il ne reçoit ses données que par props (pas de fetch interne vers un endpoint tenant) |
| Cache public pollué par une donnée tenant | Faible actuellement (aucune page publique ne lit le kernel en direct pour l'instant) | §00_BASELINE_AUDIT §6 : aucun précédent d'exposition publique du kernel | P10 doit utiliser un cache/ISR strictement séparé du cockpit authentifié |
| Réouverture CSP non anticipée | Faible | Motif Mapbox révolu (§00_BASELINE_AUDIT §8), P11 impose D3/TopoJSON | Toute future demande d'ouvrir `connect-src`/`worker-src` doit être justifiée et documentée dans la PR correspondante |

## Risques hérités de l'audit (au-delà de la simple collision de route)

| Risque | Constat | Impact potentiel |
|---|---|---|
| Aucun connecteur réel n'a jamais été implémenté | Seul `FakeAdapter` existe ; P05-P09 sont les premières implémentations réelles du contrat `SourceAdapter` | Risque d'itération plus lente que prévu si le contrat révèle des angles morts non couverts par le faux adaptateur (pagination réelle, erreurs réseau réelles, formats de fichiers réels) |
| Aucune page publique n'a jamais interrogé le Evidence Kernel en direct | `/materials` (seule page publique existante liée au kernel) est figée/locale, pas live | P04/P10 défrichent un terrain neuf ; prévoir un temps de validation supplémentaire, ne pas sous-estimer comme une simple réutilisation |
| `display_allowed` n'est pas vérifié à la publication | Porte de publication = `allow_ingest AND allow_store` uniquement ; la redaction par valeur est un mécanisme séparé (`value_withheld`) | Si P10 oublie de répliquer cette vérification, une valeur sous licence restrictive pourrait fuiter dans le snapshot public |
| Écart interne au pack maître (P01) | Critère d'acceptation P01 ne couvre que 12 des 16 lignes du CSV opérateur (les 4 sources « recommended_addition » — Aqueduct/EEA/Copernicus/USGS — ne sont pas explicitement requises) | Une implémentation de P01 strictement conforme au critère écrit pourrait légitimement écarter des sources dont dépendent P05/P06/P09 ; signalé, non corrigé (fichiers copies conformes), arbitrage attendu avant P01 |
| `geocode_service.py` non lu intégralement | Dépendance indirecte de `screening_service.get_accepted_position`, non auditée en détail | Faible impact pour P00-P04 (aucun n'en dépend directement) ; à couvrir si une mission future s'appuie dessus |

## Conditions d'arrêt immédiat

Reprises du pack maître (§6), contextualisées par les constats de cet audit. Toute mission P01+ doit s'arrêter et documenter plutôt que contourner si :

- une licence ne permet pas le stockage, l'affichage ou l'usage dérivé d'une source (mécanisme déjà en place : `license_policy.py` — utiliser ses réponses, ne pas les court-circuiter) ;
- une source officielle a changé de schéma sans fixture ni validation ;
- une jointure géographique n'a pas d'identifiant stable (aucun fuzzy matching — le moteur `water_screening.py` donne l'exemple à suivre : bbox puis point-in-polygon sur identifiants officiels uniquement) ;
- une donnée sensible ne peut pas être désensibilisée proprement ;
- une migration serait nécessaire alors qu'elle n'est pas le périmètre du prompt en cours (voir ADR §7 — aucune migration sans besoin démontré) ;
- la route entrerait en conflit avec `/water` (voir tableau de collision ci-dessus — actuellement improbable, donc tout conflit détecté est un signal fort à ne pas ignorer) ;
- la CI ou la Preview présente une régression non expliquée ;
- une donnée manque et la seule solution serait de l'inventer (le moteur existant refuse explicitement plutôt que d'inventer — même standard attendu du nouveau module) ;
- l'agent ne peut pas établir la provenance d'une affirmation juridique ;
- le payload dépasse le budget sans stratégie de découpage (budgets définis dans `WATER_INTELLIGENCE_PROMPT_PACK_V1.md` §3) ;
- **(ajout spécifique à cet audit)** une PR de connecteur (P05-P09) s'apprête à exposer une valeur sans vérifier `display_allowed` au moment de la construction du snapshot — arrêt immédiat, ce n'est pas couvert automatiquement par la porte de publication.

## Statut à l'issue de P00

Aucun risque bloquant identifié pour engager P01. Le point le plus significatif à trancher avant P01 est l'écart de couverture du CSV (12 vs 16 lignes) — décision humaine attendue, pas une correction silencieuse des fichiers copies conformes.
