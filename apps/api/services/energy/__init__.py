"""
services.energy — fondation énergie & Scope 2 (PR-06A).

Ledger de la consommation d'énergie de l'entreprise (compteurs, activités),
des instruments contractuels market-based (REC/GO/PPA/tarif vert) et de leurs
allocations contrôlées. NE contient PAS de moteur de calcul Scope 2 : aucun
total location-based, aucun total market-based (PR-06B). Aucun LLM, aucun
fallback silencieux de facteur.

Une exception métier UNIQUE pour tout le domaine (contrats Wave 2 §6) —
`EnergyError` — traduite en HTTP par le helper lexical du routeur
(`introuvable` → 404, `requis/requise` → 400, sinon 409).
"""

from __future__ import annotations


class EnergyError(Exception):
    """Erreur métier du domaine énergie (compteur / activité / instrument /
    allocation) — message en français, non sensible (jamais de SQL, de secret,
    ni de fuite d'existence cross-tenant)."""
