"""
services/intelligence/adapters — contrat d'adaptateur de source + implémentations.

PR-04 ne livre QUE `FakeAdapter` (hors réseau, piloté par fixtures). Aucun
connecteur externe réel (LME/USGS/WRI…), aucun scraping, aucun accès Internet,
aucun LLM — conforme au périmètre du plan (§2 « Hors périmètre »).
"""

from .base import (
    AdapterError,
    ObservationDraft,
    ReleaseCandidate,
    SourceAdapter,
    sha256_hex,
)
from .fake import FakeAdapter

__all__ = [
    "AdapterError",
    "ObservationDraft",
    "ReleaseCandidate",
    "SourceAdapter",
    "FakeAdapter",
    "sha256_hex",
]
