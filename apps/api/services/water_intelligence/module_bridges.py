"""
services/water_intelligence/module_bridges.py — carte des ponts entre Water
Intelligence et les modules CarbonCo (P14, Wave D).

## Le problème que ce module rend impossible

Water Intelligence a deux faces : une surface **publique** (`/water-intelligence`,
aucune donnée d'entreprise) et un **cockpit authentifié** (`/water`, données
tenant). Relier les deux est utile — un lecteur du contexte public doit pouvoir
rejoindre son propre suivi. Mais un lien mal construit suffit à faire fuiter du
tenant : il suffit qu'une page publique compose une URL du type
`/water?site=12345` pour que l'identifiant d'un site d'entreprise voyage dans
une surface publique, dans l'historique du navigateur et dans les journaux.

Ce module déclare donc les ponts **en données**, avec des invariants vérifiés à
la construction :

1. un pont partant du public est **unidirectionnel** et ne transporte **aucun
   paramètre** — la cible est un chemin nu ;
2. aucun pont public ne peut être marqué comme transportant du tenant ;
3. aucune cible ne peut contenir un nom de champ tenant.

Un pont mal formé est refusé au démarrage, pas détecté en revue.

## Ce que le pont transporte, et ce qu'il ne transporte pas

Un pont porte un **sens de lecture** (« le stress hydrique d'un bassin éclaire
l'exposition d'une matière »), pas une valeur. Il ne calcule rien, n'agrège
rien, et surtout ne produit **aucun score ESG global** : le chantier a
explicitement refusé l'indice composite depuis la Wave C, et un pont qui
additionnerait les dimensions le réintroduirait par la porte de service.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Literal, Mapping

#: Sens d'un pont.
#:
#: - `public_to_cockpit` : depuis la surface publique vers un module
#:   authentifié. Chemin nu obligatoire, aucun paramètre.
#: - `public_to_public` : entre deux surfaces publiques.
#: - `cockpit_internal` : entre deux modules authentifiés ; peut légitimement
#:   porter du contexte tenant, puisque les deux extrémités sont derrière
#:   l'authentification et la RLS.
BridgeDirection = Literal["public_to_cockpit", "public_to_public", "cockpit_internal"]

#: Noms de champs tenant interdits dans une cible de pont — même liste que le
#: garde-fou du snapshot public, pour que les deux barrières ne divergent pas.
_TENANT_FIELDS = ("company_id", "tenant_id", "site_id", "organisation_id", "user_id")


class ModuleBridgeError(Exception):
    """Pont mal formé — refusé à la construction, jamais toléré."""


@dataclass(frozen=True)
class ModuleBridge:
    """Un pont déclaré entre Water Intelligence et un module CarbonCo."""

    bridge_id: str
    target_path: str
    label: str
    #: Signal hydrique qui éclaire le module cible. Descriptif, jamais calculé.
    water_signal: str
    direction: BridgeDirection
    #: Ce que l'utilisateur trouvera de l'autre côté. Sert la matrice du handoff.
    reads: str
    #: Vrai uniquement pour un pont interne au cockpit.
    carries_tenant_context: bool = False

    def __post_init__(self) -> None:
        for name in ("bridge_id", "target_path", "label", "water_signal", "reads"):
            if not str(getattr(self, name)).strip():
                raise ModuleBridgeError(f"ModuleBridge.{name} obligatoire.")

        if not self.target_path.startswith("/"):
            raise ModuleBridgeError(
                f"{self.bridge_id} : la cible doit être un chemin interne "
                f"(reçu {self.target_path!r}) — un pont ne sort jamais du produit."
            )

        lowered = self.target_path.lower()
        for field_name in _TENANT_FIELDS:
            if field_name in lowered:
                raise ModuleBridgeError(
                    f"{self.bridge_id} : la cible contient {field_name!r} — un "
                    "identifiant d'entreprise ne voyage pas dans une URL de pont."
                )

        if self.direction in ("public_to_cockpit", "public_to_public"):
            if "?" in self.target_path or "#" in self.target_path:
                raise ModuleBridgeError(
                    f"{self.bridge_id} : un pont partant du public doit viser un "
                    "chemin NU — aucun paramètre, aucune ancre paramétrée."
                )
            if self.carries_tenant_context:
                raise ModuleBridgeError(
                    f"{self.bridge_id} : un pont partant du public ne peut pas "
                    "transporter de contexte tenant."
                )

    @property
    def requires_authentication(self) -> bool:
        return self.direction != "public_to_public"

    def as_mapping(self) -> Mapping[str, object]:
        return {
            "bridge_id": self.bridge_id,
            "target_path": self.target_path,
            "label": self.label,
            "water_signal": self.water_signal,
            "direction": self.direction,
            "reads": self.reads,
            "requires_authentication": self.requires_authentication,
            "carries_tenant_context": self.carries_tenant_context,
        }


class ModuleBridgeRegistry:
    """Registre immuable de ponts, indexé par `bridge_id`."""

    def __init__(self, bridges: Iterable[ModuleBridge]) -> None:
        indexed: dict[str, ModuleBridge] = {}
        for bridge in bridges:
            if bridge.bridge_id in indexed:
                raise ModuleBridgeError(
                    f"{bridge.bridge_id} : pont déclaré deux fois — ambiguïté refusée."
                )
            indexed[bridge.bridge_id] = bridge
        self._bridges = indexed

    def __len__(self) -> int:
        return len(self._bridges)

    def get(self, bridge_id: str) -> ModuleBridge | None:
        return self._bridges.get(bridge_id)

    @property
    def all(self) -> tuple[ModuleBridge, ...]:
        return tuple(self._bridges[key] for key in sorted(self._bridges))

    def public_bridges(self) -> tuple[ModuleBridge, ...]:
        """Ponts affichables sur la surface publique.

        Ce sont les SEULS que `/water-intelligence` a le droit de rendre : ils
        ne portent aucun paramètre et aucun contexte tenant.
        """
        return tuple(
            bridge
            for bridge in self.all
            if bridge.direction in ("public_to_cockpit", "public_to_public")
        )

    def as_public_document(self) -> Mapping[str, object]:
        """Vue publiable — uniquement les ponts publics, ordre déterministe."""
        return {
            "bridge_count": len(self.public_bridges()),
            "bridges": [bridge.as_mapping() for bridge in self.public_bridges()],
        }


# ---------------------------------------------------------------------------
# Ponts courants
# ---------------------------------------------------------------------------

#: Chaque cible correspond à une route RÉELLE du produit, vérifiée dans
#: `apps/carbon/app`. Un pont vers une route inexistante serait une promesse.
CURRENT_BRIDGES: tuple[ModuleBridge, ...] = (
    ModuleBridge(
        bridge_id="water_cockpit",
        target_path="/water",
        label="Cockpit Eau & stress hydrique",
        water_signal="stress structurel, sécheresse, eaux souterraines, qualité",
        direction="public_to_cockpit",
        reads=(
            "Activités eau, permis, zones de stress enregistrées, screening "
            "déterministe versionné, cibles et actions — risque et confiance "
            "restant deux colonnes distinctes."
        ),
    ),
    ModuleBridge(
        bridge_id="sites_geo",
        target_path="/sites-geo",
        label="Géocodage des sites",
        water_signal="rattachement d'un site à un bassin ou une zone de stress",
        direction="public_to_cockpit",
        reads=(
            "Candidats de géocodage soumis à revue humaine explicite : une "
            "coordonnée non acceptée n'est jamais utilisée pour un screening."
        ),
    ),
    ModuleBridge(
        bridge_id="resources_exposures",
        target_path="/resources/exposures",
        label="Expositions ressources stratégiques",
        water_signal="dépendance opérationnelle à l'eau d'une chaîne d'approvisionnement",
        direction="public_to_cockpit",
        reads=(
            "Ponts achats et énergie vers les ressources stratégiques, avec la "
            "provenance de chaque exposition."
        ),
    ),
    ModuleBridge(
        bridge_id="materials_public",
        target_path="/materials",
        label="Métaux et matières premières critiques",
        water_signal="intensité hydrique des filières d'extraction et de raffinage",
        direction="public_to_public",
        reads=(
            "Module public des matières critiques : contexte de dépendance "
            "matière, sans aucune donnée d'entreprise."
        ),
    ),
    ModuleBridge(
        bridge_id="iro_register",
        target_path="/iro",
        label="Registre IRO",
        water_signal="promotion d'un screening hydrique en impact, risque ou opportunité",
        direction="public_to_cockpit",
        reads=(
            "Registre des IRO, où un screening hydrique peut être promu en "
            "candidat — la promotion reste un geste humain."
        ),
    ),
    ModuleBridge(
        bridge_id="materialite",
        target_path="/materialite",
        label="Double matérialité",
        water_signal="matérialité du thème eau (ESRS E3), condition de portée réglementaire",
        direction="public_to_cockpit",
        reads=(
            "Matrice de double matérialité : matérialité d'impact et matérialité "
            "financière restent deux panneaux distincts, jamais un score fusionné."
        ),
    ),
    ModuleBridge(
        bridge_id="energy_scope2",
        target_path="/scopes",
        label="Énergie et Scope 2",
        water_signal="dépendance hydrique de la production électrique consommée",
        direction="public_to_cockpit",
        reads=(
            "Périmètres d'émissions, dont le Scope 2 : la disponibilité de l'eau "
            "conditionne le refroidissement et l'hydroélectricité."
        ),
    ),
    ModuleBridge(
        bridge_id="procurement_scope3",
        target_path="/fournisseurs/scope3",
        label="Achats et Scope 3",
        water_signal="exposition hydrique des fournisseurs amont",
        direction="public_to_cockpit",
        reads=(
            "Campagnes fournisseurs et Scope 3 amont : l'exposition d'un "
            "fournisseur situé en zone de stress remonte ici, jamais sur la "
            "surface publique."
        ),
    ),
    ModuleBridge(
        bridge_id="actions",
        target_path="/actions",
        label="Plan d'actions",
        water_signal="capacité d'adaptation documentée",
        direction="public_to_cockpit",
        reads=(
            "Actions engagées et leur suivi : une capacité d'adaptation n'est "
            "affirmée que si une action la documente."
        ),
    ),
)


def current_bridges() -> ModuleBridgeRegistry:
    """Registre courant des ponts. Tous partent du public et sont nus."""
    return ModuleBridgeRegistry(CURRENT_BRIDGES)
