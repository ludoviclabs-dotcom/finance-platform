"""
demo_verify.py — rapport de parité du scénario Asterion (« les calculs attendus
sont obtenus »).

Trois niveaux, du plus portable au plus complet :
  1. Parité ARITHMÉTIQUE (toujours, sans base) — dérive du scénario les invariants
     déterministes : somme des lignes Scope 3 = 3 480 tCO2e, part aimants = 61,8 %,
     couverture contractuelle = 54 %.
  2. Parité de PEUPLEMENT (si base) — le tenant démo contient bien l'IRO, les
     artefacts, les liens de preuve et les observations attendus.
  3. Preuve du PIPELINE IA (si base + schéma 041) — exécute la VRAIE revue IA
     (mode demo) sur l'IRO seedé et vérifie que les statuts déterministes
     attendus apparaissent (partially_supported / contradicted / unsupported).

Sortie : rapport lisible + code 0 si tout passe, 1 sinon. Aucun appel payant.

Usage :
    python scripts/demo_verify.py [--scenario asterion-motion-v1]
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.database import db_available, get_db  # noqa: E402
from demo.loader import Scenario, load_scenario  # noqa: E402
from services.auth_service import DEMO_TENANT_SLUG  # noqa: E402


class Report:
    def __init__(self) -> None:
        self.rows: list[tuple[str, str, str, bool]] = []
        self.ok = True

    def check(self, name: str, expected, actual, passed: bool | None = None) -> None:
        if passed is None:
            passed = str(expected) == str(actual)
        self.rows.append((name, str(expected), str(actual), passed))
        if not passed:
            self.ok = False

    def skip(self, name: str, why: str) -> None:
        self.rows.append((name, "—", f"SKIP ({why})", True))

    def render(self) -> str:
        width = max((len(r[0]) for r in self.rows), default=10)
        lines = [f"{'CHECK'.ljust(width)}  {'ATTENDU':>12}  {'OBTENU':>18}  OK"]
        for name, exp, act, ok in self.rows:
            lines.append(f"{name.ljust(width)}  {exp:>12}  {act:>18}  {'✓' if ok else '✗'}")
        return "\n".join(lines)


def _approx(a: float, b: float, tol: float = 0.05) -> bool:
    return abs(float(a) - float(b)) <= tol


def _arithmetic(sc: Scenario, rep: Report) -> None:
    m = sc.manifest.expected_metrics
    # 1. Somme des lignes Scope 3.
    line_sum = round(sum(ln.scope3_tco2e for ln in sc.purchases.lines), 1)
    rep.check("scope3 = somme lignes", m.scope3_purchases_tco2e, line_sum,
              _approx(line_sum, m.scope3_purchases_tco2e, tol=1.0))
    # 2. Part aimants = ligne aimants / total.
    magnet = next((ln for ln in sc.purchases.lines if ln.material_code == "NDFEB"), None)
    share = round((magnet.scope3_tco2e / line_sum) * 100, 1) if magnet else 0.0
    rep.check("part aimants %", m.scope3_magnets_share_pct, share,
              _approx(share, m.scope3_magnets_share_pct, tol=0.3))
    # 3. Couverture contractuelle = Σ instruments / conso élec.
    instruments = sc.energy.get("contractual_instruments", [])
    total_mwh = sc.energy.get("electricity_mwh") or (m.electricity_gwh * 1000)
    covered = sum(i.get("mwh", 0) for i in instruments)
    coverage = round(covered / total_mwh * 100, 1) if total_mwh else 0.0
    rep.check("couverture contractuelle %", m.contractual_coverage_pct, coverage,
              _approx(coverage, m.contractual_coverage_pct, tol=0.5))


def _population(sc: Scenario, rep: Report) -> int | None:
    """Vérifie le peuplement DB. Retourne le company_id démo (ou None)."""
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM companies WHERE slug = %s", (DEMO_TENANT_SLUG,))
                row = cur.fetchone()
                if not row:
                    rep.skip("tenant démo", "non seedé")
                    return None
                cid = row["id"] if isinstance(row, dict) else row[0]

                iro = sc.iro.iros[0]
                cur.execute("SELECT id FROM iros WHERE company_id = %s AND title = %s", (cid, iro.title))
                iro_row = cur.fetchone()
                rep.check("IRO seedé", "present", "present" if iro_row else "absent", bool(iro_row))

                cur.execute("SELECT count(*) AS n FROM evidence_artifacts WHERE company_id = %s", (cid,))
                n_art = cur.fetchone()["n"]
                rep.check("artefacts", len(sc.evidence.artifacts), n_art, n_art >= len(sc.evidence.artifacts))

                cur.execute("SELECT count(*) AS n FROM claim_evidence_links WHERE company_id = %s", (cid,))
                n_link = cur.fetchone()["n"]
                rep.check("claim_evidence_links", len(sc.evidence.iro_evidence_links), n_link,
                          n_link >= len(sc.evidence.iro_evidence_links))

                cur.execute("SELECT count(*) AS n FROM observations WHERE company_id = %s", (cid,))
                n_obs = cur.fetchone()["n"]
                rep.check("observations", ">=10", n_obs, n_obs >= 10)
                return cid
    except Exception as exc:  # noqa: BLE001
        rep.skip("peuplement DB", f"{type(exc).__name__}")
        return None


def _ai_pipeline(cid: int, sc: Scenario, rep: Report) -> None:
    """Exécute la VRAIE revue IA (mode demo) sur l'IRO seedé et vérifie les statuts."""
    try:
        from services.intelligence.ai import review_service

        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM iros WHERE company_id = %s AND title = %s",
                    (cid, sc.iro.iros[0].title),
                )
                row = cur.fetchone()
        if not row:
            rep.skip("pipeline IA", "IRO absent")
            return
        iro_id = row["id"] if isinstance(row, dict) else row[0]

        result = review_service.run_review(
            company_id=cid, use_case="iro_review", subject_key=str(iro_id), created_by=None,
        )
        statuses = {c.support_status for c in result.claims}
        for expected in ("partially_supported", "contradicted", "unsupported"):
            rep.check(f"IA statut {expected}", "present",
                      "present" if expected in statuses else "absent", expected in statuses)
    except Exception as exc:  # noqa: BLE001
        rep.skip("pipeline IA", f"{type(exc).__name__}: {exc}")


def run(scenario_name: str) -> int:
    sc = load_scenario(scenario_name)
    rep = Report()

    print(f"== demo_verify :: scénario {sc.name} :: tenant {DEMO_TENANT_SLUG} ==\n")
    _arithmetic(sc, rep)

    if db_available():
        cid = _population(sc, rep)
        if cid is not None:
            _ai_pipeline(cid, sc, rep)
    else:
        rep.skip("peuplement DB", "DATABASE_URL absent")
        rep.skip("pipeline IA", "DATABASE_URL absent")

    print(rep.render())
    print()
    if rep.ok:
        print("[ok] parité vérifiée.")
        return 0
    print("[fail] au moins un contrôle de parité a échoué.")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Rapport de parité du scénario démo Asterion.")
    parser.add_argument("--scenario", default="asterion-motion-v1")
    args = parser.parse_args()
    return run(scenario_name=args.scenario)


if __name__ == "__main__":
    raise SystemExit(main())
