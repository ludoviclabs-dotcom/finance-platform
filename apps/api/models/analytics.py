"""
models/analytics.py — enveloppe analytique partagée Wave 2 (contrats §4).

**Module canonique.** `WAVE_2_INTERFACE_CONTRACTS.md` §4 marque
`models/analytics.py::AnalyticalEnvelope` « À INTRODUIRE par la première PR
Wave 2 qui expose un endpoint de calcul ». C'est PR-05B (moteur Scope 3 achats).
Les PR suivantes (PR-06B Scope 2, exposures, IRO…) **réutilisent** ce module
plutôt que d'en créer un second : une seule forme de réponse analytique dans
tout le backend.

Forme gelée (contrats §4) :

    {
      "data":     { … résultat métier typé du domaine … },
      "meta": {
        "as_of":  "2026-06-30",
        "status": "estimated",
        "method": { "code": "CC-METHOD-CODE", "version": "1.0.0" },
        "quality": { "confidence": 62, "coverage_pct": 80, "warnings": [] }
      },
      "evidence": [ { "artifact_id": 415, "source_code": "…", … } ]
    }

Règles portées par les types (pas seulement par la documentation) :

- `meta.method` est **obligatoire** dès qu'un calcul déterministe est impliqué :
  `AnalyticalMeta.method` n'est pas optionnel. Pas de calcul sans méthode
  versionnée (principe §9 du plan d'architecture).
- `meta.status` appartient au vocabulaire `data_status` du noyau
  (`verified/estimated/manual/inferred`) — importé de `models.intelligence`,
  jamais redéclaré ici (une seule source de vérité pour l'énumération).
- `meta.quality.confidence` est un **entier 0-100 de PRÉSENTATION**, distinct de
  `observations.confidence` (0-1, échelle backend). `confidence_to_display()`
  fait la conversion, une seule fois, au même endroit pour tous les domaines.
- `evidence[]` ne contient **jamais d'URL** — uniquement des références
  (`artifact_id` Evidence Kernel, ou `fact_id` de la chaîne `facts_events`).
  Le téléchargement passe toujours par un proxy authentifié (contrats §3/§8).

Générique : `AnalyticalEnvelope` est paramétré par le type de `data`, pour que
chaque domaine garde son modèle métier typé sans `dict` opaque (« no untyped
JSON »).
"""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

from models.intelligence import DataStatus

DataT = TypeVar("DataT")


class MethodRef(BaseModel):
    """Méthode de calcul versionnée. Obligatoire dès qu'un chiffre est dérivé."""

    code: str = Field(min_length=1, max_length=100)
    version: str = Field(min_length=1, max_length=50)


class QualityMeta(BaseModel):
    """Qualité du résultat — grandeurs SÉPARÉES, jamais fusionnées (contrats §2).

    `confidence` (0-100, présentation) mesure la solidité du chiffre ; elle ne
    dit rien du risque (dimension distincte, cf. services/procurement/scoring.py)
    ni du statut de la donnée (`meta.status`). `warnings` reste visible : un
    résultat utilisable mais réservé n'est pas un résultat propre.
    """

    confidence: int | None = Field(default=None, ge=0, le=100)
    coverage_pct: float | None = Field(default=None, ge=0, le=100)
    warnings: list[str] = Field(default_factory=list)


class EvidenceRef(BaseModel):
    """Référence de preuve — jamais une URL (contrats §4).

    Soit une pièce du noyau (`artifact_id` + contexte source/release/localisation),
    soit un maillon de la chaîne `facts_events` (`fact_id`).
    """

    artifact_id: int | None = None
    fact_id: int | None = None
    source_code: str | None = None
    release_key: str | None = None
    page_reference: str | None = None
    excerpt: str | None = None
    note: str | None = None


class AnalyticalMeta(BaseModel):
    """Métadonnées obligatoires de tout résultat analytique.

    Toute valeur affichée par un module Wave 2 porte date + source + statut +
    méthode (contrats §2) : `as_of` + `evidence[]` de l'enveloppe + `status` +
    `method` ici.
    """

    as_of: str | None = None
    status: DataStatus = "estimated"
    method: MethodRef
    quality: QualityMeta = Field(default_factory=QualityMeta)


class AnalyticalEnvelope(BaseModel, Generic[DataT]):
    """`{data, meta, evidence}` — forme unique des endpoints de calcul Wave 2."""

    data: DataT
    meta: AnalyticalMeta
    evidence: list[EvidenceRef] = Field(default_factory=list)


def confidence_to_display(confidence_0_1: float | None) -> int | None:
    """Convertit une confiance backend (0-1) en confiance de présentation (0-100).

    Point de conversion UNIQUE (contrats §4 : « documenter la conversion dans
    chaque PR ») — pour qu'aucun domaine n'invente son propre arrondi et que
    les deux échelles ne se mélangent jamais dans le stockage.
    """
    if confidence_0_1 is None:
        return None
    return int(round(max(0.0, min(1.0, float(confidence_0_1))) * 100))
