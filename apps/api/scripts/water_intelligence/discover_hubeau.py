"""scripts/water_intelligence/discover_hubeau.py — découverte BORNÉE d'un
identifiant de station (X1.3).

Deux chroniques Hub'Eau n'acceptent qu'un identifiant de station :
`hydrometrie/obs_elab` exige `code_entite`, `niveaux_nappes/chroniques` exige
`code_bss`. Aucun des deux ne peut être filtré par département.

Le pack interdit d'écrire un territoire en dur, et il a raison : un code de
station figé dans un script devient une donnée métier que personne n'a
choisie, et qui survit à la recette qui l'a introduite. Cette commande
interroge donc le référentiel — une page, taille bornée — et IMPRIME des
candidats. L'opérateur en choisit un et le passe explicitement à
`validate_hubeau`.

Elle ne valide rien, ne normalise rien, n'écrit rien.

    python -m scripts.water_intelligence.discover_hubeau \\
      --source hydrometrie|piezometrie \\
      --geography-type code_departement --geography-code 34 \\
      --limit 5
"""

from __future__ import annotations

import argparse
import json
from typing import Sequence

from scripts.water_intelligence.fetcher import OperatorFetcher
from scripts.water_intelligence.validate_hubeau import build_socket_fetcher
from services.water_intelligence import hubeau_transport as transport_mod

#: Endpoint référentiel et champ d'identifiant, par famille.
REFERENTIALS: dict[str, tuple[str, str]] = {
    "hydrometrie": ("hydrometrie.stations", "code_station"),
    "piezometrie": ("piezometrie.stations", "code_bss"),
}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m scripts.water_intelligence.discover_hubeau",
        description="Découverte bornée d'identifiants de station Hub'Eau (lecture seule).",
    )
    parser.add_argument("--source", required=True, choices=sorted(REFERENTIALS))
    parser.add_argument("--geography-type", required=True)
    parser.add_argument("--geography-code", required=True)
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--page-size", type=int, default=20)
    parser.add_argument("--max-bytes", type=int, default=500_000)
    parser.add_argument("--timeout", type=float, default=20.0)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    endpoint_key, identifier_field = REFERENTIALS[args.source]
    endpoint = transport_mod.ENDPOINTS[endpoint_key]

    if args.geography_type not in endpoint.geographic_parameters:
        raise SystemExit(
            f"--geography-type {args.geography_type!r} inconnu pour {endpoint_key!r} ; "
            f"attendus : {sorted(endpoint.geographic_parameters)}."
        )

    query = transport_mod.HubeauQuery(
        endpoint_key=endpoint_key,
        parameters={args.geography_type: args.geography_code},
        page_size=args.page_size,
    )
    fetcher = OperatorFetcher(
        allowed_hosts=transport_mod.ALLOWED_HOSTS,
        timeout_seconds=args.timeout,
        max_bytes=args.max_bytes,
    )
    transport = transport_mod.HubeauTransport(
        query=query,
        fetcher=build_socket_fetcher(fetcher),
        max_pages=1,
        max_total_bytes=args.max_bytes,
        timeout_seconds=args.timeout,
    )

    page = transport.fetch_page(page_token=None)
    payload = json.loads(page.content.decode("utf-8"))
    records = payload.get("data") or []

    print(f"endpoint      : {endpoint.path}")
    print(f"HTTP          : {fetcher.log[-1].status_code}")
    print(f"content-type  : {fetcher.log[-1].content_type}")
    print(f"octets        : {page.content and len(page.content)}")
    print(f"count annoncé : {payload.get('count')}")
    print(f"candidats ({identifier_field}) :")
    for record in records[: args.limit]:
        identifier = record.get(identifier_field)
        label = record.get("libelle_station") or record.get("libelle_pe") or ""
        print(f"  - {identifier}  {label}".rstrip())
    return 0


if __name__ == "__main__":  # pragma: no cover - point d'entrée opérateur
    raise SystemExit(main())
