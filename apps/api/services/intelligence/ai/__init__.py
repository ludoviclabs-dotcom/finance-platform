"""services/intelligence/ai/ — assistant IA de REVUE et d'EXPLICATION cité (PR-11).

Le backend possède la frontière de confiance : grounding (reference pack sous
RLS + licence + sensibilité + minimisation), résolution/validation des
citations, entailment, gate de publication (§16.4), journal auditable
(migration 041). Le modèle est appelé via `provider.generate` et ne voit qu'un
pack pré-autorisé — jamais d'accès direct DB/Blob/réseau. Aucune sortie ne fait
autorité : tout est DRAFT/SUGGESTION/REVIEW_REQUIRED et passe par une revue
humaine. Voir AI_GOVERNANCE_CONTRACTS.md.
"""
