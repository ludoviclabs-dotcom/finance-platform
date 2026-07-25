"""
services/water_intelligence/publication_decisions.py — registre des décisions
HUMAINES de publication (P10, Wave C).

## Pourquoi ce registre existe

Identifier la licence générale d'une plateforme ne rend pas ses jeux
publiables. Hub'Eau est en Licence Ouverte Etalab, l'EEA publie le WEI+ en
CC BY 4.0 : ces faits sont vérifiés (Waves A et B) et **ne suffisent pas**.

Le gate licence du MACRO-PROMPT C impose une étape de plus : une **décision
humaine explicite et revue**, source par source. Sans elle, rien n'est
publié. Ce module matérialise cette étape au lieu de la laisser implicite —
une licence permissive lue par une machine n'est pas un feu vert éditorial.

## Les quatre statuts, et ce qu'ils autorisent

| Statut | Publiable | Sens |
|---|---|---|
| `approved` | **oui**, si `reviewed_by` et `reviewed_on` sont renseignés | Un humain a tranché et signé |
| `proposed` | **non** | Analyse faite, décision NON rendue. Reste inactive |
| `refused` | **non** | Un humain a explicitement refusé |
| *(absente du registre)* | **non** | Aucune décision : exclusion par défaut |

`unknown` n'existe pas comme statut autorisant : une source sans décision est
traitée exactement comme une source refusée du point de vue de la
publication, avec un motif différent. **Aucune décision absente ne devient
autorisée**, et un `approved` sans réviseur ni date est rejeté à la
construction — une signature manquante n'est pas une signature.

## État du registre au moment de la Wave C

Aucune source n'est `approved`. Conséquence assumée et testée : le snapshot
public est **vide**. C'est le résultat honnête du gate, pas une régression —
la surface doit le rendre correctement (états 7.3/7.5 du blueprint UX).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable, Literal, Mapping

PublicationStatus = Literal["approved", "proposed", "refused"]

#: Motifs d'exclusion normalisés — repris tels quels dans le manifest public.
EXCLUSION_NO_DECISION = "no_human_decision"
EXCLUSION_DECISION_PENDING = "decision_proposed_not_reviewed"
EXCLUSION_DECISION_REFUSED = "decision_refused"


class PublicationDecisionError(Exception):
    """Décision mal formée — refusée à la construction, jamais tolérée."""


@dataclass(frozen=True)
class PublicationDecision:
    """Décision humaine de publication pour UNE source.

    `reviewed_by`/`reviewed_on` sont obligatoires dès que le statut est
    `approved` : une autorisation sans réviseur identifié ni date n'est pas
    une décision, c'est une case cochée.
    """

    source_code: str
    status: PublicationStatus
    reason: str
    reviewed_by: str | None = None
    reviewed_on: date | None = None

    def __post_init__(self) -> None:
        if not self.source_code.strip():
            raise PublicationDecisionError("source_code obligatoire.")
        if not self.reason.strip():
            raise PublicationDecisionError(
                f"{self.source_code} : motif obligatoire — une décision sans motif "
                "n'est pas auditable."
            )
        if self.status not in ("approved", "proposed", "refused"):
            raise PublicationDecisionError(
                f"{self.source_code} : statut {self.status!r} inconnu."
            )
        if self.status == "approved" and not (self.reviewed_by and self.reviewed_on):
            raise PublicationDecisionError(
                f"{self.source_code} : un statut 'approved' exige `reviewed_by` ET "
                "`reviewed_on` — une signature manquante n'est pas une signature."
            )

    @property
    def allows_publication(self) -> bool:
        """Seul `approved` signé autorise. Le reste, jamais."""
        return self.status == "approved" and bool(self.reviewed_by and self.reviewed_on)

    @property
    def exclusion_reason(self) -> str | None:
        if self.allows_publication:
            return None
        if self.status == "proposed":
            return EXCLUSION_DECISION_PENDING
        return EXCLUSION_DECISION_REFUSED


class PublicationDecisionRegistry:
    """Registre immuable de décisions, indexé par `source_code`."""

    def __init__(self, decisions: Iterable[PublicationDecision]) -> None:
        indexed: dict[str, PublicationDecision] = {}
        for decision in decisions:
            if decision.source_code in indexed:
                raise PublicationDecisionError(
                    f"{decision.source_code} : deux décisions pour la même source — "
                    "ambiguïté refusée."
                )
            indexed[decision.source_code] = decision
        self._decisions = indexed

    def __len__(self) -> int:
        return len(self._decisions)

    def get(self, source_code: str) -> PublicationDecision | None:
        return self._decisions.get(source_code)

    def allows(self, source_code: str) -> bool:
        decision = self.get(source_code)
        return decision.allows_publication if decision else False

    def exclusion_reason(self, source_code: str) -> str | None:
        """Motif d'exclusion, ou `None` si la source est publiable."""
        decision = self.get(source_code)
        if decision is None:
            return EXCLUSION_NO_DECISION
        return decision.exclusion_reason

    @property
    def approved_source_codes(self) -> tuple[str, ...]:
        return tuple(
            sorted(code for code, d in self._decisions.items() if d.allows_publication)
        )

    def as_manifest_entries(self) -> tuple[Mapping[str, object], ...]:
        """Vue sérialisable pour le manifest public — décisions incluses ET
        exclusions, dans un ordre déterministe."""
        return tuple(
            {
                "source_code": code,
                "status": decision.status,
                "reason": decision.reason,
                "reviewed_by": decision.reviewed_by,
                "reviewed_on": decision.reviewed_on.isoformat() if decision.reviewed_on else None,
                "allows_publication": decision.allows_publication,
            }
            for code, decision in sorted(self._decisions.items())
        )


# ---------------------------------------------------------------------------
# Registre courant — aucune source approuvée à ce jour
# ---------------------------------------------------------------------------

#: Décisions réelles au moment de la Wave C. Chaque motif est un fait vérifié
#: par les Waves A et B, jamais une supposition.
CURRENT_DECISIONS: tuple[PublicationDecision, ...] = (
    PublicationDecision(
        source_code="WRI_AQUEDUCT",
        status="refused",
        reason=(
            "Licence CC BY 4.0 vérifiée, mais WRI exige en outre un enregistrement "
            "pour partager/adapter les données. Enregistrement NON effectué : aucune "
            "valeur Aqueduct n'est publiable tant qu'un humain n'a pas tranché."
        ),
    ),
    PublicationDecision(
        source_code="COPERNICUS_EDO",
        status="refused",
        reason=(
            "Statut connecteur `source_verified_decoder_deferred` : identité de source "
            "vérifiée mais décodage raster volontairement reporté (aucune dépendance "
            "GDAL/rasterio/netCDF4 sans ADR). Aucune valeur décodée, donc rien à publier."
        ),
    ),
    PublicationDecision(
        source_code="EEA_WEI_PLUS",
        status="proposed",
        reason=(
            "Licence CC BY 4.0 (détenteur EEA) vérifiée en Wave A, attribution composée "
            "disponible. Analyse faite, décision de publication NON rendue : identifier "
            "une licence permissive ne vaut pas autorisation éditoriale. Reste inactive."
        ),
    ),
    PublicationDecision(
        source_code="HUBEAU_HYDROMETRIE",
        status="proposed",
        reason=(
            "Licence Ouverte Etalab vérifiée en Wave B (plateforme). Décision par jeu "
            "NON rendue ; le connecteur n'a par ailleurs jamais publié (dry-run)."
        ),
    ),
    PublicationDecision(
        source_code="HUBEAU_ADES",
        status="proposed",
        reason=(
            "Licence Ouverte Etalab vérifiée en Wave B (plateforme). Décision par jeu "
            "NON rendue ; le connecteur n'a par ailleurs jamais publié (dry-run)."
        ),
    ),
    PublicationDecision(
        source_code="HUBEAU_BNPE_PRELEVEMENTS",
        status="proposed",
        reason=(
            "Licence Ouverte Etalab vérifiée en Wave B. Décision NON rendue. Rappel de "
            "couverture : usages exonérés de redevance inconnus et volumes < 10 000 m³ "
            "non déclarés — une publication devra rendre l'absence, jamais un zéro."
        ),
    ),
    PublicationDecision(
        source_code="HUBEAU_QUALITE_SURFACE",
        status="proposed",
        reason=(
            "Licence Ouverte Etalab vérifiée en Wave B. Décision NON rendue. Une "
            "publication exigerait en outre une allowlist de paramètres SANDRE revue "
            "et l'absence de toute conclusion de conformité (registre juridique = P13)."
        ),
    ),
)


def current_registry() -> PublicationDecisionRegistry:
    """Registre courant. Aucune source `approved` à ce jour — le snapshot
    public est donc vide, et c'est le résultat correct du gate."""
    return PublicationDecisionRegistry(CURRENT_DECISIONS)
