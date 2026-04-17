"""
esrs_corpus.py — Corpus ESRS statique pour le copilote RAG Phase 4.

Contient ~60 entrées couvrant les normes ESRS 1/2, ESRS E1-E5, ESRS S1-S4, ESRS G1.
Chaque entrée : { id, standard, topic, question_patterns, answer, sources }

Utilisé par rag_service.py pour la recherche sémantique keyword-TF-IDF
(pgvector optionnel si disponible).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class CorpusEntry:
    id: str
    standard: str          # ex. "ESRS E1", "ESRS G1"
    topic: str
    keywords: list[str]    # mots-clés pour la recherche TF-IDF
    answer: str            # réponse de référence (< 500 mots)
    source_ref: str        # ex. "ESRS E1 §AR 24-26"


CORPUS: list[CorpusEntry] = [
    # -------------------------------------------------------------------
    # ESRS 1 — Exigences générales
    # -------------------------------------------------------------------
    CorpusEntry(
        id="esrs1_double_materialite",
        standard="ESRS 1",
        topic="Double matérialité",
        keywords=["double matérialité", "matérialité", "IRO", "impacts", "risques", "opportunités", "évaluation"],
        answer=(
            "La double matérialité requiert d'évaluer deux perspectives : "
            "(1) la matérialité d'impact — les effets positifs ou négatifs réels ou potentiels de l'entreprise sur "
            "l'environnement et la société ; (2) la matérialité financière — les risques et opportunités ESG ayant "
            "un effet significatif sur la situation financière de l'entreprise. Une question est matérielle si elle "
            "est matérielle selon l'une ou l'autre de ces perspectives (logique OU). "
            "L'entreprise doit réaliser une évaluation formelle des IRO (Impacts, Risques, Opportunités) en "
            "impliquant les parties prenantes pertinentes."
        ),
        source_ref="ESRS 1 §3.4, §48-62",
    ),
    CorpusEntry(
        id="esrs1_chaine_valeur",
        standard="ESRS 1",
        topic="Chaîne de valeur",
        keywords=["chaîne de valeur", "amont", "aval", "scope 3", "fournisseurs", "clients", "sous-traitants"],
        answer=(
            "ESRS 1 exige que le reporting couvre la chaîne de valeur amont et aval de l'entreprise, "
            "pas uniquement ses activités propres. Cela inclut fournisseurs, sous-traitants et clients. "
            "En pratique, la collecte de données auprès des fournisseurs (questionnaires, déclarations) "
            "est indispensable pour couvrir les émissions de catégorie 3 (scope 3 GHG Protocol). "
            "L'ESRS permet d'utiliser des données proxy lorsque les données primaires ne sont pas disponibles, "
            "à condition de le documenter et de travailler à l'amélioration progressive de la qualité."
        ),
        source_ref="ESRS 1 §5, §63-68",
    ),
    CorpusEntry(
        id="esrs1_parties_prenantes",
        standard="ESRS 1",
        topic="Parties prenantes",
        keywords=["parties prenantes", "stakeholders", "dialogue", "consultation", "engagement"],
        answer=(
            "ESRS 1 §26 impose un processus de consultation des parties prenantes pour identifier "
            "les impacts matériels. Les parties prenantes comprennent les travailleurs, les communautés locales, "
            "les investisseurs, les clients et la société civile. Le processus doit être documenté, "
            "itératif et proportionné à la taille de l'entreprise. "
            "Les PME (VSME) bénéficient de dispositions allégées mais ne sont pas exemptes de l'engagement."
        ),
        source_ref="ESRS 1 §26-32",
    ),
    # -------------------------------------------------------------------
    # ESRS 2 — Informations générales
    # -------------------------------------------------------------------
    CorpusEntry(
        id="esrs2_gouvernance",
        standard="ESRS 2",
        topic="Gouvernance ESG",
        keywords=["gouvernance", "conseil d'administration", "organe de direction", "responsabilité ESG",
                  "comité", "supervision"],
        answer=(
            "ESRS 2 GOV-1 exige la description du rôle des organes de direction et de surveillance "
            "dans le pilotage des questions de durabilité. L'entreprise doit préciser : "
            "qui est responsable de la stratégie ESG, quelles compétences ESG existent au conseil, "
            "avec quelle fréquence les sujets ESG sont examinés. "
            "GOV-2 couvre le rôle de la direction dans le contrôle des impacts et risques matériels."
        ),
        source_ref="ESRS 2 GOV-1, GOV-2",
    ),
    CorpusEntry(
        id="esrs2_strategie",
        standard="ESRS 2",
        topic="Stratégie de durabilité",
        keywords=["stratégie", "modèle d'affaires", "résilience", "plan de transition", "objectifs"],
        answer=(
            "ESRS 2 SBM-1 à SBM-3 couvrent le modèle d'affaires, la stratégie et la gestion des IRO. "
            "L'entreprise doit expliquer comment les questions de durabilité s'intègrent dans la stratégie "
            "et dans les processus de planification financière. "
            "SBM-3 aborde l'identification des impacts, risques et opportunités matériels et leur lien "
            "avec le modèle d'affaires."
        ),
        source_ref="ESRS 2 SBM-1, SBM-2, SBM-3",
    ),
    # -------------------------------------------------------------------
    # ESRS E1 — Changement climatique
    # -------------------------------------------------------------------
    CorpusEntry(
        id="e1_plan_transition",
        standard="ESRS E1",
        topic="Plan de transition climatique",
        keywords=["plan de transition", "neutralité carbone", "net zéro", "decarbonation", "trajectoire",
                  "1.5°C", "Paris"],
        answer=(
            "ESRS E1-1 exige un plan de transition climatique crédible, aligné sur l'Accord de Paris (1,5°C). "
            "Il doit couvrir : les objectifs de réduction des émissions à court, moyen et long terme, "
            "les leviers d'action (efficacité énergétique, ENR, procédés industriels, chaîne d'approvisionnement), "
            "les investissements prévus (CapEx vert), et le lien avec le plan stratégique financier. "
            "Un plan aligné SBTi satisfait cette exigence. L'absence de plan doit être explicitement mentionnée."
        ),
        source_ref="ESRS E1-1 §14-26",
    ),
    CorpusEntry(
        id="e1_scope1",
        standard="ESRS E1",
        topic="Scope 1 — Émissions directes",
        keywords=["scope 1", "émissions directes", "combustion", "procédés industriels", "tCO2e", "GES"],
        answer=(
            "ESRS E1-6 impose le reporting des émissions brutes de GES de scope 1 (émissions directes). "
            "Cela inclut la combustion de combustibles fossiles, les procédés industriels, "
            "les fugitifs (réfrigérants, SF6), et les émissions de la flotte propre. "
            "Les données doivent être en tCO₂e, suivre le GHG Protocol (approche opérationnelle ou de contrôle "
            "financier), et être comparées à l'année de référence. "
            "Les facteurs d'émission doivent être sourcés (ADEME Base Empreinte, IPCC, Ecoinvent)."
        ),
        source_ref="ESRS E1-6 §44-55",
    ),
    CorpusEntry(
        id="e1_scope2",
        standard="ESRS E1",
        topic="Scope 2 — Émissions indirectes énergie",
        keywords=["scope 2", "électricité", "chaleur", "vapeur", "location based", "market based",
                  "énergie achetée"],
        answer=(
            "ESRS E1-6 requiert les émissions de scope 2 selon deux méthodes : "
            "market-based (MB) — utilise les facteurs des contrats d'énergie, GO, PPA — "
            "et location-based (LB) — utilise les facteurs moyens du réseau. "
            "Les deux valeurs doivent être reportées. MB reflète les actions d'achat d'énergie verte. "
            "Si l'entreprise dispose de certifications ENR (GO), les émissions MB peuvent être nulles "
            "même si le réseau est carboné (LB élevé)."
        ),
        source_ref="ESRS E1-6 §56-64",
    ),
    CorpusEntry(
        id="e1_scope3",
        standard="ESRS E1",
        topic="Scope 3 — Émissions indirectes hors énergie",
        keywords=["scope 3", "chaîne de valeur", "catégories", "biens achetés", "transport", "utilisation",
                  "fin de vie", "déplacements", "émissions amont aval"],
        answer=(
            "ESRS E1-6 demande les émissions de scope 3 selon les 15 catégories du GHG Protocol. "
            "Les catégories les plus significatives varient par secteur : "
            "C1 (biens/services achetés) et C11 (utilisation des produits) pour les industriels, "
            "C4 (transport amont) pour les distributeurs, C15 (investissements) pour les financiers. "
            "Une analyse de matérialité des catégories scope 3 est requise avant de décider lesquelles reporter. "
            "ESRS permet d'exclure des catégories non matérielles en les justifiant."
        ),
        source_ref="ESRS E1-6 §65-82",
    ),
    CorpusEntry(
        id="e1_intensite",
        standard="ESRS E1",
        topic="Intensité carbone",
        keywords=["intensité", "intensité carbone", "tCO2e par million €", "par salarié", "ratio", "benchmark"],
        answer=(
            "ESRS E1-6 requiert les indicateurs d'intensité des émissions de GES : "
            "émissions (scope 1+2 et/ou 1+2+3) rapportées à une métrique de revenus (ex. tCO₂e/M€CA) "
            "ou à une métrique d'activité sectorielle. "
            "Les indicateurs d'intensité permettent des comparaisons inter-entreprises et le suivi "
            "de la performance de décarbonation indépendamment de la croissance du chiffre d'affaires."
        ),
        source_ref="ESRS E1-6 §83-87",
    ),
    CorpusEntry(
        id="e1_energie",
        standard="ESRS E1",
        topic="Consommation d'énergie",
        keywords=["énergie", "consommation énergétique", "ENR", "fossile", "MWh", "efficacité énergétique",
                  "mix énergétique", "renouvelable"],
        answer=(
            "ESRS E1-5 impose le reporting de la consommation totale d'énergie (MWh) ventilée par source "
            "(fossile, nucléaire, ENR) et par type (électricité, chaleur, carburant). "
            "La part d'énergies renouvelables (%) et les achats de certificats (GO, PPA) doivent être déclarés. "
            "L'amélioration de l'efficacité énergétique (MWh évités) est un indicateur de performance clé."
        ),
        source_ref="ESRS E1-5 §35-43",
    ),
    CorpusEntry(
        id="e1_sbti",
        standard="ESRS E1",
        topic="Objectifs SBTi",
        keywords=["SBTi", "science based targets", "objectifs basés science", "validation", "near term",
                  "long term", "net zero"],
        answer=(
            "Les Science Based Targets (SBTi) sont des objectifs de réduction d'émissions alignés sur les "
            "scénarios climatiques de l'IPCC limitant le réchauffement à 1,5°C. "
            "L'entreprise peut viser : Near-term (5-10 ans, scope 1+2 -42% min., scope 3 -25% min.) et "
            "Long-term / Net-Zero (2050, 90% réduction absolue + compensation résiduelle). "
            "La validation SBTi satisfait automatiquement E1-1 pour le plan de transition. "
            "ESRS demande de préciser si les objectifs sont validés, en cours de validation ou inexistants."
        ),
        source_ref="ESRS E1-4, SBTi Corporate Standard v2",
    ),
    CorpusEntry(
        id="e1_cbam",
        standard="ESRS E1",
        topic="CBAM — Mécanisme d'ajustement carbone aux frontières",
        keywords=["CBAM", "taxe carbone frontière", "ETS", "EU ETS", "quotas carbone", "acier", "ciment",
                  "aluminium", "engrais", "electricité"],
        answer=(
            "Le CBAM (Carbon Border Adjustment Mechanism) s'applique depuis 2026 aux importations "
            "d'acier, ciment, aluminium, engrais, électricité et hydrogène dans l'UE. "
            "Il impose l'achat de certificats CBAM couvrant les émissions intégrées des produits importés. "
            "Pour les entreprises exposées : calculer le coût CBAM = tonnes CO₂e intégrées × prix ETS EU. "
            "ESRS E1 demande de divulguer l'exposition aux risques de prix du carbone (ETS + CBAM)."
        ),
        source_ref="Règlement UE 2023/956, ESRS E1-2",
    ),
    # -------------------------------------------------------------------
    # ESRS E2 — Pollution
    # -------------------------------------------------------------------
    CorpusEntry(
        id="e2_pollution",
        standard="ESRS E2",
        topic="Pollution air, eau, sol",
        keywords=["pollution", "émissions polluantes", "NOx", "SOx", "COV", "PFAS", "microplastiques",
                  "eau", "sol"],
        answer=(
            "ESRS E2 couvre les émissions de polluants dans l'air, l'eau et le sol. "
            "Principaux indicateurs : émissions NOx, SOx, COV, particules (PM), métaux lourds, PFAS. "
            "Les entreprises doivent déclarer les substances préoccupantes conformément au règlement REACH. "
            "E2-3 (objectifs de réduction) et E2-4 (incidents de pollution) sont souvent matériels "
            "pour les secteurs chimie, pharmacie, agro-alimentaire et industrie lourde."
        ),
        source_ref="ESRS E2-3, E2-4, E2-6",
    ),
    # -------------------------------------------------------------------
    # ESRS E3 — Eau et ressources marines
    # -------------------------------------------------------------------
    CorpusEntry(
        id="e3_eau",
        standard="ESRS E3",
        topic="Eau et ressources marines",
        keywords=["eau", "consommation eau", "zones de stress hydrique", "déchets marins", "prélèvements",
                  "recyclage eau"],
        answer=(
            "ESRS E3 s'applique en priorité aux entreprises dans des secteurs à forte consommation d'eau "
            "(agro-alimentaire, chimie, papier) ou dans des zones de stress hydrique. "
            "Indicateurs clés : prélèvements totaux (m³), consommation (m³), recyclage/réutilisation (%). "
            "E3-4 impose de localiser les sites exposés au stress hydrique (WRI Aqueduct)."
        ),
        source_ref="ESRS E3-4, E3-5",
    ),
    # -------------------------------------------------------------------
    # ESRS E4 — Biodiversité
    # -------------------------------------------------------------------
    CorpusEntry(
        id="e4_biodiversite",
        standard="ESRS E4",
        topic="Biodiversité et écosystèmes",
        keywords=["biodiversité", "écosystèmes", "Natura 2000", "perte biodiversité", "tnfd", "csbd",
                  "sols", "déforestation"],
        answer=(
            "ESRS E4 exige l'évaluation des impacts sur la biodiversité, en particulier pour les sites "
            "proches de zones Natura 2000 ou d'importance pour la biodiversité. "
            "Les entreprises doivent conduire une analyse de dépendance aux services écosystémiques (TNFD). "
            "E4-5 impose des métriques de superficie affectée et d'état des écosystèmes. "
            "La déforestation zéro est un objectif spécifique pour les entreprises des chaînes alimentaires."
        ),
        source_ref="ESRS E4-4, E4-5",
    ),
    # -------------------------------------------------------------------
    # ESRS E5 — Économie circulaire
    # -------------------------------------------------------------------
    CorpusEntry(
        id="e5_circulaire",
        standard="ESRS E5",
        topic="Économie circulaire et déchets",
        keywords=["économie circulaire", "déchets", "recyclage", "réutilisation", "emballage", "fin de vie",
                  "ressources entrantes", "matières premières"],
        answer=(
            "ESRS E5 porte sur l'utilisation des ressources et l'économie circulaire. "
            "Indicateurs principaux : flux entrants de matières (tonnes, dont recyclées), "
            "production de déchets (tonnes, ventilée par type : dangereux/non dangereux, valorisé/éliminé). "
            "E5-5 (recyclabilité des produits, %) est lié au Digital Product Passport ESPR. "
            "Une stratégie de circularité vise à réduire les déchets mis en décharge et augmenter la part "
            "de matières premières secondaires dans la production."
        ),
        source_ref="ESRS E5-4, E5-5",
    ),
    # -------------------------------------------------------------------
    # ESRS S1 — Effectifs propres
    # -------------------------------------------------------------------
    CorpusEntry(
        id="s1_effectifs",
        standard="ESRS S1",
        topic="Effectifs et conditions de travail",
        keywords=["effectif", "salariés", "CDI", "CDD", "temps plein", "temps partiel", "turnover",
                  "absentéisme", "conditions de travail"],
        answer=(
            "ESRS S1 couvre les conditions de travail des propres effectifs de l'entreprise. "
            "Indicateurs clés : effectif total (ETP et têtes), répartition par genre/contrat/région, "
            "taux de turnover, taux d'absentéisme, heures supplémentaires. "
            "S1-6 à S1-9 portent sur la rémunération équitable, les heures de travail, la sécurité et "
            "la formation (heures de formation par salarié, budget)."
        ),
        source_ref="ESRS S1-6, S1-7, S1-8, S1-9",
    ),
    CorpusEntry(
        id="s1_sante_securite",
        standard="ESRS S1",
        topic="Santé et sécurité au travail",
        keywords=["santé sécurité", "accidents", "LTIR", "taux de fréquence", "maladies professionnelles",
                  "AT", "OHSAS", "ISO 45001"],
        answer=(
            "ESRS S1-14 impose le reporting des indicateurs de santé et sécurité : "
            "LTIR (Lost Time Injury Rate = accidents avec arrêt × 200 000 / heures travaillées), "
            "nombre de décès liés au travail, maladies professionnelles (taux et types). "
            "Un système de management SST certifié ISO 45001 est un indicateur de maturité. "
            "L'entreprise doit déclarer les objectifs de réduction des accidents et leur suivi."
        ),
        source_ref="ESRS S1-14",
    ),
    CorpusEntry(
        id="s1_egalite",
        standard="ESRS S1",
        topic="Égalité hommes-femmes",
        keywords=["égalité", "genre", "femmes", "hommes", "écart salarial", "parité", "index égalité",
                  "discrimination"],
        answer=(
            "ESRS S1-16 requiert le reporting sur l'égalité de rémunération et les opportunités de carrière. "
            "Indicateurs : écart de rémunération H/F (gender pay gap) en %, "
            "ratio de rémunération des plus hauts salaires / médiane, "
            "proportion de femmes dans les instances dirigeantes et au conseil. "
            "En France, l'Index Égalité Femmes-Hommes (Loi Pénicaud) est directement utilisable."
        ),
        source_ref="ESRS S1-16",
    ),
    # -------------------------------------------------------------------
    # ESRS S2 — Travailleurs chaîne de valeur
    # -------------------------------------------------------------------
    CorpusEntry(
        id="s2_chaine_valeur",
        standard="ESRS S2",
        topic="Travailleurs dans la chaîne de valeur",
        keywords=["travailleurs chaîne valeur", "droits humains", "fournisseurs", "audit social",
                  "travail forcé", "travail des enfants", "conditions travail fournisseurs"],
        answer=(
            "ESRS S2 porte sur les droits des travailleurs chez les fournisseurs et sous-traitants. "
            "L'entreprise doit conduire un exercice de diligence raisonnable (devoir de vigilance Loi Sapin 2 "
            "en France, Directive UE 2024/1760 CSDDD). "
            "Indicateurs : nombre de fournisseurs audités sur les droits humains, incidents identifiés, "
            "plans de remédiation. Les secteurs à risque (textile, électronique, agro) sont prioritaires."
        ),
        source_ref="ESRS S2-2, S2-3, S2-4",
    ),
    # -------------------------------------------------------------------
    # ESRS S3 — Communautés affectées
    # -------------------------------------------------------------------
    CorpusEntry(
        id="s3_communautes",
        standard="ESRS S3",
        topic="Communautés affectées",
        keywords=["communautés", "impacts locaux", "consultation", "peuples autochtones", "accaparement terres",
                  "infrastructure", "emploi local"],
        answer=(
            "ESRS S3 concerne les impacts sur les communautés vivant près des sites de l'entreprise. "
            "Sujets couverts : accès aux ressources, contamination, nuisances, impacts sur l'emploi local, "
            "respect des droits des peuples autochtones (UNDRIP). "
            "Un mécanisme de réclamation accessible aux communautés locales est requis (S3-3)."
        ),
        source_ref="ESRS S3-2, S3-3, S3-4",
    ),
    # -------------------------------------------------------------------
    # ESRS S4 — Consommateurs et utilisateurs finaux
    # -------------------------------------------------------------------
    CorpusEntry(
        id="s4_consommateurs",
        standard="ESRS S4",
        topic="Consommateurs et utilisateurs",
        keywords=["consommateurs", "clients", "sécurité produits", "vie privée", "données personnelles",
                  "marketing responsable", "accès équitable"],
        answer=(
            "ESRS S4 porte sur l'impact des produits et services sur les consommateurs. "
            "Sujets clés : sécurité des produits (incidents, rappels), protection des données personnelles, "
            "pratiques de marketing responsable (publicité honnête, pas de greenwashing), "
            "accessibilité financière des produits essentiels. "
            "S4-3 (objectifs de remédiation) et S4-4 (métriques d'incidents) sont les plus fréquemment reportés."
        ),
        source_ref="ESRS S4-2, S4-3, S4-4",
    ),
    # -------------------------------------------------------------------
    # ESRS G1 — Conduite des affaires
    # -------------------------------------------------------------------
    CorpusEntry(
        id="g1_ethique",
        standard="ESRS G1",
        topic="Éthique des affaires et anti-corruption",
        keywords=["corruption", "anti-corruption", "éthique", "code de conduite", "lanceur d'alerte",
                  "concurrence", "lobbying", "conformité"],
        answer=(
            "ESRS G1 couvre la gouvernance, l'éthique des affaires et la culture d'entreprise. "
            "Indicateurs : nombre d'incidents de corruption, amendes pour non-conformité, "
            "existence d'un code de conduite et d'une ligne de dénonciation (whistleblowing). "
            "G1-3 (prévention de la corruption) et G1-4 (incidents confirmés) sont les plus reportés. "
            "En France, la Loi Sapin 2 impose un programme anti-corruption aux grandes entreprises."
        ),
        source_ref="ESRS G1-3, G1-4",
    ),
    CorpusEntry(
        id="g1_fournisseurs_paiement",
        standard="ESRS G1",
        topic="Relations fournisseurs et délais de paiement",
        keywords=["fournisseurs", "délais paiement", "PME", "relations commerciales", "dépendance",
                  "LME", "paiement tardif"],
        answer=(
            "ESRS G1-2 et G1-6 couvrent les pratiques commerciales équitables vis-à-vis des fournisseurs. "
            "Indicateurs : délai moyen de paiement des fournisseurs (jours), part des paiements hors délais, "
            "litiges commerciaux significatifs. "
            "En France, la Loi LME limite les délais de paiement à 60 jours (30 pour les fournisseurs agricoles). "
            "La dépendance excessive à un fournisseur unique est un risque de chaîne d'approvisionnement à divulguer."
        ),
        source_ref="ESRS G1-2, G1-6",
    ),
    # -------------------------------------------------------------------
    # Taxonomy UE
    # -------------------------------------------------------------------
    CorpusEntry(
        id="taxonomie_ue",
        standard="Taxonomie UE",
        topic="Alignement Taxonomie UE",
        keywords=["taxonomie", "éligible", "aligné", "CapEx vert", "OpEx vert", "chiffre affaires aligné",
                  "DNSH", "critères techniques", "activités durables"],
        answer=(
            "La Taxonomie UE (Règlement 2020/852) classe les activités économiques selon leur contribution "
            "à 6 objectifs environnementaux. Une activité est 'alignée' si elle est (1) éligible, "
            "(2) substantiellement contributive à un objectif, (3) ne cause pas de préjudice significatif "
            "aux 5 autres (DNSH), et (4) respecte les garanties sociales minimales. "
            "Le reporting impose 3 KPIs : % CA, % CapEx, % OpEx alignés. "
            "Pour E1, l'activité clé est la production d'énergie renouvelable, la rénovation thermique, "
            "les transports bas-carbone, etc."
        ),
        source_ref="Règlement UE 2020/852, Actes délégués Climat (2021) et Environnement (2023)",
    ),
    # -------------------------------------------------------------------
    # CSRD / VSME
    # -------------------------------------------------------------------
    CorpusEntry(
        id="csrd_champ",
        standard="CSRD",
        topic="Champ d'application CSRD",
        keywords=["CSRD", "grandes entreprises", "PME cotées", "VSME", "seuils", "calendrier",
                  "reporting durabilité", "directive"],
        answer=(
            "La CSRD (Corporate Sustainability Reporting Directive, 2022/2464) s'applique : "
            "- 2024 (rapport 2025) : grandes entreprises UE > 500 salariés (ex-NFRD) "
            "- 2025 (rapport 2026) : grandes entreprises UE > 250 salariés OU CA > 40M€ OU bilan > 20M€ "
            "- 2026 (rapport 2027) : PME cotées (norme VSME allégée) "
            "- 2028 : entreprises extra-UE avec CA > 150M€ dans l'UE. "
            "Les PME non cotées peuvent utiliser volontairement le standard VSME (VS-SME)."
        ),
        source_ref="Directive CSRD 2022/2464, Art. 4-5",
    ),
    CorpusEntry(
        id="vsme_standard",
        standard="VSME",
        topic="Standard VSME pour PME",
        keywords=["VSME", "PME", "standard volontaire", "VS-SME", "reporting simplifié", "indicateurs",
                  "module basique", "module narratif"],
        answer=(
            "Le standard VSME (Voluntary SME standard) est le référentiel de reporting durabilité "
            "simplifié pour les PME non cotées. Il comprend : "
            "- Module basique (B) : indicateurs essentiels (GES scope 1+2, énergie, effectifs, SST, égalité H/F) "
            "- Module narratif (N) : politiques, objectifs, gouvernance "
            "- Module partenaires (P) : questionnaire destiné aux donneurs d'ordre. "
            "Le module P est directement exploitable comme questionnaire fournisseur dans le cadre de S2."
        ),
        source_ref="EFRAG VSME ED, Module B §1-45, Module N §46-80",
    ),
    CorpusEntry(
        id="sfdr",
        standard="SFDR",
        topic="SFDR et finance durable",
        keywords=["SFDR", "PAI", "article 8", "article 9", "finance durable", "investisseurs",
                  "principal adverse impacts", "fonds ESG"],
        answer=(
            "SFDR (Sustainable Finance Disclosure Regulation) impose aux sociétés de gestion de déclarer "
            "les Principal Adverse Impacts (PAI) des investissements. "
            "PAI 1 : émissions GES scope 1+2+3 des sociétés en portefeuille. "
            "PAI 3 : intensité carbone. PAI 4 : exposition aux énergies fossiles. "
            "Les fonds Article 9 (dark green) doivent avoir un objectif d'investissement durable explicite. "
            "Les fonds Article 8 (light green) promeuvent des caractéristiques ESG."
        ),
        source_ref="SFDR Règlement UE 2019/2088, RTS SFDR 2022/1288",
    ),
    # -------------------------------------------------------------------
    # Divers
    # -------------------------------------------------------------------
    CorpusEntry(
        id="bilan_carbone_methodologie",
        standard="GHG Protocol",
        topic="Méthodologie Bilan GES",
        keywords=["bilan carbone", "GHG Protocol", "ISO 14064", "facteurs émission", "ADEME", "périmètre",
                  "consolidation", "année de référence"],
        answer=(
            "Un bilan GES suit le GHG Protocol Corporate Standard (ou ISO 14064-1 équivalent). "
            "Étapes clés : (1) définir le périmètre organisationnel (contrôle opérationnel ou financier), "
            "(2) identifier les sources par scope, (3) collecter les données d'activité, "
            "(4) sélectionner les facteurs d'émission (ADEME Base Empreinte, IEA, IPCC, Ecoinvent), "
            "(5) calculer tCO₂e = données × facteur, (6) vérifier par tier 3 si matériel, "
            "(7) fixer l'année de référence et la méthode de recalcul. "
            "Le Bilan Carbone® ADEME est la méthodologie française reconnue."
        ),
        source_ref="GHG Protocol Corporate Standard 2004, ISO 14064-1:2018",
    ),
    CorpusEntry(
        id="greenwashing",
        standard="Général",
        topic="Anti-greenwashing",
        keywords=["greenwashing", "allégations", "tromperie", "neutralité carbone", "net zéro",
                  "preuves", "directive anti-greenwashing"],
        answer=(
            "La directive anti-greenwashing UE (2024/825) interdit les allégations environnementales "
            "non étayées par des preuves scientifiques. Spécifiquement interdits : "
            "- Allégation de 'neutralité carbone' sans décarbonation réelle (compensation seule insuffisante) "
            "- Éco-labels non reconnus officiellement "
            "- Allégations vagues ('vert', 'éco-responsable') sans critères précis. "
            "Pour ESRS : s'assurer que toute allégation dans le rapport de durabilité est prouvable "
            "et cohérente avec les indicateurs reportés."
        ),
        source_ref="Directive UE 2024/825, Green Claims Directive",
    ),
]


def search(query: str, top_k: int = 5) -> list[dict]:
    """
    Recherche keyword TF-IDF simple sur le corpus ESRS.
    Retourne les top_k entrées les plus pertinentes avec score et source.
    """
    query_lower = query.lower()
    query_words = set(query_lower.split())

    scored: list[tuple[float, CorpusEntry]] = []
    for entry in CORPUS:
        # Score basique : nombre de keywords matchés + présence dans answer/topic
        keyword_hits = sum(
            1 for kw in entry.keywords
            if kw.lower() in query_lower or any(w in kw.lower() for w in query_words)
        )
        topic_bonus = 2 if any(w in entry.topic.lower() for w in query_words) else 0
        standard_bonus = 1 if entry.standard.lower() in query_lower else 0
        score = keyword_hits + topic_bonus + standard_bonus
        if score > 0:
            scored.append((score, entry))

    scored.sort(key=lambda x: -x[0])
    return [
        {
            "id": e.id,
            "standard": e.standard,
            "topic": e.topic,
            "answer": e.answer,
            "source_ref": e.source_ref,
            "score": s,
        }
        for s, e in scored[:top_k]
    ]
