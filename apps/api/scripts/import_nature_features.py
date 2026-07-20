"""
import_nature_features.py — CLI d'administration : ingestion du référentiel
`nature_features` (PR-09 tranche A).

GESTE OPÉRATEUR, hors de toute requête HTTP (même discipline que
`import_water_risk_areas.py`, PR-08 — « aucun endpoint d'écriture exposé aux
utilisateurs pour ce référentiel »). Lit un fichier GeoJSON local
(FeatureCollection dont chaque feature porte `properties.code`,
`properties.label`, `properties.feature_kind` et une géométrie Polygon/
MultiPolygon), et enregistre chaque élément via `features_service.register_feature` :

  * `--source-release` OBLIGATOIRE — aucun élément sans release enregistrée ;
  * licence évaluée par license_policy (allow_store requis) ;
  * `--company-id` absent = lignes GLOBALES (get_admin_db + app.rls_bypass) ;
  * `--sensitivity` par élément lu depuis `properties.sensitivity` (défaut
    'public' si absent) — jamais un défaut 'confidential' deviné, une donnée
    sensible non déclarée par la source est un bug d'import à corriger, pas un
    repli silencieux.

Usage :
    python scripts/import_nature_features.py \
        --file zones.geojson --source-release 12 [--company-id 3] \
        [--data-status estimated]

Aucun réseau, aucun LLM : le fichier est LOCAL, sa provenance est documentée
par la release Evidence Kernel citée. Aucun appel à un service d'espèces ou
d'aires protégées en ligne — même discipline que le géocodage PR-08.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.nature import features_service  # noqa: E402

EXIT_OK = 0
EXIT_ERROR = 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ingestion du référentiel nature_features")
    parser.add_argument("--file", required=True, help="Fichier GeoJSON (FeatureCollection)")
    parser.add_argument("--source-release", type=int, required=True,
                        help="ID de la release source (Evidence Kernel) — obligatoire")
    parser.add_argument("--company-id", type=int, default=None,
                        help="Tenant cible ; absent = lignes GLOBALES (admin)")
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
        feature_kind = props.get("feature_kind") or "ecosystem"
        sensitivity = props.get("sensitivity") or "public"
        geometry = feature.get("geometry")
        if not code or not geometry:
            print(f"ERREUR : feature {idx} incomplète (code/geometry requis) "
                  "— import interrompu, rien d'autre n'est écrit.", file=sys.stderr)
            return EXIT_ERROR
        try:
            registered_feature = features_service.register_feature(
                company_id=args.company_id,
                code=str(code),
                label=str(label),
                boundary_geojson=geometry,
                feature_kind=str(feature_kind),
                sensitivity=str(sensitivity),
                source_release_id=args.source_release,
                data_status=args.data_status,
            )
        except features_service.NatureFeatureError as exc:
            print(f"ERREUR : feature {idx} ('{code}') refusée — {exc}", file=sys.stderr)
            return EXIT_ERROR
        registered += 1
        print(
            f"OK : élément '{registered_feature.code}' enregistré "
            f"(id={registered_feature.id}, sensibilité={registered_feature.sensitivity}, "
            f"portée={'globale' if registered_feature.company_id is None else registered_feature.company_id})"
        )

    print(f"Terminé : {registered} élément(s) enregistré(s).")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
