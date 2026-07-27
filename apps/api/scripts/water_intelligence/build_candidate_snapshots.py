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
from datetime import datetime, timezone
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
from services.intelligence import license_policy
from services.water.staging_environment import staging_connection_factory
from services.water.staging_ingestion import (
    StagingIngestionRefused,
    load_verified_request,
    report_retrieved_on,
)
from services.water.staging_writer import load_source_row, prepare_release
from services.water_intelligence import public_snapshot_builder as builder
from services.water_intelligence import release_parity, release_provenance
from services.water_intelligence.publication_decisions import (
    PublicationDecisionRegistry,
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

    Délégué à `public_snapshot_builder` : ce script en portait une seconde
    définition, avec son propre motif et son propre réviseur factice. Deux
    registres de mesure divergeraient à la première correction de l'un des
    deux, et un artefact de run ne dirait plus lequel l'a produit. Il n'y en a
    qu'un.
    """
    return builder.measurement_registry(source_codes)


def verify_nothing_is_approved() -> None:
    """Le registre RÉEL ne porte aucune signature — vérifié, pas supposé."""
    try:
        builder.assert_real_registry_untouched()
    except builder.RealRegistryMutated as exc:
        raise CandidateBuildError(f"{exc} X4B-PREP ne signe rien.") from exc


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
class _PreparedReleases:
    """Les releases préparées du run, indexées par (CANDIDAT, source).

    Elles viennent des ARTEFACTS, jamais de la table `observations` : celle-ci
    ne conserve qu'une projection du contrat P02 (ni période, ni portée ou
    libellé de géographie, ni couverture, et la provenance vit dans
    `source_releases`). C'est le constat de la PR #174, et la décision
    d'architecture de cette phase : **le snapshot public ne se reconstruit
    jamais depuis la projection SQL.**

    ## Pourquoi le candidat fait partie de la clé

    `HUBEAU_ADES` figure dans les TROIS candidats, avec une `release_key`
    différente à chaque fois, et `HUBEAU_QUALITE_SURFACE` y porte deux fenêtres
    distinctes (janvier pour `balanced_pilot`, le trimestre pour
    `x3_technical_sample`). Un index sur la seule source ferait que la mesure
    de `minimal_pilot` additionnerait les trois releases ADES : **trois fois
    ses observations, trois fois son budget** — et ce sont précisément les
    chiffres censés guider la décision de publication.

    Même famille de défaut que les chemins d'acquisition partagés corrigés en
    PR #174 : une clé trop courte confond des choses distinctes, et l'erreur
    est un nombre plausible, pas un plantage.
    """

    by_candidate: dict[str, dict[str, list[Any]]]

    def observations(self, candidate_key: str, codes: Sequence[str]) -> list[Any]:
        group = self.by_candidate.get(candidate_key, {})
        out: list[Any] = []
        for code in codes:
            out.extend(
                observation
                for release in group.get(code, [])
                for observation in release.observations
            )
        return out

    def codes_of(self, candidate_key: str) -> frozenset[str]:
        return frozenset(self.by_candidate.get(candidate_key, {}))

    def releases(self) -> list[Any]:
        return [
            release
            for group in self.by_candidate.values()
            for bucket in group.values()
            for release in bucket
        ]


def _prepare_releases(
    args: argparse.Namespace, artifacts: Path, reports: Path
) -> _PreparedReleases:
    """Rejoue la MÊME préparation que le graveur, depuis les artefacts.

    Deux accès base, tous deux en LECTURE : la ligne du Source Registry (pour
    confronter la provenance et évaluer les capacités de licence, exactement
    comme le graveur) et les observations déjà gravées de chaque release (pour
    la parité). Aucune observation publiable n'est LUE depuis SQL — elles sont
    toutes préparées ici, à partir des artefacts vérifiés.
    """
    factory, _target = staging_connection_factory(
        expect_database=args.expect_database, ephemeral=True
    )
    by_candidate: dict[str, dict[str, list[Any]]] = {}
    parities: list[dict[str, Any]] = []

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

            for candidate in _selected(args.candidate):
                for scope in candidate.scopes:
                    release_key = (
                        f"{scope.source_code.lower()}-{candidate.key}-x4b-prep"
                    )
                    artifact_dir, report_path = _scope_paths(
                        candidate.key,
                        scope.source_code,
                        artifacts=artifacts,
                        reports=reports,
                    )
                    prepared = _prepare_one(
                        cur,
                        source_code=scope.source_code,
                        release_key=release_key,
                        artifact_dir=artifact_dir,
                        report_path=report_path,
                    )
                    by_candidate.setdefault(candidate.key, {}).setdefault(
                        scope.source_code, []
                    ).append(prepared)
                    parities.append(
                        _check_parity(cur, prepared, candidate_key=candidate.key)
                    )

    _write(reports / "25_parity.json", {"releases": parities})
    return _PreparedReleases(by_candidate=by_candidate)


def _prepare_one(
    cur, *, source_code: str, release_key: str, artifact_dir: Path, report_path: Path
) -> Any:
    """Une release préparée — via `prepare_release()`, le graveur lui-même.

    Aucun second normaliseur : la fonction appelée ici est celle qui grave. Une
    préparation parallèle « pour mesurer » divergerait de la préparation qui
    publie à la première correction apportée à l'une des deux.
    """
    loaded = load_verified_request(
        source_code=source_code,
        release_key=release_key,
        artifact_path=artifact_dir,
        report_path=report_path,
        operator="x4b-measure",
        dry_run=True,
    )
    # Même date que celle qu'a gravée l'ingestion : lue dans le rapport, jamais
    # « aujourd'hui ». Une release mesurée sous une autre date de consultation
    # porterait une attribution différente de la release gravée.
    retrieved_at = report_retrieved_on(loaded.report)
    provenance = release_provenance.provenance_for(
        source_code, accessed_on=retrieved_at
    )

    # `load_source_row()`, la fonction du graveur — pas une requête réécrite ici.
    # La version manuscrite précédente interrogeait une table `sources` qui
    # n'existe pas (le registre est `source_registry`) et sélectionnait des
    # colonnes `license_*` absentes du schéma : elle aurait levé
    # `UndefinedTable` APRÈS les acquisitions réseau et l'ingestion des trois
    # candidats. Même famille de défaut que l'invocation `ingest_release`
    # composée d'après son usage supposé (PR #174) — une requête écrite de
    # mémoire est une supposition tant qu'elle n'est pas celle du code qui
    # marche.
    try:
        row = load_source_row(cur, source_code)
    except StagingIngestionRefused as exc:
        raise CandidateBuildError(
            f"{source_code} : {exc} Semer le registre "
            "(`staging_rehearsal seed-sources`) avant de mesurer."
        ) from exc
    # Mêmes barrières que le graveur, dans le même ordre : la provenance est
    # confrontée à la configuration, PUIS la licence est évaluée en base.
    release_provenance.verify_registry_row(provenance, row)
    decision = license_policy.evaluate(row)
    if not (decision.allow_ingest and decision.allow_store):
        raise CandidateBuildError(
            f"{source_code} : licence refusant ingestion ou conservation — "
            + " ; ".join(decision.reasons)
        )

    return prepare_release(
        loaded.request,
        pages=loaded.decoded_pages,
        report=loaded.report,
        license_decision=decision,
        retrieved_at=retrieved_at,
        provenance=provenance,
    )


def _check_parity(cur, prepared: Any, *, candidate_key: str) -> dict[str, Any]:
    """Parité entre la release préparée et ce que la base porte réellement.

    Les lignes relues servent à CONFRONTER, jamais à composer : aucune
    observation publiable n'en est dérivée. Une divergence lève, et le run
    s'arrête — un budget mesuré sur une release amputée ne serait le budget de
    rien.
    """
    cur.execute(
        "SELECT o.subject_type, o.subject_key, o.metric_code, o.geography_code, "
        "o.valid_from, o.valid_to, o.unit, o.methodology_version "
        "FROM observations o JOIN source_releases r ON r.id = o.source_release_id "
        "WHERE r.release_key = %s AND o.company_id IS NULL AND r.published_at IS NULL",
        (prepared.release_key,),
    )
    rows = [dict(row) for row in cur.fetchall()]
    # `enforce_budget=False` : la parité vérifie que le CONTENU d'une release
    # survit fidèlement à l'assemblage (gate licence, provenance, exclusions),
    # pas si elle tient sous 100 000 octets À ELLE SEULE — orthogonal, et
    # mesuré séparément par `command_measure`. Une release individuellement
    # surdimensionnée (cas connu : ADES/x3_technical_sample, ~255 ko) ne doit
    # pas faire échouer TOUT le run de mesure avant que le budget n'ait eu la
    # chance d'être rapporté proprement en `over_budget`.
    reconstructed = builder.reconstruct_candidate(
        label=f"{candidate_key}/{prepared.source_code}",
        releases=[prepared],
        generated_at=datetime.now(timezone.utc),
        enforce_budget=False,
    )
    manifest = reconstructed.snapshot.manifest
    try:
        report = release_parity.check_release_parity(
            prepared,
            candidate_observations=manifest.observations if manifest else [],
            persisted_rows=rows or None,
        )
    except release_parity.ParityViolation as exc:
        raise CandidateBuildError(
            f"ARRÊT — parité rompue sur {candidate_key}/{prepared.source_code}.\n{exc}"
        ) from exc
    return {"candidate": candidate_key, **report.as_mapping()}


def command_measure(args: argparse.Namespace) -> int:
    artifacts, reports = Path(args.artifact_dir), Path(args.report_dir)
    loaded = _prepare_releases(args, artifacts, reports)
    clock = datetime.now(timezone.utc)

    measurements: list[budget.BudgetMeasurement] = []
    candidate_measurements: list[budget.BudgetMeasurement] = []
    skipped: list[dict[str, Any]] = []

    for candidate in _selected(args.candidate):
        available = loaded.codes_of(candidate.key)

        # Les combinaisons de sources — mesurées DANS un candidat, jamais entre
        # candidats. Une même source n'y a pas le même périmètre : ADES est
        # commune aux trois, mais QUALITE couvre janvier dans `balanced_pilot`
        # et le trimestre dans `x3_technical_sample`. Une combinaison mesurée
        # sans nommer son candidat serait un chiffre que personne ne peut
        # reproduire.
        for combination in BUDGET_COMBINATIONS:
            if not set(combination) <= available:
                # Combinaison hors du périmètre de ce candidat — `minimal_pilot`
                # ne porte qu'ADES. Consigné plutôt que silencieusement absent :
                # une ligne manquante dans un tableau de budgets se lit comme un
                # oubli, pas comme une décision.
                skipped.append(
                    {
                        "candidate": candidate.key,
                        "combination": list(combination),
                        "reason": "sources_hors_perimetre_du_candidat",
                    }
                )
                continue
            measurements.append(
                budget.measure(
                    label=(
                        f"{candidate.key} — combinaison : " + " + ".join(combination)
                    ),
                    observations=loaded.observations(candidate.key, combination),
                    registry=measurement_registry(combination),
                    generated_at=clock,
                )
            )

        # Puis le candidat exact.
        codes = candidate.source_codes
        measurement = budget.measure(
            label=f"{candidate.key} — {candidate.title}",
            observations=loaded.observations(candidate.key, codes),
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
            "skipped_combinations": skipped,
            "scope_note": (
                "Chaque mesure est indexée sur un CANDIDAT. Une même source n'a "
                "pas le même périmètre d'un candidat à l'autre : additionner ses "
                "releases entre candidats gonflerait les comptes et les budgets."
            ),
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
