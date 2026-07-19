"""
hotspots_service.py — détection de hotspots, SÉLECTION HUMAINE et campagne
fournisseur contrôlée (PR-05B).

Principe directeur : **détecter n'est pas décider.**

  - `detect_hotspots` est une AGRÉGATION déterministe, en lecture seule. Elle
    classe les contributeurs d'un run ; elle ne retient rien, ne notifie rien,
    ne déclenche rien.
  - `select_hotspot` enregistre ce qu'un analyste a explicitement retenu ou
    écarté. C'est le gate humain entre « le calcul montre » et « on agit ».
  - `create_campaign_from_selection` ne part QUE d'une sélection retenue, de
    type `supplier`, rattachée à un fournisseur du tenant. Le moteur de
    campagnes existant (024, `supplier_campaigns_service`) est **réutilisé**,
    jamais réimplémenté.

Chaque hotspot expose sa part NON RÉSOLUE à côté de sa contribution : un poste
dont la moitié des lignes n'ont pas pu être calculées ne doit pas passer pour
un petit contributeur. C'est la traduction directe de « aucun fallback
silencieux » au niveau agrégé.

Défense en profondeur (contrats §7) : chaque requête porte `company_id = %s` en
plus de la RLS (le PostgreSQL de CI est superuser et bypasse la RLS).

Aucun LLM : le classement est un `ORDER BY`, pas un jugement.
"""

from __future__ import annotations

from typing import Any

from db.database import get_db
from models.procurement import (
    CampaignFromHotspotRequest,
    CampaignFromHotspotResponse,
    ExposureData,
    ExposureRow,
    Hotspot,
    HotspotsData,
    HotspotSelectionCreate,
    HotspotSelectionResponse,
)

_SCOPE = "company_id = %s"

# Seuil de détection : un contributeur strictement nul ou non résolu n'est pas
# écarté du classement — il est visible avec sa part non résolue.
DEFAULT_HOTSPOT_LIMIT = 20


class HotspotError(Exception):
    """Erreur métier d'un hotspot (run introuvable, sélection invalide…)."""


def _as_float(value: Any) -> float | None:
    return None if value is None else float(value)


def _assert_run_in_scope(cur, company_id: int, run_id: int) -> None:
    cur.execute(
        f"SELECT 1 FROM procurement_calculation_runs WHERE id = %s AND {_SCOPE}",
        (run_id, company_id),
    )
    if cur.fetchone() is None:
        raise HotspotError(f"Run '{run_id}' introuvable.")


# Expression de regroupement par dimension. Table de correspondance FERMÉE :
# `hotspot_type` vient d'un Literal Pydantic, jamais d'une chaîne libre, donc
# aucune interpolation de valeur utilisateur dans le SQL.
_GROUPING: dict[str, tuple[str, str, str]] = {
    # type: (expression de clé, expression de libellé, jointure supplémentaire)
    "supplier": (
        "r.supplier_id::text",
        "COALESCE(s.name, 'Fournisseur inconnu')",
        "LEFT JOIN suppliers s ON s.id = r.supplier_id AND s.company_id = r.company_id",
    ),
    "supplier_product": (
        "r.supplier_product_id::text",
        "COALESCE(sp.product_name, sp.product_code, 'Produit inconnu')",
        "LEFT JOIN supplier_products sp ON sp.id = r.supplier_product_id "
        "AND sp.company_id = r.company_id",
    ),
    "category": (
        "COALESCE(pl.category_code, 'non_categorise')",
        "COALESCE(pl.category_code, 'Non catégorisé')",
        "",
    ),
    "country": (
        "COALESCE(pl.origin_country, 'inconnu')",
        "COALESCE(pl.origin_country, 'Pays inconnu')",
        "",
    ),
}


def detect_hotspots(
    *, company_id: int, run_id: int, hotspot_type: str = "supplier",
    limit: int = DEFAULT_HOTSPOT_LIMIT,
) -> HotspotsData:
    """Classe les contributeurs d'un run par la dimension demandée.

    Lecture seule et déterministe : même run + même dimension ⇒ même classement
    (tri secondaire sur la clé pour lever les ex æquo). Les sélections humaines
    déjà enregistrées sont rattachées au passage, pour que l'UI montre d'un coup
    d'œil ce qui a déjà été traité."""
    if hotspot_type not in _GROUPING:
        raise HotspotError(f"Dimension de hotspot '{hotspot_type}' inconnue.")
    key_expr, label_expr, extra_join = _GROUPING[hotspot_type]

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_run_in_scope(cur, company_id, run_id)
            cur.execute(
                f"SELECT total_tco2e FROM procurement_calculation_runs "
                f"WHERE id = %s AND {_SCOPE}",
                (run_id, company_id),
            )
            total_tco2e = _as_float(cur.fetchone()["total_tco2e"])

            cur.execute(
                f"""
                SELECT
                    {key_expr} AS hotspot_key,
                    {label_expr} AS hotspot_label,
                    MAX(r.supplier_id) AS supplier_id,
                    COUNT(*) AS line_count,
                    SUM(r.result_tco2e) AS contribution_tco2e,
                    SUM(pl.spend_amount) AS spend_amount,
                    COUNT(*) FILTER (WHERE r.calculation_method = 'unresolved')
                        AS unresolved_line_count,
                    SUM(pl.spend_amount) FILTER (WHERE r.calculation_method = 'unresolved')
                        AS unresolved_spend_amount,
                    MIN(r.method_rank) AS best_rank
                FROM procurement_line_results r
                JOIN purchase_lines pl
                  ON pl.id = r.purchase_line_id AND pl.company_id = r.company_id
                {extra_join}
                WHERE r.{_SCOPE} AND r.run_id = %s
                GROUP BY 1, 2
                ORDER BY SUM(r.result_tco2e) DESC NULLS LAST, 1
                LIMIT %s
                """,
                (company_id, run_id, limit),
            )
            rows = [dict(r) for r in cur.fetchall()]

            cur.execute(
                f"""
                SELECT id, hotspot_key, selection_status
                FROM procurement_hotspot_selections
                WHERE {_SCOPE} AND run_id = %s AND hotspot_type = %s
                """,
                (company_id, run_id, hotspot_type),
            )
            selections = {r["hotspot_key"]: r for r in cur.fetchall()}

            # Méthode dominante par groupe (celle qui porte le plus de lignes).
            cur.execute(
                f"""
                SELECT {key_expr} AS hotspot_key, r.calculation_method, COUNT(*) AS n
                FROM procurement_line_results r
                JOIN purchase_lines pl
                  ON pl.id = r.purchase_line_id AND pl.company_id = r.company_id
                {extra_join}
                WHERE r.{_SCOPE} AND r.run_id = %s
                GROUP BY 1, 2
                ORDER BY 1, n DESC, 2
                """,
                (company_id, run_id),
            )
            dominant: dict[str, str] = {}
            for row in cur.fetchall():
                dominant.setdefault(row["hotspot_key"], row["calculation_method"])

    items: list[Hotspot] = []
    for position, row in enumerate(rows, start=1):
        contribution = _as_float(row["contribution_tco2e"])
        key = row["hotspot_key"]
        selection = selections.get(key)
        items.append(Hotspot(
            hotspot_type=hotspot_type,
            hotspot_key=key,
            hotspot_label=row["hotspot_label"],
            supplier_id=row["supplier_id"] if hotspot_type == "supplier" else None,
            line_count=int(row["line_count"]),
            contribution_tco2e=contribution,
            contribution_pct=(
                round(contribution / total_tco2e * 100.0, 4)
                if contribution is not None and total_tco2e else None
            ),
            spend_amount=_as_float(row["spend_amount"]),
            unresolved_line_count=int(row["unresolved_line_count"] or 0),
            unresolved_spend_amount=_as_float(row["unresolved_spend_amount"]),
            dominant_method=dominant.get(key),
            rank_position=position,
            selection_status=selection["selection_status"] if selection else None,
            selection_id=selection["id"] if selection else None,
        ))

    return HotspotsData(
        run_id=run_id, hotspot_type=hotspot_type, total_tco2e=total_tco2e, items=items,
    )


def get_exposure(
    *, company_id: int, run_id: int, dimension: str, limit: int = 50,
) -> ExposureData:
    """Exposition par matière ou par pays d'origine.

    `materials` s'appuie sur les correspondances matières ACCEPTÉES (gate humain)
    rattachées aux produits achetés ; `countries` sur le pays d'origine des
    lignes. Dans les deux cas, le compte de lignes non résolues accompagne la
    contribution."""
    if dimension not in ("materials", "countries"):
        raise HotspotError(f"Dimension d'exposition '{dimension}' inconnue.")

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_run_in_scope(cur, company_id, run_id)
            cur.execute(
                f"SELECT total_tco2e FROM procurement_calculation_runs "
                f"WHERE id = %s AND {_SCOPE}",
                (run_id, company_id),
            )
            total_tco2e = _as_float(cur.fetchone()["total_tco2e"])

            if dimension == "countries":
                cur.execute(
                    f"""
                    SELECT COALESCE(pl.origin_country, 'inconnu') AS key,
                           COUNT(*) AS line_count,
                           SUM(pl.spend_amount) AS spend_amount,
                           SUM(r.result_tco2e) AS contribution_tco2e,
                           COUNT(*) FILTER (WHERE r.calculation_method = 'unresolved')
                               AS unresolved_line_count
                    FROM procurement_line_results r
                    JOIN purchase_lines pl
                      ON pl.id = r.purchase_line_id AND pl.company_id = r.company_id
                    WHERE r.{_SCOPE} AND r.run_id = %s
                    GROUP BY 1
                    ORDER BY SUM(r.result_tco2e) DESC NULLS LAST, 1
                    LIMIT %s
                    """,
                    (company_id, run_id, limit),
                )
                rows = [dict(r) for r in cur.fetchall()]
                items = [
                    ExposureRow(
                        key=r["key"], label=r["key"], line_count=int(r["line_count"]),
                        spend_amount=_as_float(r["spend_amount"]), mass_kg=None,
                        contribution_tco2e=_as_float(r["contribution_tco2e"]),
                        contribution_pct=(
                            round(_as_float(r["contribution_tco2e"]) / total_tco2e * 100.0, 4)
                            if r["contribution_tco2e"] is not None and total_tco2e else None
                        ),
                        unresolved_line_count=int(r["unresolved_line_count"] or 0),
                    )
                    for r in rows
                ]
            else:
                cur.execute(
                    f"""
                    SELECT mm.material_id AS key,
                           COUNT(DISTINCT r.id) AS line_count,
                           SUM(pl.spend_amount) AS spend_amount,
                           SUM(r.result_tco2e) AS contribution_tco2e,
                           COUNT(DISTINCT r.id) FILTER (
                               WHERE r.calculation_method = 'unresolved'
                           ) AS unresolved_line_count
                    FROM procurement_line_results r
                    JOIN purchase_lines pl
                      ON pl.id = r.purchase_line_id AND pl.company_id = r.company_id
                    JOIN bom_items bi
                      ON bi.supplier_product_id = r.supplier_product_id
                      AND bi.company_id = r.company_id
                    JOIN material_mappings mm
                      ON mm.bom_item_id = bi.id AND mm.company_id = bi.company_id
                      AND mm.review_status = 'accepted'
                    WHERE r.{_SCOPE} AND r.run_id = %s AND mm.material_id IS NOT NULL
                    GROUP BY 1
                    ORDER BY SUM(r.result_tco2e) DESC NULLS LAST, 1
                    LIMIT %s
                    """,
                    (company_id, run_id, limit),
                )
                rows = [dict(r) for r in cur.fetchall()]
                items = [
                    ExposureRow(
                        key=r["key"], label=r["key"], line_count=int(r["line_count"]),
                        spend_amount=_as_float(r["spend_amount"]), mass_kg=None,
                        contribution_tco2e=_as_float(r["contribution_tco2e"]),
                        contribution_pct=(
                            round(_as_float(r["contribution_tco2e"]) / total_tco2e * 100.0, 4)
                            if r["contribution_tco2e"] is not None and total_tco2e else None
                        ),
                        unresolved_line_count=int(r["unresolved_line_count"] or 0),
                    )
                    for r in rows
                ]

    return ExposureData(run_id=run_id, dimension=dimension, items=items)


# ---------------------------------------------------------------------------
# Sélection humaine
# ---------------------------------------------------------------------------

def _row_to_selection(row: dict[str, Any]) -> HotspotSelectionResponse:
    data = dict(row)
    for key in ("contribution_tco2e", "contribution_pct"):
        data[key] = _as_float(data.get(key))
    return HotspotSelectionResponse(**data)


def select_hotspot(
    *, company_id: int, payload: HotspotSelectionCreate, selected_by: int | None = None,
) -> HotspotSelectionResponse:
    """Enregistre la décision humaine sur un hotspot (retenu ou écarté).

    Idempotent par `(run, type, clé)` : re-sélectionner met à jour la ligne
    existante plutôt que d'en empiler une seconde. Les chiffres de contribution
    sont RELUS depuis le run au moment de la sélection — jamais recopiés depuis
    le client, qui pourrait envoyer n'importe quoi."""
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            _assert_run_in_scope(cur, company_id, payload.run_id)

            snapshot = detect_hotspots(
                company_id=company_id, run_id=payload.run_id,
                hotspot_type=payload.hotspot_type, limit=500,
            )
            match = next(
                (h for h in snapshot.items if h.hotspot_key == payload.hotspot_key), None
            )
            if match is None:
                raise HotspotError(
                    f"Hotspot '{payload.hotspot_key}' introuvable dans le run "
                    f"'{payload.run_id}' pour la dimension '{payload.hotspot_type}'."
                )

            supplier_id = match.supplier_id if payload.hotspot_type == "supplier" else None
            if supplier_id is not None:
                cur.execute(
                    "SELECT 1 FROM suppliers WHERE id = %s AND company_id = %s",
                    (supplier_id, company_id),
                )
                if cur.fetchone() is None:
                    supplier_id = None

            cur.execute(
                """
                INSERT INTO procurement_hotspot_selections
                    (company_id, run_id, hotspot_type, hotspot_key, hotspot_label, supplier_id,
                     contribution_tco2e, contribution_pct, rank_position, selection_status,
                     selection_reason, selected_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_id, run_id, hotspot_type, hotspot_key) DO UPDATE SET
                    hotspot_label = EXCLUDED.hotspot_label,
                    supplier_id = EXCLUDED.supplier_id,
                    contribution_tco2e = EXCLUDED.contribution_tco2e,
                    contribution_pct = EXCLUDED.contribution_pct,
                    rank_position = EXCLUDED.rank_position,
                    selection_status = EXCLUDED.selection_status,
                    selection_reason = EXCLUDED.selection_reason,
                    selected_by = EXCLUDED.selected_by,
                    selected_at = now(),
                    updated_at = now()
                RETURNING *
                """,
                (
                    company_id, payload.run_id, payload.hotspot_type, payload.hotspot_key,
                    payload.hotspot_label or match.hotspot_label, supplier_id,
                    match.contribution_tco2e, match.contribution_pct, match.rank_position,
                    payload.selection_status, payload.selection_reason, selected_by,
                ),
            )
            row = dict(cur.fetchone())
    return _row_to_selection(row)


def list_selections(
    *, company_id: int, run_id: int | None = None, limit: int = 50, offset: int = 0,
) -> tuple[list[HotspotSelectionResponse], int]:
    clauses = [_SCOPE]
    params: list[Any] = [company_id]
    if run_id is not None:
        clauses.append("run_id = %s")
        params.append(run_id)
    where = f"WHERE {' AND '.join(clauses)}"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT COUNT(*) AS c FROM procurement_hotspot_selections {where}", params
            )
            total = cur.fetchone()["c"]
            cur.execute(
                f"SELECT * FROM procurement_hotspot_selections {where} "
                "ORDER BY rank_position NULLS LAST, id LIMIT %s OFFSET %s",
                (*params, limit, offset),
            )
            rows = cur.fetchall()
    return [_row_to_selection(dict(r)) for r in rows], total


# ---------------------------------------------------------------------------
# Campagne fournisseur depuis un hotspot retenu — CONTRÔLÉE
# ---------------------------------------------------------------------------

def create_campaign_from_selection(
    *,
    company_id: int,
    selection_id: int,
    payload: CampaignFromHotspotRequest,
    created_by: str | None = None,
) -> CampaignFromHotspotResponse:
    """Crée une campagne de collecte ciblée sur le fournisseur d'un hotspot retenu.

    Contrôles explicites, tous refusés bruyamment plutôt que contournés :
      - la sélection doit appartenir au tenant ;
      - elle doit être au statut `selected` (une sélection écartée ou déjà
        transformée ne redonne pas lieu à une campagne) ;
      - elle doit être de type `supplier` et porter un `supplier_id` du tenant —
        on ne lance pas une collecte « sur une catégorie », il n'y a personne à
        interroger au bout.

    Le moteur de campagnes (024) est réutilisé tel quel : création + invitation
    tokenisée + revue des réponses restent son affaire."""
    from services import supplier_campaigns_service as campaigns

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT * FROM procurement_hotspot_selections WHERE id = %s AND {_SCOPE}",
                (selection_id, company_id),
            )
            row = cur.fetchone()
            if row is None:
                raise HotspotError(f"Sélection '{selection_id}' introuvable.")
            selection = dict(row)

            if selection["selection_status"] != "selected":
                raise HotspotError(
                    f"Sélection '{selection_id}' au statut '{selection['selection_status']}' — "
                    "seule une sélection retenue ('selected') donne lieu à une campagne."
                )
            if selection["hotspot_type"] != "supplier":
                raise HotspotError(
                    f"Sélection '{selection_id}' de type '{selection['hotspot_type']}' — "
                    "une campagne ne peut cibler qu'un hotspot fournisseur."
                )
            supplier_id = selection["supplier_id"]
            if supplier_id is None:
                raise HotspotError(
                    f"Sélection '{selection_id}' sans fournisseur identifié — "
                    "aucune campagne possible."
                )
            cur.execute(
                "SELECT id FROM suppliers WHERE id = %s AND company_id = %s",
                (supplier_id, company_id),
            )
            if cur.fetchone() is None:
                raise HotspotError(
                    f"Fournisseur '{supplier_id}' introuvable ou hors périmètre."
                )

    campaign = campaigns.create_campaign(
        campaigns.CampaignCreate(
            name=payload.campaign_name,
            exercise_year=payload.exercise_year,
            deadline=payload.deadline,
        ),
        company_id,
        created_by,
    )
    invites = campaigns.invite_suppliers(campaign.id, company_id, [supplier_id])

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE procurement_hotspot_selections
                SET selection_status = 'campaign_created', campaign_id = %s, updated_at = now()
                WHERE id = %s AND {_SCOPE}
                RETURNING *
                """,
                (campaign.id, selection_id, company_id),
            )
            updated = dict(cur.fetchone())

    return CampaignFromHotspotResponse(
        selection=_row_to_selection(updated),
        campaign_id=campaign.id,
        campaign_name=campaign.name,
        invited_supplier_ids=[i.supplier_id for i in invites],
    )
