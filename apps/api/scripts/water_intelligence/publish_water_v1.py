"""
scripts/water_intelligence/publish_water_v1.py — production du snapshot PUBLIC
Water V1 (`bnpe_minimal_pilot_v1`).

## Ce que ce script est, et ce qu'il n'est pas

C'est un **point d'entrée**, pas un pipeline. Chaque étape appelle la fonction
qui l'a déjà : le connecteur Hub'Eau réel via `validate_hubeau`, le normaliseur
via `prepare_release()` — celui qui grave —, la provenance canonique via
`release_provenance`, l'assembleur public via `assemble_public_snapshot()`, et
le sérialiseur canonique via `public_snapshot_builder`. Le budget et le gate
licence sont ceux de l'assembleur, jamais réécrits ici.

Un second pipeline « pour publier » divergerait du pipeline qui mesure à la
première correction apportée à l'un des deux, et le document publié cesserait
alors de correspondre au périmètre approuvé. C'est le défaut que ce chantier a
rencontré trois fois sous trois formes différentes ; il n'est pas réintroduit
ici.

## La différence avec `build_candidate_snapshots.py`

Celui-là **mesure** : il assemble en mémoire avec un registre de MESURE, et
n'écrit aucun document. Celui-ci **publie** : il assemble avec le registre
RÉEL — donc sous la signature humaine du 2026-07-28 — et écrit deux documents
versionnés. Les deux partagent leurs étapes ; ils diffèrent par leur registre
et par leur sortie, c'est-à-dire par exactement ce qui distingue mesurer
d'autoriser.

## Les neuf conditions d'arrêt

L'autorisation humaine est **conditionnelle**. Ce script échoue — et ne produit
aucun document — si l'un de ces éléments diverge :

1. checksum du payload différent de celui approuvé ;
2. nombre d'observations différent de 3 ;
3. périmètre différent de `34172` / 2020 ;
4. pagination non exhaustive (dernière page saturée) ;
5. snapshot ≥ 100 000 octets ;
6. attribution absente ;
7. licence non applicable ;
8. présence d'une donnée tenant ;
9. présence d'une autre source dans le snapshot.

Aucune n'est un avertissement : chacune lève. *Un contrôle qui se contente
d'avertir n'a jamais empêché une publication.*

## Ce qui n'est jamais écrit

Les octets bruts Hub'Eau restent hors dépôt. Le document canonique porte des
valeurs normalisées, leur provenance et leurs limites — jamais la réponse
d'API. Le rapport de preuve porte des checksums et des comptes, jamais un
tableau `data`.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from scripts.water_intelligence.build_candidate_snapshots import (
    _acquisition_argv,
    _assert_exhaustive,
    _prepare_one,
)
from scripts.water_intelligence.candidate_scopes import (
    BNPE_MINIMAL_PILOT_V1,
    BNPE_PILOT_RELEASE_KEY,
)
from services.water.staging_environment import staging_connection_factory
from services.water_intelligence import public_snapshot_builder as builder
from services.water_intelligence.public_snapshot import (
    MAX_MANIFEST_BYTES_UNCOMPRESSED,
    assemble_public_snapshot,
)
from services.water_intelligence.publication_decisions import (
    assert_human_approvals_unchanged,
    current_registry,
)

# ---------------------------------------------------------------------------
# Les constantes APPROUVÉES — recopiées du paquet de décision, jamais déduites
# ---------------------------------------------------------------------------

#: Source unique du pilote. Toute autre source dans le snapshot est un arrêt.
PILOT_SOURCE_CODE = "HUBEAU_BNPE_PRELEVEMENTS"

#: Checksum du payload source, tel que porté par l'autorisation humaine.
APPROVED_PAYLOAD_SHA256 = (
    "c9b8d10e9f1059fd49db51a45d6890ff1cebe546084eeac03d871742a74bd2e9"
)

#: Nombre d'observations attendu. Ni un minimum, ni un ordre de grandeur : le
#: signataire a approuvé TROIS observations après avoir lu leur nombre.
APPROVED_OBSERVATION_COUNT = 3

#: Unité attendue. Une conversion silencieuse produirait un facteur invisible.
APPROVED_UNIT = "m3"

#: Bornes de la période approuvée.
APPROVED_PERIOD_START = date(2020, 1, 1)
APPROVED_PERIOD_END = date(2020, 12, 31)

#: Avertissements de couverture, à conserver mot pour mot. Ils ne décrivent pas
#: une réserve levée par la signature : ils décrivent la source elle-même.
MANDATORY_WARNINGS: tuple[str, ...] = (
    "Les volumes exonérés de redevance peuvent être absents de cette source.",
    "Certains petits volumes peuvent ne pas être déclarés.",
    "Une absence de déclaration n'est JAMAIS un prélèvement nul.",
)

#: Documents produits, relatifs à la racine du dépôt.
CANONICAL_DOCUMENT = Path(
    "docs/carbonco/water-intelligence/contracts/PUBLIC_SNAPSHOT_BNPE_V1.json"
)
FRONTEND_MIRROR = Path(
    "apps/carbon/lib/water-intelligence/public-snapshot-bnpe-v1.json"
)


class PublicationRefused(Exception):
    """Publication arrêtée. Aucun document n'est écrit — jamais un partiel."""


# ---------------------------------------------------------------------------
# Chemins
# ---------------------------------------------------------------------------


def _paths(artifacts: Path, reports: Path) -> tuple[Path, Path]:
    return artifacts / BNPE_PILOT_RELEASE_KEY, reports / "acq_bnpe_v1.md"


def _repo_root() -> Path:
    """Racine du dépôt, déduite de ce fichier — jamais du répertoire courant.

    Le script est invoqué depuis `apps/api` (comme tous les autres) mais écrit
    dans `docs/` et `apps/carbon/`. Faire dépendre les chemins du `cwd`
    rendrait l'écriture silencieusement relative au mauvais endroit selon le
    répertoire d'appel.
    """
    return Path(__file__).resolve().parents[4]


# ---------------------------------------------------------------------------
# acquire — réacquisition du périmètre signé, et rien d'autre
# ---------------------------------------------------------------------------


def command_acquire(args: argparse.Namespace) -> int:
    """Réacquiert BNPE sur le périmètre signé, puis PROUVE que c'est bien lui.

    Le territoire est vérifié ICI, sur la requête, parce qu'il ne l'est pas à
    l'assemblage : le code géographique d'une observation BNPE est un
    identifiant d'ouvrage, pas une commune INSEE.
    """
    assert_human_approvals_unchanged()
    scope = BNPE_MINIMAL_PILOT_V1
    registry = current_registry()

    # Condition d'arrêt 3 — le périmètre, avant tout appel réseau.
    if not registry.matches_acquisition(
        PILOT_SOURCE_CODE,
        geography_type=scope.geography_type,
        geography_code=scope.geography_code,
    ):
        raise PublicationRefused(
            f"ARRÊT — le périmètre acquis ({scope.geography_type} "
            f"{scope.geography_code}) n'est pas celui signé. Élargir un "
            "périmètre exige une nouvelle décision humaine, jamais une nouvelle "
            "invocation."
        )
    if (scope.date_from, scope.date_to) != ("2020", "2020"):
        raise PublicationRefused(
            f"ARRÊT — année acquise {scope.date_from}–{scope.date_to}, "
            "approuvée : 2020."
        )

    artifact_dir, report_path = _paths(Path(args.artifact_dir), Path(args.report_dir))
    argv = _acquisition_argv(
        scope,
        candidate_key=BNPE_PILOT_RELEASE_KEY,
        release=BNPE_PILOT_RELEASE_KEY,
        artifacts=Path(args.artifact_dir),
        reports=Path(args.report_dir),
    )
    # `_acquisition_argv` indexe ses chemins sur le couple (candidat, source).
    # On lui donne la clé de release comme candidat, ce qui produit le même
    # répertoire que `_paths()` — vérifié plutôt que supposé.
    argv_artifact = Path(argv[argv.index("--artifact-dir") + 1])
    argv_report = Path(argv[argv.index("--report") + 1])

    print(f"→ acquisition {PILOT_SOURCE_CODE} — {scope.geography_code} / 2020", flush=True)
    result = subprocess.run(argv, check=False)
    if result.returncode != 0:
        raise PublicationRefused(
            f"ARRÊT — acquisition en échec (code {result.returncode}). Un verdict "
            "dégradé se corrige, il ne se contourne pas."
        )

    from services.water.staging_ingestion import load_acquisition_evidence

    evidence = load_acquisition_evidence(
        argv_report,
        expect_source_code=PILOT_SOURCE_CODE,
        expect_release_key=BNPE_PILOT_RELEASE_KEY,
    )
    # Condition d'arrêt 4 — pagination exhaustive, prouvée par une dernière
    # page incomplète et non par une déclaration.
    summary = _assert_exhaustive(scope, evidence)

    # Condition d'arrêt 1 — le checksum approuvé, à l'octet près.
    if summary["payload_sha256"] != APPROVED_PAYLOAD_SHA256:
        raise PublicationRefused(
            "ARRÊT — checksum du payload différent de celui approuvé.\n"
            f"  reçu     : {summary['payload_sha256']}\n"
            f"  approuvé : {APPROVED_PAYLOAD_SHA256}\n"
            "La source a changé depuis la mesure. La publication n'est plus "
            "couverte par la signature du 2026-07-28."
        )
    # Condition d'arrêt 2 — trois enregistrements reçus, trois normalisés,
    # zéro rejet. Les trois nombres, pas seulement le premier : un rejet
    # silencieux ferait publier moins que ce qui a été approuvé.
    if summary["records_received"] != APPROVED_OBSERVATION_COUNT:
        raise PublicationRefused(
            f"ARRÊT — {summary['records_received']} enregistrements reçus, "
            f"{APPROVED_OBSERVATION_COUNT} approuvés."
        )
    if summary["records_normalized"] != APPROVED_OBSERVATION_COUNT:
        raise PublicationRefused(
            f"ARRÊT — {summary['records_normalized']} enregistrements normalisés, "
            f"{APPROVED_OBSERVATION_COUNT} approuvés : des enregistrements ont "
            "été rejetés à la normalisation."
        )
    if summary["pages"] != 1:
        raise PublicationRefused(
            f"ARRÊT — {summary['pages']} page(s) acquises, 1 approuvée."
        )
    if set(summary["units"]) != {APPROVED_UNIT}:
        raise PublicationRefused(
            f"ARRÊT — unités reçues {summary['units']}, approuvée : "
            f"{APPROVED_UNIT!r}. Aucune conversion n'est appliquée nulle part : "
            "une unité inattendue est un changement de contrat, pas un détail "
            "d'affichage."
        )
    if len(summary["geographies"]) != APPROVED_OBSERVATION_COUNT:
        raise PublicationRefused(
            f"ARRÊT — {len(summary['geographies'])} géographies reçues, "
            f"{APPROVED_OBSERVATION_COUNT} approuvées."
        )

    _write(
        Path(args.report_dir) / "10_acquisition_bnpe_v1.json",
        {
            "source_code": PILOT_SOURCE_CODE,
            "release_key": BNPE_PILOT_RELEASE_KEY,
            "geography_type": scope.geography_type,
            "geography_code": scope.geography_code,
            "year": scope.date_from,
            "page_size": scope.page_size,
            "max_pages": scope.max_pages,
            "artifact_dir": str(argv_artifact),
            **summary,
        },
    )
    print(
        f"✓ {summary['records_normalized']} observations, checksum conforme, "
        f"dernière page incomplète ({summary['records_received']}/{scope.page_size})",
        flush=True,
    )
    return 0


# ---------------------------------------------------------------------------
# publish — assemblage sous le registre RÉEL, puis écriture des documents
# ---------------------------------------------------------------------------


def command_publish(args: argparse.Namespace) -> int:
    assert_human_approvals_unchanged()
    registry = current_registry()
    artifact_dir, report_path = _paths(Path(args.artifact_dir), Path(args.report_dir))

    factory, _target = staging_connection_factory(
        expect_database=args.expect_database, ephemeral=True
    )
    with factory() as connection:
        with connection.cursor() as cur:
            # Condition d'arrêt 8 — aucune donnée tenant, vérifiée AVANT de
            # produire quoi que ce soit. Refuser plutôt que filtrer : filtrer
            # masquerait qu'une donnée tenant a atteint une release publique.
            cur.execute(
                "SELECT COUNT(*) AS n FROM observations WHERE company_id IS NOT NULL"
            )
            leaked = cur.fetchone()["n"]
            if leaked:
                raise PublicationRefused(
                    f"ARRÊT — {leaked} observation(s) portent un company_id."
                )
            # `_prepare_one` porte les MÊMES barrières que le graveur, dans le
            # même ordre : provenance confrontée à la configuration, puis
            # licence évaluée en base (conditions d'arrêt 6 et 7).
            prepared = _prepare_one(
                cur,
                source_code=PILOT_SOURCE_CODE,
                release_key=BNPE_PILOT_RELEASE_KEY,
                artifact_dir=artifact_dir,
                report_path=report_path,
            )

    _verify_prepared(prepared)

    generated_at = _generated_at(args.generated_at)
    snapshot = assemble_public_snapshot(
        observations=prepared.observations,
        generated_at=generated_at,
        registry=registry,
    )
    _verify_snapshot(snapshot)

    document = _document(snapshot, prepared, generated_at)
    # Sérialiseur canonique PARTAGÉ : la règle de mise en forme vit dans
    # `public_snapshot_builder`, pas ici. Une seconde règle divergerait d'un
    # saut de ligne, et un saut de ligne suffit à rompre la parité octet pour
    # octet entre le document et son miroir.
    payload = builder.serialize_canonical_document(document)

    # Condition d'arrêt 5 — le budget, mesuré sur le document réellement écrit.
    if len(payload) >= MAX_MANIFEST_BYTES_UNCOMPRESSED:
        raise PublicationRefused(
            f"ARRÊT — document de {len(payload)} octets, budget "
            f"{MAX_MANIFEST_BYTES_UNCOMPRESSED}. Le plafond ne se relève pas et "
            "aucune preuve n'est retirée : c'est le périmètre qui se restreint."
        )

    root = _repo_root()
    for target in (CANONICAL_DOCUMENT, FRONTEND_MIRROR):
        path = root / target
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)

    # Miroir octet pour octet — vérifié, jamais supposé. Deux écritures depuis
    # les mêmes octets peuvent diverger : encodage, saut de ligne final, ordre
    # de clés. `TestDocumentParity` compare ces deux fichiers.
    written = (root / CANONICAL_DOCUMENT).read_bytes()
    mirrored = (root / FRONTEND_MIRROR).read_bytes()
    if written != mirrored:
        raise PublicationRefused(
            "ARRÊT — le miroir front n'est pas identique octet pour octet au "
            "document canonique."
        )

    _write(
        Path(args.report_dir) / "40_publication_proof.json",
        _proof(snapshot, prepared, document, payload, generated_at),
    )
    print(
        f"✓ snapshot publié — {snapshot.observation_count} observations, "
        f"{len(payload)} octets (marge {MAX_MANIFEST_BYTES_UNCOMPRESSED - len(payload)}), "
        f"ETag {snapshot.etag()}",
        flush=True,
    )
    return 0


# ---------------------------------------------------------------------------
# Vérifications
# ---------------------------------------------------------------------------


def _verify_prepared(prepared: Any) -> None:
    """Ce que la préparation doit porter, avant tout assemblage."""
    observations = prepared.observations
    if len(observations) != APPROVED_OBSERVATION_COUNT:
        raise PublicationRefused(
            f"ARRÊT — {len(observations)} observations préparées, "
            f"{APPROVED_OBSERVATION_COUNT} approuvées."
        )
    if prepared.records_rejected:
        raise PublicationRefused(
            f"ARRÊT — {prepared.records_rejected} enregistrement(s) rejeté(s). "
            "Le périmètre approuvé était exhaustif ; il ne l'est plus."
        )
    if set(prepared.units) != {APPROVED_UNIT}:
        raise PublicationRefused(
            f"ARRÊT — unités préparées {prepared.units}, approuvée {APPROVED_UNIT!r}."
        )
    if len(prepared.geography_codes) != APPROVED_OBSERVATION_COUNT:
        raise PublicationRefused(
            f"ARRÊT — {len(prepared.geography_codes)} géographies préparées, "
            f"{APPROVED_OBSERVATION_COUNT} approuvées."
        )
    for observation in observations:
        if not (APPROVED_PERIOD_START <= observation.period_start
                and observation.period_end <= APPROVED_PERIOD_END):
            raise PublicationRefused(
                f"ARRÊT — observation hors période approuvée : "
                f"{observation.period_start} → {observation.period_end}."
            )
    provenance = prepared.provenance
    # Condition d'arrêt 6 — l'attribution, et la voie de conformité retenue.
    if not (provenance and (provenance.attribution or "").strip()):
        raise PublicationRefused(
            "ARRÊT — attribution absente. Une valeur publiée sans paternité "
            "citable n'est pas publiable."
        )
    if not (provenance.information_url or "").strip():
        raise PublicationRefused(
            "ARRÊT — URL officielle absente. C'est la voie de conformité à la "
            "condition de paternité retenue par la signature du 2026-07-28 "
            "(X4B_HUMAN_APPROVAL_PACKET.md §6.1) : sans elle, l'attribution ne "
            "satisfait pas la Licence Ouverte 2.0."
        )


def _verify_snapshot(snapshot: Any) -> None:
    """Ce que le snapshot assemblé doit porter — et ne doit pas porter."""
    if snapshot.is_empty:
        raise PublicationRefused(
            "ARRÊT — snapshot vide alors qu'une décision signée le couvre. "
            "L'acquisition n'a rien produit, ou tout a été écarté."
        )
    # Condition d'arrêt 9 — une seule source. Une seconde source dans le
    # snapshot ne serait pas couverte par la signature.
    if snapshot.included_source_codes != (PILOT_SOURCE_CODE,):
        raise PublicationRefused(
            f"ARRÊT — sources incluses {snapshot.included_source_codes}, "
            f"approuvée : ({PILOT_SOURCE_CODE!r},). Une source de plus dans le "
            "snapshot est une source de plus publiée."
        )
    if snapshot.observation_count != APPROVED_OBSERVATION_COUNT:
        raise PublicationRefused(
            f"ARRÊT — {snapshot.observation_count} observations assemblées, "
            f"{APPROVED_OBSERVATION_COUNT} approuvées."
        )
    # Après le gate licence : les trois valeurs ne doivent plus être retenues.
    manifest = snapshot.manifest
    withheld = [o for o in manifest.observations if o.value_withheld or o.value is None]
    if withheld:
        raise PublicationRefused(
            f"ARRÊT — {len(withheld)} valeur(s) encore retenue(s) après une "
            "décision de licence approuvée."
        )
    # Aucune autre source ne devient publiable au passage.
    for exclusion in snapshot.exclusions:
        if exclusion.source_code == PILOT_SOURCE_CODE:
            raise PublicationRefused(
                f"ARRÊT — {PILOT_SOURCE_CODE} figure à la fois incluse et exclue."
            )
    serialized = snapshot.canonical_json()
    for field in ("company_id", "tenant_id", "site_id", "organisation_id", "user_id"):
        if field in serialized:
            raise PublicationRefused(f"ARRÊT — champ tenant {field!r} sérialisé.")


# ---------------------------------------------------------------------------
# Document canonique
# ---------------------------------------------------------------------------


def _document(snapshot: Any, prepared: Any, generated_at: datetime) -> dict[str, Any]:
    """Le document PUBLIC — l'enveloppe de l'assembleur, plus ce que le pilote
    doit dire de lui-même.

    Les métadonnées ajoutées ici ne sont pas décoratives : `publication_mode`,
    `geo_layers` et `pilot_status` disent au lecteur (et à la surface) ce que ce
    document est — une table, sans carte, sur un périmètre limité. Les inventer
    côté front les rendrait modifiables sans repasser par une décision.
    """
    payload = dict(snapshot.as_public_mapping())
    provenance = prepared.provenance
    decision = current_registry().get(PILOT_SOURCE_CODE)

    payload["generated_at"] = generated_at.isoformat()
    # Discriminant lu par le miroir front. Le document versionné existe AVANT
    # que le workflow ne tourne — il porte alors `not_generated` et ne prétend
    # rien. C'est ce qui permet à `/water` de se construire et de dire
    # honnêtement « le document pilote n'est pas encore généré » plutôt que de
    # dépendre d'un fichier absent, ou pire, d'un snapshot d'attente fabriqué.
    payload["pilot_document_status"] = "generated"
    payload["pilot"] = {
        "option_key": "bnpe_minimal_pilot_v1",
        "publication_mode": "table_first",
        "geo_layers": "deferred",
        "pilot_status": "limited_scope",
        "observation_count": snapshot.observation_count,
        "retrieved_at": provenance.accessed_on.isoformat(),
        "source_refresh_cadence": provenance.refresh_cadence,
        "observed_period_start": APPROVED_PERIOD_START.isoformat(),
        "observed_period_end": APPROVED_PERIOD_END.isoformat(),
        "source_code": PILOT_SOURCE_CODE,
        "release_key": prepared.release_key,
        "payload_sha256": APPROVED_PAYLOAD_SHA256,
        "artifact_checksum": prepared.artifact_checksum,
        "geography_type": BNPE_MINIMAL_PILOT_V1.geography_type,
        "geography_code": BNPE_MINIMAL_PILOT_V1.geography_code,
        "attribution": provenance.attribution,
        "source_information_url": provenance.information_url,
        "license_code": provenance.license_code,
        "license_scope": provenance.license_scope,
        # `None` assumé : aucune date de dernière mise à jour n'a été relevée.
        # La voie de conformité retenue est celle de l'URL — écrire ici une
        # date de consultation la ferait lire comme une date de mise à jour.
        "source_last_updated_on": None,
        "reviewed_by": decision.reviewed_by,
        "reviewed_on": decision.reviewed_on.isoformat(),
        "permissions": {
            "display_allowed": decision.display_allowed,
            "derived_use_allowed": decision.derived_use_allowed,
            "automated_access_allowed": decision.automated_access_allowed,
            "storage_allowed": decision.storage_allowed,
        },
        "coverage_warnings": list(MANDATORY_WARNINGS),
        "excluded_sources": [
            {"source_code": e.source_code, "reason": e.reason, "detail": e.detail}
            for e in snapshot.exclusions
        ],
    }
    return payload


def _proof(
    snapshot: Any,
    prepared: Any,
    document: dict[str, Any],
    payload: bytes,
    generated_at: datetime,
) -> dict[str, Any]:
    """Rapport de PREUVE — des checksums et des comptes, aucun payload brut."""
    import hashlib

    return {
        "generated_at": generated_at.isoformat(),
        "source_code": PILOT_SOURCE_CODE,
        "release_key": prepared.release_key,
        "approved_payload_sha256": APPROVED_PAYLOAD_SHA256,
        "artifact_checksum": prepared.artifact_checksum,
        "validation_report_checksum": prepared.validation_report_checksum,
        "observation_count": snapshot.observation_count,
        "included_source_codes": list(snapshot.included_source_codes),
        "excluded_source_count": len(snapshot.exclusions),
        "etag": snapshot.etag(),
        "payload_bytes": snapshot.payload_bytes(),
        "document_bytes": len(payload),
        "document_sha256": hashlib.sha256(payload).hexdigest(),
        "budget_bytes": MAX_MANIFEST_BYTES_UNCOMPRESSED,
        "margin_bytes": MAX_MANIFEST_BYTES_UNCOMPRESSED - len(payload),
        "canonical_document": str(CANONICAL_DOCUMENT),
        "frontend_mirror": str(FRONTEND_MIRROR),
        "mirror_is_byte_identical": True,
        "geography_codes": list(prepared.geography_codes),
        "units": list(prepared.units),
        "pilot": document["pilot"],
        "approved_source_codes": list(current_registry().approved_source_codes),
    }


# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------


def _generated_at(raw: str | None) -> datetime:
    """Horodatage d'assemblage — INJECTÉ, jamais lu d'une horloge implicite.

    Un document versionné doit être reproductible : deux exécutions du même
    périmètre avec le même `--generated-at` produisent les mêmes octets.
    """
    if not raw:
        return datetime.now(timezone.utc)
    parsed = datetime.fromisoformat(raw)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="publish_water_v1",
        description=(
            "Produit le snapshot public Water V1 (bnpe_minimal_pilot_v1). "
            "Refuse de publier si le périmètre, le checksum, le compte "
            "d'observations ou le budget divergent de ce qui a été approuvé."
        ),
    )
    parser.add_argument("--expect-database", required=True)
    parser.add_argument("--artifact-dir", required=True)
    parser.add_argument("--report-dir", required=True)
    parser.add_argument(
        "--generated-at",
        default=None,
        help="Horodatage ISO 8601 injecté. Par défaut : maintenant, UTC.",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("acquire", help="Réacquiert le périmètre signé et le prouve.")
    sub.add_parser("publish", help="Assemble et écrit les documents publics.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    handlers = {"acquire": command_acquire, "publish": command_publish}
    try:
        return handlers[args.command](args)
    except PublicationRefused as exc:
        print(str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
