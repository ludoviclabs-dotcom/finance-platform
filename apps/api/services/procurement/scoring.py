"""
scoring.py — profil fournisseur en CINQ DIMENSIONS SÉPARÉES (PR-05B).

═══════════════════════════════════════════════════════════════════════════════
LE PRINCIPE QUI GOUVERNE CE MODULE : PAS DE SCORE ESG UNIQUE
═══════════════════════════════════════════════════════════════════════════════

Ce module ne produit **jamais** un chiffre unique par fournisseur, et il ne faut
pas en ajouter un « pour simplifier l'affichage ». Fusionner ces cinq dimensions
reviendrait à additionner des grandeurs qui ne parlent pas de la même chose :
un fournisseur peut avoir d'excellentes preuves ET une concentration
d'approvisionnement dangereuse. La moyenne des deux ne veut rien dire, et masque
précisément l'information qui doit déclencher une action (principe §1.10 du plan
d'architecture, contrats §2).

Les cinq dimensions, indépendantes :

  1. `evidence_maturity`     maturité des preuves — la donnée est-elle sourcée,
                             pièce à l'appui, vérifiée ?
  2. `ghg_data_quality`      qualité des données GES — quelles méthodes ont
                             réellement servi à calculer ce fournisseur ?
  3. `supply_concentration`  concentration d'approvisionnement — quelle part de
                             la dépense dépend de ce seul fournisseur ?
  4. `location_exposure`     exposition géographique — l'origine est-elle connue,
                             et sur combien de pays s'étale-t-elle ?
  5. `compliance_response`   conformité & réponse — le fournisseur répond-il aux
                             sollicitations, et ses réponses sont-elles revues ?

**Trois grandeurs distinctes, jamais confondues** (contrats §2) :
  - `value`      : l'état mesuré (0-100), avec son `direction` explicite ;
  - `confidence` : à quel point la donnée disponible SOUTIENT cette mesure ;
  - `data_status`: la nature de la donnée (porté par les observations, ailleurs).

Un fournisseur sans donnée n'a pas un score de 0 : il a `value=None` avec une
confiance nulle et un avertissement. Un trou d'information n'est pas une
mauvaise performance — c'est un trou d'information.

**Aucun LLM, aucune notation propriétaire opaque** : chaque dimension est une
fonction PURE de comptages explicites, lisible et rejouable.
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.procurement import ScoreDimension, SupplierScoreCard
from services.calculations import procurement as engine

_SCOPE = "company_id = %s"


class ScoringError(Exception):
    """Erreur métier du profil fournisseur (fournisseur hors périmètre…)."""


def _pct(numerator: float, denominator: float) -> float:
    return round(numerator / denominator * 100.0, 2) if denominator else 0.0


# ---------------------------------------------------------------------------
# Dimensions — fonctions PURES (testables sans PostgreSQL)
# ---------------------------------------------------------------------------

def evidence_maturity(
    *, total_records: int, sourced_records: int, verified_records: int,
) -> ScoreDimension:
    """Maturité des preuves : part des déclarations/PCF réellement SOURCÉES
    (release + pièce justificative) et vérifiées par un tiers.

    Une valeur déclarée sans pièce ne compte pas comme une preuve : c'est une
    affirmation. La dimension distingue les deux."""
    warnings: list[str] = []
    if total_records == 0:
        return ScoreDimension(
            code="evidence_maturity", label="Maturité des preuves", value=None,
            direction="higher_is_better", confidence=0.0,
            basis="Aucune déclaration ni PCF enregistrée pour ce fournisseur.",
            inputs={"total_records": 0},
            warnings=["Aucune donnée : absence d'information, pas une mauvaise performance."],
        )
    # Pondération : une donnée sourcée vaut 60 points, sa vérification par tiers
    # les 40 restants. Convention de méthode, documentée, non aléatoire.
    value = round(
        _pct(sourced_records, total_records) * 0.6
        + _pct(verified_records, total_records) * 0.4,
        2,
    )
    if sourced_records < total_records:
        warnings.append(
            f"{total_records - sourced_records} donnée(s) sans source ni pièce justificative."
        )
    return ScoreDimension(
        code="evidence_maturity", label="Maturité des preuves", value=value,
        direction="higher_is_better",
        confidence=round(min(1.0, total_records / 5.0), 2),
        basis="Part des déclarations/PCF sourcées (60 %) et vérifiées par tiers (40 %).",
        inputs={
            "total_records": total_records,
            "sourced_records": sourced_records,
            "verified_records": verified_records,
        },
        warnings=warnings,
    )


def ghg_data_quality(
    *, method_counts: dict[str, int], primary_data_pct: float | None = None,
) -> ScoreDimension:
    """Qualité des données GES : quelles MÉTHODES ont servi à calculer ce
    fournisseur, pondérées par la hiérarchie Scope 3.

    Reprend directement `METHOD_PROFILES` du moteur : la qualité affichée ici et
    la qualité utilisée dans le calcul viennent de la même source versionnée —
    impossible qu'elles divergent."""
    total = sum(method_counts.values())
    if total == 0:
        return ScoreDimension(
            code="ghg_data_quality", label="Qualité des données GES", value=None,
            direction="higher_is_better", confidence=0.0,
            basis="Aucune ligne calculée pour ce fournisseur.",
            inputs={"method_counts": {}},
            warnings=["Aucun résultat de calcul : fournisseur non couvert par un run."],
        )
    weighted = 0.0
    for method, count in method_counts.items():
        quality = engine.METHOD_PROFILES.get(method, engine.METHOD_PROFILES["unresolved"]).data_quality
        weighted += (quality or 0.0) * count
    value = round(weighted / total * 100.0, 2)

    warnings: list[str] = []
    unresolved = method_counts.get("unresolved", 0)
    if unresolved:
        warnings.append(
            f"{unresolved} ligne(s) non résolue(s) sur {total} — qualité mesurée sur "
            "un périmètre incomplet."
        )
    spend_based = method_counts.get("spend_based_economic", 0)
    if spend_based and spend_based / total > 0.5:
        warnings.append(
            "Plus de la moitié des lignes reposent sur un facteur monétaire — "
            "collecte de donnée fournisseur recommandée."
        )
    return ScoreDimension(
        code="ghg_data_quality", label="Qualité des données GES", value=value,
        direction="higher_is_better",
        confidence=round(min(1.0, total / 10.0), 2),
        basis=(
            "Moyenne des qualités de méthode (METHOD_PROFILES, méthodologie "
            f"{engine.METHODOLOGY_CODE} v{engine.METHODOLOGY_VERSION}), pondérée par le "
            "nombre de lignes."
        ),
        inputs={
            "method_counts": dict(sorted(method_counts.items())),
            "line_count": total,
            "declared_primary_data_pct": primary_data_pct,
        },
        warnings=warnings,
    )


def supply_concentration(
    *, supplier_spend: float | None, total_spend: float | None, supplier_count: int,
) -> ScoreDimension:
    """Concentration d'approvisionnement : part de la dépense totale portée par
    ce seul fournisseur.

    **Direction inversée** : une valeur ÉLEVÉE signale une dépendance forte,
    donc un risque — pas une bonne note. D'où `higher_is_riskier`."""
    if not total_spend or supplier_spend is None:
        return ScoreDimension(
            code="supply_concentration", label="Concentration d'approvisionnement",
            value=None, direction="higher_is_riskier", confidence=0.0,
            basis="Dépense totale inconnue — part non calculable.",
            inputs={"supplier_spend": supplier_spend, "total_spend": total_spend},
            warnings=["Dépenses absentes : concentration non mesurable."],
        )
    value = _pct(supplier_spend, total_spend)
    warnings: list[str] = []
    if value >= 30.0:
        warnings.append(
            f"Ce fournisseur porte {value:g} % de la dépense analysée — "
            "dépendance à surveiller."
        )
    if supplier_count <= 2:
        warnings.append(
            f"Seulement {supplier_count} fournisseur(s) dans le périmètre — "
            "part relative peu significative."
        )
    return ScoreDimension(
        code="supply_concentration", label="Concentration d'approvisionnement",
        value=value, direction="higher_is_riskier",
        confidence=round(min(1.0, supplier_count / 5.0), 2),
        basis="Part de la dépense analysée portée par ce fournisseur.",
        inputs={
            "supplier_spend": supplier_spend,
            "total_spend": total_spend,
            "supplier_count": supplier_count,
        },
        warnings=warnings,
    )


def location_exposure(
    *, lines_total: int, lines_with_country: int, distinct_countries: int,
    sites_total: int, sites_geocode_accepted: int,
) -> ScoreDimension:
    """Exposition géographique — mesure de ce que l'on SAIT de l'origine.

    Volontairement **descriptive** : part d'origines inconnues et dispersion
    géographique. Ce module n'attribue AUCUN score de risque pays (géopolitique,
    gouvernance, droits humains) : ce serait un jugement normatif opaque, hors
    périmètre, et il exigerait une source qualifiée et citable.

    Direction inversée : plus l'origine est inconnue, plus l'exposition est
    élevée."""
    if lines_total == 0:
        return ScoreDimension(
            code="location_exposure", label="Exposition géographique", value=None,
            direction="higher_is_riskier", confidence=0.0,
            basis="Aucune ligne d'achat rattachée à ce fournisseur.",
            inputs={"lines_total": 0},
            warnings=["Aucune ligne : exposition non mesurable."],
        )
    unknown_share = _pct(lines_total - lines_with_country, lines_total)
    # Dispersion : 0 pour un pays unique, plafonnée à 100 au-delà de 5 pays.
    dispersion = min(100.0, max(0, distinct_countries - 1) * 25.0)
    value = round(unknown_share * 0.7 + dispersion * 0.3, 2)

    warnings: list[str] = []
    if unknown_share > 0:
        warnings.append(
            f"{unknown_share:g} % des lignes sans pays d'origine renseigné."
        )
    if sites_total and sites_geocode_accepted < sites_total:
        warnings.append(
            f"{sites_total - sites_geocode_accepted} site(s) fournisseur sans "
            "géolocalisation revue."
        )
    return ScoreDimension(
        code="location_exposure", label="Exposition géographique", value=value,
        direction="higher_is_riskier",
        confidence=round(min(1.0, lines_total / 10.0), 2),
        basis=(
            "Part d'origines inconnues (70 %) et dispersion multi-pays (30 %). "
            "Aucun score de risque pays normatif n'est appliqué."
        ),
        inputs={
            "lines_total": lines_total,
            "lines_with_country": lines_with_country,
            "distinct_countries": distinct_countries,
            "sites_total": sites_total,
            "sites_geocode_accepted": sites_geocode_accepted,
        },
        warnings=warnings,
    )


def compliance_response(
    *, invited: int, completed: int, answers_accepted: int, answers_pending: int,
) -> ScoreDimension:
    """Conformité & réponse : le fournisseur répond-il, et ses réponses
    passent-elles le gate de revue ?

    Une réponse reçue mais non revue ne compte PAS comme une réponse conforme :
    le gate humain fait partie de la mesure."""
    if invited == 0:
        return ScoreDimension(
            code="compliance_response", label="Conformité & réponse", value=None,
            direction="higher_is_better", confidence=0.0,
            basis="Aucune sollicitation envoyée à ce fournisseur.",
            inputs={"invited": 0},
            warnings=["Jamais sollicité : aucune conclusion possible sur sa réactivité."],
        )
    # Répondre vaut 60 points, la revue acceptée les 40 restants.
    value = round(
        _pct(completed, invited) * 0.6 + _pct(answers_accepted, invited) * 0.4, 2
    )
    warnings: list[str] = []
    if completed < invited:
        warnings.append(f"{invited - completed} sollicitation(s) sans réponse.")
    if answers_pending:
        warnings.append(
            f"{answers_pending} réponse(s) en attente de revue — non comptées comme conformes."
        )
    return ScoreDimension(
        code="compliance_response", label="Conformité & réponse", value=value,
        direction="higher_is_better",
        confidence=round(min(1.0, invited / 3.0), 2),
        basis="Taux de réponse aux campagnes (60 %) et réponses acceptées en revue (40 %).",
        inputs={
            "invited": invited, "completed": completed,
            "answers_accepted": answers_accepted, "answers_pending": answers_pending,
        },
        warnings=warnings,
    )


# ---------------------------------------------------------------------------
# Composition depuis la base (défense en profondeur : company_id = %s partout)
# ---------------------------------------------------------------------------

def _as_float(value: Any) -> float | None:
    return None if value is None else float(value)


def get_supplier_scorecard(
    *, company_id: int, supplier_id: int, run_id: int | None = None,
) -> SupplierScoreCard:
    """Assemble les cinq dimensions d'un fournisseur.

    `run_id` restreint la qualité GES et l'exposition au périmètre d'un run
    précis ; sans lui, toutes les lignes calculées du tenant sont considérées.
    Aucune agrégation entre dimensions n'est produite, ici ni ailleurs."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name FROM suppliers WHERE id = %s AND company_id = %s",
                (supplier_id, company_id),
            )
            supplier = cur.fetchone()
            if supplier is None:
                raise ScoringError(f"Fournisseur '{supplier_id}' introuvable.")
            supplier_name = supplier["name"]

            # 1 — Maturité des preuves : déclarations + PCF du fournisseur.
            cur.execute(
                f"""
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (
                        WHERE evidence_artifact_id IS NOT NULL AND source_release_id IS NOT NULL
                    ) AS sourced,
                    COUNT(*) FILTER (WHERE data_status = 'verified') AS verified
                FROM supplier_metric_declarations
                WHERE {_SCOPE} AND supplier_id = %s
                """,
                (company_id, supplier_id),
            )
            decl = dict(cur.fetchone())
            cur.execute(
                f"""
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (
                        WHERE pcf.evidence_artifact_id IS NOT NULL
                          AND pcf.source_release_id IS NOT NULL
                    ) AS sourced,
                    COUNT(*) FILTER (
                        WHERE pcf.verification_status = 'third_party_verified'
                    ) AS verified
                FROM product_carbon_footprints pcf
                JOIN supplier_products sp
                  ON sp.id = pcf.supplier_product_id AND sp.company_id = pcf.company_id
                WHERE pcf.{_SCOPE} AND sp.supplier_id = %s
                """,
                (company_id, supplier_id),
            )
            pcf = dict(cur.fetchone())

            # 2 — Qualité GES : méthodes réellement employées.
            run_clause = "AND r.run_id = %s" if run_id is not None else ""
            run_params: tuple[Any, ...] = (run_id,) if run_id is not None else ()
            cur.execute(
                f"""
                SELECT r.calculation_method, COUNT(*) AS n
                FROM procurement_line_results r
                WHERE r.{_SCOPE} AND r.supplier_id = %s {run_clause}
                GROUP BY r.calculation_method
                """,
                (company_id, supplier_id, *run_params),
            )
            method_counts = {r["calculation_method"]: int(r["n"]) for r in cur.fetchall()}

            cur.execute(
                f"""
                SELECT AVG(primary_data_pct) AS avg_primary
                FROM supplier_metric_declarations
                WHERE {_SCOPE} AND supplier_id = %s AND primary_data_pct IS NOT NULL
                """,
                (company_id, supplier_id),
            )
            avg_primary = _as_float(cur.fetchone()["avg_primary"])

            # 3 — Concentration : dépense du fournisseur / dépense analysée.
            cur.execute(
                f"""
                SELECT
                    SUM(spend_amount) FILTER (WHERE supplier_id = %s) AS supplier_spend,
                    SUM(spend_amount) AS total_spend,
                    COUNT(DISTINCT supplier_id) AS supplier_count
                FROM purchase_lines
                WHERE {_SCOPE}
                """,
                (supplier_id, company_id),
            )
            spend = dict(cur.fetchone())

            # 4 — Exposition géographique.
            cur.execute(
                f"""
                SELECT
                    COUNT(*) AS lines_total,
                    COUNT(*) FILTER (WHERE origin_country IS NOT NULL) AS lines_with_country,
                    COUNT(DISTINCT origin_country) AS distinct_countries
                FROM purchase_lines
                WHERE {_SCOPE} AND supplier_id = %s
                """,
                (company_id, supplier_id),
            )
            geo = dict(cur.fetchone())
            cur.execute(
                f"""
                SELECT
                    COUNT(*) AS sites_total,
                    COUNT(*) FILTER (WHERE geocode_review_status = 'accepted') AS geocoded
                FROM supplier_sites
                WHERE {_SCOPE} AND supplier_id = %s
                """,
                (company_id, supplier_id),
            )
            sites = dict(cur.fetchone())

            # 5 — Conformité & réponse (module fournisseurs historique).
            cur.execute(
                """
                SELECT
                    COUNT(*) AS invited,
                    COUNT(used_at) AS completed
                FROM supplier_questionnaire_tokens
                WHERE company_id = %s AND supplier_id = %s
                """,
                (company_id, supplier_id),
            )
            tokens = dict(cur.fetchone())
            cur.execute(
                """
                SELECT
                    COUNT(*) FILTER (WHERE review_status = 'accepted') AS accepted,
                    COUNT(*) FILTER (WHERE review_status = 'pending') AS pending
                FROM supplier_answers
                WHERE company_id = %s AND supplier_id = %s
                """,
                (company_id, supplier_id),
            )
            answers = dict(cur.fetchone())

    dimensions = [
        evidence_maturity(
            total_records=int(decl["total"] or 0) + int(pcf["total"] or 0),
            sourced_records=int(decl["sourced"] or 0) + int(pcf["sourced"] or 0),
            verified_records=int(decl["verified"] or 0) + int(pcf["verified"] or 0),
        ),
        ghg_data_quality(method_counts=method_counts, primary_data_pct=avg_primary),
        supply_concentration(
            supplier_spend=_as_float(spend["supplier_spend"]),
            total_spend=_as_float(spend["total_spend"]),
            supplier_count=int(spend["supplier_count"] or 0),
        ),
        location_exposure(
            lines_total=int(geo["lines_total"] or 0),
            lines_with_country=int(geo["lines_with_country"] or 0),
            distinct_countries=int(geo["distinct_countries"] or 0),
            sites_total=int(sites["sites_total"] or 0),
            sites_geocode_accepted=int(sites["geocoded"] or 0),
        ),
        compliance_response(
            invited=int(tokens["invited"] or 0),
            completed=int(tokens["completed"] or 0),
            answers_accepted=int(answers["accepted"] or 0),
            answers_pending=int(answers["pending"] or 0),
        ),
    ]
    return SupplierScoreCard(
        supplier_id=supplier_id, supplier_name=supplier_name, dimensions=dimensions,
    )
