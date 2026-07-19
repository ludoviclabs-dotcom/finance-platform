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
from services.storage import get_storage

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


def _fetch_evidence(company_id: int) -> list[dict[str, Any]]:
    """Pièces justificatives ACTIVES de la company (T2.1), reconstruites depuis le trail."""
    if not db_available():
        return []
    active: dict[str, dict[str, Any]] = {}
    try:
        with get_db(company_id=company_id) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, computed_at, meta
                    FROM facts_events
                    WHERE company_id = %s
                      AND (source_path LIKE 'evidence:%%' OR source_path LIKE 'evidence-revoke:%%')
                    ORDER BY computed_at ASC, id ASC
                    """,
                    (company_id,),
                )
                for row in cur.fetchall():
                    meta = row["meta"] or {}
                    if meta.get("kind") == "evidence_attach":
                        piece = meta.get("evidence")
                        if isinstance(piece, dict) and piece.get("sha256"):
                            active[piece["sha256"]] = piece
                    elif meta.get("kind") == "evidence_revoke":
                        active.pop(meta.get("target_sha256"), None)
    except Exception as exc:  # pragma: no cover - best effort
        logger.warning("_fetch_evidence échoué: %s", exc)
    return list(active.values())


def _checksums_file(files: dict[str, bytes]) -> bytes:
    """Génère un CHECKSUMS.sha256 au format `sha256sum -c` (deux espaces)."""
    lines = [f"{_sha256_hex(data)}  {name}" for name, data in sorted(files.items())]
    return ("\n".join(lines) + "\n").encode("utf-8")


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

Verification de TOUS les fichiers (sans outil proprietaire)
-----------------------------------------------------------

Le fichier "CHECKSUMS.sha256" liste l'empreinte de chaque fichier du pack.
Apres extraction du ZIP, depuis le dossier racine :

  sha256sum -c CHECKSUMS.sha256        (Linux/macOS)

Chaque ligne doit afficher « OK ». Toute ligne « FAILED » signale un fichier
altere. Sur Windows, comparez manuellement Get-FileHash a CHECKSUMS.sha256.

Contenu du package
------------------

- manifest.json     : metadonnees + hashs des fichiers embarques (signe)
- audit_trail.json  : events facts + reviews (chaine Merkle verifiable)
- snapshot.json     : KPIs consolides ESG / Carbon / Finance
- evidence/         : pieces justificatives (PDF/PNG/JPG), nommees par leur sha256
- report.pdf        : synthese PDF avec watermark hash (si inclus)
- CHECKSUMS.sha256  : empreintes de tous les fichiers (sha256sum -c)
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

    # Pièces justificatives actives (T2.1) — embarquées pour un pack auto-suffisant.
    evidence_blobs: dict[str, bytes] = {}
    evidence_files: dict[str, dict[str, Any]] = {}
    for piece in _fetch_evidence(company_id):
        sha = piece.get("sha256")
        key = piece.get("storage_key")
        if not sha or not key:
            continue
        try:
            data = get_storage().get(key)
        except Exception as exc:
            logger.warning("Pièce justificative %s illisible (ignorée): %s", sha, exc)
            continue
        ext = key.rsplit(".", 1)[-1] if "." in key else "bin"
        zip_name = f"evidence/{sha}.{ext}"
        evidence_blobs[zip_name] = data
        evidence_files[zip_name] = {
            "sha256": _sha256_hex(data), "size": len(data), "filename": piece.get("filename"),
        }

    # Manifest : signature canonique. Ne contient PAS de timestamp (reproductibilité).
    # Le README (informatif, avec date) n'est PAS inclus dans le manifest.
    manifest: dict[str, Any] = {
        "manifest_version": MANIFEST_VERSION,
        "company_id": company_id,
        "company_name": company_name,
        "domain": domain,
        "files": {
            "audit_trail.json": {"sha256": _sha256_hex(audit_bytes), "size": len(audit_bytes)},
            "snapshot.json": {"sha256": _sha256_hex(snapshot_bytes), "size": len(snapshot_bytes)},
        },
        "stats": {
            "event_count": event_count,
            "frozen_count": frozen_count,
            "reviews_count": len(audit.get("datapoint_reviews", [])),
            "evidence_count": len(evidence_files),
        },
    }
    if report_pdf_bytes is not None:
        manifest["files"]["report.pdf"] = {
            "sha256": _sha256_hex(report_pdf_bytes), "size": len(report_pdf_bytes),
        }
    manifest["files"].update(evidence_files)

    manifest_bytes = json.dumps(manifest, sort_keys=True, indent=2, ensure_ascii=False).encode("utf-8")
    manifest_hash = _sha256_hex(manifest_bytes)

    readme_final = _readme_content(
        company_name=company_name,
        package_hash="(calculé après signature manifest)",
        manifest_hash=manifest_hash,
        generated_at=now.isoformat(),
    ).encode("utf-8")

    # Fichiers embarqués (hors CHECKSUMS) → table de contrôle compatible `sha256sum -c`.
    embedded: dict[str, bytes] = {
        "manifest.json": manifest_bytes,
        "audit_trail.json": audit_bytes,
        "snapshot.json": snapshot_bytes,
        "README.txt": readme_final,
    }
    if report_pdf_bytes is not None:
        embedded["report.pdf"] = report_pdf_bytes
    embedded.update(evidence_blobs)
    checksums_bytes = _checksums_file(embedded)

    buf2 = io.BytesIO()
    with zipfile.ZipFile(buf2, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, data in embedded.items():
            zf.writestr(name, data)
        zf.writestr("CHECKSUMS.sha256", checksums_bytes)

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
    h = package_hash.lower()
    with get_db() as conn:
        with conn.cursor() as cur:
            # On résout par package_hash (hash du ZIP) OU manifest_hash (ancre stable
            # imprimée en pied de PDF / README). Sans le second, le lien
            # /verify/{manifest_hash} documenté dans le pack ne résoudrait jamais.
            cur.execute(
                """
                SELECT ep.package_hash, ep.manifest_hash, ep.domain, ep.filename,
                       ep.size_bytes, ep.event_count, ep.frozen_count,
                       ep.generated_at, ep.meta, c.name AS company_name
                FROM export_packages ep
                LEFT JOIN companies c ON c.id = ep.company_id
                WHERE ep.package_hash = %s OR ep.manifest_hash = %s
                LIMIT 1
                """,
                (h, h),
            )
            row = cur.fetchone()
    if not row:
        return None
    return {
        "package_hash": row["package_hash"],
        "manifest_hash": row["manifest_hash"],
        "matched_on": "package" if row["package_hash"] == h else "manifest",
        "domain": row["domain"],
        "filename": row["filename"],
        "size_bytes": row["size_bytes"],
        "event_count": row["event_count"],
        "frozen_count": row["frozen_count"],
        "generated_at": row["generated_at"].isoformat() if row["generated_at"] else None,
        "company_name": row["company_name"] or "—",
    }


# ---------------------------------------------------------------------------
# Vérification d'un ZIP reçu — recompute côté serveur (T2.3)
# ---------------------------------------------------------------------------

def inspect_zip(zip_bytes: bytes) -> dict[str, Any]:
    """Recompute package_hash, manifest_hash et l'intégrité interne d'un pack.

    Fonction PURE (aucun accès DB) — testable directement. Vérifie que chaque
    fichier listé dans le manifest a bien le sha256 annoncé (cohérence interne).
    """
    package_hash = _sha256_hex(zip_bytes)
    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile:
        return {"valid": False, "reason": "Archive illisible (pas un ZIP)."}
    names = set(zf.namelist())
    if "manifest.json" not in names:
        return {"valid": False, "reason": "manifest.json absent — pas un pack CarbonCo."}

    manifest_bytes = zf.read("manifest.json")
    manifest_hash = _sha256_hex(manifest_bytes)
    try:
        manifest = json.loads(manifest_bytes)
    except json.JSONDecodeError:
        return {"valid": False, "reason": "manifest.json illisible (JSON invalide)."}

    file_integrity: list[dict[str, Any]] = []
    self_consistent = True
    for fname, entry in (manifest.get("files") or {}).items():
        expected = entry.get("sha256")
        if fname in names:
            actual = _sha256_hex(zf.read(fname))
            ok = actual == expected
        else:
            actual, ok = None, False
        if not ok:
            self_consistent = False
        file_integrity.append({"file": fname, "expected": expected, "actual": actual, "ok": ok})

    return {
        "valid": True,
        "package_hash": package_hash,
        "manifest_hash": manifest_hash,
        "self_consistent": self_consistent,
        "file_integrity": file_integrity,
    }


def verify_zip(zip_bytes: bytes) -> dict[str, Any]:
    """Statut d'authenticité d'un ZIP reçu : authentic | altered | unknown | invalid.

    - authentic : manifest enregistré ET ZIP byte-identique ET cohérence interne OK
    - altered   : manifest (ou package) enregistré MAIS bytes modifiés
    - unknown   : aucun enregistrement officiel ne correspond
    - invalid   : ce n'est pas un pack CarbonCo lisible
    """
    insp = inspect_zip(zip_bytes)
    if not insp.get("valid"):
        return {"status": "invalid", "reason": insp.get("reason")}

    reg = lookup_by_hash(insp["manifest_hash"]) or lookup_by_hash(insp["package_hash"])
    if reg is None:
        return {"status": "unknown", **{k: insp[k] for k in ("package_hash", "manifest_hash", "self_consistent", "file_integrity")}}

    authentic = insp["self_consistent"] and reg.get("package_hash") == insp["package_hash"]
    return {
        "status": "authentic" if authentic else "altered",
        "package_hash": insp["package_hash"],
        "manifest_hash": insp["manifest_hash"],
        "self_consistent": insp["self_consistent"],
        "file_integrity": insp["file_integrity"],
        "metadata": reg,
    }


# ---------------------------------------------------------------------------
# Evidence Pack d'un run de calcul Scope 2 dual (PR-06B)
# ---------------------------------------------------------------------------

SCOPE2_PACK_DOMAIN = "scope2_run"

# Horodatage FIXE des entrées du ZIP. Un evidence pack doit être reproductible
# BIT À BIT : deux générations du même run doivent produire le même ZIP, donc le
# même `package_hash`. Or `ZipFile.writestr(str, ...)` estampille chaque entrée
# avec l'heure courante — d'où cette date d'époque constante, appliquée via un
# ZipInfo explicite. La date réelle du calcul reste dans `run.json`, signée.
_ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)


def _scope2_readme(*, company_name: str, run: dict[str, Any], manifest_hash: str) -> str:
    result = run.get("result") or {}
    method = result.get("methodology") or {}
    return f"""CarbonCo - Evidence Pack Scope 2 dual (location-based & market-based)
====================================================================

Entreprise      : {company_name}
Run de calcul   : #{run.get('id')}
Periode         : {run.get('period_start')} -> {run.get('period_end')}
Zone de reseau  : {run.get('geography_code')}
Methodologie    : {method.get('code')} {method.get('version')}
Statut du run   : {run.get('status')}
Calcule le      : {run.get('calculated_at')}

Hash manifest   : {manifest_hash}

Resultats
---------

  Location-based : {result.get('location_based_tco2e')} tCO2e
  Market-based   : {result.get('market_based_tco2e')} tCO2e

Les DEUX bases sont publiees ensemble. Aucune ne remplace l'autre : le GHG
Protocol Scope 2 Guidance impose la double comptabilisation.

  Consommation totale       : {result.get('total_consumption_mwh')} MWh
  Couverture contractuelle  : {result.get('contractual_coverage_mwh')} MWh
                              ({result.get('contractual_coverage_pct')} %)
  Part non couverte         : {result.get('uncovered_mwh')} MWh
  Mix residuel utilise      : {result.get('residual_mix_used')}
  Couverture du calcul      : {result.get('coverage_pct')} %
  Confiance                 : {result.get('confidence')} / 100
  Calcul complet            : {result.get('is_complete')}

Ce que ce pack garantit (et ce qu'il ne garantit pas)
-----------------------------------------------------

GARANTI :
  - Chaque ligne de calculation_trace.json porte le NIVEAU de hierarchie de
    facteur retenu (selection_level) et sa RAISON (selection_reason). Aucun
    facteur n'a ete choisi silencieusement.
  - input_snapshot.json contient les entrees GELEES du calcul (activites,
    allocations, facteurs candidats). Rejouer le moteur sur ce snapshot doit
    redonner exactement result.json (empreinte input_fingerprint).
  - Les quantites non couvertes par un instrument contractuel sont VISIBLES
    (segment "uncovered" de la trace), jamais absorbees dans un total.

INTERDITS RESPECTES :
  - Une moyenne de reseau nationale n'est JAMAIS presentee comme market-based.
    Les lignes market-based ne portent que factor_basis = contractual_instrument,
    market, residual_mix ou documented_fallback (repli explicitement autorise
    par la methodologie, avec fallback_reason obligatoire).
  - Une estimation n'est JAMAIS presentee comme verifiee : data_quality vaut
    "verified" seulement si la preuve existe (certificat d'instrument attache,
    ou facteur source par une release tracee).
  - Un proxy fournisseur n'est JAMAIS presente comme facteur contractuel
    verifie : seul un instrument contractuel alloue produit le niveau
    "contractual_instrument".

NON GARANTI :
  - Un run au statut "draft" n'est PAS un resultat officiel. Tant qu'aucun run
    n'est approuve, les KPI Scope 2 historiques restent la reference.

Verification independante
-------------------------

  1. SHA-256 du fichier "manifest.json" de ce ZIP :
       sha256sum manifest.json       (Linux/macOS)
       Get-FileHash manifest.json    (PowerShell)
  2. Il doit valoir : {manifest_hash}
  3. "CHECKSUMS.sha256" liste l'empreinte de chaque fichier :
       sha256sum -c CHECKSUMS.sha256

Contenu du package
------------------

- manifest.json           : metadonnees + hashs des fichiers embarques (signe)
- run.json                : identite du run (periode, methodologie, statut)
- result.json             : les deux totaux + couverture + confiance
- calculation_trace.json  : trace ligne a ligne (hierarchie de facteurs)
- input_snapshot.json     : entrees gelees (reproductibilite)
- factors.json            : facteurs REELLEMENT utilises et leurs versions
- warnings.json           : avertissements et facteurs manquants
- CHECKSUMS.sha256        : empreintes de tous les fichiers
- README.txt              : ce fichier (informatif, non signe)
"""


def assemble_scope2_pack(
    *,
    company_id: int,
    company_name: str,
    run: dict[str, Any],
    trace: list[dict[str, Any]],
) -> ExportPackage:
    """Assemble l'Evidence Pack d'un run Scope 2 — fonction PURE (aucune DB).

    Reutilise la convention de pack existante (`manifest.json` signe +
    `CHECKSUMS.sha256` verifiable par `sha256sum -c`), avec le meme calcul de
    hash — un auditeur qui sait verifier un pack CarbonCo sait verifier
    celui-ci. Reproductible : memes entrees ⇒ memes octets ⇒ meme package_hash.
    """
    result = run.get("result") or {}
    warnings = run.get("warnings") or []

    run_meta = {
        "run_id": run.get("id"),
        "company_id": company_id,
        "methodology_code": run.get("methodology_code"),
        "methodology_version": run.get("methodology_version"),
        "period_start": str(run.get("period_start")),
        "period_end": str(run.get("period_end")),
        "geography_code": run.get("geography_code"),
        "status": run.get("status"),
        "input_fingerprint": run.get("input_fingerprint"),
        "calculated_at": str(run.get("calculated_at")),
        "approved_at": str(run.get("approved_at")) if run.get("approved_at") else None,
        "confidence": run.get("confidence"),
        "coverage_pct": run.get("coverage_pct"),
    }

    def _dump(payload: Any) -> bytes:
        return json.dumps(
            payload, sort_keys=True, indent=2, default=str, ensure_ascii=False
        ).encode("utf-8")

    signed: dict[str, bytes] = {
        "run.json": _dump(run_meta),
        "result.json": _dump(result),
        "calculation_trace.json": _dump(trace),
        "input_snapshot.json": _dump(run.get("input_snapshot") or {}),
        "factors.json": _dump(run.get("factor_versions") or []),
        "warnings.json": _dump({
            "warnings": warnings,
            "missing_factors": result.get("missing_factors") or [],
        }),
    }

    manifest: dict[str, Any] = {
        "manifest_version": MANIFEST_VERSION,
        "pack_type": SCOPE2_PACK_DOMAIN,
        "company_id": company_id,
        "company_name": company_name,
        "domain": SCOPE2_PACK_DOMAIN,
        "run_id": run.get("id"),
        "input_fingerprint": run.get("input_fingerprint"),
        "files": {
            name: {"sha256": _sha256_hex(data), "size": len(data)}
            for name, data in signed.items()
        },
        "stats": {
            "line_count": len(trace),
            "warning_count": len(warnings),
            "missing_factor_count": len(result.get("missing_factors") or []),
            "location_based_tco2e": result.get("location_based_tco2e"),
            "market_based_tco2e": result.get("market_based_tco2e"),
        },
    }
    manifest_bytes = json.dumps(manifest, sort_keys=True, indent=2, ensure_ascii=False).encode("utf-8")
    manifest_hash = _sha256_hex(manifest_bytes)

    embedded: dict[str, bytes] = {"manifest.json": manifest_bytes, **signed}
    embedded["README.txt"] = _scope2_readme(
        company_name=company_name, run=run, manifest_hash=manifest_hash
    ).encode("utf-8")
    checksums_bytes = _checksums_file(embedded)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for name, data in sorted({**embedded, "CHECKSUMS.sha256": checksums_bytes}.items()):
            info = zipfile.ZipInfo(filename=name, date_time=_ZIP_EPOCH)
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, data)

    final_zip = buf.getvalue()
    final_hash = _sha256_hex(final_zip)
    filename = f"carbonco-scope2-run-{run.get('id')}-{final_hash[:12]}.zip"

    return ExportPackage(
        package_hash=final_hash,
        manifest_hash=manifest_hash,
        zip_bytes=final_zip,
        filename=filename,
        event_count=len(trace),
        frozen_count=1 if run.get("status") == "approved" else 0,
        size_bytes=len(final_zip),
        manifest=manifest,
    )


def build_scope2_evidence_pack(
    *,
    company_id: int,
    company_name: str,
    run: dict[str, Any],
    trace: list[dict[str, Any]],
    generated_by: int | None = None,
) -> ExportPackage:
    """Assemble le pack ET l'enregistre dans `export_packages` (domaine
    `scope2_run`), pour que la page publique `/verify/{hash}` puisse attester de
    son existence et de sa date comme pour un pack consolide. Idempotent :
    regenerer le meme run ne cree pas de doublon (`ON CONFLICT DO NOTHING` sur
    `package_hash`, qui est stable par construction)."""
    pack = assemble_scope2_pack(
        company_id=company_id, company_name=company_name, run=run, trace=trace
    )
    if db_available():
        try:
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
                            company_id, pack.package_hash, pack.manifest_hash,
                            SCOPE2_PACK_DOMAIN, pack.filename, pack.size_bytes,
                            pack.event_count, pack.frozen_count, generated_by,
                            json.dumps({
                                "company_name": company_name,
                                "run_id": run.get("id"),
                                "input_fingerprint": run.get("input_fingerprint"),
                            }),
                        ),
                    )
        except Exception as exc:
            logger.warning("Persist export_packages (scope2) échoué: %s", exc)
    return pack
