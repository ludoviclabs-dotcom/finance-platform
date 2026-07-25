"""
services/water_intelligence/tenant_synthesis.py — synthèse hydrique
authentifiée (P14, Wave D).

## Ce que la synthèse compose, et ce qu'elle refuse d'agréger

Le MACRO-PROMPT D demande une synthèse authentifiée portant six facettes :
risque, confiance, dépendance, ressource/matière, IRO et actions. Il interdit
dans la même phrase tout **score ESG global**.

Ces deux exigences ne sont pas en tension, elles sont la même : une synthèse
utile juxtapose des grandeurs qui ne s'additionnent pas. Un risque élevé mesuré
sur une source fragile n'est pas comparable à un risque élevé bien documenté ;
une dépendance opérationnelle n'est pas une unité de risque. Les fusionner
produirait un nombre lisible et faux.

Ce module compose donc, et **ne calcule aucun agrégat inter-facettes**. Il n'y
a pas de champ `score`, pas de moyenne, pas de pondération — et un test le
vérifie sur la structure elle-même.

## Le piège des vocabulaires homonymes

`/water` qualifie un screening en `high` ; `/resources` qualifie une sévérité
en `high` ; un IRO porte sa propre échelle. Ces trois `high` ne veulent pas dire
la même chose et ne proviennent pas de la même méthode.

Chaque entrée porte donc obligatoirement le **nom du vocabulaire** dont sa
valeur est tirée. Deux entrées de vocabulaires différents ne peuvent jamais
être comparées par ce module — il n'expose aucune fonction pour le faire.

## Anti-IDOR : deuxième barrière, jamais la seule

La RLS PostgreSQL reste la barrière principale. Ce module en ajoute une
seconde, applicative : la synthèse est construite pour **un** `company_id`, et
toute entrée portant un autre `company_id` fait échouer la construction au lieu
d'être filtrée en silence. Un filtrage silencieux masquerait un défaut de
requête ; un échec bruyant le révèle.

Le module est **pur** : aucune connexion, aucune requête, aucune horloge. Le
service qui le nourrit fait les lectures scopées ; ici on ne fait que composer.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Literal, Mapping

#: Les six facettes de la synthèse. Volontairement fermées : ajouter une
#: facette est une décision de conception, pas un effet de bord d'une requête.
SynthesisFacet = Literal[
    "risk",
    "confidence",
    "dependency",
    "resource_material",
    "iro",
    "action",
]

FACET_ORDER: tuple[SynthesisFacet, ...] = (
    "risk",
    "confidence",
    "dependency",
    "resource_material",
    "iro",
    "action",
)

#: Libellés normalisés — repris tels quels par l'API et l'UI.
FACET_LABELS: Mapping[SynthesisFacet, str] = {
    "risk": "Risque hydrique",
    "confidence": "Confiance documentaire",
    "dependency": "Dépendance opérationnelle",
    "resource_material": "Ressources et matières",
    "iro": "IRO rattachés",
    "action": "Actions et adaptation",
}


class TenantSynthesisError(Exception):
    """Synthèse mal formée — refusée à la construction, jamais tolérée."""


class CrossTenantEntryError(TenantSynthesisError):
    """Une entrée d'un autre tenant a été versée à la synthèse.

    Ne jamais rattraper cette exception pour continuer : elle signale une
    requête mal scopée, pas un cas limite fonctionnel.
    """


@dataclass(frozen=True)
class FacetEntry:
    """Un fait déjà établi par un module, versé tel quel à la synthèse.

    `value` reste dans le vocabulaire de sa source ; `vocabulary` nomme ce
    vocabulaire. Sans ce nom, deux `high` d'origines différentes finiraient par
    être lus comme équivalents.
    """

    company_id: int
    facet: SynthesisFacet
    source_module: str
    label: str
    vocabulary: str
    value: str | None = None
    evidence_ref: str | None = None
    absence_reason: str | None = None

    def __post_init__(self) -> None:
        if self.facet not in FACET_ORDER:
            raise TenantSynthesisError(f"facette {self.facet!r} inconnue.")
        for name in ("source_module", "label", "vocabulary"):
            if not str(getattr(self, name)).strip():
                raise TenantSynthesisError(
                    f"FacetEntry.{name} obligatoire — une entrée sans {name} n'est "
                    "pas interprétable."
                )
        if self.value is None and not (self.absence_reason or "").strip():
            raise TenantSynthesisError(
                f"{self.source_module}/{self.facet} : une valeur absente exige un "
                "motif d'absence — une absence muette se lit comme un zéro."
            )

    @property
    def is_absent(self) -> bool:
        return self.value is None

    def as_mapping(self) -> Mapping[str, object]:
        return {
            "facet": self.facet,
            "source_module": self.source_module,
            "label": self.label,
            "vocabulary": self.vocabulary,
            "value": self.value,
            "evidence_ref": self.evidence_ref,
            "absence_reason": self.absence_reason,
        }


@dataclass(frozen=True)
class FacetSummary:
    """Résumé d'UNE facette. Ne porte aucun nombre agrégé.

    `vocabularies` est un tuple : si une facette reçoit des entrées de
    plusieurs vocabulaires, la synthèse le rend visible au lieu de choisir.
    """

    facet: SynthesisFacet
    label: str
    entries: tuple[FacetEntry, ...]

    @property
    def vocabularies(self) -> tuple[str, ...]:
        return tuple(sorted({entry.vocabulary for entry in self.entries}))

    @property
    def is_empty(self) -> bool:
        return not self.entries

    @property
    def has_mixed_vocabularies(self) -> bool:
        return len(self.vocabularies) > 1

    def as_mapping(self) -> Mapping[str, object]:
        return {
            "facet": self.facet,
            "label": self.label,
            "is_empty": self.is_empty,
            "vocabularies": list(self.vocabularies),
            "has_mixed_vocabularies": self.has_mixed_vocabularies,
            "entries": [entry.as_mapping() for entry in self.entries],
        }


@dataclass(frozen=True)
class TenantWaterSynthesis:
    """Synthèse hydrique d'UNE entreprise.

    Ne comporte volontairement **aucun** champ de score, d'indice ou de note
    globale : les six facettes restent lisibles séparément.
    """

    company_id: int
    facets: tuple[FacetSummary, ...]

    @property
    def is_empty(self) -> bool:
        return all(facet.is_empty for facet in self.facets)

    def facet(self, facet: SynthesisFacet) -> FacetSummary:
        for summary in self.facets:
            if summary.facet == facet:
                return summary
        raise TenantSynthesisError(f"facette {facet!r} absente de la synthèse.")

    def as_mapping(self) -> Mapping[str, object]:
        return {
            "company_id": self.company_id,
            "is_empty": self.is_empty,
            "facets": [facet.as_mapping() for facet in self.facets],
        }


def build_tenant_synthesis(
    *, company_id: int, entries: Iterable[FacetEntry]
) -> TenantWaterSynthesis:
    """Compose la synthèse d'une entreprise à partir d'entrées déjà scopées.

    Deuxième barrière anti-IDOR : une entrée portant un autre `company_id` fait
    échouer la construction (`CrossTenantEntryError`) au lieu d'être écartée en
    silence. Les six facettes sont toujours présentes, même vides — une facette
    absente de la réponse serait indiscernable d'une facette non calculée.
    """
    if company_id <= 0:
        raise TenantSynthesisError("company_id doit être un identifiant positif.")

    grouped: dict[SynthesisFacet, list[FacetEntry]] = {facet: [] for facet in FACET_ORDER}
    for entry in entries:
        if entry.company_id != company_id:
            raise CrossTenantEntryError(
                f"entrée {entry.source_module}/{entry.facet} portant "
                f"company_id={entry.company_id} versée à la synthèse de "
                f"company_id={company_id} — requête mal scopée."
            )
        grouped[entry.facet].append(entry)

    return TenantWaterSynthesis(
        company_id=company_id,
        facets=tuple(
            FacetSummary(
                facet=facet,
                label=FACET_LABELS[facet],
                entries=tuple(
                    sorted(grouped[facet], key=lambda e: (e.source_module, e.label))
                ),
            )
            for facet in FACET_ORDER
        ),
    )
