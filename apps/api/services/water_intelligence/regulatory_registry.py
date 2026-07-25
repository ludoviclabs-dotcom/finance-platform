"""
services/water_intelligence/regulatory_registry.py — registre juridique
versionné (P13, Wave D).

## Pourquoi ce module existe, et ce qu'il refuse de faire

Le registre des risques du chantier liste « **fait juridique non sourcé** »
comme risque à part entière. Une couche décisionnelle qui annoncerait « vous
êtes soumis à ESRS E3 depuis telle date » sans référence officielle vérifiée
ferait exactement ce que ce risque décrit, avec l'autorité trompeuse d'une
machine.

Ce module livre donc la **mécanique** du registre — schéma, versionnement,
moteur de portée, historique — et **refuse de produire un verdict** tant que
deux conditions ne sont pas réunies pour la règle concernée :

1. une **source officielle** enregistrée (éditeur, référence, URL, date de
   relevé, vérificateur) ;
2. une **revue humaine** signée (réviseur, date, note de périmètre).

Sans les deux, le moteur répond `unknown`. Ce n'est pas un défaut de
remplissage : c'est le même gate que la Wave C a appliqué à la publication de
données, transposé au fait juridique. Une licence permissive lue par une
machine n'était pas un feu vert éditorial ; un article de loi mémorisé par une
machine n'est pas un conseil juridique.

## Ce que le moteur ne calcule jamais

Le moteur **n'évalue aucun seuil réglementaire lui-même** (effectifs, chiffre
d'affaires, total de bilan, cotation…). Il ne connaît pas ces nombres et ne
doit pas les connaître : ils changent, ils dépendent du texte applicable, et
les encoder ici reviendrait à figer un conseil juridique dans du code.

Le registre déclare des **critères nommés** ; l'entité fournit des
**déterminations humaines** critère par critère, chacune datée, signée et
accompagnée de sa preuve. Le moteur ne fait que composer ces déterminations.
Un critère sans détermination rend `unknown` — jamais une supposition.

## Droit contraignant et référentiels volontaires

GRI 303, CDP Water, TNFD/LEAP et SBTN ne sont **pas** du droit. Les ranger
avec la CSRD ou la Taxonomie sous une étiquette commune « conformité »
laisserait croire à une obligation légale là où il n'y en a pas. Le champ
`instrument_kind` sépare les deux familles et un test l'impose : un
référentiel volontaire ne peut jamais porter d'échéance de transposition ni
être présenté comme contraignant.

## Transposition : « inconnu » n'est pas « sans objet »

Un règlement européen est directement applicable et n'a **pas** d'échéance de
transposition ; une directive en a une. Confondre « pas de transposition
parce que le texte n'en demande pas » avec « échéance non vérifiée »
produirait deux erreurs opposées. `TranspositionState` distingue
explicitement `not_applicable` et `unknown`.

## État du registre à la Wave D

**Aucune règle n'est vérifiée.** Le chantier n'a pas de réviseur juridique
identifié, et la date de connaissance du modèle qui a rédigé ce fichier ne
vaut pas vérification d'un état du droit au jour de la lecture. Toutes les
entrées de `CURRENT_RULES` portent donc `source=None` et
`human_review=None` : elles nomment le texte à instruire, jamais son contenu
normatif. Conséquence assumée et testée : **le moteur répond `unknown` pour
toutes les règles**, exactement comme le snapshot public de la Wave C est
vide.

Le tableau des champs qu'un réviseur doit renseigner pour lever un `unknown`
est produit par `RegulatoryRule.missing_verification_fields()`, et le handoff
`handoffs/WAVE_D_DECISION_LAYER.md` en dresse la matrice.

## Deux vocabulaires de statut, et pourquoi ils ne sont pas fusionnés

Le contrat P02 (`models/water_intelligence.py`) déclare un `WaterLegalStatus`
mirroré côté TypeScript. Il mélange volontairement l'état d'un **texte**
(`in_force`, `proposed`, `transposition_pending`…) et le résultat d'une
**portée** pour une entité (`out_of_scope`, `materiality_dependent`) : c'est le
vocabulaire du *record public*.

Le registre a besoin d'un statut de texte pur. Les deux vocabulaires coexistent
donc, avec une conversion explicite et testée (`to_public_legal_status`).

**Wave E — la conversion n'est plus destructive.** `repealed` manquait au
vocabulaire public, si bien qu'un texte abrogé était publié comme
`out_of_scope`. La valeur a été ajoutée au contrat partagé (Python, miroir Zod,
fixture, documents canoniques, tests de parité, dans le même commit) et la
conversion `repealed → out_of_scope` est désormais **interdite**.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date
from typing import Iterable, Literal, Mapping

from models.water_intelligence import WaterLegalStatus

# ---------------------------------------------------------------------------
# Vocabulaire
# ---------------------------------------------------------------------------

#: Nature de l'instrument. Sépare le droit contraignant des référentiels
#: volontaires — les confondre serait une erreur de catégorie, pas un détail.
InstrumentKind = Literal[
    "regulation",  # règlement UE : directement applicable, pas de transposition
    "directive",  # directive UE : transposition nationale requise
    "delegated_act",  # acte délégué / d'exécution
    "national_law",  # texte national
    "voluntary_framework",  # GRI, CDP, TNFD, SBTN — JAMAIS contraignant
]

#: Statut juridique du texte. `unknown` est le défaut et le reste tant qu'un
#: humain n'a pas vérifié.
LegalStatus = Literal[
    "unknown",
    "proposed",
    "adopted",
    "in_force",
    "amended",
    "repealed",
]

#: Verdict du moteur de portée. Volontairement limité à quatre valeurs.
ApplicabilityOutcome = Literal["in_scope", "out_of_scope", "conditional", "unknown"]

#: Réponse humaine à un critère de portée.
DeterminationAnswer = Literal["yes", "no", "unknown"]

#: État de transposition. `not_applicable` (le texte n'en demande pas) et
#: `unknown` (non vérifié) sont deux choses différentes.
TranspositionStatus = Literal["not_applicable", "unknown", "pending", "completed"]

#: Motifs normalisés d'un verdict — repris tels quels par l'API et l'UI, jamais
#: reformulés en prose côté surface.
REASON_NO_SOURCE = "no_official_source"
REASON_NO_HUMAN_REVIEW = "no_human_review"
REASON_STATUS_UNKNOWN = "legal_status_unknown"
REASON_REPEALED = "text_repealed"
REASON_NOT_YET_APPLICABLE = "not_yet_applicable"
REASON_MISSING_DETERMINATION = "missing_entity_determination"
REASON_MATERIALITY_PENDING = "materiality_assessment_pending"
REASON_CRITERION_NOT_MET = "criterion_not_met"
REASON_ALL_CRITERIA_MET = "all_criteria_met"


class RegulatoryRegistryError(Exception):
    """Entrée mal formée — refusée à la construction, jamais tolérée."""


# ---------------------------------------------------------------------------
# Preuve : source officielle et revue humaine
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class OfficialSource:
    """Référence officielle d'un texte, relevée et vérifiée par un humain.

    L'URL seule ne suffit pas : sans `retrieved_on` on ne sait pas de quand
    date la lecture, et sans `verified_by` personne n'en répond.
    """

    publisher: str
    reference: str
    url: str
    retrieved_on: date
    verified_by: str

    def __post_init__(self) -> None:
        for name in ("publisher", "reference", "url", "verified_by"):
            if not str(getattr(self, name)).strip():
                raise RegulatoryRegistryError(
                    f"OfficialSource.{name} obligatoire — une source incomplète "
                    "n'est pas une source."
                )
        if not self.url.startswith("https://"):
            raise RegulatoryRegistryError(
                f"OfficialSource.url doit être en https:// (reçu {self.url!r})."
            )


@dataclass(frozen=True)
class HumanReview:
    """Revue humaine signée d'une règle.

    `scope_note` est obligatoire : une signature qui ne dit pas ce qui a été
    revu n'est pas auditable.
    """

    reviewed_by: str
    reviewed_on: date
    scope_note: str

    def __post_init__(self) -> None:
        if not self.reviewed_by.strip():
            raise RegulatoryRegistryError("HumanReview.reviewed_by obligatoire.")
        if not self.scope_note.strip():
            raise RegulatoryRegistryError(
                "HumanReview.scope_note obligatoire — une revue sans périmètre "
                "déclaré n'est pas auditable."
            )


@dataclass(frozen=True)
class TranspositionState:
    """État de transposition nationale d'un texte européen."""

    status: TranspositionStatus = "unknown"
    deadline: date | None = None
    national_reference: str | None = None

    def __post_init__(self) -> None:
        if self.status == "not_applicable" and (
            self.deadline is not None or self.national_reference is not None
        ):
            raise RegulatoryRegistryError(
                "TranspositionState : `not_applicable` ne peut porter ni échéance "
                "ni référence nationale — un texte directement applicable ne se "
                "transpose pas."
            )


# ---------------------------------------------------------------------------
# Critères de portée et déterminations de l'entité
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ScopeCondition:
    """Critère nommé conditionnant l'application d'une règle à une entité.

    Le critère porte la **question**, jamais le seuil. Répondre exige une
    détermination humaine (`EntityDetermination`) — le moteur ne calcule
    aucun effectif, aucun chiffre d'affaires, aucun total de bilan.
    """

    criterion_code: str
    question: str
    #: Vrai lorsque la réponse dépend d'une évaluation de matérialité (double
    #: matérialité ESRS notamment) et non d'un fait administratif.
    requires_materiality: bool = False

    def __post_init__(self) -> None:
        if not self.criterion_code.strip():
            raise RegulatoryRegistryError("ScopeCondition.criterion_code obligatoire.")
        if not self.question.strip():
            raise RegulatoryRegistryError(
                f"{self.criterion_code} : `question` obligatoire — un critère sans "
                "question n'est pas déterminable par un humain."
            )


@dataclass(frozen=True)
class EntityDetermination:
    """Réponse humaine, datée et sourcée, à un critère de portée.

    `evidence` est obligatoire dès que la réponse n'est pas `unknown` : une
    détermination sans preuve est une opinion.
    """

    criterion_code: str
    answer: DeterminationAnswer
    determined_by: str
    determined_on: date
    evidence: str = ""

    def __post_init__(self) -> None:
        if not self.criterion_code.strip():
            raise RegulatoryRegistryError(
                "EntityDetermination.criterion_code obligatoire."
            )
        if self.answer not in ("yes", "no", "unknown"):
            raise RegulatoryRegistryError(
                f"{self.criterion_code} : réponse {self.answer!r} inconnue."
            )
        if not self.determined_by.strip():
            raise RegulatoryRegistryError(
                f"{self.criterion_code} : `determined_by` obligatoire."
            )
        if self.answer != "unknown" and not self.evidence.strip():
            raise RegulatoryRegistryError(
                f"{self.criterion_code} : une réponse {self.answer!r} exige une "
                "preuve — une détermination sans preuve est une opinion."
            )


@dataclass(frozen=True)
class EntityProfile:
    """Ce que l'entité a **déterminé**, jamais ce qu'elle « est ».

    Volontairement sans effectif, chiffre d'affaires ni total de bilan : ces
    nombres appellent une comparaison à un seuil, et aucun seuil n'est encodé
    dans ce module.
    """

    entity_ref: str
    determinations: tuple[EntityDetermination, ...] = ()

    def __post_init__(self) -> None:
        if not self.entity_ref.strip():
            raise RegulatoryRegistryError("EntityProfile.entity_ref obligatoire.")
        seen: set[str] = set()
        for determination in self.determinations:
            if determination.criterion_code in seen:
                raise RegulatoryRegistryError(
                    f"{determination.criterion_code} : deux déterminations pour le "
                    "même critère — ambiguïté refusée."
                )
            seen.add(determination.criterion_code)

    def determination(self, criterion_code: str) -> EntityDetermination | None:
        for determination in self.determinations:
            if determination.criterion_code == criterion_code:
                return determination
        return None


# ---------------------------------------------------------------------------
# Règle
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RegulatoryRule:
    """Une règle du registre, dans **une** version donnée.

    Une même règle logique (`rule_id`) peut exister en plusieurs versions
    (`text_version`) : le registre les conserve toutes et résout par date.
    Une version n'est jamais réécrite en place — l'historique est le seul
    moyen de savoir ce que l'on affirmait hier.
    """

    rule_id: str
    text_version: str
    jurisdiction: str
    instrument_kind: InstrumentKind
    title: str
    text_reference: str
    legal_status: LegalStatus = "unknown"
    adoption: date | None = None
    entry_into_force: date | None = None
    application: date | None = None
    transposition: TranspositionState = field(default_factory=TranspositionState)
    conditions: tuple[ScopeCondition, ...] = ()
    source: OfficialSource | None = None
    human_review: HumanReview | None = None
    #: Version de la règle qui remplace celle-ci, le cas échéant.
    superseded_by: str | None = None
    notes: str = ""

    def __post_init__(self) -> None:
        for name in ("rule_id", "text_version", "jurisdiction", "title", "text_reference"):
            if not str(getattr(self, name)).strip():
                raise RegulatoryRegistryError(f"RegulatoryRule.{name} obligatoire.")

        # Un référentiel volontaire n'est pas du droit : ni transposition, ni
        # prétention contraignante.
        if self.instrument_kind == "voluntary_framework":
            if self.transposition.status != "not_applicable":
                raise RegulatoryRegistryError(
                    f"{self.rule_id} : un référentiel volontaire ne se transpose pas — "
                    "`transposition.status` doit valoir 'not_applicable'."
                )
        # Un règlement est directement applicable : pas d'échéance de transposition.
        if self.instrument_kind == "regulation" and self.transposition.status in (
            "pending",
            "completed",
        ):
            raise RegulatoryRegistryError(
                f"{self.rule_id} : un règlement est directement applicable — il ne "
                "porte pas d'échéance de transposition."
            )

        # Cohérence temporelle : on n'entre pas en vigueur avant d'être adopté,
        # on ne s'applique pas avant d'entrer en vigueur.
        self._check_order("adoption", self.adoption, "entry_into_force", self.entry_into_force)
        self._check_order(
            "entry_into_force", self.entry_into_force, "application", self.application
        )

        # Une date sans source vérifiée serait précisément le « fait juridique
        # non sourcé » du registre des risques.
        if self.source is None and any(
            value is not None for value in (self.adoption, self.entry_into_force, self.application)
        ):
            raise RegulatoryRegistryError(
                f"{self.rule_id} : des dates sont renseignées sans `source` officielle — "
                "un fait juridique non sourcé est refusé à la construction."
            )

    @staticmethod
    def _check_order(
        earlier_name: str, earlier: date | None, later_name: str, later: date | None
    ) -> None:
        if earlier is not None and later is not None and later < earlier:
            raise RegulatoryRegistryError(
                f"{later_name} ({later.isoformat()}) est antérieur à {earlier_name} "
                f"({earlier.isoformat()}) — ordre temporel impossible."
            )

    @property
    def is_binding(self) -> bool:
        """Vrai pour le droit contraignant seul. Les référentiels volontaires
        sont utiles et attendus, mais ils n'obligent personne."""
        return self.instrument_kind != "voluntary_framework"

    @property
    def is_verified(self) -> bool:
        """Une règle n'est exploitable que sourcée ET revue par un humain."""
        return self.source is not None and self.human_review is not None

    def missing_verification_fields(self) -> tuple[str, ...]:
        """Champs qu'un réviseur doit renseigner pour lever le `unknown`.

        Sert la matrice du handoff et l'écran P13 : dire *ce qui manque* est
        plus utile que dire « inconnu ».
        """
        missing: list[str] = []
        if self.source is None:
            missing.append("source")
        if self.human_review is None:
            missing.append("human_review")
        if self.legal_status == "unknown":
            missing.append("legal_status")
        if self.application is None:
            missing.append("application")
        if self.instrument_kind == "directive" and self.transposition.status == "unknown":
            missing.append("transposition")
        return tuple(missing)


# ---------------------------------------------------------------------------
# Verdict
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ApplicabilityAssessment:
    """Verdict du moteur pour un couple (règle, entité) à une date donnée.

    Porte toujours ses motifs : un `unknown` muet serait aussi opaque qu'un
    `in_scope` non justifié.
    """

    rule_id: str
    text_version: str
    outcome: ApplicabilityOutcome
    reasons: tuple[str, ...]
    missing_fields: tuple[str, ...] = ()
    unresolved_criteria: tuple[str, ...] = ()
    applies_from: date | None = None

    def __post_init__(self) -> None:
        if not self.reasons:
            raise RegulatoryRegistryError(
                f"{self.rule_id} : un verdict sans motif n'est pas auditable."
            )

    def as_mapping(self) -> Mapping[str, object]:
        """Vue sérialisable, ordre déterministe — consommée telle quelle par
        l'API et l'UI, jamais reformulée en prose côté surface."""
        return {
            "rule_id": self.rule_id,
            "text_version": self.text_version,
            "outcome": self.outcome,
            "reasons": list(self.reasons),
            "missing_fields": list(self.missing_fields),
            "unresolved_criteria": list(self.unresolved_criteria),
            "applies_from": self.applies_from.isoformat() if self.applies_from else None,
        }


def evaluate_rule(
    rule: RegulatoryRule, profile: EntityProfile, *, as_of: date
) -> ApplicabilityAssessment:
    """Compose des faits déjà établis. N'en établit aucun.

    Ordre de décision, du plus bloquant au plus fin :

    1. règle non vérifiée (source ou revue manquante) → `unknown` ;
    2. statut juridique inconnu → `unknown` ;
    3. texte abrogé → `out_of_scope` ;
    4. date d'application absente → `unknown` ; postérieure à `as_of` →
       `out_of_scope`, en portant la date pour que la surface puisse dire
       « s'applique à partir de… » ;
    5. critère sans détermination → `unknown` ; critère de matérialité non
       tranché → `conditional` ;
    6. un critère répondu `no` → `out_of_scope` ;
    7. tous les critères répondus `yes` → `in_scope`.
    """
    missing = rule.missing_verification_fields()

    if rule.source is None:
        return ApplicabilityAssessment(
            rule_id=rule.rule_id,
            text_version=rule.text_version,
            outcome="unknown",
            reasons=(REASON_NO_SOURCE,),
            missing_fields=missing,
        )
    if rule.human_review is None:
        return ApplicabilityAssessment(
            rule_id=rule.rule_id,
            text_version=rule.text_version,
            outcome="unknown",
            reasons=(REASON_NO_HUMAN_REVIEW,),
            missing_fields=missing,
        )
    if rule.legal_status == "unknown":
        return ApplicabilityAssessment(
            rule_id=rule.rule_id,
            text_version=rule.text_version,
            outcome="unknown",
            reasons=(REASON_STATUS_UNKNOWN,),
            missing_fields=missing,
        )
    if rule.legal_status == "repealed":
        return ApplicabilityAssessment(
            rule_id=rule.rule_id,
            text_version=rule.text_version,
            outcome="out_of_scope",
            reasons=(REASON_REPEALED,),
        )
    if rule.application is None:
        return ApplicabilityAssessment(
            rule_id=rule.rule_id,
            text_version=rule.text_version,
            outcome="unknown",
            reasons=(REASON_STATUS_UNKNOWN,),
            missing_fields=missing,
        )
    if as_of < rule.application:
        return ApplicabilityAssessment(
            rule_id=rule.rule_id,
            text_version=rule.text_version,
            outcome="out_of_scope",
            reasons=(REASON_NOT_YET_APPLICABLE,),
            applies_from=rule.application,
        )

    unresolved: list[str] = []
    materiality_pending: list[str] = []
    refused: list[str] = []
    for condition in rule.conditions:
        determination = profile.determination(condition.criterion_code)
        if determination is None or determination.answer == "unknown":
            if condition.requires_materiality:
                materiality_pending.append(condition.criterion_code)
            else:
                unresolved.append(condition.criterion_code)
        elif determination.answer == "no":
            refused.append(condition.criterion_code)

    # Un critère factuel non tranché prime : sans lui on ne sait pas, et une
    # matérialité « en attente » sur un périmètre inconnu n'aurait pas de sens.
    if unresolved:
        return ApplicabilityAssessment(
            rule_id=rule.rule_id,
            text_version=rule.text_version,
            outcome="unknown",
            reasons=(REASON_MISSING_DETERMINATION,),
            unresolved_criteria=tuple(unresolved),
        )
    if refused:
        return ApplicabilityAssessment(
            rule_id=rule.rule_id,
            text_version=rule.text_version,
            outcome="out_of_scope",
            reasons=(REASON_CRITERION_NOT_MET,),
            unresolved_criteria=tuple(refused),
        )
    if materiality_pending:
        return ApplicabilityAssessment(
            rule_id=rule.rule_id,
            text_version=rule.text_version,
            outcome="conditional",
            reasons=(REASON_MATERIALITY_PENDING,),
            unresolved_criteria=tuple(materiality_pending),
        )
    return ApplicabilityAssessment(
        rule_id=rule.rule_id,
        text_version=rule.text_version,
        outcome="in_scope",
        reasons=(REASON_ALL_CRITERIA_MET,),
    )


# ---------------------------------------------------------------------------
# Registre versionné
# ---------------------------------------------------------------------------


class RegulatoryRegistry:
    """Registre immuable, versionné et historisé.

    Plusieurs versions d'une même `rule_id` coexistent. `resolve()` rend la
    version en vigueur à une date donnée sans jamais effacer les autres :
    l'historique est le seul moyen de savoir ce que l'on affirmait hier.
    """

    def __init__(self, rules: Iterable[RegulatoryRule], *, registry_version: str) -> None:
        if not registry_version.strip():
            raise RegulatoryRegistryError("registry_version obligatoire.")
        indexed: dict[tuple[str, str], RegulatoryRule] = {}
        for rule in rules:
            key = (rule.rule_id, rule.text_version)
            if key in indexed:
                raise RegulatoryRegistryError(
                    f"{rule.rule_id} : version {rule.text_version!r} déclarée deux "
                    "fois — ambiguïté refusée."
                )
            indexed[key] = rule
        self._rules = indexed
        self.registry_version = registry_version

    def __len__(self) -> int:
        return len(self._rules)

    @property
    def rule_ids(self) -> tuple[str, ...]:
        return tuple(sorted({rule_id for rule_id, _ in self._rules}))

    def versions(self, rule_id: str) -> tuple[RegulatoryRule, ...]:
        """Toutes les versions connues d'une règle, plus ancienne d'abord.

        Les versions sans date d'adoption vérifiée viennent en tête : elles ne
        sont pas datables, donc pas ordonnables autrement.
        """
        return tuple(
            sorted(
                (rule for (rid, _), rule in self._rules.items() if rid == rule_id),
                key=lambda r: (r.adoption is not None, r.adoption or date.min, r.text_version),
            )
        )

    def resolve(self, rule_id: str, *, as_of: date) -> RegulatoryRule | None:
        """Version applicable à `as_of`, ou `None` si la règle est inconnue.

        Une version non datée ne peut pas être écartée par la date : elle est
        rendue telle quelle, et le moteur la traitera en `unknown`.
        """
        versions = self.versions(rule_id)
        if not versions:
            return None
        dated = [r for r in versions if r.application is not None and r.application <= as_of]
        if dated:
            return max(dated, key=lambda r: r.application or date.min)
        return versions[0]

    def evaluate(
        self, profile: EntityProfile, *, as_of: date
    ) -> tuple[ApplicabilityAssessment, ...]:
        """Verdict pour chaque règle du registre, ordre déterministe."""
        assessments = []
        for rule_id in self.rule_ids:
            rule = self.resolve(rule_id, as_of=as_of)
            if rule is None:  # pragma: no cover - rule_ids garantit la présence
                continue
            assessments.append(evaluate_rule(rule, profile, as_of=as_of))
        return tuple(assessments)

    def verification_gaps(self) -> tuple[Mapping[str, object], ...]:
        """Ce qu'il manque, règle par règle, pour sortir du `unknown`.

        C'est la vue utile tant qu'aucun réviseur juridique n'est désigné :
        elle dit quoi instruire, pas ce que dit le droit.
        """
        return tuple(
            {
                "rule_id": rule.rule_id,
                "text_version": rule.text_version,
                "title": rule.title,
                "jurisdiction": rule.jurisdiction,
                "instrument_kind": rule.instrument_kind,
                "text_reference": rule.text_reference,
                "is_binding": rule.is_binding,
                "missing_fields": list(rule.missing_verification_fields()),
            }
            for _, rule in sorted(self._rules.items())
        )

    def canonical_document(self) -> Mapping[str, object]:
        """Document canonique publiable — la seule vue exportée hors du backend.

        Sert de source unique au miroir TypeScript, exactement comme
        `FIXTURE_MANIFEST.json` sert les contrats P02 : mêmes octets validés des
        deux côtés, donc aucune divergence silencieuse possible.

        Ne contient **aucune conclusion** : pour chaque règle, ce qu'elle est et
        ce qui manque pour l'instruire. Aucune donnée tenant n'y transite — le
        registre n'a pas de dimension entreprise.
        """
        return {
            "registry_version": self.registry_version,
            "verified_rule_count": sum(1 for r in self._rules.values() if r.is_verified),
            "rules": [
                {
                    "rule_id": rule.rule_id,
                    "text_version": rule.text_version,
                    "jurisdiction": rule.jurisdiction,
                    "instrument_kind": rule.instrument_kind,
                    "is_binding": rule.is_binding,
                    "title": rule.title,
                    "text_reference": rule.text_reference,
                    "legal_status": rule.legal_status,
                    "public_legal_status": to_public_legal_status(rule),
                    "transposition_status": rule.transposition.status,
                    "criteria": [c.criterion_code for c in rule.conditions],
                    "missing_fields": list(rule.missing_verification_fields()),
                    "notes": rule.notes,
                }
                for _, rule in sorted(self._rules.items())
            ],
        }

    def canonical_json(self) -> str:
        """Sérialisation déterministe du document canonique."""
        return json.dumps(
            self.canonical_document(), ensure_ascii=False, indent=2, sort_keys=True
        )


# ---------------------------------------------------------------------------
# Pont vers le contrat public P02
# ---------------------------------------------------------------------------


def to_public_legal_status(rule: RegulatoryRule) -> WaterLegalStatus:
    """Traduit le statut interne vers le vocabulaire public `WaterLegalStatus`.

    Règles de conversion, dans cet ordre :

    - règle non vérifiée (source ou revue manquante) → `unknown`, **quel que
      soit** le statut interne : un statut non sourcé ne se publie pas ;
    - référentiel volontaire → `voluntary` ;
    - `repealed` → `repealed`, **sans conversion**.

    ## La conversion destructive corrigée en Wave E

    Tant que le vocabulaire public ne comportait pas `repealed`, un texte abrogé
    était publié comme `out_of_scope`. Les deux énoncés n'ont ni la même cause
    ni les mêmes conséquences : « hors de votre champ » suggère qu'un
    changement de taille ou de périmètre pourrait rendre le texte applicable,
    alors qu'un texte abrogé ne redeviendra jamais applicable.

    `repealed` a donc été ajouté au contrat partagé, et la conversion est
    **interdite** — un test la surveille explicitement.
    """
    if not rule.is_verified:
        return "unknown"
    if rule.instrument_kind == "voluntary_framework":
        return "voluntary"
    if rule.legal_status == "repealed":
        # Jamais `out_of_scope` : voir la note ci-dessus.
        return "repealed"
    if rule.legal_status in ("in_force", "amended"):
        if rule.instrument_kind == "directive" and rule.transposition.status == "pending":
            return "transposition_pending"
        return "in_force"
    if rule.legal_status == "adopted":
        return "adopted_not_applicable"
    if rule.legal_status == "proposed":
        return "proposed"
    return "unknown"


# ---------------------------------------------------------------------------
# Registre courant — aucune règle vérifiée à ce jour
# ---------------------------------------------------------------------------

#: Version du registre. Incrémentée dès qu'une entrée est ajoutée, retirée ou
#: qu'une version de texte est publiée — jamais pour une correction de forme.
REGISTRY_VERSION = "2026.07-D1"

#: Critères de portée nommés. Ils portent la QUESTION, jamais le seuil : le
#: seuil dépend du texte applicable et appartient au réviseur juridique.
CRITERION_UNDERTAKING_IN_SCOPE = ScopeCondition(
    criterion_code="undertaking_in_reporting_scope",
    question=(
        "L'entité entre-t-elle dans le champ des entreprises assujetties à ce "
        "texte, au sens de la version applicable et de sa transposition ?"
    ),
)
CRITERION_WATER_MATERIAL = ScopeCondition(
    criterion_code="water_topic_material",
    question=(
        "L'eau (et les ressources marines) ressort-elle comme thème matériel de "
        "l'évaluation de double matérialité de l'entité ?"
    ),
    requires_materiality=True,
)
CRITERION_VOLUNTARY_ADOPTION = ScopeCondition(
    criterion_code="framework_voluntarily_adopted",
    question="L'entité a-t-elle décidé d'adopter volontairement ce référentiel ?",
)

#: Les entrées ci-dessous nomment les textes à instruire. Elles ne portent
#: AUCUNE date, AUCUN statut : rien n'a été vérifié auprès d'une source
#: officielle, et la connaissance mémorisée d'un modèle ne vaut pas
#: vérification de l'état du droit au jour de la lecture. `evaluate()` répond
#: donc `unknown` pour toutes — c'est le résultat correct du gate, pas un
#: remplissage inachevé.
CURRENT_RULES: tuple[RegulatoryRule, ...] = (
    RegulatoryRule(
        rule_id="EU_CSRD",
        text_version="to-verify",
        jurisdiction="EU",
        instrument_kind="directive",
        title="Directive sur la publication d'informations en matière de durabilité (CSRD)",
        text_reference="À vérifier auprès d'EUR-Lex (numéro et version consolidée)",
        conditions=(CRITERION_UNDERTAKING_IN_SCOPE,),
        notes=(
            "Directive : l'échéance de transposition et l'état de transposition "
            "nationale doivent être vérifiés pays par pays. Le calendrier "
            "d'application a fait l'objet de modifications successives — aucune "
            "date n'est reprise ici sans relevé officiel daté."
        ),
    ),
    RegulatoryRule(
        rule_id="EU_ESRS_SET",
        text_version="to-verify",
        jurisdiction="EU",
        instrument_kind="delegated_act",
        title="Normes européennes d'information en durabilité (ESRS 2, E1-E5 dont E2, E3, E4)",
        text_reference="Acte délégué ESRS — référence et version à vérifier auprès d'EUR-Lex",
        conditions=(CRITERION_UNDERTAKING_IN_SCOPE, CRITERION_WATER_MATERIAL),
        notes=(
            "ESRS E3 (eau et ressources marines) est le point d'ancrage du "
            "chantier ; E2 (pollution) et E4 (biodiversité) lui sont liés. "
            "L'obligation de publier E3 dépend de l'évaluation de double "
            "matérialité de l'entité : le moteur rend `conditional` tant que "
            "cette évaluation n'est pas tranchée, jamais `in_scope` par défaut."
        ),
    ),
    RegulatoryRule(
        rule_id="EU_TAXONOMY",
        text_version="to-verify",
        jurisdiction="EU",
        instrument_kind="regulation",
        title="Règlement Taxonomie et actes délégués associés",
        text_reference="À vérifier auprès d'EUR-Lex (règlement et actes délégués)",
        transposition=TranspositionState(status="not_applicable"),
        conditions=(CRITERION_UNDERTAKING_IN_SCOPE,),
        notes=(
            "Règlement : directement applicable, aucune transposition. Le critère "
            "« utilisation durable et protection des ressources aquatiques et "
            "marines » et les critères DNSH associés sont à instruire par un "
            "réviseur — aucun seuil n'est encodé ici."
        ),
    ),
    RegulatoryRule(
        rule_id="EU_WATER_LAW",
        text_version="to-verify",
        jurisdiction="EU",
        instrument_kind="directive",
        title="Droit européen de l'eau et des polluants (cadre, eaux souterraines, substances)",
        text_reference="À vérifier auprès d'EUR-Lex (directive-cadre et directives filles)",
        conditions=(CRITERION_UNDERTAKING_IN_SCOPE,),
        notes=(
            "Famille de textes, pas un texte unique : la directive-cadre, les "
            "directives filles et les listes de substances doivent être "
            "instruites séparément et versionnées séparément dès qu'un réviseur "
            "est désigné. Aucune conclusion de conformité n'est produite ailleurs "
            "que dans ce registre — les connecteurs Hub'Eau n'en portent aucune, "
            "et un test le vérifie."
        ),
    ),
    RegulatoryRule(
        rule_id="FR_NATIONAL",
        text_version="to-verify",
        jurisdiction="FR",
        instrument_kind="national_law",
        title="Textes nationaux français applicables (à instruire)",
        text_reference="À vérifier auprès de Légifrance",
        conditions=(CRITERION_UNDERTAKING_IN_SCOPE,),
        notes=(
            "Entrée volontairement vide de contenu normatif : la consigne du "
            "MACRO-PROMPT D limite la France aux textes officiels vérifiés. "
            "Aucun n'a été relevé. Cette entrée existe pour que l'absence soit "
            "visible dans la matrice, pas pour suggérer une obligation."
        ),
    ),
    RegulatoryRule(
        rule_id="GRI_303",
        text_version="to-verify",
        jurisdiction="INTERNATIONAL",
        instrument_kind="voluntary_framework",
        title="GRI 303 — Eau et effluents",
        text_reference="Référentiel GRI — version à vérifier auprès du GSSB",
        transposition=TranspositionState(status="not_applicable"),
        conditions=(CRITERION_VOLUNTARY_ADOPTION,),
        notes="Référentiel volontaire : n'oblige personne, ne se transpose pas.",
    ),
    RegulatoryRule(
        rule_id="CDP_WATER",
        text_version="to-verify",
        jurisdiction="INTERNATIONAL",
        instrument_kind="voluntary_framework",
        title="CDP — questionnaire sécurité de l'eau",
        text_reference="Questionnaire CDP — millésime à vérifier auprès du CDP",
        transposition=TranspositionState(status="not_applicable"),
        conditions=(CRITERION_VOLUNTARY_ADOPTION,),
        notes=(
            "Référentiel volontaire, souvent demandé par un donneur d'ordre ou un "
            "investisseur. Une demande contractuelle n'est pas une obligation "
            "légale : la distinction est portée par `instrument_kind`."
        ),
    ),
    RegulatoryRule(
        rule_id="TNFD_LEAP",
        text_version="to-verify",
        jurisdiction="INTERNATIONAL",
        instrument_kind="voluntary_framework",
        title="TNFD — recommandations et approche LEAP",
        text_reference="Recommandations TNFD — version à vérifier auprès de la TNFD",
        transposition=TranspositionState(status="not_applicable"),
        conditions=(CRITERION_VOLUNTARY_ADOPTION,),
        notes=(
            "Le module `/nature` du dépôt implémente déjà une approche LEAP : "
            "toute articulation avec cette entrée doit passer par la matrice du "
            "handoff, jamais par une conclusion de conformité rendue dans `/nature`."
        ),
    ),
    RegulatoryRule(
        rule_id="SBTN",
        text_version="to-verify",
        jurisdiction="INTERNATIONAL",
        instrument_kind="voluntary_framework",
        title="SBTN — objectifs fondés sur la science pour la nature (eau douce)",
        text_reference="Méthodes SBTN — version à vérifier auprès du SBTN",
        transposition=TranspositionState(status="not_applicable"),
        conditions=(CRITERION_VOLUNTARY_ADOPTION,),
        notes="Référentiel volontaire, méthodologie en évolution.",
    ),
)


def current_registry() -> RegulatoryRegistry:
    """Registre courant. **Aucune règle n'est vérifiée** : toutes les entrées
    sont dépourvues de source officielle et de revue humaine, donc le moteur
    répond `unknown` pour chacune. C'est le résultat correct du gate
    réglementaire, pas un registre inachevé."""
    return RegulatoryRegistry(CURRENT_RULES, registry_version=REGISTRY_VERSION)
