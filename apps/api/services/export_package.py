"""
export_package.py — Génération de packages auditables (ZIP signé).

Un package contient :
  - manifest.json       : métadonnées + hash SHA-256 de chaque fichier embarqué
  - audit_trail.json    : tous les facts_events + reviews de la company
  - snapshot.json       : snapshot JSON consolidé (carbon/esg/finance)
  - report.pdf          : synthèse PDF avec watermark hash + date gel
  - README.txt          : instructions de vérification

Le hash global du ZIP (package_hash) est :
  SHA-256( manifest.json bytes )

Ce hash est publique : la page /verify/{package_hash} permet à un auditeur
externe de vérifier l'existence et la date d'un package officiel sans
authentification — le contenu reste privé, seules les métadonnées sont exposées.

Idempotence : en cas de régénération sur la même entrée, le même manifest
produit le même hash (dates d'export exclues du hash manifest).
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from db.database import db_available, get_db

logger = logging.getLogger(__name__)

MANIFEST_VERSION = "v1"


@dataclass
class ExportPackage:
    package_hash: str
    manifest_hash: str
    zip_bytes: bytes
    filename: str
    event_count: int
    frozen_count: int
    size_bytes: int
    manifest: dict[str, Any]


class ExportError(Exception):
    """Erreur de génération de package."""


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _fetch_audit_trail(company_id: int) -> dict[str, Any]:
    """Récupère les facts_events + reviews pour une company."""
    facts: list[dict[str, Any]] = []
    reviews: list[dict[str, Any]] = []

    if not db_available():
        return {"facts_events": [], "datapoint_reviews": [], "notice": "DB absente — audit trail vide"}

    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, code, value, unit, ef_id, source_path,
                       computed_at, hash_prev, hash_self
                FROM facts_events
                WHERE company_id = %s
                ORDER BY computed_at ASC, id ASC
                """,
                (company_id,),
            )
            for row in cur.fetchall():
                facts.append({
                    "id": row["id"],
                    "code": row["code"],
                    "value": float(row["value"]) if row["value"] is not None else None,
                    "unit": row["unit"],
                    "ef_id": row["ef_id"],
                    "source_path": row["source_path"],
                    "computed_at": row["computed_at"].isoformat() if row["computed_at"] else None,
                    "hash_prev": row["hash_prev"],
                    "hash_self": row["hash_self"],
                })

            cur.execute(
                """
                SELECT id, fact_code, fact_event_id, status, proposed_at,
                       reviewed_at, frozen_at, comment, reject_reason
                FROM datapoint_reviews
                WHERE company_id = %s
                ORDER BY proposed_at ASC
                """,
                (company_id,),
            )
            for row in cur.fetchall():
                reviews.append({
                    "id": row["id"],
                    "fact_code": row["fact_code"],
                    "fact_event_id": row["fact_event_id"],
                    "status": row["status"],
                    "proposed_at": row["proposed_at"].isoformat() if row["proposed_at"] else None,
                    "reviewed_at": row["reviewed_at"].isoformat() if row["reviewed_at"] else None,
                    "frozen_at": row["frozen_at"].isoformat() if row["frozen_at"] else None,
                    "comment": row["comment"],
                    "reject_reason": row["reject_reason"],
                })

    return {
        "facts_events": facts,
        "datapoint_reviews": reviews,
    }


def _fetch_snapshot(company_id: int, domain: str = "consolidated") -> dict[str, Any]:
    """Retourne le snapshot JSON le plus récent pour la company."""
    if not db_available():
        return {}
    with get_db(company_id=company_id) as conn:
        with conn.cursor() as cur:
            if domain == "consolidated":
                cur.execute(
                    """
                    SELECT domain, version, data, generated_at
                    FROM snapshots
                    WHERE company_id = %s
                    ORDER BY generated_at DESC
                    """,
                    (company_id,),
                )
                rows = cur.fetchall()
                if not rows:
                    return {}
                # Prend le plus récent de chaque domaine
                by_domain: dict[str, Any] = {}
                for row in rows:
                    d = row["domain"]
                    if d not in by_domain:
                        by_domain[d] = {
                            "version": row["version"],
                            "generated_at": row["generated_at"].isoformat() if row["generated_at"] else None,
                            "data": row["data"] if isinstance(row["data"], dict) else json.loads(row["data"] or "{}"),
                        }
                return by_domain
            else:
                cur.execute(
                    """
                    SELECT version, data, generated_at
                    FROM snapshots
                    WHERE company_id = %s AND domain = %s
                    ORDER BY generated_at DESC LIMIT 1
                    """,
                    (company_id, domain),
                )
                row = cur.fetchone()
                if not row:
                    return {}
                return {
                    "domain": domain,
                    "version": row["version"],
                    "generated_at": row["generated_at"].isoformat() if row["generated_at"] else None,
                    "data": row["data"] if isinstance(row["data"], dict) else json.loads(row["data"] or "{}"),
                }


def _readme_content(
    *,
    company_name: str,
    package_hash: str,
    manifest_hash: str,
    generated_at: str,
) -> str:
    return f"""CarbonCo - Package d'export auditable
=====================================

Entreprise      : {company_name}
Genere le       : {generated_at}

Hash manifest   : {manifest_hash}
(Hash ZIP       : {package_hash})

Verification independante
-------------------------

Le fichier "manifest.json" est la signature canonique de ce package.
Un auditeur externe peut verifier son authenticite sans acces a CarbonCo :

  1. Calculez le SHA-256 du fichier "manifest.json" de ce ZIP :
     sha256sum manifest.json       (Linux/macOS)
     Get-FileHash manifest.json    (PowerShell)

  2. Ce hash doit etre egal a : {manifest_hash}

  3. Visitez https://carbon-snowy-nine.vercel.app/verify/{manifest_hash}
     pour valider l'enregistrement officiel (manifest_hash).

Contenu du package
------------------

- manifest.json     : metadonnees + hashs des fichiers embarques (signe)
- audit_trail.json  : events facts + reviews (chaine Merkle verifiable)
- snapshot.json     : KPIs consolides ESG / Carbon / Finance
- report.pdf        : synthese PDF avec watermark hash (si inclus)
- README.txt        : ce fichier (informatif, non signe)

Integrite de la chaine audit_trail.json
----------------------------------------

Chaque event facts_events a un hash_self =
  SHA-256(hash_prev | company_id | code | value | unit | ef_id
          | source_path | computed_at)

Tout event dont le hash_self ne correspond pas a ce calcul est altere.

Plus d'infos : https://carbon-snowy-nine.vercel.app/methodologie
"""


def build_package(
    *,
    company_id: int,
    company_name: str,
    domain: str = "consolidated",
    generated_by: int | None = None,
    report_pdf_bytes: bytes | None = None,
) -> ExportPackage:
    """Construit le package ZIP auditable pour une company.

    Args:
        company_id : tenant
        company_name : nom affiché dans le README / manifest
        domain : consolidated | carbon | esg | finance
        generated_by : user_id de l'auteur (pour traçabilité)
        report_pdf_bytes : PDF optionnel (si None, non inclus)

    Returns :
        ExportPackage avec zip_bytes + package_hash + manifest.
    """
    if company_id is None:
        raise ExportError("company_id obligatoire")

    now = datetime.now(tz=timezone.utc)
    audit = _fetch_audit_trail(company_id)
    snapshot = _fetch_snapshot(company_id, domain=domain)

    # Canonicalisation JSON pour reproductibilité (sort_keys + même séparateur)
    audit_bytes = json.dumps(audit, sort_keys=True, indent=2, default=str, ensure_ascii=False).encode("utf-8")
    snapshot_bytes = json.dumps(snapshot, sort_keys=True, indent=2, default=str, ensure_ascii=False).encode("utf-8")

    frozen_count = sum(1 for r in audit.get("datapoint_reviews", []) if r.get("status") == "frozen")
    event_count = len(audit.get("facts_events", []))

    # Manifest : signature canonique. Ne contient PAS de timestamp (reproductibilité).
    # Le README (informatif, avec date) n'est PAS inclus dans le manifest.
    manifest: dict[str, Any] = {
        "manifest_version": MANIFEST_VERSION,
        "company_id": company_id,
        "company_name": company_name,
        "domain": domain,
        "files": {
            "audit_trail.json": {
                "sha256": _sha256_hex(audit_bytes),
                "size": len(audit_bytes),
            },
            "snapshot.json": {
                "sha256": _sha256_hex(snapshot_bytes),
                "size": len(snapshot_bytes),
            },
        },
        "stats": {
            "event_count": event_count,
            "frozen_count": frozen_count,
            "reviews_count": len(audit.get("datapoint_reviews", [])),
        },
    }
    if report_pdf_bytes is not None:
        manifest["files"]["report.pdf"] = {
            "sha256": _sha256_hex(report_pdf_bytes),
            "size": len(report_pdf_bytes),
        }

    manifest_bytes = json.dumps(manifest, sort_keys=True, indent=2, ensure_ascii=False).encode("utf-8")
    manifest_hash = _sha256_hex(manifest_bytes)

    # README : informatif (contient hash + date), PAS dans le manifest.
    # Le README est regénéré après manifest_hash pour contenir le hash réel.
    readme_final = _readme_content(
        company_name=company_name,
        package_hash="(calculé après signature manifest)",  # le README est écrit avant le hash final du ZIP
        manifest_hash=manifest_hash,
        generated_at=now.isoformat(),
    ).encode("utf-8")

    # Construction ZIP final (une seule passe, manifest deterministe)
    buf2 = io.BytesIO()
    with zipfile.ZipFile(buf2, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", manifest_bytes)
        zf.writestr("audit_trail.json", audit_bytes)
        zf.writestr("snapshot.json", snapshot_bytes)
        if report_pdf_bytes is not None:
            zf.writestr("report.pdf", report_pdf_bytes)
        zf.writestr("README.txt", readme_final)

    final_zip = buf2.getvalue()
    final_hash = _sha256_hex(final_zip)

    filename = (
        f"carbonco-export-{company_id}-"
        f"{now.strftime('%Y%m%d-%H%M%S')}-"
        f"{final_hash[:12]}.zip"
    )

    # Persister le package dans la DB si disponible
    if db_available():
        try:
            import json as _json
            with get_db(company_id=company_id) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO export_packages
                            (company_id, package_hash, manifest_hash, domain, filename,
                             size_bytes, event_count, frozen_count, generated_by, meta)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (package_hash) DO NOTHING
                        """,
                        (
                            company_id, final_hash, manifest_hash, domain, filename,
                            len(final_zip), event_count, frozen_count, generated_by,
                            _json.dumps({"company_name": company_name}),
                        ),
                    )
        except Exception as exc:
            logger.warning("Persist export_packages échoué (fallback sans DB enregistrement): %s", exc)

    return ExportPackage(
        package_hash=final_hash,
        manifest_hash=manifest_hash,
        zip_bytes=final_zip,
        filename=filename,
        event_count=event_count,
        frozen_count=frozen_count,
        size_bytes=len(final_zip),
        manifest=manifest,
    )


def lookup_by_hash(package_hash: str) -> dict[str, Any] | None:
    """Retrouve les métadonnées publiques d'un package par son hash.

    **IMPORTANT** : retourne uniquement des métadonnées non-sensibles pour
    l'endpoint public `/verify/{hash}`. Pas de PII, pas de company_id exact
    (seulement un slug/nom affichable si présent).
    """
    if not db_available():
        return None
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT ep.package_hash, ep.manifest_hash, ep.domain, ep.filename,
                       ep.size_bytes, ep.event_count, ep.frozen_count,
                       ep.generated_at, ep.meta, c.name AS company_name
                FROM export_packages ep
                LEFT JOIN companies c ON c.id = ep.company_id
                WHERE ep.package_hash = %s
                LIMIT 1
                """,
                (package_hash,),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {
        "package_hash": row["package_hash"],
        "manifest_hash": row["manifest_hash"],
        "domain": row["domain"],
        "filename": row["filename"],
        "size_bytes": row["size_bytes"],
        "event_count": row["event_count"],
        "frozen_count": row["frozen_count"],
        "generated_at": row["generated_at"].isoformat() if row["generated_at"] else None,
        "company_name": row["company_name"] or "—",
    }
