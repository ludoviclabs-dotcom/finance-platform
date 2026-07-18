"""
adapters/base.py — contrat `SourceAdapter` (PR-04).

Un adaptateur transforme une source (fichier, à terme API/webpage) en
`ReleaseCandidate` (octets bruts + clé + checksum) puis en `ObservationDraft`
normalisés — SANS écrire en base, SANS décider de licence, SANS publier. Le
pipeline d'écriture (register source → artifact → detect/validate/publish →
observations) reste l'affaire de `snapshot_migration` + des services PR-03 :

    adapter.detect_releases()  →  candidats (octets + checksum)
    adapter.fetch_release(c)   →  octets bruts (déjà en mémoire pour un fichier)
    adapter.parse(raw)         →  structure intermédiaire (ex. JSON désérialisé)
    adapter.normalize(parsed)  →  list[ObservationDraft] déterministe

Invariants du contrat :
  - **Déterministe / idempotent** : mêmes octets d'entrée → mêmes drafts, même
    checksum, même clé de release. Aucun horodatage « maintenant », aucun
    aléa.
  - **Aucune logique métier** : l'adaptateur mappe des champs, il ne calcule
    pas de score ni ne juge une valeur (le score du snapshot est RECOPIÉ, pas
    recalculé — migration byte-fidèle).
  - **Aucun réseau, aucun LLM** : PR-04 ne fournit que `FakeAdapter`, piloté
    par fixtures locales.
  - **Incapable de publier** : un adaptateur n'a pas accès à la licence ; la
    publication est refusée en aval (`release_service.publish_release`, gate
    `license_policy`) si les droits l'interdisent — jamais contournable par un
    adaptateur.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol, runtime_checkable


class AdapterError(Exception):
    """Erreur d'un adaptateur (fichier illisible, structure inattendue…)."""


def sha256_hex(data: bytes) -> str:
    """SHA-256 hexadécimal des octets bruts — même primitive que
    `artifact_service` et le ledger de migrations (aucune normalisation)."""
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True)
class ReleaseCandidate:
    """Une release détectée : octets bruts + identité stable.

    `checksum_sha256` est calculé à la construction si non fourni — l'identité
    d'idempotence de détection (source, release_key, checksum) du noyau 028.
    """

    release_key: str
    content: bytes
    filename: str
    mime_type: str = "application/json"
    published_at: datetime | None = None
    checksum_sha256: str = ""

    def __post_init__(self) -> None:
        if not self.checksum_sha256:
            object.__setattr__(self, "checksum_sha256", sha256_hex(self.content))


@dataclass(frozen=True)
class ObservationDraft:
    """Observation normalisée AVANT écriture (pas encore de company_id ni de
    source_release_id — ajoutés par `snapshot_migration` au moment de créer la
    ligne). Miroir des colonnes de `observations` (migration 028).

    Au moins une des trois valeurs typées (numeric/text/boolean) doit être
    renseignée — même contrat que la contrainte CHECK
    `observations_value_presence_check`.
    """

    subject_type: str
    subject_key: str
    metric_code: str
    numeric_value: float | None = None
    text_value: str | None = None
    boolean_value: bool | None = None
    unit: str | None = None
    geography_code: str | None = None
    stage_code: str | None = None
    observed_at: datetime | None = None
    data_status: str = "estimated"
    confidence: float | None = None
    methodology_version: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def has_value(self) -> bool:
        return (
            self.numeric_value is not None
            or self.text_value is not None
            or self.boolean_value is not None
        )

    def dedup_key(self) -> tuple[str, str, str]:
        """Clé d'idempotence d'une observation dans une release :
        (subject_type, subject_key, metric_code)."""
        return (self.subject_type, self.subject_key, self.metric_code)


@runtime_checkable
class SourceAdapter(Protocol):
    """Contrat que tout adaptateur (fake aujourd'hui, réels plus tard) respecte."""

    def detect_releases(self) -> list[ReleaseCandidate]:
        """Liste les releases disponibles (déterministe, sans réseau en PR-04)."""
        ...

    def fetch_release(self, candidate: ReleaseCandidate) -> bytes:
        """Octets bruts d'une release (déjà en mémoire pour un fichier local)."""
        ...

    def parse(self, raw: bytes) -> Any:
        """Désérialise les octets bruts en structure intermédiaire."""
        ...

    def normalize(self, parsed: Any) -> list[ObservationDraft]:
        """Produit les observations normalisées à partir de la structure parsée."""
        ...
