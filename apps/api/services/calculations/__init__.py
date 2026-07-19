"""
services/calculations — moteurs de calcul déterministes, PURS et versionnés.

Un module par domaine. Règles communes à tout ce paquet :

  - **Pur** : aucune I/O, aucun accès base, aucun appel réseau. Les entrées sont
    passées explicitement, ce qui rend chaque moteur testable sans PostgreSQL
    (les tests DB-gated ne tournent qu'en CI).
  - **Versionné** : tout résultat porte `methodology_code` + `methodology_version`.
    Pas de calcul sans méthode versionnée (contrats §4, plan §9).
  - **Reproductible** : mêmes entrées ⇒ mêmes sorties, sans horloge, sans
    aléatoire, sans dépendance à l'ordre d'un dictionnaire.
  - **Aucun LLM** : un modèle de langage ne calcule rien et ne décide rien ici.
"""
