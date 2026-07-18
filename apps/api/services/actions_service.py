"""
actions_service.py — T5.1 (MACC) + T5.2 (plan de transition).

Une action de réduction porte un CapEx (€), une réduction annuelle (tCO2e/an) et
une durée de vie (ans). Le coût marginal d'abattement est PUR :

    coût marginal (€/tCO2e) = CapEx / (réduction_annuelle × durée_de_vie)

La MACC trie les actions par coût marginal croissant (largeur de barre = potentiel
d'abattement sur la durée de vie = réduction × durée → l'aire de la barre = CapEx).
La trajectoire projetée retranche les réductions des actions selon leur statut.
Tout est CALCULÉ en lecture ; rien n'est ré-émis comme fact (la chaîne de preuve
reste la source des émissions). Par-organisation → RLS.
"""

from __future__ import annotations

import logging
from typing import Any

from db.database import db_available, get_db
from services.carbon import scope2_selection

logger = logging.getLogger(__name__)

STATUSES = ("proposed", "committed", "done")


class ActionError(Exception):
    """Action invalide."""


# ---------------------------------------------------------------------------
# Cœur PUR (testable sans DB)
# ---------------------------------------------------------------------------

def marginal_cost(capex: float | None, reduction_tco2e: float | None,
                  lifespan_years: float | None) -> float | None:
    """Coût marginal d'abattement €/tCO2e = CapEx / (réduction × durée).

    None si une donnée manque ou si le potentiel (réduction × durée) est ≤ 0
    (une action sans réduction n'a pas de coût marginal défini).
    """
    if capex is None or reduction_tco2e is None or lifespan_years is None:
        return None
    potential = float(reduction_tco2e) * float(lifespan_years)
    if potential <= 0:
        return None
    return round(float(capex) / potential, 2)


def lifetime_potential(reduction_tco2e: float | None, lifespan_years: float | None) -> float:
    """Potentiel d'abattement sur la durée de vie = réduction annuelle × durée."""
    if reduction_tco2e is None or lifespan_years is None:
        return 0.0
    return round(float(reduction_tco2e) * float(lifespan_years), 6)


def build_macc(actions: list[dict[str, Any]]) -> dict[str, Any]:
    """Construit la courbe MACC. Fonction PURE.

    Trie par coût marginal croissant ; cumule le potentiel. Les actions sans coût
    marginal calculable (donnée manquante) sont retournées à part (non chiffrées),
    jamais masquées.
    """
    priced: list[dict[str, Any]] = []
    unpriced: list[dict[str, Any]] = []
    for a in actions:
        mc = marginal_cost(a.get("capex"), a.get("reduction_tco2e"), a.get("lifespan_years"))
        pot = lifetime_potential(a.get("reduction_tco2e"), a.get("lifespan_years"))
        bar = {
            "id": a.get("id"),
            "title": a.get("title"),
            "status": a.get("status"),
            "marginal_cost": mc,
            "potential_tco2e": pot,
            "capex": float(a["capex"]) if a.get("capex") is not None else None,
        }
        (priced if mc is not None and pot > 0 else unpriced).append(bar)

    priced.sort(key=lambda b: b["marginal_cost"])
    cumulative = 0.0
    for b in priced:
        b["cumulative_start"] = round(cumulative, 6)
        cumulative += b["potential_tco2e"]
        b["cumulative_end"] = round(cumulative, 6)

    return {
        "bars": priced,
        "unpriced": unpriced,
        "total_potential_tco2e": round(cumulative, 6),
        "total_capex": round(sum(b["capex"] or 0.0 for b in priced), 2),
    }


def project_trajectory(baseline_tco2e: float, actions: list[dict[str, Any]],
                       years: int = 5) -> dict[str, Any]:
    """Trajectoire projetée vs référence. Fonction PURE.

    Référence = émissions constantes (baseline). Les actions retranchent leur
    réduction annuelle selon leur statut (réalisé < engagé < potentiel total).
    Modèle volontairement simple (réduction appliquée à plein), documenté : pas
    de phasage par jalon en P5 (jalon stocké, exploité ultérieurement).
    """
    def _sum(stat: set[str]) -> float:
        return round(sum(float(a.get("reduction_tco2e") or 0.0)
                         for a in actions if a.get("status") in stat), 6)

    done = _sum({"done"})
    committed = _sum({"done", "committed"})
    total = _sum({"done", "committed", "proposed"})
    n = max(1, int(years))
    flat = [round(baseline_tco2e, 6)] * n

    def _line(reduction: float) -> list[float]:
        return [round(max(0.0, baseline_tco2e - reduction), 6)] * n

    return {
        "baseline_tco2e": round(baseline_tco2e, 6),
        "years": n,
        "reference": flat,
        "projected_done": _line(done),
        "projected_committed": _line(committed),
        "potential": _line(total),
        "reductions": {
            "done": done,
            "committed": round(committed - done, 6),
            "proposed": round(total - committed, 6),
            "total": total,
        },
    }


# ---------------------------------------------------------------------------
# DB (RLS) — sous skipif dans les tests
# ---------------------------------------------------------------------------

_COLS = ("id", "company_id", "site_id", "title", "description", "status", "owner", "milestone",
         "capex", "reduction_tco2e", "lifespan_years", "target_code", "created_at", "updated_at")
_NUM = {"capex", "reduction_tco2e", "lifespan_years"}


def _row(r: dict[str, Any]) -> dict[str, Any]:
    out = {k: r.get(k) for k in _COLS}
    for k in _NUM:
        if out.get(k) is not None:
            out[k] = float(out[k])
    for k in ("milestone", "created_at", "updated_at"):
        if out.get(k) is not None:
            out[k] = str(out[k])
    return out


def list_actions(company_id: int, site_id: int | None = None) -> list[dict[str, Any]]:
    """Actions de la company — optionnellement filtrées sur un site.

    site_id=None = « entreprise entière » (rollup groupe, comportement
    historique). Le filtre alimente la MACC par site ; les fonctions pures
    build_macc/project_trajectory ne changent pas.
    """
    if not db_available():
        return []
    where = "company_id = %s"
    params: list[Any] = [company_id]
    if site_id is not None:
        where += " AND site_id = %s"
        params.append(site_id)
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT {', '.join(_COLS)} FROM actions WHERE {where} "
                "ORDER BY created_at DESC",
                params,
            )
            return [_row(r) for r in cur.fetchall()]


def create_action(company_id: int, *, title: str, description: str | None = None,
                  owner: str | None = None, milestone: str | None = None,
                  capex: float | None = None, reduction_tco2e: float | None = None,
                  lifespan_years: float | None = None, target_code: str | None = None,
                  site_id: int | None = None, actor: str | None = None) -> dict[str, Any]:
    if not title or not title.strip():
        raise ActionError("Titre obligatoire.")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO actions
                   (company_id, site_id, title, description, status, owner, milestone, capex,
                    reduction_tco2e, lifespan_years, target_code)
                   VALUES (%s,%s,%s,%s,'proposed',%s,%s,%s,%s,%s,%s)
                   RETURNING """ + ", ".join(_COLS),
                (company_id, site_id, title.strip(), description, owner, milestone, capex,
                 reduction_tco2e, lifespan_years, target_code),
            )
            row = _row(cur.fetchone())
            cur.execute(
                "INSERT INTO action_events (company_id, action_id, status_from, status_to, actor) "
                "VALUES (%s,%s,NULL,'proposed',%s)",
                (company_id, row["id"], actor),
            )
    return row


_EDITABLE = ("title", "description", "owner", "milestone", "capex",
             "reduction_tco2e", "lifespan_years", "target_code", "site_id")


def update_action(company_id: int, action_id: int, patch: dict[str, Any]) -> dict[str, Any]:
    """Met à jour les champs éditables d'une action (PAS le statut — cf. set_status)."""
    fields = {k: v for k, v in patch.items() if k in _EDITABLE}
    if not fields:
        raise ActionError("Aucun champ éditable fourni.")
    set_sql = ", ".join(f"{k} = %s" for k in fields) + ", updated_at = now()"
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE actions SET {set_sql} WHERE id = %s AND company_id = %s "
                "RETURNING " + ", ".join(_COLS),
                (*fields.values(), action_id, company_id),
            )
            row = cur.fetchone()
    if not row:
        raise ActionError("Action introuvable.")
    return _row(row)


def set_status(company_id: int, action_id: int, new_status: str,
               actor: str | None = None) -> dict[str, Any]:
    """Change le statut d'une action et journalise l'événement (append-only)."""
    if new_status not in STATUSES:
        raise ActionError(f"Statut invalide : {new_status} (attendu {STATUSES}).")
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT status FROM actions WHERE id = %s AND company_id = %s",
                        (action_id, company_id))
            cur_row = cur.fetchone()
            if not cur_row:
                raise ActionError("Action introuvable.")
            old = cur_row["status"]
            cur.execute(
                "UPDATE actions SET status = %s, updated_at = now() "
                "WHERE id = %s AND company_id = %s RETURNING " + ", ".join(_COLS),
                (new_status, action_id, company_id),
            )
            row = _row(cur.fetchone())
            cur.execute(
                "INSERT INTO action_events (company_id, action_id, status_from, status_to, actor) "
                "VALUES (%s,%s,%s,%s,%s)",
                (company_id, action_id, old, new_status, actor),
            )
    return row


def delete_action(company_id: int, action_id: int) -> bool:
    if not db_available():
        return False
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM actions WHERE id = %s AND company_id = %s RETURNING id",
                        (action_id, company_id))
            return cur.fetchone() is not None


def list_events(company_id: int, action_id: int) -> list[dict[str, Any]]:
    if not db_available():
        return []
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, action_id, status_from, status_to, actor, created_at "
                "FROM action_events WHERE company_id = %s AND action_id = %s "
                "ORDER BY created_at DESC",
                (company_id, action_id),
            )
            return [{**r, "created_at": str(r["created_at"])} for r in cur.fetchall()]


def baseline_total(company_id: int) -> float:
    """Total GHG courant (tCO2e) depuis facts_current — base de la trajectoire.

    S1 + S2 + S3. Scope 2 : préférence location-based (LB), repli sur market-based
    (MB) si LB ABSENT — sur la présence, pas la valeur (LB = 0 est légitime). Règle
    consolidée dans `services.carbon.scope2_selection` (PR-06A), partagée avec
    beges_export. Scope 3 : agrégat non catégorisé (CC.GES.SCOPE3) + catégories
    (CC.GES.SCOPE3.{n}, Modèle B), disjoints donc sans double comptage. Sans ce
    repli/cette inclusion, la trajectoire sous-estimerait les émissions.
    """
    if not db_available():
        return 0.0
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT code, value FROM facts_current "
                "WHERE company_id = %s AND code LIKE 'CC.GES.%%'",
                (company_id,),
            )
            vals = {r["code"]: float(r["value"]) for r in cur.fetchall() if r["value"] is not None}

    total = vals.get("CC.GES.SCOPE1", 0.0)
    scope2 = scope2_selection.select_scope2_from_facts(vals)
    if scope2 is not None:
        total += scope2.value
    total += sum(v for code, v in vals.items()
                 if code == "CC.GES.SCOPE3" or code.startswith("CC.GES.SCOPE3."))
    return round(total, 6)
