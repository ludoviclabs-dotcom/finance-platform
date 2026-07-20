"""
services/crma — CRMA, aimants permanents et exposition matières critiques (PR-07).

Découpage :
  * `scoring`            — calcul PUR du CarbonCo Material Exposure Score (aucune DB).
  * `reference_service`  — référentiels globaux : groupes, statut critique/stratégique,
                           étapes, substituts, filières de recyclage, événements.
  * `stage_service`      — observations par étape, chaîne de valeur, données de
                           marché sous licence.
  * `exposure_service`   — expositions du tenant et orchestration du score.
  * `article24_service`  — évaluations Article 24, actions d'atténuation, rapport.

Toutes les requêtes portent leur prédicat de périmètre EN PLUS de la RLS
(défense en profondeur, contrats §7) : le PostgreSQL de CI se connecte en
superuser, qui bypasse la RLS y compris FORCE.
"""

from __future__ import annotations
