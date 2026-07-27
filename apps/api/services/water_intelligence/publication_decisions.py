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

## État du registre après l'approbation humaine du 2026-07-28

**Une** source est `approved` : `HUBEAU_BNPE_PRELEVEMENTS`, et seulement sur
le périmètre commune INSEE `34172` / année 2020. Les six autres restent non
approuvées, chacune pour un motif nommé et distinct.

Une décision `approved` ne vaut donc PAS pour toute la source : elle porte un
**périmètre autorisé** (`AuthorizedScope`), et l'assembleur public écarte avec
motif toute observation qui en sort. C'est la différence entre « BNPE est
publiable » — faux — et « ces trois observations-là sont publiables » — ce que
le signataire a réellement approuvé.
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
#: Une source approuvée dont l'observation sort du périmètre signé. Ce n'est
#: pas un refus de la source : c'est le refus d'un ÉLARGISSEMENT non signé.
EXCLUSION_OUTSIDE_AUTHORIZED_SCOPE = "outside_authorized_scope"


class PublicationDecisionError(Exception):
    """Décision mal formée — refusée à la construction, jamais tolérée."""


@dataclass(frozen=True)
class AuthorizedScope:
    """Le périmètre EXACT qu'une signature humaine couvre.

    ## Pourquoi une décision sans périmètre serait un chèque en blanc

    `approved` sans périmètre autorise la source entière. Or le signataire du
    2026-07-28 a approuvé trois observations sur une commune et une année,
    après avoir lu leur nombre, leur checksum et leur poids. Publier ensuite
    le département, ou l'année suivante, sous la même signature reviendrait à
    étendre une autorisation à des données que personne n'a vues.

    Le périmètre est donc porté par la décision elle-même, et l'assembleur
    public le fait respecter. Élargir exige une nouvelle signature, pas une
    nouvelle acquisition.
    """

    geography_type: str
    geography_code: str
    period_start: date
    period_end: date
    #: `True` UNIQUEMENT dans le contexte de mesure X4B, qui doit pouvoir
    #: assembler n'importe quel périmètre pour en peser le résultat. Un tel
    #: périmètre est refusé à l'entrée du registre RÉEL (`current_registry()`) :
    #: il ne peut donc jamais accompagner une signature humaine, et aucune
    #: publication ne peut en hériter.
    measurement_only: bool = False

    def __post_init__(self) -> None:
        if not self.geography_type.strip() or not self.geography_code.strip():
            raise PublicationDecisionError(
                "Un périmètre autorisé nomme un type ET un code de géographie — "
                "un périmètre sans identifiant officiel n'est pas vérifiable."
            )
        if self.period_end < self.period_start:
            raise PublicationDecisionError(
                f"Période inversée : {self.period_start} → {self.period_end}."
            )

    def covers(
        self, *, geography_code: str | None, period_start: date, period_end: date
    ) -> bool:
        """Vrai si cette observation tombe DANS le périmètre signé.

        Les deux bornes sont inclusives, et le code géographique doit être
        exactement celui approuvé : aucune correspondance par préfixe, aucun
        rattachement territorial déduit. `34` ne couvre pas `34172` et
        réciproquement — un département n'est pas une commune.
        """
        if self.measurement_only:
            # Mesurer ce que pèserait un périmètre n'est pas l'autoriser : le
            # contexte de mesure ne filtre rien, et n'atteint jamais le
            # registre réel.
            return True
        if (geography_code or "") != self.geography_code:
            return False
        return self.period_start <= period_start and period_end <= self.period_end

    def as_mapping(self) -> dict[str, object]:
        return {
            "geography_type": self.geography_type,
            "geography_code": self.geography_code,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "measurement_only": self.measurement_only,
        }


@dataclass(frozen=True)
class PublicationDecision:
    """Décision humaine de publication pour UNE source.

    `reviewed_by`/`reviewed_on` sont obligatoires dès que le statut est
    `approved` : une autorisation sans réviseur identifié ni date n'est pas
    une décision, c'est une case cochée. `authorized_scope` l'est aussi, pour
    la même raison : une autorisation sans périmètre n'est pas une décision,
    c'est un blanc-seing.

    Les quatre permissions reprennent VERBATIM celles du formulaire humain.
    Elles ne sont pas décoratives : `display_allowed=false` retiendrait la
    valeur, et `derived_use_allowed=false` — le cas ici — interdit toute
    dérivation (total, moyenne, classement, score) à partir des valeurs
    publiées, côté backend comme côté surface.
    """

    source_code: str
    status: PublicationStatus
    reason: str
    reviewed_by: str | None = None
    reviewed_on: date | None = None
    authorized_scope: AuthorizedScope | None = None
    display_allowed: bool = False
    derived_use_allowed: bool = False
    automated_access_allowed: bool = False
    storage_allowed: bool = False

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
        if self.status == "approved" and self.authorized_scope is None:
            # Volontairement TOLÉRÉ ici, et refusé à `current_registry()`.
            #
            # Le contexte de mesure X4B et les fixtures de test doivent pouvoir
            # approuver sans périmètre : mesurer ce que pèserait une
            # publication suppose de l'assembler en entier, et un test de
            # l'assembleur n'a pas à inventer un territoire. Exiger le
            # périmètre sur le TYPE les rendrait impossibles, ce qui pousserait
            # à inventer des périmètres factices — c'est-à-dire à rendre
            # indiscernables un périmètre signé et un périmètre de commodité.
            #
            # L'exigence vit donc là où elle mord : à la porte du registre
            # RÉEL, le seul que lise la publication. Une décision sans
            # périmètre y est refusée ; partout ailleurs, elle ne filtre rien
            # et ne publie rien.
            pass

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

    def covers(
        self, *, geography_code: str | None, period_start: date, period_end: date
    ) -> bool:
        """Vrai si cette observation est DANS le périmètre signé.

        Faux dès que la décision n'autorise pas, et faux dès que l'observation
        sort du périmètre — les deux refus sont distincts et le sont restés :
        `exclusion_reason` dit « pas de décision », celui-ci dit « hors du
        périmètre de la décision ».
        """
        if not self.allows_publication or self.authorized_scope is None:
            return False
        return self.authorized_scope.covers(
            geography_code=geography_code,
            period_start=period_start,
            period_end=period_end,
        )


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

    def covers(
        self,
        source_code: str,
        *,
        geography_code: str | None,
        period_start: date,
        period_end: date,
    ) -> bool:
        """Vrai si CETTE observation-là est couverte par la signature."""
        decision = self.get(source_code)
        if decision is None:
            return False
        return decision.covers(
            geography_code=geography_code,
            period_start=period_start,
            period_end=period_end,
        )

    def authorized_scope(self, source_code: str) -> AuthorizedScope | None:
        decision = self.get(source_code)
        return decision.authorized_scope if decision else None

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
                # Le périmètre voyage AVEC la décision jusqu'au document
                # public : un lecteur doit pouvoir lire ce que la signature
                # couvre, pas seulement qu'elle existe.
                "authorized_scope": (
                    decision.authorized_scope.as_mapping()
                    if decision.authorized_scope
                    else None
                ),
                "permissions": {
                    "display_allowed": decision.display_allowed,
                    "derived_use_allowed": decision.derived_use_allowed,
                    "automated_access_allowed": decision.automated_access_allowed,
                    "storage_allowed": decision.storage_allowed,
                },
            }
            for code, decision in sorted(self._decisions.items())
        )


# ---------------------------------------------------------------------------
# Registre courant — UNE source approuvée, sur UN périmètre
# ---------------------------------------------------------------------------

#: Périmètre signé le 2026-07-28. Il reprend mot pour mot celui du candidat
#: mesuré au run 30306257628 : commune INSEE 34172, année 2020. C'est le seul
#: périmètre de tout le chantier Water dont le poids ait été MESURÉ sous le
#: budget (6 120 octets pour 100 000).
BNPE_PILOT_SCOPE = AuthorizedScope(
    geography_type="code_commune_insee",
    geography_code="34172",
    period_start=date(2020, 1, 1),
    period_end=date(2020, 12, 31),
)

#: Décisions réelles. Chaque motif est un fait vérifié par les Waves A et B,
#: jamais une supposition ; la seule signature humaine est celle de BNPE.
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
        status="approved",
        reason=(
            "publication pilote BNPE exhaustive sur un périmètre communal et annuel "
            "explicitement limité"
        ),
        reviewed_by="ludoviclabs-dotcom",
        reviewed_on=date(2026, 7, 28),
        authorized_scope=BNPE_PILOT_SCOPE,
        display_allowed=True,
        # `derived_use_allowed=False` est la contrainte la plus structurante de
        # cette signature : les trois volumes sont publiables tels quels, et
        # AUCUN total, moyenne, classement, score ou extrapolation n'en est
        # dérivable. La couverture BNPE est partielle par construction (usages
        # exonérés de redevance inconnus, volumes < 10 000 m³ non déclarés) —
        # un total communal calculé sur trois ouvrages présenterait une somme
        # partielle comme le prélèvement de la commune.
        derived_use_allowed=False,
        automated_access_allowed=True,
        storage_allowed=True,
    ),
    PublicationDecision(
        source_code="HUBEAU_QUALITE_SURFACE",
        status="proposed",
        reason=(
            "Licence Ouverte Etalab vérifiée en Wave B. Décision NON rendue. Une "
            "publication exigerait en outre une allowlist de paramètres SANDRE revue "
            "et l'absence de toute conclusion de conformité, qui relève exclusivement "
            "du registre juridique."
        ),
    ),
)


#: Les sources portant une signature humaine, ÉNUMÉRÉES à la main.
#:
#: Ce n'est pas une redondance de `CURRENT_DECISIONS` : c'est une seconde
#: écriture, indépendante, à laquelle la première est confrontée. Basculer une
#: septième source en `approved` sans toucher cette ligne fait échouer
#: `assert_human_approvals_unchanged()` — donc le workflow de publication, donc
#: la CI. Une approbation ne peut pas être glissée dans un diff.
HUMAN_APPROVED_SOURCE_CODES: tuple[str, ...] = ("HUBEAU_BNPE_PRELEVEMENTS",)


def current_registry() -> PublicationDecisionRegistry:
    """Registre courant. Une seule source `approved` — BNPE, sur la commune
    INSEE 34172 et l'année 2020, et rien d'autre.

    C'est ici, à l'entrée du registre RÉEL, que deux choses sont refusées :
    une approbation SANS périmètre, et un périmètre de MESURE. Les deux sont
    légitimes ailleurs — une fixture de test, un assemblage de mesure — et
    aucune des deux ne doit pouvoir publier. Le contrôle est donc posé sur le
    seul registre que la publication lise, pas sur le type, où il aurait
    empêché de mesurer et de tester.
    """
    for decision in CURRENT_DECISIONS:
        if not decision.allows_publication:
            continue
        scope = decision.authorized_scope
        if scope is None:
            raise PublicationDecisionError(
                f"{decision.source_code} : approbation SANS périmètre dans le "
                "registre réel. Elle autoriserait la source entière, y compris "
                "des données que le signataire n'a jamais vues."
            )
        if scope.measurement_only:
            raise PublicationDecisionError(
                f"{decision.source_code} : périmètre de MESURE dans le registre "
                "réel. Un contexte de mesure ne signe rien et n'autorise aucune "
                "publication — refusé ici, où le motif est encore lisible."
            )
        if not decision.display_allowed:
            raise PublicationDecisionError(
                f"{decision.source_code} : approuvée avec `display_allowed=false` — "
                "approuver la publication d'une valeur qu'on n'affiche pas ne veut "
                "rien dire."
            )
    return PublicationDecisionRegistry(CURRENT_DECISIONS)


def assert_human_approvals_unchanged() -> None:
    """Les sources approuvées sont EXACTEMENT celles énumérées, ni plus ni moins.

    Confronte `CURRENT_DECISIONS` à `HUMAN_APPROVED_SOURCE_CODES`, deux
    écritures indépendantes de la même vérité. Basculer une source en
    `approved` sans toucher la seconde échoue ici ; toucher la seconde sans
    basculer la source aussi. C'est ce qui empêche une approbation d'être
    glissée dans un diff au milieu d'autres changements.
    """
    approved = current_registry().approved_source_codes
    if approved != HUMAN_APPROVED_SOURCE_CODES:
        raise PublicationDecisionError(
            "ARRÊT — les sources approuvées ne sont pas celles attendues.\n"
            f"  registre  : {approved}\n"
            f"  énumérées : {HUMAN_APPROVED_SOURCE_CODES}\n"
            "Une approbation se signe explicitement, aux deux endroits."
        )
