"""
scripts/water_intelligence/build_candidate_snapshots.py — constructeur des
snapshots CANDIDATS X4B-PREP.

Quatre sous-commandes, toutes passant par la MÊME porte d'environnement que le
graveur (`services.water.staging_environment`) : jamais `DATABASE_URL`, jamais
`DATABASE_ADMIN_URL`, jamais une destination non prouvée.

    acquire     acquiert les périmètres de `candidate_scopes` (réseau)
    ingest      ingère puis rejoue, pour prouver l'idempotence
    measure     assemble et MESURE les budgets — lecture seule en base
    diff-ades   compare les acquisitions X2A / X3 / X4B-PREP

## Ce que ce script ne fait pas

- **Il ne publie rien.** Aucun document canonique n'est écrit, aucun snapshot
  public n'est modifié. `measure` assemble en mémoire et rapporte des chiffres.
- **Il n'approuve rien.** Le registre des décisions humaines est LU. Pour
  mesurer un budget il faut pourtant qu'une source franchisse le gate — d'où un
  registre de MESURE, construit en mémoire, explicitement nommé comme tel, et
  qui ne touche jamais `CURRENT_DECISIONS`. Mesurer ce que pèserait une
  publication n'est pas l'autoriser.
- **Il ne tronque jamais.** Un candidat au-dessus de 100 000 octets ressort
  `over_budget` ; le plafond n'est pas relevé et aucune preuve n'est retirée.
- **Il ne commit aucun payload brut.** Les artefacts restent hors dépôt ; seuls
  checksums, statistiques et diffs de forme sont rapportés.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Sequence

from scripts.water_intelligence import candidate_budget as budget
from scripts.water_intelligence.candidate_scopes import (
    BUDGET_COMBINATIONS,
    CANDIDATES,
    CANDIDATES_BY_KEY,
    Candidate,
    SourceScope,
)
from services.water.staging_environment import staging_connection_factory
from services.water_intelligence.publication_decisions import (
    PublicationDecision,
    PublicationDecisionRegistry,
    current_registry,
)

#: Checksums de référence de la variation ADES non expliquée (§4.3 du plan).
ADES_REFERENCE_CHECKSUMS = {
    "X2A": "52bc5f94759d7c96b06ef2853fd417342e2a9e409f77e2900af9ad2518bbd7c6",
    "X3": "54ac8e5b4d895f323ee352c1c7c8ddde3c9a3c5dae469b6e351ac46fc76ee00b",
}
#: Nombre d'octets identique des deux côtés — c'est ce qui rend la variation
#: intéressante : même longueur, contenu différent ⇒ quelque chose a été
#: REMPLACÉ par une chaîne de même longueur, jamais ajouté ni retiré.
ADES_REFERENCE_BYTES = 52_139


class CandidateBuildError(Exception):
    """Échec explicite — jamais un rapport vert obtenu par contournement."""


# ---------------------------------------------------------------------------
# Registre de MESURE — jamais une approbation
# ---------------------------------------------------------------------------


def measurement_registry(source_codes: Sequence[str]) -> PublicationDecisionRegistry:
    """Registre en mémoire autorisant les sources À MESURER.

    Il n'existe que le temps d'un assemblage de mesure et n'est jamais écrit.
    `CURRENT_DECISIONS` reste intouché : les sept sources y demeurent
    `proposed`/`refused`, et `verify_nothing_is_approved()` le vérifie à la fin
    de chaque exécution.

    Le motif est écrit en toutes lettres dans le registre lui-même, pour qu'un
    artefact de run relu plus tard ne puisse pas être confondu avec une
    décision.
    """
    return PublicationDecisionRegistry(
        [
            PublicationDecision(
                source_code=code,
                status="approved",
                reason=(
                    "MESURE X4B-PREP UNIQUEMENT — registre en mémoire, jamais écrit, "
                    "jamais publié. Ne vaut aucune approbation humaine : le registre "
                    "réel reste inchangé et aucune de ses sources n'est approuvée."
                ),
                reviewed_by="x4b-prep-measurement (non humain, sans valeur de signature)",
                reviewed_on=date(1970, 1, 1),
            )
            for code in sorted(set(source_codes))
        ]
    )


def verify_nothing_is_approved() -> None:
    """Le registre RÉEL ne porte aucune signature — vérifié, pas supposé."""
    approved = current_registry().approved_source_codes
    if approved:
        raise CandidateBuildError(
            f"ARRÊT — le registre réel porte des sources approuvées : {approved}. "
            "X4B-PREP ne signe rien."
        )


# ---------------------------------------------------------------------------
# acquire — compose les invocations de validate_hubeau depuis les périmètres
# ---------------------------------------------------------------------------


def _scope_paths(
    candidate_key: str, source_code: str, *, artifacts: Path, reports: Path
) -> tuple[Path, Path]:
    """Répertoire d'artefacts et rapport d'UNE source DANS UN candidat.

    Les deux sont indexés sur le couple (candidat, source), jamais sur la seule
    source : `HUBEAU_ADES` figure dans les TROIS candidats, avec une
    `release_key` différente à chaque fois. Des chemins indexés sur la seule
    source feraient que `--candidate all` écrase les artefacts et le rapport de
    A par ceux de B, puis par ceux de C — et l'ingestion de A recevrait le
    rapport de C. `verify_report()` rejetterait alors la `release_key`
    discordante, après que les trois acquisitions réseau ont déjà été
    consommées.

    Un répertoire par couple supprime aussi le risque de pages RÉSIDUELLES :
    une acquisition plus courte ne laisse pas derrière elle les pages d'une
    acquisition précédente plus longue.
    """
    return (
        artifacts / candidate_key / source_code,
        reports / f"acq_{candidate_key}_{source_code}.md",
    )


def _acquisition_argv(
    scope: SourceScope,
    *,
    candidate_key: str,
    release: str,
    artifacts: Path,
    reports: Path,
) -> list[str]:
    """Invocation `validate_hubeau` d'UN périmètre.

    Composée depuis `candidate_scopes`, jamais recopiée dans le workflow : une
    recette dupliquée dérive de son module de référence à la première
    modification, et c'est exactement ce qui rend un périmètre publié différent
    du périmètre approuvé.
    """
    artifact_dir, report = _scope_paths(
        candidate_key, scope.source_code, artifacts=artifacts, reports=reports
    )
    argv = [
        sys.executable, "-m", "scripts.water_intelligence.validate_hubeau",
        "--source", scope.family,
        "--release", release,
        "--geography-type", scope.geography_type,
        "--geography-code", scope.geography_code,
        "--date-from", scope.date_from,
        "--date-to", scope.date_to,
        "--max-pages", str(scope.max_pages),
        "--max-bytes", "2000000",
        "--page-size", str(scope.page_size),
        "--report", str(report),
        "--artifact-dir", str(artifact_dir),
    ]
    for code in scope.parameter_codes:
        argv += ["--parameter-code", code]
    if scope.max_years is not None:
        argv += ["--max-years", str(scope.max_years)]
    return argv


def _read_acquisition(
    artifacts: Path, candidate_key: str, source_code: str
) -> dict[str, Any]:
    """Relit l'artefact d'acquisition d'UN couple (candidat, source)."""
    directory = artifacts / candidate_key / source_code
    found = sorted(directory.glob("*.json"))
    if not found:
        raise CandidateBuildError(
            f"{candidate_key}/{source_code} : aucun artefact d'acquisition dans {directory}."
        )
    return json.loads(found[-1].read_text(encoding="utf-8"))


def _assert_exhaustive(scope: SourceScope, acquisition: dict[str, Any]) -> dict[str, Any]:
    """Une prétention d'exhaustivité doit être PROUVÉE, pas déclarée.

    Le seul signal disponible est la saturation de la dernière page : si elle
    est pleine, des enregistrements ont pu rester de l'autre côté de la borne,
    et le périmètre est tronqué — pas exhaustif.
    """
    received = int(acquisition.get("records_received") or 0)
    pages = int(acquisition.get("pages") or 0)
    last_page_full = pages > 0 and received == pages * scope.page_size
    exhaustive = not last_page_full

    if scope.expects_incomplete_last_page and not exhaustive:
        raise CandidateBuildError(
            f"{scope.source_code} : ce périmètre prétend être exhaustif, mais sa "
            f"dernière page est SATURÉE ({received} = {pages} × {scope.page_size}). "
            "Des enregistrements peuvent avoir été laissés de l'autre côté de la "
            "borne : le périmètre est tronqué, pas complet. Resserrer la fenêtre "
            "ou augmenter --max-pages, jamais publier tel quel."
        )
    return {
        "records_received": received,
        "pages": pages,
        "page_size": scope.page_size,
        "last_page_full": last_page_full,
        "exhaustive": exhaustive,
        "announced_total": acquisition.get("count"),
        "payload_sha256": acquisition.get("payload_sha256"),
    }


def command_acquire(args: argparse.Namespace) -> int:
    artifacts, reports = Path(args.artifact_dir), Path(args.report_dir)
    summary: dict[str, Any] = {"candidate": args.candidate, "scopes": []}

    for candidate in _selected(args.candidate):
        for scope in candidate.scopes:
            release = f"{scope.source_code.lower()}-{candidate.key}-x4b-prep"
            argv = _acquisition_argv(
                scope,
                candidate_key=candidate.key,
                release=release,
                artifacts=artifacts,
                reports=reports,
            )
            print(f"→ {scope.source_code} ({candidate.key})", flush=True)
            result = subprocess.run(argv, check=False)
            if result.returncode != 0:
                raise CandidateBuildError(
                    f"{scope.source_code} : acquisition en échec (code {result.returncode}). "
                    "Un verdict dégradé se corrige, il ne se contourne pas."
                )
            acquisition = _read_acquisition(artifacts, candidate.key, scope.source_code)
            summary["scopes"].append(
                {
                    "candidate": candidate.key,
                    "source_code": scope.source_code,
                    "release_key": release,
                    "geography_type": scope.geography_type,
                    "geography_code": scope.geography_code,
                    "date_from": scope.date_from,
                    "date_to": scope.date_to,
                    "parameter_codes": list(scope.parameter_codes),
                    "justification": scope.justification,
                    "interpretation_risk": scope.interpretation_risk,
                    **_assert_exhaustive(scope, acquisition),
                }
            )

    _write(reports / "10_acquisitions.json", summary)
    return 0


# ---------------------------------------------------------------------------
# ingest — ingestion puis rejeu, sur staging éphémère
# ---------------------------------------------------------------------------


def _ingestion_argv(
    scope: SourceScope,
    *,
    candidate_key: str,
    release: str,
    expect_database: str,
    artifacts: Path,
    reports: Path,
) -> list[str]:
    """Invocation `ingest_release` d'UN périmètre.

    Composée depuis la signature RÉELLE du graveur, pas depuis son usage
    supposé : `--source-code`, `--artifact`, `--report` et `--expect-database`
    y sont **obligatoires**, et `--ephemeral` est ce qui déclare une base
    jetable. Une invocation approximative échouerait au premier appel avec un
    `unrecognized arguments`, après avoir déjà consommé les acquisitions
    réseau — c'est-à-dire au pire moment.

    `test_ingestion_argv_is_accepted_by_the_real_parser` confronte cette
    composition au parser du graveur : si l'un des deux bouge, la CI casse
    avant le run, pas pendant.
    """
    artifact_dir, report = _scope_paths(
        candidate_key, scope.source_code, artifacts=artifacts, reports=reports
    )
    return [
        sys.executable, "-m", "scripts.water_intelligence.ingest_release",
        "--source-code", scope.source_code,
        "--release", release,
        "--artifact", str(artifact_dir),
        "--report", str(report),
        "--environment", "staging",
        "--expect-database", expect_database,
        # Staging JETABLE : les releases ne survivent pas au job. Le déclarer
        # explicitement plutôt que le laisser deviner — X3 a montré qu'un
        # drapeau qui NOMME une intention sans la faire respecter ne protège
        # rien, et l'inverse vaut aussi : une intention non déclarée n'est pas
        # une intention.
        "--ephemeral",
    ]


def command_ingest(args: argparse.Namespace) -> int:
    artifacts, reports = Path(args.artifact_dir), Path(args.report_dir)
    outcome: list[dict[str, Any]] = []

    for candidate in _selected(args.candidate):
        for scope in candidate.scopes:
            release = f"{scope.source_code.lower()}-{candidate.key}-x4b-prep"
            base = _ingestion_argv(
                scope,
                candidate_key=candidate.key,
                release=release,
                expect_database=args.expect_database,
                artifacts=artifacts,
                reports=reports,
            )
            # Dry-run d'abord : il exécute le VRAI chemin d'écriture puis
            # avorte la transaction — il ne simule rien.
            for phase, extra in (("dry-run", ["--dry-run"]), ("commit", ["--commit"]),
                                 ("replay", ["--commit"])):
                result = subprocess.run(base + extra, check=False)
                if result.returncode != 0:
                    raise CandidateBuildError(
                        f"{scope.source_code} : phase {phase} en échec "
                        f"(code {result.returncode})."
                    )
                outcome.append(
                    {"candidate": candidate.key, "source_code": scope.source_code,
                     "release_key": release, "phase": phase, "returncode": result.returncode}
                )

    _write(reports / "20_ingestion.json", {"phases": outcome})
    return 0


# ---------------------------------------------------------------------------
# measure — LECTURE SEULE en base, assemblage en mémoire, mesure de budget
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _LoadedObservations:
    by_source: dict[str, list[Any]]

    def for_codes(self, codes: Sequence[str]) -> list[Any]:
        out: list[Any] = []
        for code in codes:
            out.extend(self.by_source.get(code, []))
        return out


def _load_observations(expect_database: str) -> _LoadedObservations:
    """Relit les observations des releases `validated`, en LECTURE SEULE.

    Trois prédicats non négociables : `published_at IS NULL` (rien de déjà
    publié), `company_id IS NULL` (aucune donnée tenant), et une release
    `validated`. Le constructeur REFUSE de produire un document si une ligne
    tenant apparaît, plutôt que de la filtrer — filtrer masquerait le fait
    qu'une donnée tenant a atteint une release publique.
    """
    factory, _target = staging_connection_factory(
        expect_database=expect_database, ephemeral=True
    )
    try:
        from services.water.staging_ingestion import (  # type: ignore[attr-defined]
            read_validated_observations,
        )
    except ImportError as exc:
        # DÉFAUT CONNU, non masqué. `services/water/staging_ingestion.py` n'expose
        # aucun lecteur de ce nom : la table `observations` ne stocke qu'une
        # PROJECTION du contrat P02 (ni `period_start`/`period_end`, ni portée
        # ou libellé de géographie, ni couverture, ni référence de source — la
        # provenance vit dans `source_releases`). Reconstruire un
        # `WaterMetricObservation` fidèle depuis cette projection est exactement
        # le travail que le §5.1 du plan X4B assigne à un script
        # `build_public_snapshot.py` qui n'existe pas encore.
        #
        # Écrire ici une reconstruction approximative produirait des mesures de
        # budget plausibles et fausses — précisément ce que cette phase existe
        # pour empêcher. L'étape échoue donc en le NOMMANT.
        raise CandidateBuildError(
            "ARRÊT — la mesure de budget n'est pas implémentable en l'état : "
            "`services.water.staging_ingestion` n'expose aucun lecteur "
            "`read_validated_observations`, et la table `observations` ne "
            "conserve qu'une projection du contrat P02 (période, géographie et "
            "provenance ne s'y relisent pas). Reconstruire une observation "
            "fidèle relève du §5.1 du plan X4B. Les acquisitions, l'ingestion "
            "et le rejeu de ce run restent valides — seule la mesure est "
            "bloquée. Aucune mesure approximative n'est produite."
        ) from exc

    with factory() as connection:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) AS n FROM observations WHERE company_id IS NOT NULL"
            )
            leaked = cur.fetchone()["n"]
            if leaked:
                raise CandidateBuildError(
                    f"ARRÊT — {leaked} observation(s) portent un company_id. Le "
                    "constructeur refuse de produire un document plutôt que de les "
                    "filtrer : filtrer masquerait qu'une donnée tenant a atteint une "
                    "release publique."
                )
        observations = read_validated_observations(connection)

    by_source: dict[str, list[Any]] = {}
    for observation in observations:
        by_source.setdefault(observation.source.source_code, []).append(observation)
    return _LoadedObservations(by_source=by_source)


def command_measure(args: argparse.Namespace) -> int:
    reports = Path(args.report_dir)
    loaded = _load_observations(args.expect_database)
    clock = datetime.now(timezone.utc)

    measurements: list[budget.BudgetMeasurement] = []

    # Les sept combinaisons de base — elles disent où le budget casse,
    # indépendamment de tout choix éditorial.
    for combination in BUDGET_COMBINATIONS:
        observations = loaded.for_codes(combination)
        measurements.append(
            budget.measure(
                label="combinaison : " + " + ".join(combination),
                observations=observations,
                registry=measurement_registry(combination),
                generated_at=clock,
            )
        )

    # Puis les trois candidats exacts.
    candidate_measurements: list[budget.BudgetMeasurement] = []
    for candidate in _selected(args.candidate):
        codes = candidate.source_codes
        measurement = budget.measure(
            label=f"{candidate.key} — {candidate.title}",
            observations=loaded.for_codes(codes),
            registry=measurement_registry(codes),
            generated_at=clock,
        )
        measurements.append(measurement)
        if candidate.recommended_for_publication:
            candidate_measurements.append(measurement)

    recommended = budget.recommend(candidate_measurements)

    _write(
        reports / "30_budgets.json",
        {
            "budget_bytes": budget.MAX_MANIFEST_BYTES_UNCOMPRESSED,
            "measurements": [m.as_mapping() for m in measurements],
            "recommended": recommended.as_mapping() if recommended else None,
            "recommendation_note": (
                "Recommandation TECHNIQUE : le plus grand candidat conforme au budget, "
                "sans perte de provenance. Elle ne vaut aucune approbation humaine — "
                "le périmètre éditorial, les limites à afficher et la décision restent "
                "au signataire."
            ),
        },
    )
    verify_nothing_is_approved()
    return 0


# ---------------------------------------------------------------------------
# diff-ades — la variation de checksum non expliquée
# ---------------------------------------------------------------------------


def command_diff_ades(args: argparse.Namespace) -> int:
    """Compare X2A, X3 et l'acquisition du run, et rend un verdict NOMMÉ.

    Trois verdicts possibles, et un seul bloque :

    - `byte_stable` — le checksum est celui attendu, rien à expliquer ;
    - `transport_only_variation` — les octets diffèrent mais **aucune valeur
      métier** ne change : la variation est de forme (URL de pagination,
      `api_version`, ordre de clés). Documenter le diff exact, puis publier ;
    - `content_changed` — une valeur a changé côté source. **Bloque ADES.**
      Une donnée qui bouge sans explication n'est pas publiable, et la question
      remonte au signataire.
    """
    artifacts, reports = Path(args.artifact_dir), Path(args.report_dir)
    # Comparé sur `x3_technical_sample`, la reproduction STRICTE des bornes X3 :
    # c'est la seule comparaison apples-to-apples avec le checksum X3. Lire un
    # autre candidat opposerait un payload acquis sur une autre fenêtre à une
    # référence qui ne la décrit pas — un écart alors « constaté » ne dirait
    # rien de la source.
    acquisition = _read_acquisition(artifacts, "x3_technical_sample", "HUBEAU_ADES")
    digest = acquisition.get("payload_sha256")
    received_bytes = int(acquisition.get("bytes") or 0)

    matches = {
        label: (digest == expected) for label, expected in ADES_REFERENCE_CHECKSUMS.items()
    }
    same_length = received_bytes == ADES_REFERENCE_BYTES

    if matches.get("X3"):
        verdict = "byte_stable"
        detail = "Checksum identique à celui de X3 : aucune variation à expliquer."
    elif same_length:
        # Même longueur, contenu différent ⇒ quelque chose a été REMPLACÉ par
        # une chaîne de même longueur. C'est l'hypothèse de l'URL de pagination
        # (`size=100` / `size=200`, même nombre de caractères). Elle reste une
        # hypothèse tant que le diff n'a pas été produit : le verdict est donc
        # provisoire et exige une inspection.
        verdict = "transport_only_variation_unproven"
        detail = (
            "Nombre d'octets identique à la référence mais checksum différent : "
            "quelque chose a été REMPLACÉ par une chaîne de même longueur, jamais "
            "ajouté ni retiré. L'hypothèse de l'URL de pagination doit être "
            "DÉMONTRÉE par un diff octet à octet des deux payloads, hors dépôt, "
            "avant toute publication. Tant qu'elle ne l'est pas, ce verdict n'est "
            "pas `transport_only_variation`."
        )
    else:
        verdict = "content_changed"
        detail = (
            "Checksum ET longueur diffèrent des références : une valeur a "
            "probablement changé côté source. BLOQUE ADES — une donnée qui bouge "
            "sans explication n'est pas publiable, et la question remonte au "
            "signataire."
        )

    payload = {
        "source_code": "HUBEAU_ADES",
        "reference_checksums": ADES_REFERENCE_CHECKSUMS,
        "reference_bytes": ADES_REFERENCE_BYTES,
        "run_checksum": digest,
        "run_bytes": received_bytes,
        "matches_reference": matches,
        "same_byte_length_as_reference": same_length,
        "verdict": verdict,
        "detail": detail,
        "publication_checksum_note": (
            "Le checksum de publication sera celui de l'artefact EXACT retenu dans "
            "la PR de publication, jamais celui de X3 par défaut."
        ),
    }
    _write(reports / "40_ades_diff.json", payload)

    if verdict == "content_changed":
        raise CandidateBuildError(
            "ARRÊT — diff ADES `content_changed` inexpliqué : ADES est bloquée."
        )
    return 0


# ---------------------------------------------------------------------------
# Plomberie
# ---------------------------------------------------------------------------


def _selected(key: str) -> tuple[Candidate, ...]:
    if key in ("all", "", None):
        return CANDIDATES
    if key not in CANDIDATES_BY_KEY:
        raise CandidateBuildError(
            f"candidat {key!r} inconnu — attendus : {sorted(CANDIDATES_BY_KEY)} ou 'all'."
        )
    return (CANDIDATES_BY_KEY[key],)


def _write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"écrit : {path}", flush=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Construit et mesure les snapshots candidats X4B-PREP. Ne publie rien."
    )
    parser.add_argument("--expect-database", required=True)
    parser.add_argument("--candidate", default="all")
    parser.add_argument("--artifact-dir", required=True)
    parser.add_argument("--report-dir", required=True)
    parser.add_argument(
        "command", choices=("acquire", "ingest", "measure", "diff-ades")
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    # Le registre réel est vérifié AVANT et APRÈS : une exécution qui
    # signerait quoi que ce soit doit échouer, pas se rattraper.
    verify_nothing_is_approved()
    handlers = {
        "acquire": command_acquire,
        "ingest": command_ingest,
        "measure": command_measure,
        "diff-ades": command_diff_ades,
    }
    try:
        code = handlers[args.command](args)
    except CandidateBuildError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    verify_nothing_is_approved()
    # Rappel imprimé à chaque exécution : ce script ne décide rien.
    print(
        "\nX4B-PREP : aucune donnée publiée, aucune source approuvée, "
        "aucun document canonique modifié.",
        flush=True,
    )
    return code


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
