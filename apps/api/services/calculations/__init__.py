"""
services/calculations — moteurs de calcul déterministes, PURS et versionnés.

Un module par domaine : `procurement` (Scope 3 catégorie 1, PR-05B) et `scope2`
+ `scope2_runs` (Scope 2 dual location/market-based, PR-06B). Les deux moteurs
coexistent ici, aucun ne remplace l'autre.

Règles communes à tout ce paquet :

  - **Pur** : aucune I/O, aucun accès base, aucun appel réseau. Les entrées sont
    passées explicitement, ce qui rend chaque moteur testable sans PostgreSQL
    (les tests DB-gated ne tournent qu'en CI).
  - **Versionné** : tout résultat porte `methodology_code` + `methodology_version`.
    Pas de calcul sans méthode versionnée (contrats §4, plan §9).
  - **Aucun choix silencieux** : tout facteur retenu porte son NIVEAU de
    hiérarchie et sa RAISON ; l'échec du dernier niveau est une ERREUR explicite,
    jamais un repli discret.
  - **Reproductible** : mêmes entrées ⇒ mêmes sorties, sans horloge, sans
    aléatoire, sans dépendance à l'ordre d'un dictionnaire.
  - **Aucun LLM** : un modèle de langage ne calcule rien et ne décide rien ici.

Exception métier du paquet (contrats §6), traduite en HTTP par le helper lexical
partagé `routers/_errors.py`. Le moteur procurement conserve sa propre exception
dédiée (`ProcurementCalculationError`, côté service) — les deux coexistent.
"""

from __future__ import annotations


class CalculationError(Exception):
    """Erreur métier d'un moteur de calcul — message en français, non sensible
    (jamais de SQL, de secret, ni de fuite d'existence cross-tenant).

    Sert notamment aux ERREURS EXPLICITES de fin de hiérarchie de facteurs :
    « aucun facteur location-based admissible pour la zone X sur la période Y »
    est une erreur qui remonte, pas un zéro silencieux.
    """
