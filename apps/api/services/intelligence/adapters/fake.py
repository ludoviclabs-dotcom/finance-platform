"""
adapters/fake.py — `FakeAdapter` : adaptateur hors réseau piloté par un
fichier local (PR-04).

Aucun accès Internet, aucun LLM : lit les octets d'un fichier, les désérialise
en JSON, et délègue la normalisation à une fonction `normalizer` injectée
(la connaissance métier du format — ex. le mapping CRM matière → observations
— vit dans l'appelant, pas dans l'adaptateur). Déterministe : mêmes octets →
mêmes drafts, même checksum.

C'est l'unique adaptateur livré par PR-04. Les connecteurs réels
(LME/USGS/WRI…) sont explicitement hors périmètre.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from .base import AdapterError, ObservationDraft, ReleaseCandidate

Normalizer = Callable[[Any], list[ObservationDraft]]


class FakeAdapter:
    """Adaptateur de fichier local.

    Paramètres :
      - `path` : chemin du fichier fixture (JSON) à lire.
      - `release_key` : clé stable de la release (ex. la date du snapshot).
      - `normalizer` : `parsed -> list[ObservationDraft]` (mapping métier).
      - `mime_type` / `filename` / `published_at` : métadonnées de la release.

    `content` peut être fourni directement (tests) pour court-circuiter la
    lecture disque — l'adaptateur reste alors 100 % en mémoire.
    """

    def __init__(
        self,
        *,
        path: str | Path | None = None,
        release_key: str,
        normalizer: Normalizer,
        content: bytes | None = None,
        filename: str | None = None,
        mime_type: str = "application/json",
        published_at: datetime | None = None,
    ) -> None:
        if content is None and path is None:
            raise AdapterError("FakeAdapter : `path` ou `content` requis.")
        self._path = Path(path) if path is not None else None
        self._content = content
        self._release_key = release_key
        self._normalizer = normalizer
        self._filename = filename or (self._path.name if self._path else f"{release_key}.json")
        self._mime_type = mime_type
        self._published_at = published_at

    def _read_bytes(self) -> bytes:
        if self._content is not None:
            return self._content
        assert self._path is not None
        try:
            return self._path.read_bytes()
        except OSError as exc:  # fichier absent/illisible — jamais un fallback silencieux
            raise AdapterError(f"FakeAdapter : lecture impossible de {self._path} : {exc}") from exc

    def detect_releases(self) -> list[ReleaseCandidate]:
        """Une seule release : le fichier fixture. Checksum calculé sur les
        octets bruts (identité d'idempotence de détection du noyau 028)."""
        raw = self._read_bytes()
        return [
            ReleaseCandidate(
                release_key=self._release_key,
                content=raw,
                filename=self._filename,
                mime_type=self._mime_type,
                published_at=self._published_at,
            )
        ]

    def fetch_release(self, candidate: ReleaseCandidate) -> bytes:
        """Octets bruts — déjà en mémoire (aucun réseau)."""
        return candidate.content

    def parse(self, raw: bytes) -> Any:
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise AdapterError(f"FakeAdapter : JSON invalide : {exc}") from exc

    def normalize(self, parsed: Any) -> list[ObservationDraft]:
        drafts = self._normalizer(parsed)
        for d in drafts:
            if not d.has_value():
                raise AdapterError(
                    f"FakeAdapter : draft sans valeur ({d.subject_key}/{d.metric_code}) — "
                    "au moins une valeur numeric/text/boolean requise."
                )
        return drafts
