"""
scripts/water_intelligence/candidate_budget.py — mesure de budget des snapshots
candidats (X4B-PREP, §6).

## Pourquoi une mesure et pas une estimation

Le §3.5 du paquet de décision estime le snapshot X3 à 250–350 ko, soit 2,5 à
3,5 fois le budget de 100 000 octets. C'est un ordre de grandeur raisonné, et
le §5.4 du plan impose de le **mesurer** avant tout commit. Ce module fait la
mesure ; il ne conclut rien qu'il n'ait mesuré.

## Quatre interdits, appliqués par construction

1. **Aucune troncature.** L'assembleur lève `SnapshotBudgetExceeded` au-delà du
   budget ; ce module capture la levée pour la RAPPORTER, jamais pour la
   contourner. Un candidat trop gros est un candidat `over_budget`, pas un
   candidat allégé.
2. **Aucun relèvement du plafond.** `MAX_MANIFEST_BYTES_UNCOMPRESSED` est lu
   depuis l'assembleur, jamais redéfini ici.
3. **Aucune preuve retirée.** Le poids vient de l'enveloppe de preuve portée
   par chaque observation ; l'alléger rendrait le budget tenable en rendant la
   donnée non auditable.
4. **Le gzip est informatif.** Il est mesuré et rapporté, mais le budget porte
   sur les octets **non compressés** : compresser pour passer sous le plafond
   reviendrait à changer le contrat sans le dire.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable, Literal, Sequence

from models.water_intelligence import WaterMetricObservation
from services.water_intelligence.public_snapshot import (
    MAX_MANIFEST_BYTES_UNCOMPRESSED,
    SnapshotBudgetExceeded,
    assemble_public_snapshot,
)
from services.water_intelligence.publication_decisions import (
    PublicationDecisionRegistry,
)

BudgetVerdict = Literal["within_budget", "over_budget"]


@dataclass(frozen=True)
class BudgetMeasurement:
    """Mesure d'UN candidat ou d'UNE combinaison de sources.

    `payload_bytes` vaut `None` quand l'assembleur a REFUSÉ d'assembler : le
    dépassement est alors connu sans que la taille exacte le soit, et c'est
    honnête de le dire ainsi plutôt que de rapporter un nombre obtenu en
    désactivant la garde.
    """

    label: str
    source_codes: tuple[str, ...]
    source_count: int
    observation_count: int
    payload_bytes: int | None
    payload_bytes_gzip: int | None
    provenance_bytes: int | None
    verdict: BudgetVerdict
    margin_bytes: int | None
    refusal: str | None = None

    def as_mapping(self) -> dict[str, object]:
        return {
            "label": self.label,
            "source_codes": list(self.source_codes),
            "source_count": self.source_count,
            "observation_count": self.observation_count,
            "payload_bytes": self.payload_bytes,
            "payload_bytes_gzip": self.payload_bytes_gzip,
            "provenance_bytes": self.provenance_bytes,
            "budget_bytes": MAX_MANIFEST_BYTES_UNCOMPRESSED,
            "margin_bytes": self.margin_bytes,
            "verdict": self.verdict,
            "refusal": self.refusal,
        }


def _provenance_bytes(observations: Sequence[WaterMetricObservation]) -> int:
    """Poids des seules références de provenance, en JSON canonique.

    Isolé parce que c'est la part qu'on serait tenté d'alléger en premier, et
    que la consigne l'interdit : la mesurer rend le coût de l'auditabilité
    visible au signataire au lieu de le laisser deviner.
    """
    seen: dict[tuple[str, str], object] = {}
    for observation in observations:
        key = (observation.source.source_code, observation.source.release_key)
        seen.setdefault(key, observation.source.model_dump(mode="json"))
    payload = json.dumps(
        [seen[key] for key in sorted(seen)],
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return len(payload.encode("utf-8"))


def measure(
    *,
    label: str,
    observations: Iterable[WaterMetricObservation],
    registry: PublicationDecisionRegistry,
    generated_at: datetime,
) -> BudgetMeasurement:
    """Assemble et mesure. Ne tronque jamais, ne relève jamais le plafond."""
    kept = list(observations)
    source_codes = tuple(sorted({o.source.source_code for o in kept}))

    try:
        snapshot = assemble_public_snapshot(
            observations=kept, registry=registry, generated_at=generated_at
        )
    except SnapshotBudgetExceeded as exc:
        # Le refus EST le résultat. On ne réassemble pas avec une garde
        # désactivée pour obtenir un nombre : le contrat dit « refuse », et un
        # nombre obtenu hors contrat ne décrirait aucun snapshot publiable.
        return BudgetMeasurement(
            label=label,
            source_codes=source_codes,
            source_count=len(source_codes),
            observation_count=len(kept),
            payload_bytes=None,
            payload_bytes_gzip=None,
            provenance_bytes=_provenance_bytes(kept),
            verdict="over_budget",
            margin_bytes=None,
            refusal=str(exc),
        )

    size = snapshot.payload_bytes()
    return BudgetMeasurement(
        label=label,
        source_codes=tuple(snapshot.included_source_codes),
        source_count=len(snapshot.included_source_codes),
        observation_count=snapshot.observation_count,
        payload_bytes=size,
        payload_bytes_gzip=snapshot.payload_bytes_gzip(),
        provenance_bytes=_provenance_bytes(kept),
        verdict="within_budget",
        margin_bytes=MAX_MANIFEST_BYTES_UNCOMPRESSED - size,
    )


def recommend(measurements: Sequence[BudgetMeasurement]) -> BudgetMeasurement | None:
    """Le plus grand candidat conforme au budget, sans perte de provenance.

    « Le plus grand » se lit : le plus d'observations d'abord, puis le plus de
    sources. Un candidat refusé par le budget n'est jamais recommandé, et
    aucune recommandation ne s'obtient en retirant de la preuve.

    **Cette recommandation ne vaut pas approbation humaine.** Elle dit ce qui
    tient techniquement, pas ce qu'il est juste de publier — le périmètre
    éditorial, les limites à afficher et la décision restent au signataire.
    """
    eligible = [m for m in measurements if m.verdict == "within_budget" and m.observation_count]
    if not eligible:
        return None
    return max(eligible, key=lambda m: (m.observation_count, m.source_count))
