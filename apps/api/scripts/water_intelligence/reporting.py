"""scripts/water_intelligence/reporting.py — rapport d'exécution EXPURGÉ (X1.5).

Un rapport X1 est commité. Il doit donc porter assez pour être reproductible
— identité de la source, release, bornes demandées, checksum, compteurs — et
rien de plus : ni octet de donnée, ni query complète, ni valeur de paramètre
dont le nom évoque un secret.

La distinction qui structure ce module : **la query est un paramètre de
recette, pas une preuve**. Deux exécutions du même geste sur deux territoires
différents doivent produire deux rapports comparables ; c'est le checksum et
les compteurs qui attestent, pas les codes géographiques. Ceux-ci sont donc
journalisés séparément, masqués dès que leur nom l'exige, et jamais recollés
dans l'URL.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Sequence

from scripts.water_intelligence.fetcher import FetchLogEntry, is_secret_parameter

#: Verdicts autorisés. Toute autre valeur est refusée à la construction : un
#: verdict libre finirait par dire « ok », qui ne veut rien dire.
VERDICTS: tuple[str, ...] = (
    "ready_for_staging",
    "schema_drift",
    "source_unavailable",
    "blocked",
    "decoder_deferred",
)


class ReportError(Exception):
    """Rapport incohérent — refusé plutôt qu'écrit à moitié."""


@dataclass
class ValidationReport:
    """Rapport d'une validation live, unique format pour toutes les sources."""

    source_code: str
    release_key: str | None
    verdict: str
    executed_at: str
    method: str
    #: Bornes DEMANDÉES par l'opérateur (pages, octets, timeout, fenêtre).
    limits: Mapping[str, Any] = field(default_factory=dict)
    #: Paramètres de recette, masqués si leur nom évoque un secret.
    query_parameters: Mapping[str, str] = field(default_factory=dict)
    transfers: Sequence[FetchLogEntry] = field(default_factory=tuple)
    pages_fetched: int = 0
    bytes_received: int = 0
    payload_sha256: str | None = None
    payload_format: str | None = None
    records_received: int = 0
    records_normalized: int = 0
    records_rejected: int = 0
    rejection_causes: Sequence[str] = field(default_factory=tuple)
    records_absent_value: int = 0
    units: Sequence[str] = field(default_factory=tuple)
    periods: Sequence[str] = field(default_factory=tuple)
    geographies: Sequence[str] = field(default_factory=tuple)
    pipeline_steps_executed: Sequence[str] = field(default_factory=tuple)
    pipeline_steps_failed: Sequence[str] = field(default_factory=tuple)
    dry_run: bool = True
    records_publishable: int = 0
    warnings: Sequence[str] = field(default_factory=tuple)
    errors: Sequence[str] = field(default_factory=tuple)
    duration_seconds: float = 0.0
    notes: Sequence[str] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if self.verdict not in VERDICTS:
            raise ReportError(
                f"verdict {self.verdict!r} inconnu — attendus : {list(VERDICTS)}."
            )
        if self.dry_run is not True:
            raise ReportError(
                "X1 est en lecture seule : un rapport ne peut pas attester d'une "
                "exécution qui ne serait pas en dry-run."
            )
        if self.records_publishable:
            raise ReportError(
                "X1 ne publie rien : records_publishable doit rester à 0 — "
                f"reçu {self.records_publishable}."
            )
        leaked = sorted(n for n in self.query_parameters if is_secret_parameter(n))
        if leaked:
            raise ReportError(
                f"paramètre(s) sensible(s) non masqué(s) dans le rapport : {leaked}."
            )

    # -- sérialisation -----------------------------------------------------

    def as_mapping(self) -> dict[str, Any]:
        return {
            "source_code": self.source_code,
            "release_key": self.release_key,
            "verdict": self.verdict,
            "executed_at": self.executed_at,
            "method": self.method,
            "dry_run": self.dry_run,
            "limits": dict(self.limits),
            "query_parameters": dict(self.query_parameters),
            "transfers": [entry.as_mapping() for entry in self.transfers],
            "pages_fetched": self.pages_fetched,
            "bytes_received": self.bytes_received,
            "payload_sha256": self.payload_sha256,
            "payload_format": self.payload_format,
            "records_received": self.records_received,
            "records_normalized": self.records_normalized,
            "records_rejected": self.records_rejected,
            "rejection_causes": list(self.rejection_causes),
            "records_absent_value": self.records_absent_value,
            "units": list(self.units),
            "periods": list(self.periods),
            "geographies": list(self.geographies),
            "pipeline_steps_executed": list(self.pipeline_steps_executed),
            "pipeline_steps_failed": list(self.pipeline_steps_failed),
            "records_publishable": self.records_publishable,
            "warnings": list(self.warnings),
            "errors": list(self.errors),
            "duration_seconds": round(self.duration_seconds, 3),
            "notes": list(self.notes),
        }

    def to_markdown(self) -> str:
        payload = self.as_mapping()
        lines: list[str] = [
            f"# Validation live — {self.source_code}",
            "",
            f"**Verdict :** `{self.verdict}`  ",
            f"**Release :** `{self.release_key or 'n/a'}`  ",
            f"**Exécuté le :** {self.executed_at}  ",
            f"**Méthode :** `{self.method}`  ",
            "**Écriture en base :** aucune (`dry_run=true`)  ",
            f"**Durée :** {self.duration_seconds:.3f} s",
            "",
            "## Transferts",
            "",
            "| # | URL (sans query) | HTTP | Content-Type | Octets | SHA-256 | Durée |",
            "|---|---|---|---|---|---|---|",
        ]
        if not self.transfers:
            lines.append("| — | _aucun transfert_ | — | — | — | — | — |")
        for index, entry in enumerate(self.transfers, start=1):
            digest = f"`{entry.sha256[:16]}…`" if entry.sha256 else "—"
            lines.append(
                f"| {index} | `{entry.url}` | {entry.status_code or '—'} | "
                f"{entry.content_type or '—'} | {entry.bytes_received} | {digest} | "
                f"{entry.elapsed_seconds:.3f} s |"
            )
            if entry.redirects:
                lines.append(
                    f"|  | ↳ redirections : {', '.join(f'`{r}`' for r in entry.redirects)} "
                    "| | | | | |"
                )
            if entry.error:
                lines.append(f"|  | ↳ erreur : {entry.error} | | | | | |")

        lines += [
            "",
            "## Acquisition",
            "",
            f"- pages : **{self.pages_fetched}**",
            f"- octets : **{self.bytes_received}**",
            f"- format réellement reçu : **{self.payload_format or 'n/a'}**",
            f"- checksum du payload (SHA-256) : `{self.payload_sha256 or 'n/a'}`",
            "",
            "## Normalisation",
            "",
            f"- records reçus : **{self.records_received}**",
            f"- records normalisés : **{self.records_normalized}**",
            f"- records rejetés : **{self.records_rejected}**",
            f"- valeurs absentes conservées absentes : **{self.records_absent_value}**",
            f"- records publiables : **{self.records_publishable}** "
            "(X1 ne publie rien, par construction)",
        ]
        if self.rejection_causes:
            lines.append("- causes de rejet :")
            lines += [f"  - {cause}" for cause in self.rejection_causes]
        else:
            lines.append("- causes de rejet : _aucune_")

        lines += [
            "",
            "## Contenu observé",
            "",
            f"- unités : {_inline(self.units)}",
            f"- périodes : {_inline(self.periods)}",
            f"- géographies : {_inline(self.geographies)}",
            "",
            "## Pipeline (dry-run)",
            "",
            f"- étapes exécutées : {_inline(self.pipeline_steps_executed)}",
            f"- étapes en échec : {_inline(self.pipeline_steps_failed)}",
            "",
            "## Bornes demandées",
            "",
        ]
        lines += [f"- `{name}` : {value}" for name, value in sorted(self.limits.items())] or [
            "- _aucune_"
        ]
        lines += ["", "## Paramètres de recette", ""]
        lines += [
            f"- `{name}` : `{value}`" for name, value in sorted(self.query_parameters.items())
        ] or ["- _aucun_"]

        lines += ["", "## Avertissements", ""]
        lines += [f"- {w}" for w in self.warnings] or ["- _aucun_"]
        lines += ["", "## Erreurs", ""]
        lines += [f"- {e}" for e in self.errors] or ["- _aucune_"]
        if self.notes:
            lines += ["", "## Notes", ""]
            lines += [f"- {n}" for n in self.notes]

        lines += [
            "",
            "---",
            "",
            "<details><summary>Rapport structuré (JSON)</summary>",
            "",
            "```json",
            json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True),
            "```",
            "",
            "</details>",
            "",
        ]
        return "\n".join(lines)

    def write(self, path: Path) -> Path:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.to_markdown(), encoding="utf-8")
        return path


def _inline(values: Sequence[str]) -> str:
    if not values:
        return "_aucune_"
    return ", ".join(f"`{v}`" for v in values)
