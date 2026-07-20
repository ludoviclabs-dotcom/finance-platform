"""
import_water_risk_areas.py — CLI d'administration : ingestion du référentiel
de zones de stress hydrique (PR-08A).

GESTE OPÉRATEUR, hors de toute requête HTTP (plan PR-08 §7 : « aucun endpoint
d'écriture exposé aux utilisateurs pour ce référentiel » — même discipline que
db/intelligence_cli.py). Lit un fichier GeoJSON local (FeatureCollection dont
chaque feature porte `properties.code`, `properties.label`,
`properties.stress_category` et une géométrie Polygon/MultiPolygon), et
enregistre chaque zone via `risk_areas_service.register_area` :

  * `--source-release` OBLIGATOIRE — aucune zone sans release enregistrée ;
  * licence évaluée par license_policy (allow_store requis) ;
  * `--company-id` absent = lignes GLOBALES (get_admin_db + app.rls_bypass).

Usage :
    python scripts/import_water_risk_areas.py \
        --file zones.geojson --source-release 12 [--company-id 3] \
        [--scenario baseline] [--kind basin] [--data-status estimated]

Aucun réseau, aucun LLM : le fichier est LOCAL, sa provenance est documentée
par la release Evidence Kernel citée.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.water import risk_areas_service  # noqa: E402

EXIT_OK = 0
EXIT_ERROR = 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ingestion du référentiel water_risk_areas")
    parser.add_argument("--file", required=True, help="Fichier GeoJSON (FeatureCollection)")
    parser.add_argument("--source-release", type=int, required=True,
                        help="ID de la release source (Evidence Kernel) — obligatoire")
    parser.add_argument("--company-id", type=int, default=None,
                        help="Tenant cible ; absent = lignes GLOBALES (admin)")
    parser.add_argument("--scenario", default="baseline")
    parser.add_argument("--kind", default="basin",
                        choices=["basin", "aquifer", "administrative", "custom"])
    parser.add_argument("--horizon-year", type=int, default=None)
    parser.add_argument("--data-status", default="estimated",
                        choices=["verified", "estimated", "manual", "inferred"])
    args = parser.parse_args(argv)

    try:
        payload = json.loads(Path(args.file).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"ERREUR : fichier illisible — {exc}", file=sys.stderr)
        return EXIT_ERROR

    features = payload.get("features") if isinstance(payload, dict) else None
    if not isinstance(features, list) or not features:
        print("ERREUR : FeatureCollection GeoJSON attendue (clé 'features' non vide).",
              file=sys.stderr)
        return EXIT_ERROR

    registered = 0
    for idx, feature in enumerate(features):
        props = feature.get("properties") or {}
        code = props.get("code")
        label = props.get("label") or code
        stress = props.get("stress_category")
        geometry = feature.get("geometry")
        if not code or not stress or not geometry:
            print(f"ERREUR : feature {idx} incomplète (code/stress_category/geometry requis) "
                  "— import interrompu, rien d'autre n'est écrit.", file=sys.stderr)
            return EXIT_ERROR
        try:
            area = risk_areas_service.register_area(
                company_id=args.company_id,
                code=str(code),
                label=str(label),
                boundary_geojson=geometry,
                baseline_stress_category=str(stress),
                source_release_id=args.source_release,
                area_kind=args.kind,
                scenario_code=args.scenario,
                horizon_year=args.horizon_year,
                data_status=args.data_status,
            )
        except risk_areas_service.WaterRiskAreaError as exc:
            print(f"ERREUR : feature {idx} ('{code}') refusée — {exc}", file=sys.stderr)
            return EXIT_ERROR
        registered += 1
        print(f"OK : zone '{area.code}' enregistrée (id={area.id}, "
              f"portée={'globale' if area.company_id is None else area.company_id})")

    print(f"Terminé : {registered} zone(s) enregistrée(s).")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
