"""
scripts/water_intelligence/candidate_scopes.py — périmètres candidats X4B-PREP.

## Ce que ce module décrit, et ce qu'il ne décide pas

Trois familles de candidats, définies en DONNÉES plutôt qu'en arguments de
ligne de commande, pour qu'un signataire lise le périmètre exact sans
reconstituer une invocation de script.

**Aucun nouveau territoire n'est choisi ici.** Les identifiants sont ceux
éprouvés en X3 ; seules les fenêtres et la pagination bougent, dans le sens de
l'exhaustivité.

## Le problème que ces candidats corrigent

Deux des trois périmètres X3 sont des **pages saturées**, donc tronquées :

| Source | X3 | Saturation |
|---|---|---|
| `HUBEAU_ADES` | 182 enregistrements sur une page de 200 | **non saturée** — déjà exhaustive sur sa fenêtre |
| `HUBEAU_QUALITE_SURFACE` | 50 sur une page de 50 | **saturée** — fenêtre demandée tronquée à 12 jours sur 91 |
| `HUBEAU_BNPE_PRELEVEMENTS` | 50 sur une page de 50 | **saturée** — sur un département qui compte des milliers de lignes |

Publier une page saturée revient à présenter une limite de pagination comme une
couverture territoriale. Un candidat n'est donc « exhaustif » que si la
dernière page de son acquisition est **incomplète** — c'est le seul signal
disponible qui prouve qu'aucun enregistrement n'a été laissé de côté.

## Ce qui n'est pas connu tant que le workflow n'a pas tourné

`expected_total` et `exhaustive` ne sont PAS renseignés ici : ils ne se
déduisent d'aucune lecture du dépôt. Hub'Eau expose un champ `count` dans ses
réponses, et c'est lui qui les établira — au moment de l'acquisition, jamais
avant.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

#: Familles de candidats. `x3_technical_sample` existe pour la comparaison
#: seulement — il reproduit les bornes de recette, qui ne documentent aucun
#: territoire au sens éditorial (§3.1 du paquet de décision).
CandidateFamily = Literal["minimal_pilot", "balanced_pilot", "x3_technical_sample"]


@dataclass(frozen=True)
class SourceScope:
    """Périmètre d'UNE source dans UN candidat.

    `page_size` et `max_pages` bornent l'acquisition. `expects_incomplete_last_page`
    dit si ce périmètre PRÉTEND être exhaustif : si oui, le constructeur exige
    que la dernière page soit incomplète, et échoue sinon — une prétention
    d'exhaustivité non vérifiée est pire qu'une absence de prétention.
    """

    source_code: str
    #: Famille `validate_hubeau` (`piezometrie`, `qualite_surface`, `prelevements`).
    family: str
    geography_type: str
    geography_code: str
    date_from: str
    date_to: str
    page_size: int
    max_pages: int
    #: Paramètres SANDRE, pour la qualité uniquement.
    parameter_codes: tuple[str, ...] = ()
    #: Une requête par année (BNPE) — `None` pour les fenêtres continues.
    max_years: int | None = None
    expects_incomplete_last_page: bool = True
    justification: str = ""
    interpretation_risk: str = ""

    @property
    def identifier_kind(self) -> str:
        return self.geography_type


@dataclass(frozen=True)
class Candidate:
    """Une option complète, telle qu'elle sera présentée au signataire."""

    key: CandidateFamily
    title: str
    intent: str
    scopes: tuple[SourceScope, ...]
    recommended_for_publication: bool
    caveats: tuple[str, ...] = field(default_factory=tuple)

    @property
    def source_codes(self) -> tuple[str, ...]:
        return tuple(sorted({s.source_code for s in self.scopes}))


# ---------------------------------------------------------------------------
# A — minimal_pilot : une source, périmètre très étroit, exhaustif
# ---------------------------------------------------------------------------

MINIMAL_PILOT = Candidate(
    key="minimal_pilot",
    title="A — pilote minimal : une source, un périmètre exhaustif",
    intent=(
        "Première publication rapide et défendable. Une seule source, celle dont "
        "le périmètre X3 était DÉJÀ exhaustif (182 enregistrements sur une page "
        "de 200 : la page n'était pas saturée, donc rien n'a été tronqué)."
    ),
    scopes=(
        SourceScope(
            source_code="HUBEAU_ADES",
            family="piezometrie",
            geography_type="code_bss",
            geography_code="09892X0679/EXH70",
            date_from="2024-01-01",
            date_to="2024-03-31",
            page_size=200,
            max_pages=2,
            justification=(
                "Identifiant et fenêtre éprouvés en X3, sans modification. Seule "
                "source des trois dont l'acquisition X3 n'était pas tronquée."
            ),
            interpretation_risk=(
                "UNE station piézométrique ne documente aucun territoire. La "
                "surface doit nommer la station, jamais un département ni une "
                "région, et ne doit produire aucune moyenne territoriale."
            ),
        ),
    ),
    recommended_for_publication=True,
    caveats=(
        "Une station unique : la publication décrit un point de mesure, pas un territoire.",
        "Aucune couche géographique — la carte reste dans son état « aucune couche publiée ».",
    ),
)


# ---------------------------------------------------------------------------
# B — balanced_pilot : les trois sources, chacune resserrée pour être exhaustive
# ---------------------------------------------------------------------------

BALANCED_PILOT = Candidate(
    key="balanced_pilot",
    title="B — pilote équilibré : trois sources, chacune exhaustive sur un périmètre étroit",
    intent=(
        "Diversité thématique — niveau de nappe, qualité physico-chimique, "
        "prélèvements — au prix de périmètres délibérément resserrés. Chaque "
        "fenêtre est réduite jusqu'à ce que la dernière page soit incomplète, "
        "seul signal qui prouve qu'aucun enregistrement n'a été laissé de côté."
    ),
    scopes=(
        SourceScope(
            source_code="HUBEAU_ADES",
            family="piezometrie",
            geography_type="code_bss",
            geography_code="09892X0679/EXH70",
            date_from="2024-01-01",
            date_to="2024-03-31",
            page_size=200,
            max_pages=2,
            justification="Identique au candidat A — déjà exhaustif.",
            interpretation_risk="Une station, jamais un territoire.",
        ),
        SourceScope(
            source_code="HUBEAU_QUALITE_SURFACE",
            family="qualite_surface",
            geography_type="code_departement",
            geography_code="34",
            # Fenêtre RESSERRÉE au mois réellement couvert par X3
            # (2024-01-03 → 2024-01-15), élargie aux bornes du mois pour être
            # lisible. La pagination monte à 5 pages de 200 : la borne X3
            # (1 page de 50) est ce qui avait tronqué la fenêtre demandée.
            date_from="2024-01-01",
            date_to="2024-01-31",
            page_size=200,
            max_pages=5,
            parameter_codes=("1339", "1340"),
            justification=(
                "Département et paramètres SANDRE éprouvés en X3. La fenêtre passe "
                "d'un trimestre à un mois, et la pagination de 1×50 à 5×200 : c'est "
                "la borne de pagination X3, pas la source, qui avait réduit la "
                "période observée à douze jours."
            ),
            interpretation_risk=(
                "Aucune conclusion de conformité ne doit apparaître — la conformité "
                "relève exclusivement du registre juridique. Les codes de remarque "
                "sont transportés verbatim, aucune censure n'est déduite."
            ),
        ),
        SourceScope(
            source_code="HUBEAU_BNPE_PRELEVEMENTS",
            family="prelevements",
            # Géographie RESSERRÉE du département à la commune : le département
            # 34 compte des milliers de lignes, et une page de 50 en prélevait
            # un échantillon arbitraire. Montpellier (34172) est un identifiant
            # INSEE officiel, dans le département déjà éprouvé en X3.
            geography_type="code_commune_insee",
            geography_code="34172",
            date_from="2020",
            date_to="2020",
            page_size=200,
            max_pages=5,
            max_years=1,
            justification=(
                "Même département qu'en X3, resserré à une commune pour qu'une "
                "acquisition bornée soit exhaustive plutôt qu'échantillonnée. "
                "Année 2020 inchangée — l'API n'accepte qu'une année par requête."
            ),
            interpretation_risk=(
                "COUVERTURE PARTIELLE PAR CONSTRUCTION : les usages exonérés de "
                "redevance sont inconnus et les volumes < 10 000 m³ ne sont pas "
                "déclarés. Une absence n'est JAMAIS un prélèvement nul, et aucun "
                "total communal ne doit être présenté comme le prélèvement de la "
                "commune."
            ),
        ),
    ),
    recommended_for_publication=True,
    caveats=(
        "Trois périmètres étroits et hétérogènes : aucune comparaison entre sources n'est valide.",
        "BNPE : couverture partielle par construction, à afficher à côté des valeurs.",
        "Naïades : allowlist SANDRE à valider explicitement avant publication.",
        "Aucune couche géographique — la carte ne monte pas.",
    ),
)


# ---------------------------------------------------------------------------
# C — x3_technical_sample : reproduction, pour comparaison seulement
# ---------------------------------------------------------------------------

X3_TECHNICAL_SAMPLE = Candidate(
    key="x3_technical_sample",
    title="C — échantillon technique X3 : reproduction, NON recommandée pour publication",
    intent=(
        "Reproduit à l'identique les bornes de X3, dans le seul but de comparer "
        "les checksums et de mesurer l'écart de budget. Ces bornes ont été "
        "choisies pour VALIDER DES CONNECTEURS, pas pour décrire un territoire."
    ),
    scopes=(
        SourceScope(
            source_code="HUBEAU_ADES",
            family="piezometrie",
            geography_type="code_bss",
            geography_code="09892X0679/EXH70",
            date_from="2024-01-01",
            date_to="2024-03-31",
            page_size=200,
            max_pages=2,
            justification="Reproduction X3 stricte.",
            interpretation_risk="Échantillon de recette.",
        ),
        SourceScope(
            source_code="HUBEAU_QUALITE_SURFACE",
            family="qualite_surface",
            geography_type="code_departement",
            geography_code="34",
            date_from="2024-01-01",
            date_to="2024-03-31",
            page_size=50,
            max_pages=1,
            parameter_codes=("1339", "1340"),
            expects_incomplete_last_page=False,
            justification="Reproduction X3 stricte — page saturée, donc TRONQUÉE.",
            interpretation_risk=(
                "Page saturée : la période réellement observée (12 jours) est plus "
                "courte que la fenêtre demandée (91 jours). Publier ce périmètre "
                "présenterait une limite de pagination comme une couverture."
            ),
        ),
        SourceScope(
            source_code="HUBEAU_BNPE_PRELEVEMENTS",
            family="prelevements",
            geography_type="code_departement",
            geography_code="34",
            date_from="2020",
            date_to="2020",
            page_size=50,
            max_pages=1,
            max_years=1,
            expects_incomplete_last_page=False,
            justification="Reproduction X3 stricte — page saturée, donc TRONQUÉE.",
            interpretation_risk=(
                "Page saturée sur un département entier : l'échantillon de 50 "
                "ouvrages n'a aucune signification territoriale."
            ),
        ),
    ),
    recommended_for_publication=False,
    caveats=(
        "NON RECOMMANDÉ pour publication éditoriale : deux des trois périmètres sont "
        "des pages saturées, donc des ensembles tronqués présentés comme des périmètres.",
        "Existe pour la comparaison de checksums et la mesure d'écart de budget.",
    ),
)


# ---------------------------------------------------------------------------
# bnpe_minimal_pilot_v1 — le périmètre RÉELLEMENT signé
# ---------------------------------------------------------------------------
#
# Ce périmètre n'est pas un quatrième candidat à mesurer : c'est celui que la
# décision humaine du 2026-07-28 a approuvé, et le seul de tout le chantier
# dont le poids ait été mesuré sous le budget (6 120 octets pour 100 000).
#
# Il vit ici, avec les autres, pour une raison précise : les périmètres sont
# définis en DONNÉES, jamais recopiés dans un workflow. Une recette dupliquée
# dérive de son module de référence à la première modification — et c'est
# exactement ce qui rend un périmètre publié différent du périmètre approuvé.
#
# `max_pages = 1` reprend la borne signée (page 1, taille 200). Ce n'est pas
# une troncature : 3 enregistrements sur une page de 200 laissent la dernière
# page incomplète, seul signal qui prouve qu'aucun enregistrement n'a été
# laissé de l'autre côté de la borne.

#: Clé de release du pilote publié. Stable : elle est gravée dans le document
#: canonique et sert à recouper le rapport de preuve.
BNPE_PILOT_RELEASE_KEY = "bnpe-minimal-pilot-v1"

BNPE_MINIMAL_PILOT_V1 = SourceScope(
    source_code="HUBEAU_BNPE_PRELEVEMENTS",
    family="prelevements",
    geography_type="code_commune_insee",
    geography_code="34172",
    date_from="2020",
    date_to="2020",
    page_size=200,
    max_pages=1,
    max_years=1,
    expects_incomplete_last_page=True,
    justification=(
        "Périmètre approuvé par décision humaine signée le 2026-07-28 "
        "(ludoviclabs-dotcom) : commune INSEE 34172, année 2020, chroniques "
        "annuelles de prélèvements, pagination exhaustive. Seul périmètre du "
        "chantier mesuré sous le budget de 100 000 octets — 6 120 octets, "
        "marge 93 880."
    ),
    interpretation_risk=(
        "COUVERTURE PARTIELLE PAR CONSTRUCTION : les volumes exonérés de "
        "redevance peuvent être absents et certains petits volumes peuvent ne "
        "pas être déclarés. Une absence de déclaration n'est JAMAIS un "
        "prélèvement nul. Aucun total, aucune moyenne, aucun classement et "
        "aucun score ne doivent être dérivés de ces trois valeurs — "
        "`derived_use_allowed = false` au registre des décisions."
    ),
)


CANDIDATES: tuple[Candidate, ...] = (MINIMAL_PILOT, BALANCED_PILOT, X3_TECHNICAL_SAMPLE)

CANDIDATES_BY_KEY = {candidate.key: candidate for candidate in CANDIDATES}


#: Les sept combinaisons de sources à mesurer (§6 de la consigne), en plus des
#: candidats exacts. Elles disent où le budget casse, indépendamment du choix
#: éditorial.
BUDGET_COMBINATIONS: tuple[tuple[str, ...], ...] = (
    ("HUBEAU_ADES",),
    ("HUBEAU_QUALITE_SURFACE",),
    ("HUBEAU_BNPE_PRELEVEMENTS",),
    ("HUBEAU_ADES", "HUBEAU_QUALITE_SURFACE"),
    ("HUBEAU_ADES", "HUBEAU_BNPE_PRELEVEMENTS"),
    ("HUBEAU_QUALITE_SURFACE", "HUBEAU_BNPE_PRELEVEMENTS"),
    ("HUBEAU_ADES", "HUBEAU_QUALITE_SURFACE", "HUBEAU_BNPE_PRELEVEMENTS"),
)
