"""
services/water/water_synthesis_service.py — lecteur tenant de la synthèse
hydrique (P14, Wave D).

## Pourquoi ce fichier n'est pas dans `services/water_intelligence/`

Le paquet `water_intelligence` est **pur par contrat** : un test AST vérifie
qu'aucun de ses modules n'importe `db.database`, psycopg ou un client HTTP.
Cette pureté est ce qui garantit que la surface publique ne peut pas toucher au
tenant. La synthèse, elle, lit des données d'entreprise : elle appartient donc
au module tenant `services/water/`, aux côtés des autres lecteurs scopés.

La frontière est nette : `water_intelligence.tenant_synthesis` **compose** sans
rien lire ; ce module **lit** sans rien décider.

## Dégradation par facette, plutôt qu'un 503 global

Les tables 036 à 043 ne sont pas garanties présentes en production : le code
est déployé avant l'application des migrations, et 036 exige une étape manuelle.
Une synthèse qui lit six facettes à travers cinq modules aurait, avec la garde
`schema_ready_guard` classique, un comportement tout-ou-rien : une seule table
absente renverrait 503 pour l'ensemble, y compris pour les facettes
parfaitement lisibles.

Ce module dégrade donc **facette par facette** : une source dont le schéma
n'est pas prêt produit une entrée d'absence motivée (`schema_not_ready`), et
les autres facettes restent rendues. C'est exactement ce que le contrat de
`FacetEntry` impose déjà — une valeur absente exige un motif, parce qu'une
absence muette se lit comme un zéro.

Une erreur qui n'est PAS un schéma manquant remonte nue : on ne masque jamais
un vrai défaut derrière une absence plausible.

## Anti-IDOR — et le piège que la Wave E a révélé

Chaque lecture passe par un service existant déjà scopé (`company_id = %s` en
plus de la RLS). La composition ajoute une troisième barrière : toute entrée
portant un autre `company_id` fait échouer `build_tenant_synthesis`.

**Cette troisième barrière était inopérante jusqu'à la Wave E.** Les entrées
étaient estampillées avec le `company_id` DEMANDÉ, pas avec celui de la ligne
effectivement lue. Une ligne fuitée était donc réétiquetée au nom du
demandeur, et le garde-fou ne pouvait structurellement jamais se déclencher —
il vérifiait une valeur qu'il venait lui-même de poser.

Le défaut a été trouvé par le premier test tenant A/B contre un vrai
PostgreSQL (commit E5), et pas avant : un double de lecture ne peut pas
oublier une clause `WHERE`. Chaque entrée porte désormais le `company_id` de
SA ligne — `_entry_company_id()` refuse une ligne qui n'en déclare pas.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from services.water_intelligence.tenant_synthesis import (
    FacetEntry,
    TenantWaterSynthesis,
    build_tenant_synthesis,
)

#: SQLSTATE d'un schéma pas encore migré — mêmes codes que `routers/_errors.py`,
#: comparés par code pour ne pas dépendre des classes psycopg2.
_SCHEMA_NOT_READY_PGCODES = frozenset({"42P01", "42703"})

#: Motif normalisé d'absence par schéma non migré.
ABSENCE_SCHEMA_NOT_READY = "schema_not_ready"
#: Motif normalisé d'absence par donnée réellement vide.
ABSENCE_NO_RECORD = "no_record"

#: Vocabulaires nommés. Trois `high` sans rapport existent dans le produit —
#: les nommer est la seule façon de ne jamais les confondre.
VOCAB_WATER_STRESS = "water_stress_category_v1"
VOCAB_WATER_CONFIDENCE = "water_screening_confidence_pct_v1"
VOCAB_WATER_ACTIVITY = "water_activity_type_v1"
VOCAB_RESOURCE_ROLE = "resource_exposure_role_v1"
VOCAB_IRO_TYPE = "iro_type_v1"
VOCAB_ACTION_STATUS = "water_action_status_v1"


def _is_schema_not_ready(exc: BaseException) -> bool:
    return getattr(exc, "pgcode", None) in _SCHEMA_NOT_READY_PGCODES


@contextmanager
def _degrade_on_missing_schema(collected: list[FacetEntry], entry: FacetEntry) -> Iterator[None]:
    """Exécute une lecture ; en cas de schéma absent, verse `entry` à la place.

    Toute autre exception repart inchangée — jamais une absence plausible à la
    place d'un vrai défaut.
    """
    try:
        yield
    except Exception as exc:  # noqa: BLE001 - re-levée si ce n'est pas un schéma manquant
        if not _is_schema_not_ready(exc):
            raise
        collected.append(entry)


def _entry_company_id(record: object, *, source: str) -> int:
    """Tenant de la LIGNE LUE, jamais celui demandé.

    Un objet de domaine sans `company_id` ne peut pas être rattaché avec
    certitude : le refuser est plus sûr que de lui prêter le tenant courant.
    """
    company_id = getattr(record, "company_id", None)
    if company_id is None:
        raise ValueError(
            f"{source} : enregistrement sans company_id — impossible d'en vérifier "
            "le périmètre, la synthèse refuse de le rattacher au tenant courant."
        )
    return int(company_id)


def _absence(
    *,
    company_id: int,
    facet: str,
    source_module: str,
    label: str,
    vocabulary: str,
    reason: str,
) -> FacetEntry:
    return FacetEntry(
        company_id=company_id,
        facet=facet,  # type: ignore[arg-type]
        source_module=source_module,
        label=label,
        vocabulary=vocabulary,
        value=None,
        absence_reason=reason,
    )


def _collect_water_screenings(company_id: int, collected: list[FacetEntry]) -> None:
    """Risque ET confiance, lus sur les mêmes lignes mais versés séparément.

    `risk_category` peut être `NULL` : cela signifie « aucune zone connue ne
    correspond », **jamais** « risque nul ». L'absence est donc portée comme
    absence motivée, pas comme une valeur basse.
    """
    from services.water import screening_service

    fallback_risk = _absence(
        company_id=company_id,
        facet="risk",
        source_module="/water",
        label="Screenings hydriques",
        vocabulary=VOCAB_WATER_STRESS,
        reason=ABSENCE_SCHEMA_NOT_READY,
    )
    with _degrade_on_missing_schema(collected, fallback_risk):
        listing = screening_service.list_screenings(company_id=company_id, limit=50)
        if not listing.items:
            collected.append(
                _absence(
                    company_id=company_id,
                    facet="risk",
                    source_module="/water",
                    label="Screenings hydriques",
                    vocabulary=VOCAB_WATER_STRESS,
                    reason=ABSENCE_NO_RECORD,
                )
            )
            return
        for screening in listing.items:
            reference = f"site_water_screening:{screening.id}"
            row_company_id = _entry_company_id(screening, source="screening")
            collected.append(
                FacetEntry(
                    company_id=row_company_id,
                    facet="risk",
                    source_module="/water",
                    label=f"Site {screening.site_id} — {screening.methodology_code}",
                    vocabulary=VOCAB_WATER_STRESS,
                    value=screening.risk_category,
                    evidence_ref=reference,
                    absence_reason=(
                        None
                        if screening.risk_category is not None
                        else "aucune zone connue ne correspond — ce n'est pas un risque nul"
                    ),
                )
            )
            collected.append(
                FacetEntry(
                    company_id=row_company_id,
                    facet="confidence",
                    source_module="/water",
                    label=f"Site {screening.site_id} — solidité documentaire",
                    vocabulary=VOCAB_WATER_CONFIDENCE,
                    value=(
                        None
                        if screening.confidence is None
                        else f"{screening.confidence:.0f}"
                    ),
                    evidence_ref=reference,
                    absence_reason=(
                        None if screening.confidence is not None else "confiance non calculée"
                    ),
                )
            )


def _collect_dependency(company_id: int, collected: list[FacetEntry]) -> None:
    from services.water import activities_service

    fallback = _absence(
        company_id=company_id,
        facet="dependency",
        source_module="/water",
        label="Activités eau",
        vocabulary=VOCAB_WATER_ACTIVITY,
        reason=ABSENCE_SCHEMA_NOT_READY,
    )
    with _degrade_on_missing_schema(collected, fallback):
        listing = activities_service.list_activities(company_id=company_id, limit=50)
        if not listing.items:
            collected.append(
                _absence(
                    company_id=company_id,
                    facet="dependency",
                    source_module="/water",
                    label="Activités eau",
                    vocabulary=VOCAB_WATER_ACTIVITY,
                    reason=ABSENCE_NO_RECORD,
                )
            )
            return
        for activity in listing.items:
            collected.append(
                FacetEntry(
                    company_id=_entry_company_id(activity, source="activité eau"),
                    facet="dependency",
                    source_module="/water",
                    label=f"Site {activity.site_id} — {activity.activity_type}",
                    vocabulary=VOCAB_WATER_ACTIVITY,
                    value=activity.activity_type,
                    evidence_ref=f"water_activity:{activity.id}",
                )
            )


def _collect_resource_links(company_id: int, collected: list[FacetEntry]) -> None:
    """Expositions ressources déjà reliées à une activité eau.

    Aucune migration : le lien `water_activity` et le rôle `water` existent
    depuis la migration 043.
    """
    from services.resources import exposure_link_service

    fallback = _absence(
        company_id=company_id,
        facet="resource_material",
        source_module="/resources",
        label="Expositions ressources liées à l'eau",
        vocabulary=VOCAB_RESOURCE_ROLE,
        reason=ABSENCE_SCHEMA_NOT_READY,
    )
    with _degrade_on_missing_schema(collected, fallback):
        listing = exposure_link_service.list_links(
            company_id=company_id, link_kind="water_activity", limit=50
        )
        if not listing.items:
            collected.append(
                _absence(
                    company_id=company_id,
                    facet="resource_material",
                    source_module="/resources",
                    label="Expositions ressources liées à l'eau",
                    vocabulary=VOCAB_RESOURCE_ROLE,
                    reason=ABSENCE_NO_RECORD,
                )
            )
            return
        for link in listing.items:
            # `resource_slug` est nullable : afficher « None » serait pire que
            # nommer la ressource par son identifiant.
            resource_label = link.resource_slug or f"ressource #{link.resource_id}"
            collected.append(
                FacetEntry(
                    company_id=_entry_company_id(link, source="exposition ressource"),
                    facet="resource_material",
                    source_module="/resources",
                    label=f"{resource_label} — {link.role}",
                    vocabulary=VOCAB_RESOURCE_ROLE,
                    value=link.role,
                    evidence_ref=f"resource_exposure_link:{link.id}",
                )
            )


def _collect_iros(company_id: int, collected: list[FacetEntry]) -> None:
    """IRO d'origine hydrique.

    La promotion d'un screening en IRO reste un geste humain : ce lecteur
    constate le lien (`origin_reference`), il ne le crée jamais.
    """
    from services.iro import iro_service

    fallback = _absence(
        company_id=company_id,
        facet="iro",
        source_module="/iro",
        label="IRO d'origine hydrique",
        vocabulary=VOCAB_IRO_TYPE,
        reason=ABSENCE_SCHEMA_NOT_READY,
    )
    with _degrade_on_missing_schema(collected, fallback):
        listing = iro_service.list_iros(company_id=company_id, origin_domain="water", limit=50)
        if not listing.items:
            collected.append(
                _absence(
                    company_id=company_id,
                    facet="iro",
                    source_module="/iro",
                    label="IRO d'origine hydrique",
                    vocabulary=VOCAB_IRO_TYPE,
                    reason=ABSENCE_NO_RECORD,
                )
            )
            return
        for iro in listing.items:
            collected.append(
                FacetEntry(
                    company_id=_entry_company_id(iro, source="IRO"),
                    facet="iro",
                    source_module="/iro",
                    label=iro.title,
                    vocabulary=VOCAB_IRO_TYPE,
                    value=iro.iro_type,
                    evidence_ref=iro.origin_reference or f"iro:{iro.id}",
                )
            )


def _collect_actions(company_id: int, collected: list[FacetEntry]) -> None:
    from services.water import targets_actions_service

    fallback = _absence(
        company_id=company_id,
        facet="action",
        source_module="/water",
        label="Actions hydriques",
        vocabulary=VOCAB_ACTION_STATUS,
        reason=ABSENCE_SCHEMA_NOT_READY,
    )
    with _degrade_on_missing_schema(collected, fallback):
        listing = targets_actions_service.list_actions(company_id=company_id, limit=50)
        if not listing.items:
            collected.append(
                _absence(
                    company_id=company_id,
                    facet="action",
                    source_module="/water",
                    label="Actions hydriques",
                    vocabulary=VOCAB_ACTION_STATUS,
                    reason=ABSENCE_NO_RECORD,
                )
            )
            return
        for action in listing.items:
            collected.append(
                FacetEntry(
                    company_id=_entry_company_id(action, source="action hydrique"),
                    facet="action",
                    source_module="/water",
                    label=action.title,
                    vocabulary=VOCAB_ACTION_STATUS,
                    value=action.status,
                    evidence_ref=f"water_action:{action.id}",
                )
            )


#: Collecteurs, dans l'ordre des facettes. Un collecteur qui échoue sur un
#: schéma absent n'empêche pas les autres de rendre.
_COLLECTORS = (
    _collect_water_screenings,
    _collect_dependency,
    _collect_resource_links,
    _collect_iros,
    _collect_actions,
)


def build_synthesis(*, company_id: int) -> TenantWaterSynthesis:
    """Synthèse hydrique d'UNE entreprise, composée de lectures scopées.

    Ne calcule aucun agrégat inter-facettes et ne produit aucun score global :
    la composition est déléguée à `water_intelligence.tenant_synthesis`, qui
    n'en offre pas la possibilité.
    """
    collected: list[FacetEntry] = []
    for collect in _COLLECTORS:
        collect(company_id, collected)
    return build_tenant_synthesis(company_id=company_id, entries=collected)
