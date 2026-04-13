"""
strategic_mapping_service.py — Service Value Mapping ESG.

Principe :
  - Le contenu éditorial est stocké en constantes Python (versionné avec le code).
  - build_strategic_mapping() applique les filtres segment/persona/horizon,
    puis tente d'enrichir avec les KPIs réels via ConsolidatedSnapshot (grounded).
  - Si le snapshot est indisponible, groundedKpis reste None — pas d'erreur.

Filtrage :
  - Les FinancialGain et InvestmentPillar ont une liste `segments` :
    si le filtre segment est différent de "generic", on exclut les items
    dont le segment demandé n'est pas dans la liste.
  - Les ExecutiveMessage ont un champ `persona` : on retourne le message
    du persona demandé + le message generic si présent.
"""

from __future__ import annotations

import logging

from models.strategic_mapping import (
    BeforeAfterItem,
    BudgetRange,
    CarbonCoLever,
    ExecutiveMessage,
    FiltersApplied,
    FinancialGain,
    GroundedKpis,
    HeroContent,
    Horizon,
    InvestmentPillar,
    MappingMeta,
    Persona,
    PositiveExternality,
    Segment,
    SourceRef,
    StrategicMappingResponse,
    ValueChainStep,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Sources de référence
# ---------------------------------------------------------------------------

_SRC_BCE = SourceRef(
    title="Climate-related financial risks — Working Paper",
    publisher="Banque Centrale Européenne",
    year=2021,
    url="https://www.ecb.europa.eu/pub/pdf/scpwps/ecb.wp2575~1a98c7c3e3.en.pdf",
)
_SRC_FRIEDE = SourceRef(
    title="ESG and financial performance: aggregated evidence from more than 2000 empirical studies",
    publisher="Journal of Sustainable Finance & Investment",
    year=2015,
    url=None,
)
_SRC_BDF = SourceRef(
    title="Rapport annuel sur la finance durable",
    publisher="Banque de France",
    year=2023,
    url="https://www.banque-france.fr/publications/rapports-annuels/rapport-annuel-2023",
)
_SRC_LMA = SourceRef(
    title="Green Loan Principles",
    publisher="Loan Market Association",
    year=2023,
    url="https://www.lma.eu.com/green-loans",
)
_SRC_CSRD = SourceRef(
    title="Directive (UE) 2022/2464 — Corporate Sustainability Reporting Directive",
    publisher="Parlement européen et Conseil de l'UE",
    year=2022,
    url="https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX%3A32022L2464",
)
_SRC_ECOVADIS = SourceRef(
    title="Sustainable Procurement Barometer",
    publisher="EcoVadis",
    year=2023,
    url="https://ecovadis.com/resources/",
)
_SRC_ADEME = SourceRef(
    title="Gisements d'économies d'énergie dans les PME/ETI",
    publisher="ADEME",
    year=2022,
    url="https://www.ademe.fr/nos-ressources/publications/",
)
_SRC_CDP = SourceRef(
    title="Global Supply Chain Report",
    publisher="Carbon Disclosure Project",
    year=2023,
    url="https://www.cdp.net/en/research/global-reports/global-supply-chain-report",
)
_SRC_DELOITTE = SourceRef(
    title="Global Millennial & Gen Z Survey",
    publisher="Deloitte",
    year=2023,
    url="https://www.deloitte.com/global/en/issues/work/content/genzmillennialsurvey.html",
)
_SRC_PWC = SourceRef(
    title="The cost of CSRD compliance",
    publisher="PwC",
    year=2023,
    url="https://www.pwc.fr/fr/publications/reporting-extra-financier/",
)
_SRC_EUROSIF = SourceRef(
    title="European SRI Study",
    publisher="Eurosif",
    year=2023,
    url="https://www.eurosif.org/research/european-sri-study/",
)
_SRC_GHGP = SourceRef(
    title="Corporate Value Chain (Scope 3) Accounting and Reporting Standard",
    publisher="GHG Protocol",
    year=2023,
    url="https://ghgprotocol.org/scope-3-standard",
)
_SRC_TCFD = SourceRef(
    title="Recommendations of the Task Force on Climate-related Financial Disclosures",
    publisher="FSB / TCFD",
    year=2023,
    url="https://www.fsb-tcfd.org/recommendations/",
)
_SRC_OCDE = SourceRef(
    title="Principes de gouvernance d'entreprise du G20 et de l'OCDE",
    publisher="OCDE",
    year=2023,
    url="https://www.oecd.org/corporate/principles-corporate-governance/",
)


# ---------------------------------------------------------------------------
# Contenu éditorial — constantes
# ---------------------------------------------------------------------------

_META = MappingMeta(
    version="1.0",
    lastReviewedAt="2026-04-13",
    nextReviewScheduled="2026-07-01",
    regulatoryBaseline=[
        "CSRD Directive (UE) 2022/2464",
        "ESRS standards (EFRAG) 2023",
        "VSME standard (EFRAG) 2024",
        "Taxonomie européenne Règlement (UE) 2020/852",
        "SFDR Règlement (UE) 2019/2088",
    ],
    contentOwner="Carbon & Co",
)

_HERO = HeroContent(
    title="L'adhésion volontaire ESG : un investissement, pas une contrainte",
    subtitle="De l'opacité à la création de valeur — la logique économique de la démarche volontaire",
    summary=(
        "Les entreprises qui engagent une démarche ESG volontaire avant l'obligation réglementaire "
        "ne subissent pas un coût supplémentaire : elles transforment l'incertitude en actif stratégique. "
        "Cette page cartographie la logique économique complète de cet investissement."
    ),
)

_EXECUTIVE_MESSAGES: list[ExecutiveMessage] = [
    ExecutiveMessage(
        persona="dg",
        personaLabel="Direction Générale",
        headline="Anticiper la norme, c'est choisir son tempo de transformation.",
        supporting=[
            "Les entreprises qui attendent l'obligation réglementaire subissent la transition. Celles qui anticipent la pilotent.",
            "L'adhésion volontaire réduit l'exposition aux risques réglementaires, physiques et de réputation simultanément.",
            "C'est une décision de gouvernance autant qu'une décision opérationnelle.",
        ],
    ),
    ExecutiveMessage(
        persona="daf",
        personaLabel="Directeur Administratif et Financier",
        headline="Réduire le risque perçu, c'est améliorer l'accès au capital.",
        supporting=[
            "Les prêteurs et investisseurs intègrent les critères ESG dans leur évaluation du risque crédit. Une démarche documentée réduit cette prime de risque.",
            "Les instruments de financement durable (green loans, sustainability-linked loans) sont conditionnés à la capacité à produire des données ESG fiables.",
            "Un reporting structuré donne au DAF une visibilité sur les coûts carbone et réglementaires futurs, aujourd'hui invisibles dans les comptes.",
        ],
    ),
    ExecutiveMessage(
        persona="investisseur",
        personaLabel="Investisseur / Actionnaire",
        headline="La transparence ESG réduit l'asymétrie d'information — et donc le risque perçu.",
        supporting=[
            "Les entreprises non-transparentes sur leurs risques ESG sont de plus en plus exclues ou décotées par les fonds ISR, qui représentent une part croissante des flux d'investissement en Europe.",
            "Une entreprise capable de produire un reporting VSME ou CSRD crédible est plus facilement valorisable lors d'une cession, d'une levée ou d'un refinancement.",
            "La résilience aux chocs réglementaires (CBAM, taxonomie, SFDR) est un facteur de stabilité du portefeuille.",
        ],
    ),
    ExecutiveMessage(
        persona="donneur_ordre",
        personaLabel="Donneur d'ordre / Grand compte",
        headline="Vos fournisseurs ESG-ready réduisent votre scope 3 et votre risque supply chain.",
        supporting=[
            "Les grands groupes soumis à CSRD doivent documenter leur scope 3. Ils privilégient les fournisseurs capables de fournir des données carbone fiables.",
            "Une PME ou ETI sans démarche ESG est progressivement exclue des appels d'offres de grands comptes, quelles que soient ses performances opérationnelles.",
            "Être ESG-ready est devenu un critère de qualification fournisseur dans de nombreux secteurs.",
        ],
    ),
]

_INVESTMENTS: list[InvestmentPillar] = [
    InvestmentPillar(
        id="rh",
        label="Ressources humaines",
        description="Montée en compétences interne et coordination de la démarche ESG.",
        implies=[
            "Désignation d'un référent ESG (temps partiel ou dédié)",
            "Formation des équipes opérationnelles à la collecte de données",
            "Accompagnement du COMEX dans la lecture des indicateurs",
        ],
        budgetRanges=[
            BudgetRange(segment="pme", low=5_000, high=15_000, note="Temps interne + formation"),
            BudgetRange(segment="eti", low=20_000, high=60_000, note="Demi-poste à poste dédié"),
            BudgetRange(segment="grand_groupe", low=80_000, high=200_000, note="Équipe dédiée"),
        ],
        segments=["pme", "eti", "grand_groupe"],
        qualitative=True,
        sources=[],
    ),
    InvestmentPillar(
        id="si",
        label="Systèmes d'information et données",
        description="Outillage pour collecter, consolider et fiabiliser les données ESG.",
        implies=[
            "Mise en place ou adaptation d'un outil de collecte",
            "Connexion aux sources de données existantes (comptabilité, RH, énergie, achats)",
            "Stockage et versionnage des snapshots de données",
        ],
        budgetRanges=[
            BudgetRange(segment="pme", low=3_000, high=10_000, note="SaaS léger type Carbon & Co"),
            BudgetRange(segment="eti", low=10_000, high=40_000, note="SaaS + intégrations"),
            BudgetRange(segment="grand_groupe", low=40_000, high=150_000, note="Plateforme enterprise"),
        ],
        segments=["pme", "eti", "grand_groupe"],
        qualitative=True,
        sources=[],
    ),
    InvestmentPillar(
        id="conseil",
        label="Accompagnement conseil et audit",
        description="Expertise externe pour fiabiliser la démarche et la rendre opposable.",
        implies=[
            "Diagnostic ESG initial (bilan carbone, matérialité, scoring VSME)",
            "Accompagnement à la structuration du reporting",
            "Vérification tierce partie (limited assurance ou reasonable assurance)",
        ],
        budgetRanges=[
            BudgetRange(segment="pme", low=5_000, high=20_000, unit="EUR (diagnostic initial)", note="+ 3 000–8 000 €/an suivi"),
            BudgetRange(segment="eti", low=20_000, high=60_000, unit="EUR (diagnostic)", note="+ 10 000–30 000 €/an"),
            BudgetRange(segment="grand_groupe", low=60_000, high=200_000, unit="EUR", note="Diagnostic + audit tiers"),
        ],
        segments=["pme", "eti", "grand_groupe"],
        qualitative=True,
        sources=[_SRC_ADEME],
    ),
    InvestmentPillar(
        id="gouvernance",
        label="Gouvernance et pilotage",
        description="Structure de décision et de responsabilité autour de la démarche ESG.",
        implies=[
            "Intégration de l'ESG dans les revues de direction et les tableaux de bord",
            "Définition d'objectifs chiffrés et d'indicateurs de suivi",
            "Communication interne et reporting parties prenantes",
        ],
        budgetRanges=[
            BudgetRange(segment="pme", low=0, high=5_000, note="Essentiellement temps interne"),
            BudgetRange(segment="eti", low=5_000, high=20_000, note="Outils, communication, instances"),
            BudgetRange(segment="grand_groupe", low=20_000, high=80_000),
        ],
        segments=["pme", "eti", "grand_groupe"],
        qualitative=True,
        sources=[_SRC_OCDE],
    ),
]

_BEFORE_AFTER: list[BeforeAfterItem] = [
    BeforeAfterItem(
        category="Visibilité données",
        before="Données carbone dispersées, non consolidées",
        after="Snapshot annuel consolidé, traçable, versionné",
        impactTag="opérationnel",
    ),
    BeforeAfterItem(
        category="Accès au financement",
        before="Financements standard uniquement",
        after="Éligibilité aux green loans et sustainability-linked loans",
        impactTag="financement",
    ),
    BeforeAfterItem(
        category="Relation grands comptes",
        before="Risque d'exclusion appels d'offres ESG",
        after="Capacité à répondre aux questionnaires scope 3 fournisseurs",
        impactTag="commercial",
    ),
    BeforeAfterItem(
        category="Pilotage opérationnel",
        before="Coûts carbone et réglementaires invisibles",
        after="Indicateurs carbone intégrés aux décisions d'investissement",
        impactTag="opérationnel",
    ),
    BeforeAfterItem(
        category="Réputation et crédibilité",
        before="Communication RSE sans données fiables",
        after="Reporting structuré, vérifiable, opposable",
        impactTag="réputation",
    ),
    BeforeAfterItem(
        category="Exposition réglementaire",
        before="Risque de mise en conformité en urgence",
        after="Anticipation progressive, sans rupture opérationnelle",
        impactTag="réglementaire",
    ),
    BeforeAfterItem(
        category="Attractivité RH",
        before="Discours ESG non étayé",
        after="Engagements documentés, valorisables en recrutement",
        impactTag="rh",
    ),
]

_VALUE_CHAIN: list[ValueChainStep] = [
    ValueChainStep(
        order=1,
        label="Investissements initiaux",
        description="RH + SI + Conseil + Gouvernance → Capacité à produire une donnée ESG fiable et continue.",
    ),
    ValueChainStep(
        order=2,
        label="Réduction de l'asymétrie d'information",
        description="Donnée fiable → Transparence accrue → Réduction du risque perçu par les parties prenantes externes.",
    ),
    ValueChainStep(
        order=3,
        label="Amélioration de l'accès au capital",
        description="Risque perçu réduit → Meilleure notation ESG → Conditions de financement potentiellement améliorées.",
        precisionNote=(
            "Le lien ESG → WACC est documenté mais conditionnel. "
            "Il dépend de la taille de l'entreprise, de son secteur, "
            "de la qualité du reporting et du contexte de marché."
        ),
    ),
    ValueChainStep(
        order=4,
        label="Gains commerciaux et opérationnels",
        description=(
            "Crédibilité ESG → Maintien / gain d'appels d'offres grands comptes "
            "+ différenciation produit/service + attractivité RH."
        ),
    ),
    ValueChainStep(
        order=5,
        label="Résilience et externalités positives",
        description=(
            "Pilotage ESG structuré → Anticipation des risques physiques et réglementaires "
            "+ amélioration continue des performances."
        ),
    ),
]

_FINANCIAL_GAINS: list[FinancialGain] = [
    FinancialGain(
        id="green_loans",
        label="Green loans & sustainability-linked loans",
        description=(
            "Les établissements bancaires proposent des instruments de financement dont le taux "
            "est lié à la performance ESG de l'emprunteur. "
            "Une entreprise capable de fournir des données ESG fiables peut y accéder."
        ),
        magnitude="Réduction de 10 à 30 bps sur le taux d'intérêt selon les conditions du marché et la qualité du reporting.",
        qualitative=False,
        segments=["eti", "grand_groupe"],
        personas=["daf", "investisseur"],
        sources=[_SRC_BDF, _SRC_LMA],
    ),
    FinancialGain(
        id="wacc",
        label="Réduction du coût du capital (WACC)",
        description=(
            "Des études académiques et institutionnelles documentent une corrélation entre "
            "une meilleure notation ESG et une réduction du coût du capital, "
            "via la baisse de la prime de risque perçue par les investisseurs et prêteurs."
        ),
        magnitude=(
            "Potentiel de 20 à 50 bps de réduction du coût de la dette selon les études disponibles. "
            "Conditionnel à la qualité du reporting et à la taille de l'entreprise. "
            "Effet peu documenté pour les PME non cotées."
        ),
        qualitative=False,
        segments=["eti", "grand_groupe"],
        personas=["daf", "investisseur"],
        sources=[_SRC_BCE, _SRC_FRIEDE],
    ),
    FinancialGain(
        id="appels_offres",
        label="Qualification fournisseur ESG",
        description=(
            "Les grandes entreprises soumises à CSRD doivent documenter leurs émissions scope 3, "
            "qui incluent celles de leurs fournisseurs. "
            "Elles intègrent progressivement des critères ESG dans leurs processus d'homologation fournisseur."
        ),
        magnitude=None,
        qualitative=True,
        segments=["pme", "eti"],
        personas=["dg", "donneur_ordre"],
        sources=[_SRC_CSRD, _SRC_ECOVADIS],
    ),
    FinancialGain(
        id="efficacite_energetique",
        label="Efficacité énergétique et réduction des coûts opérationnels",
        description=(
            "La mesure systématique de la consommation énergétique et des déchets, "
            "inhérente à une démarche ESG structurée, "
            "génère souvent des gains d'efficacité opérationnelle identifiés lors du diagnostic initial."
        ),
        magnitude="Réduction potentielle de 5 à 20 % de la facture énergétique selon le secteur et le niveau de maturité initial.",
        qualitative=False,
        segments=["pme", "eti", "grand_groupe"],
        personas=["dg", "daf"],
        sources=[_SRC_ADEME, _SRC_CDP],
    ),
    FinancialGain(
        id="attractivite_rh",
        label="Attractivité RH et réduction du turnover",
        description=(
            "Les démarches ESG documentées améliorent la perception de l'entreprise "
            "par les candidats et les salariés, notamment chez les moins de 35 ans. "
            "Cela réduit les coûts de recrutement et de turnover."
        ),
        magnitude=None,
        qualitative=True,
        segments=["pme", "eti", "grand_groupe"],
        personas=["dg"],
        sources=[_SRC_DELOITTE],
    ),
    FinancialGain(
        id="resilience_reglementaire",
        label="Anticipation des coûts réglementaires futurs",
        description=(
            "Les entreprises qui structurent leur reporting ESG aujourd'hui "
            "amortissent sur plusieurs années les coûts de mise en conformité "
            "que leurs concurrents devront absorber en urgence."
        ),
        magnitude=None,
        qualitative=True,
        segments=["pme", "eti", "grand_groupe"],
        personas=["dg", "daf"],
        sources=[_SRC_PWC],
    ),
]

_EXTERNALITIES: list[PositiveExternality] = [
    PositiveExternality(
        id="gouvernance",
        label="Gouvernance renforcée",
        category="Gouvernance",
        description=(
            "La structuration d'une démarche ESG impose une clarification des responsabilités, "
            "des processus de décision et des circuits de remontée d'information. "
            "Elle renforce la gouvernance de manière durable, au-delà du seul reporting ESG."
        ),
        qualitative=True,
        segments=["pme", "eti", "grand_groupe"],
        sources=[_SRC_OCDE],
    ),
    PositiveExternality(
        id="scope3",
        label="Pilotage du scope 3 fournisseurs",
        category="Environnement",
        description=(
            "La démarche ESG volontaire engage l'entreprise dans une logique de pilotage "
            "de ses émissions indirectes (scope 3), notamment via sa chaîne d'approvisionnement. "
            "C'est souvent le levier de réduction le plus impactant."
        ),
        qualitative=True,
        segments=["eti", "grand_groupe"],
        sources=[_SRC_GHGP, _SRC_CDP],
    ),
    PositiveExternality(
        id="risques_physiques",
        label="Résilience aux risques physiques climatiques",
        category="Environnement",
        description=(
            "La cartographie des risques climatiques physiques associée à la démarche ESG "
            "permet d'anticiper et de réduire la vulnérabilité opérationnelle de l'entreprise."
        ),
        qualitative=True,
        segments=["pme", "eti", "grand_groupe"],
        sources=[_SRC_TCFD, _SRC_BCE],
    ),
    PositiveExternality(
        id="credibilite",
        label="Crédibilité parties prenantes",
        category="Réputation",
        description=(
            "Un reporting ESG structuré et vérifiable renforce la crédibilité de l'entreprise "
            "auprès de ses parties prenantes : clients, fournisseurs, banques, collectivités. "
            "Il réduit le risque de greenwashing et les controverses associées."
        ),
        qualitative=True,
        segments=["pme", "eti", "grand_groupe"],
        sources=[],
    ),
    PositiveExternality(
        id="isr",
        label="Attractivité pour les investisseurs ISR",
        category="Finance",
        description=(
            "Les fonds ISR et les fonds article 8/9 SFDR représentent une part croissante "
            "des flux d'investissement en Europe. "
            "Les entreprises transparentes sur leurs critères ESG sont plus facilement éligibles."
        ),
        qualitative=False,
        segments=["eti", "grand_groupe"],
        sources=[_SRC_EUROSIF],
    ),
]

_CARBONCO_LEVERS: list[CarbonCoLever] = [
    CarbonCoLever(
        id="dashboard",
        benefit="Donnée fiable et continue",
        capability="Dashboard consolidé — snapshot automatisé multi-domaine Carbon, VSME, ESG, Finance",
        moduleRef="/dashboard",
    ),
    CarbonCoLever(
        id="finance_sfdr",
        benefit="Accès aux financements durables",
        capability="Module Finance Climat + SFDR/PAI — 14 indicateurs PAI calculés et exportables via rapport PDF",
        moduleRef="/finance",
    ),
    CarbonCoLever(
        id="vsme_export",
        benefit="Qualification fournisseur grands comptes",
        capability="Rapport VSME exportable — répondre aux questionnaires scope 3 fournisseurs grands comptes",
        moduleRef="/reports",
    ),
    CarbonCoLever(
        id="copilote",
        benefit="Pilotage opérationnel",
        capability="Copilote IA grounded — analyse en langage naturel sur données réelles multi-domaine",
        moduleRef="/copilot",
    ),
    CarbonCoLever(
        id="esrs",
        benefit="Cartographie réglementaire ESRS",
        capability="Module ESRS — cartographie des obligations et statut de couverture par standard",
        moduleRef="/esrs",
    ),
    CarbonCoLever(
        id="audit",
        benefit="Traçabilité des opérations",
        capability="Journal d'audit — chaque import, calcul et export est tracé, horodaté et consultable",
        moduleRef="/audit",
    ),
]


# ---------------------------------------------------------------------------
# Helpers de filtrage
# ---------------------------------------------------------------------------

def _filter_investments(
    items: list[InvestmentPillar],
    segment: Segment,
) -> list[InvestmentPillar]:
    if segment == "generic":
        return items
    return [i for i in items if segment in i.segments]


def _filter_gains(
    items: list[FinancialGain],
    segment: Segment,
    persona: Persona,
) -> list[FinancialGain]:
    result = items
    if segment != "generic":
        result = [i for i in result if segment in i.segments]
    if persona != "generic":
        result = [i for i in result if not i.personas or persona in i.personas]
    return result


def _filter_messages(
    items: list[ExecutiveMessage],
    persona: Persona,
) -> list[ExecutiveMessage]:
    if persona == "generic":
        return items
    return [m for m in items if m.persona == persona]


def _filter_externalities(
    items: list[PositiveExternality],
    segment: Segment,
) -> list[PositiveExternality]:
    if segment == "generic":
        return items
    return [e for e in items if segment in e.segments]


# ---------------------------------------------------------------------------
# Grounded KPIs (optionnel)
# ---------------------------------------------------------------------------

def _try_load_grounded_kpis(company_id: int) -> GroundedKpis | None:
    """Tente de charger les KPIs personnalisés depuis ConsolidatedSnapshot.
    Retourne None silencieusement si indisponible."""
    try:
        from services.aggregation_service import build_consolidated_snapshot
        snap = build_consolidated_snapshot(company_id=company_id)
        carbon = snap.carbon
        esg = snap.esg
        vsme = snap.vsme
        finance = snap.finance

        # On vérifie la présence de KPIs réels (pas juste le statut health)
        # car health peut être True même avec des KPIs tous à None
        any_available = any([
            carbon and carbon.totalS123Tco2e is not None,
            esg and esg.scoreGlobal is not None,
            vsme and vsme.scorePct is not None,
            finance and finance.greenCapexPct is not None,
        ])
        if not any_available:
            return None

        company_name: str | None = None
        reporting_year: int | None = None
        if snap.company:
            company_name = snap.company.name
            reporting_year = snap.company.reportingYear

        return GroundedKpis(
            companyName=company_name,
            totalS123Tco2e=carbon.totalS123Tco2e if carbon else None,
            esgScoreGlobal=esg.scoreGlobal if esg else None,
            vsmeCompletion=vsme.scorePct if vsme else None,
            greenCapexPct=finance.greenCapexPct if finance else None,
            reportingYear=reporting_year,
            dataAvailable=any_available,
            source="ConsolidatedSnapshot",
        )
    except Exception as exc:
        logger.debug("Grounded KPIs indisponibles pour company_id=%s : %s", company_id, exc)
        return None


# ---------------------------------------------------------------------------
# Point d'entrée public
# ---------------------------------------------------------------------------

def build_strategic_mapping(
    company_id: int,
    segment: Segment = "generic",
    persona: Persona = "generic",
    horizon: Horizon = "generic",
) -> StrategicMappingResponse:
    """Construit la réponse Value Mapping ESG filtrée et enrichie."""

    filters = FiltersApplied(segment=segment, persona=persona, horizon=horizon)

    grounded = _try_load_grounded_kpis(company_id)

    return StrategicMappingResponse(
        meta=_META,
        filters=filters,
        hero=_HERO,
        executiveMessages=_filter_messages(_EXECUTIVE_MESSAGES, persona),
        investments=_filter_investments(_INVESTMENTS, segment),
        beforeAfter=_BEFORE_AFTER,
        valueChain=_VALUE_CHAIN,
        financialGains=_filter_gains(_FINANCIAL_GAINS, segment, persona),
        externalities=_filter_externalities(_EXTERNALITIES, segment),
        carbonCoLevers=_CARBONCO_LEVERS,
        groundedKpis=grounded,
    )
