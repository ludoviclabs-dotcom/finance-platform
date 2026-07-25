"""
routers/water_intelligence.py — surfaces PUBLIQUES de Water Intelligence
(P16, Wave E, commit E3).

Router monté **SANS dépendance d'authentification**, comme `routers/verify.py`.
La discipline qui en découle est la même, et elle est stricte : rien de ce qui
sort d'ici ne doit dépendre d'un tenant, d'un utilisateur ou d'une session.

## Ce que ces deux endpoints ne font pas

- **Aucune ingestion.** Ils lisent un état déjà assemblé ; ils ne déclenchent
  aucun connecteur, aucun pipeline, aucune écriture.
- **Aucun appel externe.** Aucun client HTTP n'est importé ici, donc aucun appel
  n'est possible — ni au runtime, ni en test.
- **Aucune observation non autorisée.** Le snapshot servi est assemblé par le
  registre de décisions de publication : tant qu'aucune décision humaine n'est
  signée, il est vide. Ce n'est pas un cas dégradé, c'est le résultat du gate.
- **Aucune conclusion juridique.** Le registre expose les textes à instruire et
  leur statut `unknown` ; il ne dit pas le droit.

## ETag : première occurrence dans ce dépôt

Aucun endpoint n'exposait jusqu'ici de validateur HTTP. Plutôt que d'inventer un
schéma, on réutilise le format déjà défini et testé par
`WaterPublicSnapshot.etag()` — un validateur **faible** `W/"wi-<sha256[:32]>"`
calculé sur les octets canoniques du snapshot.

Faible et non fort, délibérément : la représentation servie est sémantiquement
équivalente d'une requête à l'autre, mais rien ne garantit l'égalité octet pour
octet après sérialisation par le framework. Annoncer un validateur fort serait
une promesse qu'on ne tient pas.

Conséquence utile : le cache ne peut être invalidé que par un changement **réel**
de contenu — réassembler le même snapshot ne produit pas un nouvel ETag.
"""

from __future__ import annotations

import hashlib
import json

from fastapi import APIRouter, Header, Response, status

from models.water_intelligence_api import (
    WaterPublicSnapshotResponse,
    WaterRegulatoryRegistryResponse,
)
from services.water_intelligence.public_snapshot import (
    SNAPSHOT_SCHEMA_VERSION,
    canonical_empty_document,
)
from services.water_intelligence.regulatory_registry import current_registry

router = APIRouter()

#: Durée de fraîcheur annoncée. Le contenu ne change qu'avec un déploiement
#: (décision humaine de publication signée, ou registre juridique instruit),
#: jamais au fil de l'eau — un cache court serait du gaspillage sans bénéfice.
_PUBLIC_CACHE_CONTROL = "public, max-age=300"


def _weak_etag(prefix: str, payload: object) -> str:
    """Validateur faible sur les octets canoniques d'une charge.

    Même format que `WaterPublicSnapshot.etag()` : `W/"<prefix>-<sha256[:32]>"`.
    """
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f'W/"{prefix}-{digest[:32]}"'


def _matches(if_none_match: str | None, etag: str) -> bool:
    """Vrai si le client détient déjà cette représentation.

    Gère la liste séparée par des virgules et le joker `*`, conformément à
    RFC 9110 §13.1.2. La comparaison est faible : deux validateurs faibles
    identiques suffisent pour un 304.
    """
    if not if_none_match:
        return False
    candidates = [value.strip() for value in if_none_match.split(",")]
    return "*" in candidates or etag in candidates


@router.get(
    "/public-snapshot",
    response_model=WaterPublicSnapshotResponse,
    summary="Snapshot public Water Intelligence (lecture seule)",
)
async def get_public_snapshot(
    response: Response,
    if_none_match: str | None = Header(default=None, alias="If-None-Match"),
) -> WaterPublicSnapshotResponse | Response:
    """Sert le snapshot public autorisé.

    Aucune source n'ayant de décision de publication signée à ce jour, le
    snapshot servi est le **snapshot vide canonique** : il ne porte aucune
    observation, mais il porte les exclusions, leurs motifs, les décisions
    rendues et une couverture à zéro. C'est de l'information réelle.
    """
    snapshot = canonical_empty_document()
    etag = _weak_etag("wi", snapshot)

    if _matches(if_none_match, etag):
        # 304 : pas de corps, mais les en-têtes de validation restent requis.
        return Response(
            status_code=status.HTTP_304_NOT_MODIFIED,
            headers={"ETag": etag, "Cache-Control": _PUBLIC_CACHE_CONTROL},
        )

    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = _PUBLIC_CACHE_CONTROL
    return WaterPublicSnapshotResponse(
        schema_version=SNAPSHOT_SCHEMA_VERSION,
        is_empty=bool(snapshot["is_empty"]),
        snapshot=snapshot,
    )


@router.get(
    "/regulatory-registry",
    response_model=WaterRegulatoryRegistryResponse,
    summary="Registre juridique public (textes à instruire)",
)
async def get_regulatory_registry(
    response: Response,
    if_none_match: str | None = Header(default=None, alias="If-None-Match"),
) -> WaterRegulatoryRegistryResponse | Response:
    """Expose les textes à instruire et leur statut courant.

    Ne rend **aucune détermination d'entreprise** : la portée d'une règle pour
    une entité donnée dépend de déterminations humaines qui vivent côté
    authentifié. Ne rend **aucun conseil juridique** : chaque règle porte son
    statut `unknown` tant qu'un réviseur ne l'a pas instruite.
    """
    document = current_registry().canonical_document()
    etag = _weak_etag("wi-legal", document)

    if _matches(if_none_match, etag):
        return Response(
            status_code=status.HTTP_304_NOT_MODIFIED,
            headers={"ETag": etag, "Cache-Control": _PUBLIC_CACHE_CONTROL},
        )

    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = _PUBLIC_CACHE_CONTROL
    return WaterRegulatoryRegistryResponse(
        registry_version=str(document["registry_version"]),
        verified_rule_count=int(document["verified_rule_count"]),  # type: ignore[arg-type]
        rules=list(document["rules"]),  # type: ignore[arg-type]
    )
