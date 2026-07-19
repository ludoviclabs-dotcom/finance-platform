"""
evidence_pack.py — Evidence Pack d'un run Scope 3 cat. 1 (PR-05B).

Produit une archive AUTO-SUFFISANTE permettant de rejouer et de contester un
calcul sans accès à la plateforme :

    manifest.json        signature canonique (SHA-256 de chaque fichier), sans date
    run.json             méthodologie versionnée, snapshot d'ENTRÉE immuable,
                         versions de facteurs, avertissements du run
    line_results.json    CHAQUE ligne : méthode, rang, facteur (id + version),
                         conversion d'unité explicite, incertitude, et la
                         RAISON DE REPLI quand le rang n'est pas 1
    coverage.json        couverture, répartition par méthode, lignes non résolues
    methodology.md       la hiérarchie appliquée, en clair
    README.txt           mode d'emploi de la vérification
    CHECKSUMS.sha256     table de contrôle au format `sha256sum -c`

Réutilise **le mécanisme d'export existant** (`services/export_package.py`) :
mêmes helpers de hash et de checksums, même forme de `manifest.json`, même
enregistrement dans `export_packages`. Conséquence directe : `inspect_zip()` et
`verify_zip()` — donc la page publique `/verify/{hash}` — fonctionnent sur un
Evidence Pack de run sans une ligne de code supplémentaire. Aucun second
mécanisme de preuve n'est introduit (contrats §3).

Le manifest ne contient AUCUN horodatage : deux exports du même run produisent
le même `manifest_hash`, ce qui rend la reproductibilité vérifiable de
l'extérieur.
"""

from __future__ import annotations

import io
import json
import logging
import zipfile
from typing import Any

from db.database import db_available, get_db
from services.export_package import (
    MANIFEST_VERSION,
    _checksums_file,
    _sha256_hex,
)
from services.procurement import calculation_run_service as runs

logger = logging.getLogger(__name__)

# Domaine d'export dédié — distingue un pack de run des packs consolidés
# historiques dans `export_packages`.
EVIDENCE_PACK_DOMAIN = "procurement_scope3"


class EvidencePackError(Exception):
    """Erreur de génération d'un Evidence Pack de run."""


def _canonical_json(payload: Any) -> bytes:
    """JSON canonique : clés triées, indentation fixe, pas d'échappement ASCII.
    Deux exports des mêmes données produisent des octets identiques."""
    return json.dumps(
        payload, sort_keys=True, indent=2, ensure_ascii=False, default=str
    ).encode("utf-8")


_METHODOLOGY_DOC = """# Méthodologie appliquée — {code} v{version}

Hiérarchie Scope 3 catégorie 1 (achats de biens et services). Les niveaux sont
essayés **dans cet ordre**, sans exception :

| Rang | Méthode | Condition d'application |
|---|---|---|
| 1 | `supplier_pcf_verified` | PCF fournisseur vérifiée par un tiers ET unité comparable à la ligne |
| 2 | `supplier_specific_hybrid` | PCF auto-déclarée comparable, ou intensité GES déclarée par le fournisseur (acceptée en revue) appliquée à la dépense |
| 3 | `average_physical` | Facteur physique moyen appliqué à une masse issue de la nomenclature (BOM) ou à la quantité de la ligne |
| 4 | `spend_based_economic` | Facteur monétaire appliqué à la dépense |
| 5 | `unresolved` | Aucun niveau applicable — **aucune valeur n'est produite** |

## Règles non négociables

1. **Aucun repli silencieux.** Toute ligne dont le rang retenu n'est pas 1 porte
   une `fallback_reason` non vide, qui énumère pourquoi chaque niveau supérieur a
   été écarté. Cette obligation est également contrainte en base de données.
2. **Aucune valeur inventée.** Une ligne non résolue a `result_tco2e = null`,
   jamais `0` : un trou de donnée n'est pas une émission nulle. Ces lignes
   restent présentes dans `line_results.json`.
3. **Conversion d'unité explicite.** Chaque ligne conserve `conversion_factor`,
   `converted_unit` et `conversion_note`. Deux unités de dimensions différentes
   ne sont jamais rapprochées.
4. **Total partiel signalé.** Le total ne se lit jamais seul : `coverage.json`
   donne le taux de couverture et le volume non résolu.
5. **Incertitude conventionnelle.** Les bandes d'incertitude par méthode sont des
   PARAMÈTRES de la méthodologie versionnée ci-dessus, pas une incertitude
   mesurée sur la donnée du fournisseur.
6. **Aucun modèle de langage** n'intervient dans le calcul ni dans le choix de
   méthode.

## Vérifier ce pack

```
sha256sum -c CHECKSUMS.sha256
```

Le `manifest.json` ne contient aucune date : deux exports du même run doivent
produire un `manifest.json` identique au bit près.
"""


_README = """CarbonCo — Evidence Pack d'un run Scope 3 catégorie 1 (achats)
================================================================

Run                : #{run_id}
Méthodologie       : {code} v{version}
Empreinte d'entrée : {fingerprint}
Total calculé      : {total} tCO2e
Couverture         : {coverage} % des lignes ({unresolved} non résolue(s))

Contenu
-------
  manifest.json      signature canonique (SHA-256 par fichier), sans date
  run.json           méthodologie, snapshot d'entrée immuable, versions de facteurs
  line_results.json  chaque ligne : méthode, facteur, conversion, raison de repli
  coverage.json      couverture et répartition par méthode
  methodology.md     la hiérarchie appliquée, en clair
  CHECKSUMS.sha256   table de contrôle

Vérification
------------
  1) Intégrité interne :   sha256sum -c CHECKSUMS.sha256
  2) Authenticité :        déposer ce ZIP sur la page /verify de la plateforme.
     Le hash du manifest est enregistré à l'émission ; une archive modifiée
     ressort « altered ».

Lecture honnête des chiffres
----------------------------
Le total ci-dessus ne couvre QUE les lignes résolues. Les lignes non résolues
sont conservées dans line_results.json avec la raison de chaque échec — elles ne
valent pas zéro, elles ne sont pas calculées.
"""


def build_run_evidence_pack(
    *, company_id: int, run_id: int, generated_by: int | None = None,
) -> dict[str, Any]:
    """Construit (et enregistre) l'Evidence Pack d'un run.

    Renvoie `{package_hash, manifest_hash, filename, zip_bytes, size_bytes,
    manifest}`. L'enregistrement dans `export_packages` rend le pack vérifiable
    publiquement via `/verify/{hash}` — même chemin que les exports existants.
    """
    run = runs.get_run(company_id=company_id, run_id=run_id)
    coverage = runs.get_coverage(company_id=company_id, run_id=run_id)

    line_results, total_lines = runs.list_line_results(
        company_id=company_id, run_id=run_id, limit=100_000, offset=0,
    )

    run_payload = {
        "run_id": run.id,
        "methodology": {
            "code": run.methodology_code,
            "version": run.methodology_version,
        },
        "scope": {
            "import_id": run.import_id,
            "period_start": run.period_start,
            "period_end": run.period_end,
        },
        "input_fingerprint": run.input_fingerprint,
        "input_snapshot": run.input_snapshot,
        "factor_versions": run.factor_versions,
        "result": run.result,
        "warnings": run.warnings,
        "confidence_0_1": run.confidence,
        "coverage_pct": run.coverage_pct,
        "line_count": run.line_count,
        "unresolved_count": run.unresolved_count,
        "total_tco2e": run.total_tco2e,
        "status": run.status,
        "approved_at": run.approved_at,
    }

    lines_payload = {
        "run_id": run.id,
        "line_count": total_lines,
        "note": (
            "Les lignes non résolues (calculation_method='unresolved') sont "
            "conservées avec result_tco2e=null et leur raison : un trou de donnée "
            "n'est pas une émission nulle."
        ),
        "lines": [
            {
                "purchase_line_id": r.purchase_line_id,
                "supplier_id": r.supplier_id,
                "supplier_product_id": r.supplier_product_id,
                "calculation_method": r.calculation_method,
                "method_rank": r.method_rank,
                "factor_id": r.factor_id,
                "factor_version": r.factor_version,
                "factor_source": r.factor_source,
                "activity_value": r.activity_value,
                "activity_unit": r.activity_unit,
                "converted_value": r.converted_value,
                "converted_unit": r.converted_unit,
                "conversion_factor": r.conversion_factor,
                "conversion_note": r.conversion_note,
                "result_tco2e": r.result_tco2e,
                "uncertainty_pct": r.uncertainty_pct,
                "uncertainty_low_tco2e": r.uncertainty_low_tco2e,
                "uncertainty_high_tco2e": r.uncertainty_high_tco2e,
                "data_quality": r.data_quality,
                "data_status": r.data_status,
                "confidence_0_1": r.confidence,
                "fallback_reason": r.fallback_reason,
                "warnings": r.warnings,
                "method_trace": r.method_trace,
            }
            for r in line_results
        ],
    }

    coverage_payload = coverage.model_dump()

    run_bytes = _canonical_json(run_payload)
    lines_bytes = _canonical_json(lines_payload)
    coverage_bytes = _canonical_json(coverage_payload)
    methodology_bytes = _METHODOLOGY_DOC.format(
        code=run.methodology_code, version=run.methodology_version,
    ).encode("utf-8")
    readme_bytes = _README.format(
        run_id=run.id,
        code=run.methodology_code,
        version=run.methodology_version,
        fingerprint=run.input_fingerprint,
        total=run.total_tco2e if run.total_tco2e is not None else "non calculé",
        coverage=run.coverage_pct if run.coverage_pct is not None else "n/a",
        unresolved=run.unresolved_count,
    ).encode("utf-8")

    # Manifest : signature canonique, SANS horodatage (reproductibilité).
    manifest: dict[str, Any] = {
        "manifest_version": MANIFEST_VERSION,
        "company_id": company_id,
        "domain": EVIDENCE_PACK_DOMAIN,
        "run_id": run.id,
        "methodology_code": run.methodology_code,
        "methodology_version": run.methodology_version,
        "input_fingerprint": run.input_fingerprint,
        "files": {
            "run.json": {"sha256": _sha256_hex(run_bytes), "size": len(run_bytes)},
            "line_results.json": {"sha256": _sha256_hex(lines_bytes), "size": len(lines_bytes)},
            "coverage.json": {"sha256": _sha256_hex(coverage_bytes), "size": len(coverage_bytes)},
            "methodology.md": {
                "sha256": _sha256_hex(methodology_bytes), "size": len(methodology_bytes),
            },
        },
        "stats": {
            "line_count": run.line_count,
            "unresolved_count": run.unresolved_count,
            "total_tco2e": run.total_tco2e,
            "coverage_pct": run.coverage_pct,
            "method_counts": (run.result or {}).get("method_counts", {}),
        },
    }
    manifest_bytes = _canonical_json(manifest)
    manifest_hash = _sha256_hex(manifest_bytes)

    embedded: dict[str, bytes] = {
        "manifest.json": manifest_bytes,
        "run.json": run_bytes,
        "line_results.json": lines_bytes,
        "coverage.json": coverage_bytes,
        "methodology.md": methodology_bytes,
        "README.txt": readme_bytes,
    }
    checksums_bytes = _checksums_file(embedded)

    buf = io.BytesIO()
    # Horodatage ZIP figé : sans cela, deux exports du même run donneraient des
    # octets différents et `package_hash` ne serait pas reproductible.
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, data in sorted(embedded.items()):
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, data)
        info = zipfile.ZipInfo("CHECKSUMS.sha256", date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        zf.writestr(info, checksums_bytes)

    zip_bytes = buf.getvalue()
    package_hash = _sha256_hex(zip_bytes)
    filename = f"carbonco-scope3-run-{run.id}-{package_hash[:12]}.zip"

    if db_available():
        try:
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO export_packages
                            (company_id, package_hash, manifest_hash, domain, filename,
                             size_bytes, event_count, frozen_count, generated_by, meta)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s, %s)
                        ON CONFLICT (package_hash) DO NOTHING
                        """,
                        (
                            company_id, package_hash, manifest_hash, EVIDENCE_PACK_DOMAIN,
                            filename, len(zip_bytes), run.line_count, generated_by,
                            json.dumps({
                                "run_id": run.id,
                                "methodology_code": run.methodology_code,
                                "methodology_version": run.methodology_version,
                                "input_fingerprint": run.input_fingerprint,
                            }),
                        ),
                    )
        except Exception as exc:  # pragma: no cover - best effort, jamais bloquant
            logger.warning("Enregistrement Evidence Pack run %s échoué : %s", run.id, exc)

    return {
        "package_hash": package_hash,
        "manifest_hash": manifest_hash,
        "filename": filename,
        "zip_bytes": zip_bytes,
        "size_bytes": len(zip_bytes),
        "manifest": manifest,
    }
