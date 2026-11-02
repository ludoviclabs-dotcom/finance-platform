# Source de vérité du snapshot « Robotique & IA physique ».
#
# Le JSON livré (data/robotics_humanoid_snapshot_<date>.json) est GÉNÉRÉ par ce
# script : toute correction se fait ici, jamais dans le JSON. La CI Carbon lance
# `--check`, qui échoue si le JSON versionné diverge de ce que produit le script.
#
# Usage, depuis apps/carbon :
#   python3 scripts/robotics/build_snapshot.py           # régénère le JSON
#   python3 scripts/robotics/build_snapshot.py --check   # vérifie sans écrire
#
# Bibliothèque standard uniquement. La comparaison porte sur le contenu JSON
# (pas les octets), pour rester insensible aux fins de ligne CRLF/LF.
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from structure import ACTORS, ED, LAYERS, MATERIAL_LINKS, SLUG  # noqa: E402

ACCESSED = "2026-11-02"
OUTPUT = Path(__file__).resolve().parents[2] / "data" / f"robotics_humanoid_snapshot_{ACCESSED}.json"
SNIPPET = "Page inaccessible au moment de la relecture : valeur lue dans l'extrait de recherche."


def src(id, publisher, title, url, published, kind, note=None):
    s = {"id": id, "publisher": publisher, "title": title, "url": url,
         "published": published, "accessed": ACCESSED, "kind": kind}
    if note:
        s["note"] = note
    return s


SOURCES = [
    src(ED, "L-Labs (Ludovic Labeaut)", "Robotique humanoïde : où se capte la valeur, de 2026 à 2050",
        "https://l-labs-portfolio.vercel.app/dossiers/robotique-humanoide", "2026-10-14", "editorial",
        "Dossier éditorial d'origine : structure des 12 couches, choix des acteurs, qualifications."),
    # ── Matières, aimants, contrôles à l'export
    src("usgs-mcs-2026-ree", "U.S. Geological Survey", "Mineral Commodity Summaries 2026 — Rare Earths",
        "https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-rare-earths.pdf", "2026-02", "primary"),
    src("iea-ree-2026", "Agence internationale de l'énergie (AIE)", "Rare Earth Elements — Executive summary",
        "https://www.iea.org/reports/rare-earth-elements/executive-summary", "2026-04-08", "primary"),
    src("iea-gcmo-2026", "Agence internationale de l'énergie (AIE)",
        "Supply concentration, export restrictions and declining investment put critical mineral security at risk",
        "https://www.iea.org/news/supply-concentration-export-restrictions-and-declining-investment-put-critical-mineral-security-at-risk",
        "2026-07-16", "primary", "Communiqué de lancement du Global Critical Minerals Outlook 2026."),
    src("adamas-2026-04", "Adamas Intelligence", "Humanoid robotics sector accelerates on multiple commercialization fronts in March",
        "https://www.adamasintel.com/humanoid-robotics-sector-accelerates-on-multiple-commercialization-fronts-in-march/",
        "2026-04-14", "primary"),
    src("adamas-2026-01", "Adamas Intelligence", "What Boston Dynamics' Atlas reveals about the future of NdFeB magnet demand",
        "https://www.adamasintel.com/what-boston-dynamics-atlas-reveals-about-the-future-of-ndfeb-magnet-demand/",
        "2026-01-16", "primary"),
    src("fai-2026-09", "Foundation for American Innovation (Policy Gradients)", "The robot boom has a magnet problem",
        "https://policygradients.thefai.org/p/the-robot-boom-has-a-magnet-problem", "2026-09-08", "secondary",
        "Le chiffre par véhicule électrique y est attribué au JRC (Commission européenne)."),
    src("mofcom-18-2025", "Ministère chinois du Commerce (MOFCOM) et Administration des douanes",
        "Announcement No. 18 of 2025 on export control of some medium and heavy rare earth related items",
        "https://english.mofcom.gov.cn/Policies/AnnouncementsOrders/art/2025/art_0dd87cbee7b045bf93fabe6ab2faceee.html",
        "2025-04-04", "primary"),
    src("mofcom-70-2025", "Ministère chinois du Commerce (MOFCOM) et Administration des douanes",
        "商务部、海关总署公告2025年第70号 (annonce n° 70 de 2025)",
        "https://www.mofcom.gov.cn/zwgk/zcfb/art/2025/art_b1ec77dd3f0d4762952904df7cdaadec.html", "2025-11-07", "primary"),
    src("chinadaily-2026-09", "China Daily Hong Kong", "China-US economic and trade consultations yield positive consensus",
        "https://www.chinadailyhk.com/article/640241", "2026-09-28", "secondary",
        "La déclaration ne cite pas explicitement les terres rares."),
    # ── Semi-conducteurs
    src("sia-2026", "Semiconductor Industry Association (SIA)",
        "2026 State of the Industry Report: Historic Growth Amid Intensifying Global Competition",
        "https://www.semiconductors.org/2026-state-of-the-industry-report-historic-growth-amid-intensifying-global-competition/",
        "2026-07-27", "primary"),
    src("sia-bcg-2024", "SIA et Boston Consulting Group", "Emerging Resilience in the Semiconductor Supply Chain — Briefing",
        "https://semiconductors.org/wp-content/uploads/2024/05/Emerging-Resilience-in-the-Semiconductor-Supply-Chain_BCG-Briefing.pdf",
        "2024-05", "primary"),
    src("trendforce-2026-09", "TrendForce",
        "Global Foundry Revenue Approaches US$53.49 Billion in 2Q26 as SMIC Narrows Market Share Gap with Samsung",
        "https://www.trendforce.com/presscenter/news/20260909-13225.html", "2026-09-09", "primary"),
    src("bis-2022-10", "Federal Register — Bureau of Industry and Security (BIS)",
        "Implementation of Additional Export Controls: Certain Advanced Computing and Semiconductor Manufacturing Items",
        "https://www.federalregister.gov/documents/2022/10/13/2022-21658/implementation-of-additional-export-controls-certain-advanced-computing-and-semiconductor",
        "2022-10-13", "primary", SNIPPET),
    src("covington-2026-01", "Covington & Burling",
        "US Commerce Department revises license review policy for exports of certain advanced computing commodities to China and Macau",
        "https://www.cov.com/en/news-and-insights/insights/2026/01/us-commerce-department-revises-license-review-policy-for-exports-of-certain-advanced-computing-commodities-to-china-and-macau",
        "2026-01-20", "secondary", "Note d'un cabinet d'avocats résumant la règle BIS du 13 janvier 2026."),
    src("nvidia-gr00t-2025", "NVIDIA", "NVIDIA Announces Isaac GR00T N1 — the World's First Open Humanoid Robot Foundation Model",
        "https://nvidianews.nvidia.com/news/nvidia-isaac-gr00t-n1-open-humanoid-robot-foundation-model-simulation-frameworks",
        "2025-03-18", "primary"),
    src("nvidia-thor-2025", "NVIDIA", "NVIDIA Blackwell-Powered Jetson Thor Now Available, Accelerating the Age of General Robotics",
        "https://nvidianews.nvidia.com/news/nvidia-blackwell-powered-jetson-thor-now-available-accelerating-the-age-of-general-robotics",
        "2025-08-25", "primary"),
    # ── Volumes et constructeurs
    src("futura-omdia-2026", "Futura-Sciences (d'après Omdia)",
        "Jusqu'à 100 000 robots humanoïdes en un an en Chine",
        "https://www.futura-sciences.com/tech/actualites/robotique-jusqua-100-000-robots-humanoides-an-chine-occident-pourrait-ne-jamais-rattraper-133093/",
        "2026-03-23", "secondary", "Le rapport Omdia d'origine est payant."),
    src("restofworld-2026", "Rest of World", "Article sur les robots humanoïdes chinois (février 2026)",
        "https://restofworld.org/2026/china-humanoid-robots/", "2026-02-05", "secondary"),
    src("agibot-2026-01", "AgiBot", "Communiqué sur les livraisons mondiales de 2025 (données Omdia)",
        "https://www.agibot.com/article/231/detail/33.html", "2026-01-08", "primary"),
    src("agibot-2026-03", "AgiBot (PR Newswire)", "AGIBOT Reaches 10,000 Units as Real-World Demand for Robots Accelerates",
        "https://tools.prnewswire.com/en-us/live/20823/release/20260330EN21903", "2026-03-30", "primary"),
    src("agibot-2026-09", "AgiBot (PR Newswire, repris par Thailand Business News)",
        "AGIBOT and Chimelong Launch Large-Scale Embodied AI Theme Park with More Than 300 Robots",
        "https://www.thailand-business-news.com/?p=330876", "2026-09-24", "primary"),
    src("pedaily-2025-05", "投资界 (PEdaily)", "刘强东，投了稚晖君 (actionnaires d'AgiBot)",
        "https://news.pedaily.cn/202505/550304.shtml", "2025-05-28", "secondary"),
    src("unitree-prospectus-2026", "Unitree Robotics et CITIC Securities (CNINFO)",
        "宇树科技 — prospectus d'introduction au STAR Market (version soumise au comité)",
        "https://dataclouds.cninfo.com.cn/sjother2/documents/2026/2026-05-25/3d7fc0538abe281340a95c9c77a90525.pdf",
        "2026-05-25", "primary"),
    src("sse-chinadaily-2026-08", "China Daily (repris par la Bourse de Shanghai)",
        "Unitree IPO draws spotlight to China's fast-growing humanoid robot sector",
        "https://english.sse.com.cn/news/newsrelease/voice/c/c_20260811_10828578.shtml", "2026-08", "secondary"),
    src("10jqka-2026-08", "同花顺财经 (d'après 21世纪经济报道)", "Production cumulée des humanoïdes Unitree (août 2026)",
        "https://stock.10jqka.com.cn/20260815/c678984034.shtml", "2026-08-15", "secondary"),
    src("ubtech-2025-11", "UBTECH (PR Newswire)",
        "UBTECH Humanoid Robot Walker S2 Begins Mass Production and Delivery, with Orders Exceeding 800 Million Yuan",
        "https://kyodonewsprwire.jp/index.php/release/202511179261", "2025-11-17", "primary"),
    src("ubtech-2025-12", "UBTECH (communiqué publié par Global Times)", "1 000e Walker S2 sorti de la ligne de Liuzhou",
        "https://www.globaltimes.cn/page/202512/1351863.shtml", "2025-12-30", "primary"),
    src("ubtech-hkex-2026-08", "UBTECH Robotics (HKEX : 9880)", "Interim Results Announcement for the Six Months Ended June 30, 2026",
        "https://www1.hkexnews.hk/listedco/listconews/sehk/2026/0828/2026082801691.pdf", "2026-08-28", "primary"),
    src("ubtech-walker-s2", "UBTECH", "Walker S2 — fiche produit",
        "https://www.ubtrobot.com/en/humanoid/products/WalkerS2", None, "primary"),
    src("tesla-q4-2025", "Tesla (formulaire 8-K, SEC)", "Tesla Q4 2025 Update",
        "https://www.sec.gov/Archives/edgar/data/1318605/000162828026003837/exhibit991.htm", "2026-01-28", "primary"),
    src("tesla-q3-2026", "Tesla (formulaire 8-K, SEC)", "Tesla Q3 2026 Update",
        "https://www.sec.gov/Archives/edgar/data/0001318605/000162828026066738/exhibit9914.htm", "2026-10-21", "primary"),
    src("drivetesla-2026-07", "Drive Tesla Canada", "Tesla Dismantles Model S/X Line in Just 46 Days to Make Room for Optimus Production",
        "https://driveteslacanada.ca/news/tesla-optimus-production-fremont-model-sx-line-46-days/", "2026-07-11", "secondary"),
    src("figure-ramping-2026", "Figure AI", "Ramping Figure 03 Production",
        "https://www.figure.ai/news/ramping-figure-03-production", "2026-04-29", "primary"),
    src("figure-bmw-2025", "Figure AI", "F.02 Contributed to the Production of 30,000 Cars at BMW",
        "https://figure.ai/news/production-at-bmw", "2025-11-19", "primary"),
    src("figure-battery-2025", "Figure AI", "Figure 03 — développement de la batterie",
        "https://figure.ai/news/f-03-battery-development", "2025-07-17", "primary"),
    src("automotiveworld-2026-06", "Automotive World", "BMW Group brings Figure 03 humanoid to Spartanburg",
        "https://www.automotiveworld.com/news/bmw-group-brings-figure-03-humanoid-to-spartanburg/", "2026-06-25", "secondary"),
    src("1x-neo-factory", "1X Technologies", "NEO Factory", "https://www.1x.tech/discover/neo-factory", "2026-04-30", "primary"),
    src("agility-425-2026-06", "Agility Robotics (formulaire 425, SEC)", "Transcription du webcast investisseurs (juin 2026)",
        "https://www.sec.gov/Archives/edgar/data/0002074973/000121390026072063/ea029599102-425_churchill11.htm",
        "2026-06", "primary", "Déclarations de l'entreprise, non auditées."),
    src("agility-425-2026-10", "Agility Robotics (formulaire 425, SEC)", "Agility Robotics Commercial Update and Investor Call transcript",
        "https://www.sec.gov/Archives/edgar/data/0002074973/000121390026112934/ea0309843-425_churchill11.htm",
        "2026-10-26", "primary", "Déclarations de l'entreprise, non auditées."),
    src("agility-gxo-2024", "Agility Robotics et GXO Logistics", "GXO Signs Industry-First Multi-Year Agreement with Agility Robotics",
        "https://agilityrobotics.com/content/gxo-signs-industry-first-multi-year-agreement-with-agility-robotics",
        "2024-06-27", "primary"),
    src("agility-schaeffler-2024", "Agility Robotics",
        "Agility Robotics Announces Strategic Investment and Agreement with Motion Technology Company Schaeffler Group",
        "https://agilityrobotics.com/content/agility-robotics-announces-strategic-investment-and-agreement-with-motiontechnology-company-schaeffler-group",
        "2024-11-13", "primary"),
    src("interestingeng-2023", "Interesting Engineering (d'après Bloomberg)",
        "Robo-retailer? Watch GXO test 'human-centric' robot at SPANX warehouse",
        "https://interestingengineering.com/innovation/gxo-test-human-centric-robot-at-spanx", "2023-12-14", "secondary"),
    src("skf-leaderdrive-2026", "SKF (communiqué repris par Inderes)", "SKF and Leaderdrive form a venture for precision components in humanoids",
        "https://www.inderes.fi/en/releases/skf-and-leaderdrive-form-a-venture-for-precision-components-in-humanoids",
        "2026-07-02", "primary"),
    src("schaeffler-actuator-2025", "Schaeffler", "Schaeffler presents innovative planetary gear actuator for humanoid robots",
        "https://www.schaeffler.com/en/media/press-releases/press-releases-detail.jsp?id=88156672", "2025-12-16", "primary"),
    src("schaeffler-neura-2025", "Schaeffler", "Schaeffler and Neura Robotics launch future-oriented technology partnership",
        "https://www.schaeffler.com/en/media/press-releases/press-releases-detail.jsp?id=88136515", "2025-11-04", "primary"),
    src("humanoid-schaeffler-2026", "Humanoid (SKL Robotics)", "Humanoid Secures Landmark Deal with Schaeffler to Deploy Thousands of Humanoid Robots",
        "https://thehumanoid.ai/humanoid-secures-landmark-deal-with-schaeffler-to-deploy-thousands-of-humanoid-robots/",
        "2026-05-13", "primary"),
    src("apptronik-2025-03", "Apptronik", "Apptronik closes additional Series A funding",
        "https://apptronik.com/news-collection/apptronik-closes-additional-series-a-funding", "2025-03-18", "primary"),
    src("heise-2025-03", "heise online", "Humanoid robots: Mercedes-Benz invests millions in Apptronik",
        "https://heise.de/-10320691", "2025-03-19", "secondary"),
    src("hyundai-bd-2021", "Hyundai Motor Group", "Hyundai Motor Group Completes Acquisition of Boston Dynamics from SoftBank",
        "https://www.hyundai.com/worldwide/en/newsroom/detail/hyundai-motor-group-completes-acquisition-of-boston-dynamics-from-softbank-0000000516",
        "2021-06-21", "primary"),
    src("hyundai-ces-2026", "Hyundai Motor Group", "Hyundai Motor Group Announces AI Robotics Strategy … at CES 2026",
        "https://www.hyundai.com/worldwide/en/newsroom/detail/0000001100", "2026-01-05", "primary"),
    # ── Fonds publics chinois
    src("yicai-2025-02", "Yicai Global", "Beijing to Invest up to USD13.7 Billion in AI and Robotics Startups, Official Says",
        "https://yicaiglobal.com/news/beijing-to-invest-up-to-usd137-billion-in-ai-and-robotics-startups-official-says",
        "2025-02-28", "secondary"),
    src("caixin-2025-12", "Caixin Global", "China launches $14 billion state fund to back strategic tech industries",
        "https://www.caixinglobal.com/2025-12-26/china-launches-14-billion-state-fund-to-back-strategic-tech-industries-102397440.html",
        "2025-12-26", "secondary"),
    # ── Marché et coûts
    src("gs-humanoid-2024", "Goldman Sachs Research", "The global market for humanoid robots could reach $38 billion by 2035",
        "https://www.goldmansachs.com/insights/articles/the-global-market-for-robots-could-reach-38-billion-by-2035",
        "2024-02-27", "primary", SNIPPET),
    src("wallst-gs-2026", "24/7 Wall St.", "Goldman Sachs Just Supercharged Its Humanoid Robot Prediction 5X to 6.5 Million by 2035",
        "https://247wallst.com/investing/2026/09/14/goldman-sachs-just-supercharged-its-humanoid-robot-prediction-5x-to-6-5-million-by-2035/",
        "2026-09-14", "secondary", "Chiffres relayés ; le rapport Goldman Sachs de septembre 2026 n'a pas été consulté."),
    src("ms-humanoids-5tn", "Morgan Stanley Research", "Humanoid Robot Market Expected to Reach $5 Trillion by 2050",
        "https://www.morganstanley.com/insights/articles/humanoid-robot-market-5-trillion-by-2050", None, "primary", SNIPPET),
    src("cnbc-ms-2025", "CNBC", "Morgan Stanley says humanoid robots will be a $5 trillion market by 2050. How to play it",
        "https://www.cnbc.com/2025/04/29/how-to-play-a-5-trillion-market-for-humanoid-robots-by-2050.html", "2025-04-29", "secondary"),
    src("emsnow-ms-2025", "EMSNow (d'après Morgan Stanley Research)", "Humanoids: A $5 Trillion Market",
        "https://www.emsnow.com/?p=46855", "2025-06-09", "secondary"),
    src("ms-podcast-2026-03", "Morgan Stanley, podcast « Thoughts on the Market » (transcription)", "Japan's Bull Market Takes Shape",
        "https://www.podcast.de/episode/702302875/japans-bull-market-takes-shape", "2026-03", "secondary"),
    src("scmp-ms-2025-12", "South China Morning Post (via Yahoo), d'après Morgan Stanley",
        "China packs a patent punch in the race to build humanoid robots",
        "https://tech.yahoo.com/science/articles/china-packs-patent-punch-race-093000841.html", "2025-12-20", "secondary"),
    src("bofa-physical-ai-2026", "Bank of America Institute (d'après BofA Global Research)", "Physical AI, part 2: Humanoid robots",
        "https://institute.bankofamerica.com/content/dam/transformation/physical-ai-part-2.pdf", "2026-03-12", "primary"),
    src("citi-gps-2024", "Citi Global Insights", "The Rise of AI Robots – Humanoids are Coming for You",
        "https://citigroup.com/global/insights/the-rise-of-ai-robots-humanoids-are-coming-for-you", "2024-11-04", "primary"),
    src("yahoo-citi-2024", "Yahoo Finance (d'après Citi Global Insights)",
        "Tesla's Elon Musk may not be the only one cashing in on humanoid robots",
        "https://finance.yahoo.com/news/teslas-elon-musk-may-not-be-the-only-one-cashing-in-on-humanoid-robots-133048663.html",
        "2024-12-01", "secondary"),
    src("mm-2026-07", "MarketsandMarkets (communiqué repris par finanznachrichten.de)", "Humanoid Robot Market worth $50.27 billion by 2035",
        "https://www.finanznachrichten.de/nachrichten-2026-07/68953029-humanoid-robot-market-worth-dollar-50-27-billion-by-2035-exclusive-report-by-marketsandmarkets-008.htm",
        "2026-07-06", "primary", "Cabinet d'études de marché."),
    src("mm-2030", "MarketsandMarkets", "Humanoid Robot Market Size, Share & Analysis, 2030",
        "https://www.marketsandmarkets.com/ResearchInsight/humanoid-robot-market-analysis.asp", None, "primary",
        "Cabinet d'études de marché. " + SNIPPET),
    src("roots-2026", "Roots Analysis", "Humanoid Robot Market", "https://www.rootsanalysis.com/humanoid-robot-market",
        "2026-08", "primary", "Cabinet d'études de marché."),
    src("gmi-2026", "Global Market Insights", "Humanoid Robot Market", "https://www.gminsights.com/pressrelease/humanoid-robot-market",
        "2026-09", "primary", "Cabinet d'études de marché."),
    src("abi-2025", "ABI Research", "Humanoid Robot Market Size Outlook",
        "https://www.abiresearch.com/news-resources/chart-data/humanoid-robot-market-size-outlook", None, "primary",
        "Cabinet d'études de marché ; page non datée, rapport d'origine du 3e trimestre 2025."),
    src("yole-2025-11", "Yole Group (repris par Edge AI and Vision Alliance)", "Humanoid Robots 2025: The Race to Useful Intelligence",
        "https://www.edge-ai-vision.com/2025/11/humanoid-robots-2025-the-race-to-useful-intelligence/", "2025-11-11", "primary",
        "Cabinet d'études de marché."),
    src("bcc-2025-10", "BCC Research", "Humanoid Robot: Applications, Verticals and Global Markets",
        "https://www.bccresearch.com/market-research/instrumentation-and-sensors/humanoid-robot-market.html", "2025-10", "primary",
        "Cabinet d'études de marché."),
    src("bls-production", "U.S. Bureau of Labor Statistics", "Occupational Outlook Handbook — Production Occupations",
        "https://www.bls.gov/ooh/production/home.htm", None, "primary", "Données de mai 2025."),
    src("eurostat-2025-11", "Eurostat", "Annual full-time adjusted salary in EU up 5.2% in 2024",
        "https://ec.europa.eu/eurostat/web/products-eurostat-news/w/ddn-20251112-1", "2025-11-12", "primary"),
]


def prov(quality, *ids, note=None):
    p = {"data_quality": quality, "source_ids": list(ids)}
    if note:
        p["note"] = note
    return p


def V(*ids, note=None):
    return prov("verified", *ids, note=note)


def E(*ids, note=None):
    return prov("estimated", *ids, note=note)


def M(*ids, note=None):
    return prov("manual", ED, *ids, note=note)


def kf(id, label, value_label, mn, mx, unit, as_of, p):
    return {"id": id, "label": label, "value_label": value_label, "min": mn, "max": mx,
            "unit": unit, "as_of": as_of, "provenance": p}


KEY_FIGURES = [
    # Matières et aimants
    kf("chine-extraction-terres-rares", "Part de la Chine dans l'extraction mondiale de terres rares", "69 %", 69, 69, "%", "2025",
       V("usgs-mcs-2026-ree", note="270 000 t sur 390 000 t d'oxydes (estimation 2025). Le chiffre chinois suit le quota officiel : c'est un plancher.")),
    kf("chine-extraction-terres-rares-aimants", "Part de la Chine dans l'extraction des terres rares pour aimants (NdPr, Dy, Tb)", "60 %", 60, 60, "%", "2024",
       V("iea-ree-2026")),
    kf("chine-raffinage-terres-rares", "Part de la Chine dans le raffinage des terres rares", "85 %", 85, 85, "%", "2025",
       V("iea-gcmo-2026", "iea-ree-2026", note="Plus de 90 % en 2023 et 91 % en 2024 ; la baisse vient de nouveaux projets aux États-Unis et en Malaisie.")),
    kf("chine-aimants-frittes", "Part de la Chine dans la production d'aimants permanents frittés", "94 %", 94, 94, "%", "2024",
       V("iea-ree-2026")),
    kf("ndfeb-par-humanoide", "Aimants NdFeB par humanoïde", "2 à 4,5 kg", 2, 4.5, "kg", "2026",
       E("adamas-2026-04", "fai-2026-09", note="Estimations d'analystes ; aucun constructeur ne publie ce chiffre. Adamas retient environ 4 kg pour un humanoïde avancé.")),
    kf("ndfeb-par-vehicule-electrique", "Aimants NdFeB par véhicule électrique (moyenne pondérée des ventes)", "1,4 kg", 1.4, 1.4, "kg", "2026",
       E("fai-2026-09", note="Un humanoïde contient donc autant, voire plus d'aimants qu'un véhicule électrique.")),
    # Semi-conducteurs
    kf("us-ventes-semi-conducteurs", "Part des entreprises américaines dans les ventes mondiales de semi-conducteurs", "53,4 %", 53.4, 53.4, "%", "2025",
       V("sia-2026", note="Tous semi-conducteurs confondus, pas seulement les puces d'IA.")),
    kf("taiwan-logique-avancee", "Part de Taïwan dans les capacités de logique avancée (< 10 nm)", "69 %", 69, 69, "%", "2022",
       V("sia-bcg-2024", note="Corée du Sud 31 %, États-Unis 0 % en 2022 ; projection 2032 : Taïwan 47 %, États-Unis 28 %.")),
    kf("tsmc-revenus-fonderie", "Part de TSMC dans les revenus mondiaux de la fonderie", "72,5 %", 72.5, 72.5, "%", "T2 2026",
       V("trendforce-2026-09", note="Part des revenus des dix premiers fondeurs, tous nœuds confondus.")),
    kf("gr00t-donnees-synthetiques", "Démonstrations humaines simulées générées par NVIDIA pour GR00T N1", "6 500 h en 11 h", 6500, 6500, "heures", "2025",
       V("nvidia-gr00t-2025", note="780 000 trajectoires synthétiques, soit neuf mois de démonstrations humaines, générées en 11 heures.")),
    # Volumes
    kf("livraisons-mondiales-2025", "Humanoïdes livrés dans le monde", "≈ 13 300", 13318, 13318, "robots", "2025",
       V("futura-omdia-2026", "agibot-2026-01", note="Omdia ; IDC estime de son côté près de 18 000 unités.")),
    kf("part-chine-livraisons-2025", "Part des entreprises chinoises dans les livraisons mondiales d'humanoïdes", "87 %", 87, 87, "%", "2025",
       V("futura-omdia-2026", "restofworld-2026")),
    kf("bofa-livraisons-2030", "Livraisons annuelles d'humanoïdes projetées en 2030 (BofA)", "1,2 million", 1200000, 1200000, "robots/an", "2030",
       V("bofa-physical-ai-2026")),
    kf("bofa-livraisons-2035", "Livraisons annuelles d'humanoïdes projetées en 2035 (BofA)", "10 millions", 10000000, 10000000, "robots/an", "2035",
       V("bofa-physical-ai-2026", note="Contre 20 000 en 2025 et 90 000 en 2026.")),
    kf("ms-parc-2050", "Humanoïdes en service en 2050 (Morgan Stanley)", "≈ 1 milliard", 1000000000, 1000000000, "robots", "2050",
       V("ms-humanoids-5tn", "cnbc-ms-2025")),
    kf("ms-parc-chine-2050", "Humanoïdes en service en Chine en 2050 (Morgan Stanley)", "302 millions", 302.3, 302.3, "millions de robots", "2050",
       V("emsnow-ms-2025")),
    kf("ms-parc-usa-2050", "Humanoïdes en service aux États-Unis en 2050 (Morgan Stanley)", "78 millions", 77.7, 77.7, "millions de robots", "2050",
       V("emsnow-ms-2025")),
    kf("ms-usage-professionnel-2050", "Part des usages industriels et commerciaux en 2050 (Morgan Stanley)", "90 %", 90, 90, "%", "2050",
       V("emsnow-ms-2025", note="Environ 930 millions d'unités ; environ 80 millions dans les foyers.")),
    # Coûts
    kf("bofa-bom-chine-2025", "Coût matériel d'un humanoïde assemblé en Chine", "35 000 $", 35000, 35000, "$", "2025",
       V("bofa-physical-ai-2026")),
    kf("bofa-bom-chine-2030", "Coût matériel projeté d'un humanoïde assemblé en Chine", "< 17 000 $", 17000, 17000, "$", "2030",
       V("bofa-physical-ai-2026", note="Borne haute : BofA projette un coût inférieur à 17 000 $.")),
    kf("ms-bom-hors-chine", "Surcoût matériel d'Optimus Gen 2 sans fournisseurs chinois", "≈ 2,8 fois", 2.8, 2.8, "facteur", "2025",
       V("scmp-ms-2025-12", note="Morgan Stanley : environ 46 000 $ avec la chaîne chinoise, 131 000 $ sans.")),
    kf("ms-prix-2050", "Prix projeté d'un humanoïde dans les pays à haut revenu (Morgan Stanley)", "≈ 50 000 $", 50000, 50000, "$", "2050",
       V("emsnow-ms-2025", note="Environ 200 000 $ en 2024 et 150 000 $ en 2028 : un prix de vente, pas un coût matériel.")),
    kf("yole-prix-moyen", "Prix de vente moyen d'un humanoïde (Yole)", "75 000 $ → 25 000 $", 25000, 75000, "$", "2025–2035",
       V("yole-2025-11", note="75 000 $ en 2025, 25 000 $ projetés en 2035.")),
    kf("agility-cout-production", "Coût de production actuel d'un Digit (Agility Robotics)", "125 000 $", 125000, 125000, "$", "2026",
       V("agility-425-2026-06", note="Déclaration de l'entreprise ; objectif de coût matériel : 30 000 $.")),
    kf("bofa-actionneurs-mains-2030", "Part des actionneurs et des mains dans le coût matériel projeté", "≈ 70 %", 70, 70, "%", "2030",
       V("bofa-physical-ai-2026", note="Actionneurs linéaires 27 %, rotatifs 24 %, mains dextres 19 %.")),
    kf("ddl-humanoide", "Degrés de liberté d'un humanoïde", "30 à 40 en moyenne", 30, 40, "degrés de liberté", "2026",
       V("adamas-2026-01", note="Jusqu'à 56 pour l'Atlas électrique de Boston Dynamics.")),
    kf("batterie-figure-03", "Batterie de Figure 03", "2,3 kWh · 5 h", 2.3, 2.3, "kWh", "2025",
       V("figure-battery-2025", note="Cinq heures d'autonomie à pleine performance.")),
    # Économie de l'usage
    kf("digit-cout-horaire", "Coût d'exploitation estimé de Digit", "10 à 12 $/h", 10, 12, "$/h", "2023",
       E("interestingeng-2023", note="Estimation Bloomberg sur une durée de vie d'environ 20 000 heures ; pas un tarif payé par un client.")),
    kf("agility-retour-investissement", "Retour sur investissement annoncé en location (RaaS)", "< 1 an", 0, 1, "an", "2026",
       V("agility-425-2026-06", note="Déclaration d'Agility Robotics ; la location est facturée sous le coût horaire chargé du poste remplacé.")),
    kf("salaire-production-usa", "Salaire annuel médian des métiers de production aux États-Unis", "46 990 $", 46990, 46990, "$", "2025",
       V("bls-production", note="Salaire de base de mai 2025, hors charges.")),
    kf("salaire-moyen-ue", "Salaire annuel moyen en équivalent temps plein dans l'UE", "39 800 €", 39800, 39800, "€", "2024",
       V("eurostat-2025-11", note="Tous secteurs confondus, pas seulement l'industrie.")),
    # Politique industrielle chinoise
    kf("fonds-pekin-ia-robotique", "Fonds public de Pékin pour l'IA et la robotique", "jusqu'à 100 Md CNY", 100, 100, "Md CNY", "2025",
       V("yicai-2025-02", note="Environ 13,7 Md$ ; plafond annoncé, pas un capital engagé ; périmètre IA et robotique.")),
    kf("fonds-national-capital-risque", "Fonds national chinois d'orientation du capital-risque", "100 Md CNY", 100, 100, "Md CNY", "2025",
       V("caixin-2025-12", note="Environ 14 Md$ de capital public, lancé le 26 décembre 2025 ; l'IA incarnée fait partie des secteurs visés, il n'est pas propre à la robotique.")),
]

PROJECTIONS = [
    {"id": "ms-2050", "institution": "Morgan Stanley", "horizon": 2050, "min_bn_usd": 5000, "max_bn_usd": 5000,
     "scope": "Humanoïdes, chaînes d'approvisionnement et services de maintenance compris",
     "detail": "Environ 1 milliard d'humanoïdes en service, dont 90 % dans l'industrie et le commerce.",
     "provenance": V("ms-humanoids-5tn", "cnbc-ms-2025")},
    {"id": "ms-2050-revision", "institution": "Morgan Stanley (révision 2026)", "horizon": 2050, "min_bn_usd": 7500, "max_bn_usd": 7500,
     "scope": "Marché annuel des humanoïdes",
     "detail": "Chiffre cité en mars 2026 par l'équipe robotique de la banque.",
     "provenance": E("ms-podcast-2026-03", note="Cité oralement dans un podcast de la banque ; rapport écrit non consulté.")},
    {"id": "citi-2050", "institution": "Citi", "horizon": 2050, "min_bn_usd": 7000, "max_bn_usd": 7000,
     "scope": "Marché adressable des humanoïdes",
     "detail": "Près de 650 millions d'humanoïdes en service en 2050.",
     "provenance": V("citi-gps-2024", "yahoo-citi-2024")},
    {"id": "citi-2035", "institution": "Citi", "horizon": 2035, "min_bn_usd": 209, "max_bn_usd": 209,
     "scope": "Marché adressable des humanoïdes",
     "detail": "Étape intermédiaire de la projection 2050 de Citi.",
     "provenance": V("yahoo-citi-2024")},
    {"id": "gs-2035-2026", "institution": "Goldman Sachs (révision 2026)", "horizon": 2035, "min_bn_usd": 138, "max_bn_usd": 138,
     "scope": "Robots humanoïdes",
     "detail": "Environ 6,5 millions d'unités livrées en 2035, contre 1,4 million dans la prévision de 2024.",
     "provenance": E("wallst-gs-2026", note="Chiffres relayés par la presse financière ; à confirmer sur le site de Goldman Sachs.")},
    {"id": "gs-2035-2024", "institution": "Goldman Sachs (2024)", "horizon": 2035, "min_bn_usd": 38, "max_bn_usd": 38,
     "scope": "Robots humanoïdes",
     "detail": "Prévision multipliée par plus de six par rapport aux 6 Md$ de 2022 ; 1,4 million d'unités livrées en 2035.",
     "provenance": V("gs-humanoid-2024")},
    {"id": "etudes-2035", "institution": "Cabinets d'études de marché", "horizon": 2035, "min_bn_usd": 50, "max_bn_usd": 193,
     "scope": "Robots humanoïdes, définitions variables selon le cabinet",
     "detail": "MarketsandMarkets 50,3 Md$, Yole 51 Md$, Global Market Insights 192,7 Md$.",
     "provenance": E("mm-2026-07", "yole-2025-11", "gmi-2026")},
    {"id": "etudes-2030", "institution": "Cabinets d'études de marché", "horizon": 2030, "min_bn_usd": 6, "max_bn_usd": 15,
     "scope": "Robots humanoïdes, définitions variables selon le cabinet",
     "detail": "Yole 6 Md$, ABI Research 6,5 Md$, BCC 11 Md$, Roots Analysis 12 Md$, MarketsandMarkets 15,3 Md$.",
     "provenance": E("yole-2025-11", "abi-2025", "bcc-2025-10", "roots-2026", "mm-2030")},
    {"id": "etudes-2026", "institution": "Cabinets d'études de marché", "horizon": 2026, "min_bn_usd": 3, "max_bn_usd": 11,
     "scope": "Robots humanoïdes, définitions variables selon le cabinet",
     "detail": "Roots Analysis 3 Md$, MarketsandMarkets 5,4 Md$, Global Market Insights 10,9 Md$.",
     "provenance": E("roots-2026", "mm-2026-07", "gmi-2026")},
]

BOFA_NOTE = "Répartition projetée pour 2030, humanoïde assemblé en Chine."
BOM = [
    {"id": "actionneurs-lineaires", "label": "Actionneurs linéaires", "detail": "Vis à rouleaux, moteurs et électronique des membres",
     "min_pct": 27, "max_pct": 27, "layer_ids": [SLUG[8], SLUG[9]], "provenance": V("bofa-physical-ai-2026", note=BOFA_NOTE)},
    {"id": "actionneurs-rotatifs", "label": "Actionneurs rotatifs", "detail": "Moteurs, réducteurs et roulements des articulations",
     "min_pct": 24, "max_pct": 24, "layer_ids": [SLUG[8], SLUG[9]], "provenance": V("bofa-physical-ai-2026", note=BOFA_NOTE)},
    {"id": "mains-dextres", "label": "Mains dextres", "detail": "Micro-actionneurs, tendons et capteurs tactiles",
     "min_pct": 19, "max_pct": 19, "layer_ids": [SLUG[10], SLUG[4]], "provenance": V("bofa-physical-ai-2026", note=BOFA_NOTE)},
    {"id": "controle", "label": "Système de contrôle", "detail": "Calcul embarqué et électronique de commande",
     "min_pct": 10, "max_pct": 10, "layer_ids": [SLUG[2], SLUG[5]], "provenance": V("bofa-physical-ai-2026", note=BOFA_NOTE)},
    {"id": "vision-capteurs", "label": "Vision et autres capteurs", "detail": "Caméras, profondeur, centrales inertielles",
     "min_pct": 4, "max_pct": 4, "layer_ids": [SLUG[3]], "provenance": V("bofa-physical-ai-2026", note=BOFA_NOTE)},
    {"id": "energie", "label": "Système énergétique", "detail": "Batterie et gestion de l'énergie",
     "min_pct": 4, "max_pct": 4, "layer_ids": [SLUG[7]], "provenance": V("bofa-physical-ai-2026", note=BOFA_NOTE)},
    {"id": "autres", "label": "Autres", "detail": "Structure, câblage, connectique",
     "min_pct": 12, "max_pct": 12, "layer_ids": [SLUG[6]], "provenance": V("bofa-physical-ai-2026", note=BOFA_NOTE)},
]

BLOCS = [
    {"id": "us", "name": "États-Unis",
     "strengths": ["Puces d'IA et modèles de fondation pour robots", "Capital-risque abondant", "Capteurs de force et connectique haut de gamme"],
     "weaknesses": ["Coût de fabrication élevé hors de la chaîne d'approvisionnement chinoise", "Dépendance aux aimants et à l'usinage asiatiques"],
     "provenance": M()},
    {"id": "cn", "name": "Chine",
     "strengths": ["Premier producteur mondial d'humanoïdes en volume", "Maîtrise de la chaîne matérielle (aimants, batteries, moteurs) à bas coût", "Fonds publics dédiés à l'IA et à la robotique"],
     "weaknesses": ["Accès restreint aux puces américaines d'entraînement les plus avancées", "Dépendance partielle aux réducteurs et vis à rouleaux haut de gamme étrangers"],
     "provenance": M()},
    {"id": "eu", "name": "Europe",
     "strengths": ["Mécatronique de précision : roulements, vis à rouleaux, moteurs miniatures", "Semi-conducteurs de puissance, capteurs MEMS et logiciels de simulation industrielle"],
     "weaknesses": ["Peu de constructeurs d'humanoïdes de taille mondiale", "Coût de l'énergie pour l'usinage lourd"],
     "provenance": M()},
    {"id": "as", "name": "Japon, Corée du Sud et Taïwan",
     "strengths": ["Savoir-faire historique des réducteurs et des guidages linéaires", "Mains robotiques, batteries et fonderie de puces"],
     "weaknesses": ["Moins présents que la Silicon Valley sur l'IA incarnée", "Pression sur les marges face aux fabricants chinois de réducteurs"],
     "provenance": M()},
]

# Couches : dominance (blocs + note) et provenance.
LAYER_DOMINANCE = {
    1: (["cn"], ["us", "other"],
        "Chine : 69 % de l'extraction de terres rares (2025), 85 % du raffinage (2025) et 94 % des aimants frittés (2024). Alternatives : États-Unis (MP Materials) et Australie (Lynas).",
        ["chine-extraction-terres-rares", "chine-extraction-terres-rares-aimants", "chine-raffinage-terres-rares", "chine-aimants-frittes", "ndfeb-par-humanoide"],
        V("usgs-mcs-2026-ree", "iea-ree-2026", "iea-gcmo-2026")),
    2: (["us", "as"], [],
        "Conception : entreprises américaines (53,4 % des ventes mondiales de semi-conducteurs en 2025). Fabrication : Taïwan (69 % des capacités de logique avancée en 2022 ; TSMC, 72,5 % des revenus de fonderie au 2e trimestre 2026).",
        ["us-ventes-semi-conducteurs", "taiwan-logique-avancee", "tsmc-revenus-fonderie"],
        V("sia-2026", "sia-bcg-2024", "trendforce-2026-09")),
    7: (["cn", "as"], [], "Chine et Corée du Sud.", ["batterie-figure-03"], M()),
    3: (["eu", "us", "cn"], [], "Europe et États-Unis pour les puces MEMS et l'optique, Chine pour les modules 3D.", [], M()),
    4: (["us", "cn"], [], "États-Unis sur le haut de gamme, Chine sur le volume à bas coût.", [], M()),
    5: (["eu", "us", "as"], [], "Europe, États-Unis et Japon.", [], M()),
    6: (["us", "eu", "as"], [], "États-Unis, Europe et Taïwan.", [], M()),
    8: (["eu", "as", "us"], ["cn"], "Suisse, Japon et États-Unis sur la précision, face à la Chine et à sa base industrielle automobile.", [], M()),
    9: (["as", "eu"], ["cn"], "Japon et Europe (savoir-faire métallurgique), face à la Chine (Leaderdrive), désormais associée à SKF.", [], M("skf-leaderdrive-2026")),
    10: (["as", "eu"], [], "Corée du Sud et Europe (Royaume-Uni, Allemagne).", ["bofa-actionneurs-mains-2030"], M()),
    11: (["us", "eu"], [], "États-Unis pour les modèles d'IA, Europe pour la simulation industrielle.", ["gr00t-donnees-synthetiques"], M()),
    12: (["cn", "us"], [],
         "Chine : 87 % des quelque 13 300 humanoïdes livrés en 2025 (Omdia). États-Unis : capital, puces et modèles d'IA.",
         ["livraisons-mondiales-2025", "part-chine-livraisons-2025"],
         V("futura-omdia-2026", "agibot-2026-01", "restofworld-2026")),
}

# Rôles d'acteurs appuyés par une source externe (sinon : saisie éditoriale).
ACTOR_SOURCES = {
    "schaeffler": ("Roulements, vis à rouleaux et actionneur planétaire pour humanoïdes présenté au CES 2026.",
                   V("schaeffler-actuator-2025")),
    "skf": ("Roulements et vis à rouleaux ; coentreprise avec Leaderdrive en Chine, détenue à 60 % par SKF (juillet 2026).",
            V("skf-leaderdrive-2026")),
    "leaderdrive": ("Réducteurs harmoniques ; partenaire de SKF depuis juillet 2026.", V("skf-leaderdrive-2026")),
    "nvidia": ("Puces embarquées Jetson Thor, simulation Isaac et modèles de fondation GR00T.",
               V("nvidia-thor-2025", "nvidia-gr00t-2025")),
    "boston-dynamics": ("Humanoïde Atlas ; filiale du groupe Hyundai, qui en détient 80 % depuis 2021.", V("hyundai-bd-2021")),
}

EXTRA_ACTORS = [
    ("Neura Robotics", "neura-robotics", ["DE"], "eu", [12], "Humanoïdes et robots cognitifs ; partenaire de Schaeffler pour les actionneurs.",
     V("schaeffler-neura-2025")),
    ("Humanoid", "humanoid-uk", ["GB"], "eu", [12], "Humanoïdes à roues et bipèdes ; contrat de déploiement avec Schaeffler.",
     V("humanoid-schaeffler-2026")),
]


def build_actors():
    out = []
    for name, aid, countries, bloc, couches, role in ACTORS:
        role2, p = ACTOR_SOURCES.get(aid, (role, M()))
        out.append({"id": aid, "name": name, "countries": countries, "bloc": bloc,
                    "layer_ids": [SLUG[c] for c in couches], "role": role2, "provenance": p})
    for name, aid, countries, bloc, couches, role, p in EXTRA_ACTORS:
        out.append({"id": aid, "name": name, "countries": countries, "bloc": bloc,
                    "layer_ids": [SLUG[c] for c in couches], "role": role, "provenance": p})
    return out


def build_layers():
    out = []
    for number, order, slug, name, segment in LAYERS:
        dom, chal, note, kfs, p = LAYER_DOMINANCE[number]
        out.append({"id": slug, "number": number, "order": order, "name": name, "segment": segment,
                    "dominant_blocs": dom, "challenger_blocs": chal, "dominance_note": note,
                    "key_figure_ids": kfs,
                    "material_links": [{"material_id": m, "rationale": r} for m, r in MATERIAL_LINKS[number]],
                    "provenance": p})
    return out


def vol(kind, value, label, as_of, p, value_min=None):
    return {"kind": kind, "value": value, "value_min": value_min, "label": label, "as_of": as_of, "provenance": p}


def cap(units, year, label, p):
    return {"units_per_year": units, "year": year, "label": label, "provenance": p}


OEMS = [
    {"actor_id": "unitree", "model": "G1 / H1",
     "volume": vol("shipped", 5511, "5 511 humanoïdes livrés en 2025", "2025", V("unitree-prospectus-2026", "sse-chinadaily-2026-08")),
     "capacity": None,
     "facts": "Premier constructeur mondial en volume. Environ 18 000 humanoïdes bipèdes produits en cumulé à fin juillet 2026.",
     "provenance": V("unitree-prospectus-2026", "10jqka-2026-08")},
    {"actor_id": "agibot", "model": "Gammes industrielles et de service",
     "volume": vol("produced", 20000, "20 000e robot sorti de la ligne (septembre 2026)", "2026-09", V("agibot-2026-09")),
     "capacity": None,
     "facts": "10 000e unité fin mars 2026. 5 168 robots livrés en 2025, soit 39 % du marché mondial selon Omdia.",
     "provenance": V("agibot-2026-03", "agibot-2026-01")},
    {"actor_id": "ubtech", "model": "Walker S2",
     "volume": vol("shipped", 921, "921 humanoïdes grand format vendus au 1er semestre 2026", "2026-06", V("ubtech-hkex-2026-08")),
     "capacity": cap(10000, 2026, "Objectif de production annuel : 10 000 unités", V("ubtech-hkex-2026-08")),
     "facts": "1 000e Walker S2 sorti de l'usine de Liuzhou le 26 décembre 2025. Batterie échangée de façon autonome en moins de trois minutes.",
     "provenance": V("ubtech-2025-12", "ubtech-walker-s2")},
    {"actor_id": "tesla", "model": "Optimus",
     "volume": None,
     "capacity": cap(1000000, None, "Capacité prévue à terme de la première ligne : 1 million de robots par an", V("tesla-q4-2025")),
     "facts": "Production lancée sur les lignes à haut volume de Fremont au 3e trimestre 2026, sans volume publié. L'ancienne ligne Model S/X a été démontée en 46 jours.",
     "provenance": V("tesla-q3-2026", "drivetesla-2026-07")},
    {"actor_id": "figure-ai", "model": "Figure 03",
     "volume": vol("produced", 350, "Plus de 350 Figure 03 sortis de l'usine BotQ (avril 2026)", "2026-04", V("figure-ramping-2026")),
     "capacity": None,
     "facts": "Cadence portée à un robot par heure. Une partie des unités sert à la R&D et à la collecte de données de Figure.",
     "provenance": V("figure-ramping-2026")},
    {"actor_id": "1x-technologies", "model": "NEO",
     "volume": vol("preorders", 10000, "≈ 10 000 NEO réservés en cinq jours (octobre 2025)", "2025-10", V("1x-neo-factory")),
     "capacity": cap(10000, 2026, "Usine de Hayward (Californie) : jusqu'à 10 000 unités par an", V("1x-neo-factory")),
     "facts": "Objectif annoncé : plus de 100 000 unités par an fin 2027.",
     "provenance": V("1x-neo-factory")},
    {"actor_id": "agility-robotics", "model": "Digit",
     "volume": vol("shipped", 150, "≈ 150 robots livrés en 2025 (estimation d'un concurrent)", "2025",
                   E("unitree-prospectus-2026", note="Estimation du prospectus d'Unitree, non confirmée par Agility Robotics.")),
     "capacity": None,
     "facts": "Plus de 65 000 heures d'exploitation et plus de 100 000 bacs déplacés ; 9 sites clients engagés (octobre 2026).",
     "provenance": V("agility-425-2026-10")},
    {"actor_id": "boston-dynamics", "model": "Atlas",
     "volume": None,
     "capacity": cap(30000, 2028, "Système de production de 30 000 robots par an visé d'ici 2028 (Hyundai)", V("hyundai-ces-2026")),
     "facts": "Atlas doit être déployé à l'usine Hyundai de Géorgie (HMGMA) d'ici 2028.",
     "provenance": V("hyundai-ces-2026")},
]

ALLIANCES = [
    {"id": "bmw-figure", "client": "BMW", "oem_actor_id": "figure-ai", "sector": "Automobile",
     "relation": "Figure 02 déployé 11 mois sur une ligne de l'usine de Spartanburg ; Figure 03 affecté à la logistique depuis juin 2026.",
     "provenance": V("figure-bmw-2025", "automotiveworld-2026-06")},
    {"id": "mercedes-apptronik", "client": "Mercedes-Benz", "oem_actor_id": "apptronik", "sector": "Automobile",
     "relation": "Investisseur et partenaire commercial ; Apollo testé dans les usines de Kecskemét et de Berlin.",
     "provenance": V("apptronik-2025-03", "heise-2025-03")},
    {"id": "hyundai-boston", "client": "Hyundai Motor Group", "oem_actor_id": "boston-dynamics", "sector": "Automobile",
     "relation": "Actionnaire majoritaire (80 % depuis 2021) ; déploiement d'Atlas prévu dans ses usines.",
     "provenance": V("hyundai-bd-2021", "hyundai-ces-2026")},
    {"id": "constructeurs-ubtech", "client": "BYD, Dongfeng Liuzhou, Geely, FAW-Volkswagen, Audi FAW, BAIC", "oem_actor_id": "ubtech",
     "sector": "Automobile", "relation": "Collaborations industrielles annoncées par UBTECH, sans volume par constructeur.",
     "provenance": V("ubtech-2025-11")},
    {"id": "actionnaires-agibot", "client": "BYD, SAIC, BAIC", "oem_actor_id": "agibot", "sector": "Automobile",
     "relation": "Constructeurs présents au capital d'AgiBot (directement ou via leurs fonds).",
     "provenance": V("pedaily-2025-05")},
    {"id": "tesla-optimus", "client": "Tesla", "oem_actor_id": "tesla", "sector": "Automobile",
     "relation": "Développement intégré : Optimus est produit et utilisé par Tesla.",
     "provenance": V("tesla-q3-2026", "unitree-prospectus-2026")},
    {"id": "gxo-agility", "client": "GXO Logistics", "oem_actor_id": "agility-robotics", "sector": "Logistique",
     "relation": "Contrat pluriannuel de 2024, premier déploiement commercial d'humanoïdes en location (Robot-as-a-Service).",
     "provenance": V("agility-gxo-2024")},
    {"id": "schaeffler-agility", "client": "Schaeffler", "oem_actor_id": "agility-robotics", "sector": "Équipementier",
     "relation": "Actionnaire minoritaire et futur client : intention d'acheter des Digit pour ses usines.",
     "provenance": V("agility-schaeffler-2024")},
    {"id": "schaeffler-humanoid", "client": "Schaeffler", "oem_actor_id": "humanoid-uk", "sector": "Équipementier",
     "relation": "Déploiement d'un nombre d'unités à quatre chiffres d'ici 2032 ; Schaeffler fournisseur privilégié d'actionneurs.",
     "provenance": V("humanoid-schaeffler-2026")},
    {"id": "schaeffler-neura", "client": "Schaeffler", "oem_actor_id": "neura-robotics", "sector": "Équipementier",
     "relation": "Partenariat technologique sur les composants clés, dont les actionneurs.",
     "provenance": V("schaeffler-neura-2025")},
]

CHOKEPOINTS = [
    {"id": "aimants-controles-export", "title": "Aimants terres rares & contrôles à l'export",
     "layer_ids": [SLUG[1], SLUG[8]],
     "issue": "Chaque articulation repose sur un moteur à aimants NdFeB. La Chine produit 94 % des aimants frittés et soumet à licence, depuis avril 2025, l'exportation de sept terres rares moyennes et lourdes et des aimants qui en contiennent.",
     "signals": [
         {"date": "2025-04-04", "text": "Annonce n° 18 : licence obligatoire pour sept terres rares moyennes et lourdes et les aimants NdFeB au dysprosium ou au terbium. Toujours en vigueur.",
          "provenance": V("mofcom-18-2025", "usgs-mcs-2026-ree")},
         {"date": "2025-10-09", "text": "Extension à cinq terres rares supplémentaires et aux produits étrangers contenant des terres rares chinoises.",
          "provenance": V("usgs-mcs-2026-ree")},
         {"date": "2025-11-07", "text": "Annonce n° 70 : suspension des mesures d'octobre jusqu'au 10 novembre 2026.",
          "review_by": "2026-11-10",
          "provenance": V("mofcom-70-2025")},
         {"date": "2026-09-28", "text": "Prolongation jusqu'au 10 janvier 2027 de l'arrangement commercial sino-américain qui fonde cette suspension.",
          "review_by": "2027-01-10",
          "provenance": E("chinadaily-2026-09", note="La déclaration ne cite pas les terres rares ; aucun texte modifiant l'annonce n° 70 n'a été trouvé.")},
     ],
     "actor_ids": ["mp-materials", "lynas", "jl-mag"],
     "provenance": V("iea-ree-2026", "mofcom-18-2025")},
    {"id": "puces-ia-controles", "title": "Puces d'IA & contrôles américains",
     "layer_ids": [SLUG[2], SLUG[11]],
     "issue": "Le calcul embarqué et l'entraînement des modèles dépendent de puces conçues aux États-Unis et gravées à Taïwan. Washington restreint depuis 2022 l'accès de la Chine aux puces d'IA les plus avancées.",
     "signals": [
         {"date": "2022-10-13", "text": "Première règle du BIS sur les puces de calcul avancé et les équipements de fabrication.",
          "provenance": V("bis-2022-10")},
         {"date": "2025-08-25", "text": "NVIDIA commercialise Jetson AGX Thor, son calculateur embarqué pour robots.",
          "provenance": V("nvidia-thor-2025")},
         {"date": "2026-01-15", "text": "Examen au cas par cas des exportations vers la Chine de puces de la classe H200 ; les puces plus avancées restent refusées par principe.",
          "provenance": V("covington-2026-01")},
     ],
     "actor_ids": ["nvidia", "tsmc", "qualcomm", "amd"],
     "provenance": V("trendforce-2026-09", "sia-bcg-2024")},
    {"id": "actionneurs-mecanique", "title": "Actionneurs, réducteurs & mécanique de précision",
     "layer_ids": [SLUG[8], SLUG[9]],
     "issue": "Les actionneurs linéaires et rotatifs pèseraient environ la moitié du coût matériel d'un humanoïde en 2030. Réducteurs harmoniques et vis à rouleaux comptent parmi les pièces les plus difficiles à usiner.",
     "signals": [
         {"date": "2025-12-16", "text": "Schaeffler présente un actionneur planétaire intégré pour humanoïdes, prêt pour la série (CES 2026).",
          "provenance": V("schaeffler-actuator-2025")},
         {"date": "2026-07-02", "text": "SKF et Leaderdrive créent en Chine une coentreprise de composants de précision pour humanoïdes, détenue à 60 % par SKF.",
          "provenance": V("skf-leaderdrive-2026")},
     ],
     "actor_ids": ["harmonic-drive", "nabtesco", "skf", "thk", "hiwin", "schaeffler", "leaderdrive", "sanhua", "tuopu", "inovance"],
     "provenance": V("bofa-physical-ai-2026")},
    {"id": "mains-tactile", "title": "Mains dextres, toucher & connectique",
     "layer_ids": [SLUG[4], SLUG[6], SLUG[10]],
     "issue": "Les mains dextres représenteraient environ 19 % du coût matériel en 2030. Micro-actionneurs, tendons et peaux tactiles doivent résister à des milliers d'heures de manipulation.",
     "signals": [],
     "actor_ids": ["novanta-ati", "vpg", "honeywell", "sri", "te-connectivity", "amphenol", "shadow-robot", "tesollo", "schunk"],
     "provenance": V("bofa-physical-ai-2026")},
    {"id": "vision-puissance", "title": "Vision 3D, contrôle moteur & électronique de puissance",
     "layer_ids": [SLUG[3], SLUG[5]],
     "issue": "La valeur migre du capteur isolé vers le module de vision 3D intégré. Chaque articulation exige aussi un driver moteur, des convertisseurs et une gestion de batterie, un segment tenu par quelques grands de l'analogique et de la puissance.",
     "signals": [],
     "actor_ids": ["orbbec", "realsense", "bosch", "stmicroelectronics", "onsemi", "infineon", "texas-instruments", "analog-devices", "renesas"],
     "provenance": M()},
]

CORRECTIONS = [
    {"id": "aimants", "claim": "Part chinoise de la fabrication d'aimants permanents", "dossier_value": "~90 %",
     "outcome": "corrected", "corrected_value": "94 % des aimants frittés (2024)", "source_ids": ["iea-ree-2026"]},
    {"id": "raffinage", "claim": "Part chinoise du raffinage des terres rares", "dossier_value": "~90 %",
     "outcome": "corrected", "corrected_value": "85 % (2025), après 91 % en 2024", "source_ids": ["iea-gcmo-2026", "iea-ree-2026"]},
    {"id": "volumes-chine", "claim": "Part chinoise des volumes d'humanoïdes", "dossier_value": "~90 %",
     "outcome": "corrected", "corrected_value": "87 % des livraisons 2025 (Omdia)", "source_ids": ["futura-omdia-2026"]},
    {"id": "marche-2026", "claim": "Marché mondial 2026", "dossier_value": "2,5–4,2 Md$",
     "outcome": "corrected", "corrected_value": "3–11 Md$ selon les cabinets", "source_ids": ["roots-2026", "mm-2026-07", "gmi-2026"]},
    {"id": "marche-2030", "claim": "Marché mondial 2030", "dossier_value": "15–30 Md$",
     "outcome": "corrected", "corrected_value": "6–15 Md$ selon les cabinets", "source_ids": ["yole-2025-11", "abi-2025", "bcc-2025-10", "roots-2026", "mm-2030"]},
    {"id": "bofa-citi-2035", "claim": "Projection Bank of America / Citi 2035", "dossier_value": "100–250 Md$",
     "outcome": "corrected", "corrected_value": "Citi : 209 Md$ ; BofA ne publie pas de montant (10 millions d'unités par an)", "source_ids": ["yahoo-citi-2024", "bofa-physical-ai-2026"]},
    {"id": "foyers-2050", "claim": "Part des foyers dans le parc 2050 (Morgan Stanley)", "dossier_value": "10 %",
     "outcome": "corrected", "corrected_value": "≈ 80 millions d'unités, environ 8 %", "source_ids": ["emsnow-ms-2025"]},
    {"id": "cout-2050", "claim": "Coût de revient d'un humanoïde en 2050", "dossier_value": "12–15 k$",
     "outcome": "corrected", "corrected_value": "Aucune source ; Morgan Stanley projette un prix de 50 000 $ dans les pays à haut revenu", "source_ids": ["emsnow-ms-2025"]},
    {"id": "repartition-bom", "claim": "Part des articulations et des mains dans le coût matériel", "dossier_value": "~60 %",
     "outcome": "corrected", "corrected_value": "≈ 70 % en 2030 (actionneurs 51 %, mains 19 %)", "source_ids": ["bofa-physical-ai-2026"]},
    {"id": "surcout-usa", "claim": "Surcoût de fabrication aux États-Unis face à la Chine", "dossier_value": "2 à 3 fois",
     "outcome": "corrected", "corrected_value": "≈ 2,8 fois pour Optimus Gen 2 sans fournisseurs chinois", "source_ids": ["scmp-ms-2025-12"]},
    {"id": "salaire", "claim": "Salaire annuel d'un ouvrier posté (US/UE)", "dossier_value": "30 000–40 000 $",
     "outcome": "corrected", "corrected_value": "46 990 $ (médiane production, États-Unis) ; 39 800 € (moyenne UE, tous secteurs)", "source_ids": ["bls-production", "eurostat-2025-11"]},
    {"id": "aimants-kg", "claim": "Aimants NdFeB par robot", "dossier_value": "2–4 kg, presque autant qu'une voiture électrique",
     "outcome": "corrected", "corrected_value": "2 à 4,5 kg, autant voire plus qu'un véhicule électrique (1,4 kg)", "source_ids": ["adamas-2026-04", "fai-2026-09"]},
    {"id": "agibot", "claim": "AgiBot", "dossier_value": "10 000e unité fin mars 2026 ; clients BYD, Nio, Geely",
     "outcome": "corrected", "corrected_value": "20 000e unité en septembre 2026 ; actionnaires BYD, SAIC et BAIC (Nio et Geely non trouvés)", "source_ids": ["agibot-2026-09", "pedaily-2025-05"]},
    {"id": "tesla-46-jours", "claim": "Ligne de Fremont reconvertie en 46 jours pour Optimus V3", "dossier_value": "46 jours (mai 2026)",
     "outcome": "corrected", "corrected_value": "46 jours pour démonter l'ancienne ligne Model S/X ; production d'Optimus lancée au 3e trimestre 2026", "source_ids": ["drivetesla-2026-07", "tesla-q3-2026"]},
    {"id": "unitree-cumul", "claim": "Production cumulée d'Unitree", "dossier_value": "~11 000 (G1 / H1)",
     "outcome": "corrected", "corrected_value": "≈ 18 000 humanoïdes bipèdes à fin juillet 2026 (11 000 = G1 seul, juin 2026)", "source_ids": ["10jqka-2026-08"]},
    {"id": "1x", "claim": "1X Technologies", "dossier_value": "Usine inaugurée en mai 2026 ; plus de 10 000 précommandes",
     "outcome": "corrected", "corrected_value": "Usine annoncée le 30 avril 2026 ; ≈ 10 000 NEO réservés", "source_ids": ["1x-neo-factory"]},
    {"id": "ubtech-capacite", "claim": "Capacité d'UBTECH", "dossier_value": "5 000/an en 2026, 10 000/an en 2027",
     "outcome": "corrected", "corrected_value": "Objectif de production de 10 000 unités dès 2026 (rapport semestriel)", "source_ids": ["ubtech-hkex-2026-08"]},
    {"id": "batterie", "claim": "Autonomie en travail intensif", "dossier_value": "2–4 h avec 2 kWh",
     "outcome": "corrected", "corrected_value": "2,3 kWh pour 5 h à pleine performance (Figure 03)", "source_ids": ["figure-battery-2025"]},
    {"id": "conception-puces", "claim": "Part américaine de la conception des puces d'IA", "dossier_value": "95 %",
     "outcome": "removed", "corrected_value": None, "source_ids": []},
    {"id": "tesla-gen2", "claim": "Flotte interne d'Optimus Gen 2", "dossier_value": "Quelques centaines",
     "outcome": "removed", "corrected_value": None, "source_ids": []},
    {"id": "isaac-lab", "claim": "Essais virtuels accumulés dans Isaac Lab", "dossier_value": "10 000 h",
     "outcome": "removed", "corrected_value": None, "source_ids": []},
    {"id": "raas-gxo", "claim": "Tarif de location d'Agility chez GXO", "dossier_value": "10–15 $/h",
     "outcome": "removed", "corrected_value": None, "source_ids": []},
    {"id": "agility-flotte", "claim": "Robots Digit en service commercial", "dossier_value": "40 à 150",
     "outcome": "removed", "corrected_value": None, "source_ids": []},
]


def build():
    return {
        "schema_version": "ROBOTICS-SNAPSHOT-1",
        "snapshot_date": ACCESSED,
        "scope_note": ("Données de contexte sur la chaîne de valeur mondiale des robots humanoïdes. Non normatives : "
                       "elles éclairent l'analyse des dépendances de votre chaîne de valeur et ne constituent ni une "
                       "donnée ESRS, ni un conseil en investissement."),
        "methodology_note": ("Snapshot compilé le 2 novembre 2026 à partir du dossier « Robotique humanoïde » de L-Labs "
                             "(14 octobre 2026). Chaque chiffre du dossier a été relu dans une source datée : publications "
                             "officielles (USGS, AIE, BLS, Eurostat), documents réglementaires et boursiers (MOFCOM, SEC, "
                             "HKEX, prospectus), communiqués des entreprises, recherche bancaire, cabinets d'études de marché "
                             "et presse. Les chiffres introuvables ont été retirés, les chiffres divergents corrigés (voir "
                             "« corrections »). « Vérifié » : valeur lue telle quelle dans la source. « Estimé » : fourchette "
                             "de plusieurs sources, estimation d'analyste ou chiffre relayé. « Saisie manuelle » : "
                             "qualification éditoriale, jamais un chiffre. Hors périmètre : cours, valorisations, symboles "
                             "boursiers et thèses d'investissement du dossier d'origine."),
        "corrections": CORRECTIONS,
        "blocs": BLOCS,
        "layers": build_layers(),
        "actors": build_actors(),
        "oems": OEMS,
        "bom": BOM,
        "projections": PROJECTIONS,
        "key_figures": KEY_FIGURES,
        "chokepoints": CHOKEPOINTS,
        "alliances": ALLIANCES,
        "sources": SOURCES,
    }


def main(argv):
    ds = build()
    if "--check" in argv:
        if not OUTPUT.exists():
            print(f"absent : {OUTPUT.name} — lancer build_snapshot.py sans --check", file=sys.stderr)
            return 1
        if json.loads(OUTPUT.read_text(encoding="utf-8")) != ds:
            print(f"{OUTPUT.name} diverge de build_snapshot.py : corriger le script, puis régénérer.", file=sys.stderr)
            return 1
        print(f"{OUTPUT.name} à jour ({len(SOURCES)} sources)")
        return 0
    OUTPUT.write_text(json.dumps(ds, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{OUTPUT.name} régénéré ({len(SOURCES)} sources)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
