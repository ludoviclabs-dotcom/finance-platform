# Structure du snapshot robotique : couches, acteurs, liens vers /materials.
# Importé par build_snapshot.py, qui y ajoute sources, chiffres et provenances.
#
# Les rôles sont réécrits de façon neutre à partir du dossier d'origine : aucune
# relation commerciale non vérifiée, aucun superlatif. Un rôle qui affirme un
# fait daté est surchargé (avec sa source) dans ACTOR_SOURCES de build_snapshot.py.
# Les identifiants de matières sont ceux du snapshot CRM de /materials.

ED = "ll-dossier-robotique"  # source éditoriale

LAYERS = [
    # number, order, slug, name, segment
    (1, 1, "aimants-terres-rares", "Matières premières & aimants NdFeB", "amont"),
    (2, 2, "calcul-ia-fonderie", "Calcul IA, mémoire & fonderie", "amont"),
    (7, 3, "batteries", "Batteries haute densité", "amont"),
    (3, 4, "vision-perception", "Vision 3D, profondeur & centrales inertielles", "milieu"),
    (4, 5, "capteurs-force-tactiles", "Capteurs de force, de couple & tactiles", "milieu"),
    (5, 6, "electronique-puissance", "Électronique de puissance & contrôle moteur", "milieu"),
    (6, 7, "connectique-faisceaux", "Connectique & faisceaux", "milieu"),
    (8, 8, "moteurs-actionneurs", "Moteurs & actionneurs intégrés", "mecatronique"),
    (9, 9, "reducteurs-vis-roulements", "Réducteurs, vis à rouleaux & roulements", "mecatronique"),
    (10, 10, "mains-prehenseurs", "Mains dextres & préhenseurs", "mecatronique"),
    (11, 11, "modeles-ia-simulation", "Modèles IA, simulation & jumeaux numériques", "aval"),
    (12, 12, "constructeurs-oem", "Constructeurs d'humanoïdes", "aval"),
]
SLUG = {n: s for n, _, s, _, _ in LAYERS}

MATERIAL_LINKS = {
    1: [
        ("light-ree", "Néodyme et praséodyme, cœur des aimants NdFeB des moteurs d'articulation."),
        ("heavy-ree", "Dysprosium et terbium, ajoutés pour que l'aimant tienne à haute température."),
        ("boron", "Le « B » de NdFeB : le bore entre dans la composition de l'aimant."),
    ],
    2: [
        ("silicon-metal", "Silicium de base des puces de calcul."),
        ("hafnium", "Oxyde de hafnium des grilles des nœuds de gravure avancés."),
        ("helium", "Gaz de procédé indispensable aux fonderies de semi-conducteurs."),
    ],
    7: [
        ("lithium", "Électrolyte et cathode des cellules lithium-ion."),
        ("cobalt", "Cathodes NMC à haute densité d'énergie."),
        ("nickel", "Cathodes NMC à haute densité d'énergie."),
        ("manganese", "Cathodes NMC et LMFP."),
        ("natural-graphite", "Anodes des cellules lithium-ion."),
    ],
    3: [
        ("gallium", "Lasers VCSEL en arséniure de gallium des capteurs de profondeur à temps de vol."),
        ("arsenic", "Second composant de l'arséniure de gallium (GaAs) des émetteurs infrarouges."),
    ],
    4: [],
    5: [
        ("gallium", "Transistors en nitrure de gallium (GaN) des convertisseurs et des drivers moteur."),
        ("silicon-metal", "Silicium et carbure de silicium des composants de puissance."),
        ("tantalum", "Condensateurs des cartes électroniques."),
    ],
    6: [
        ("copper", "Conducteurs des faisceaux et des connecteurs."),
        ("beryllium", "Alliages cuivre-béryllium des contacts à ressort des connecteurs."),
    ],
    8: [
        ("light-ree", "Aimants NdFeB des moteurs sans balais."),
        ("heavy-ree", "Tenue en température des aimants des moteurs."),
        ("copper", "Bobinages des moteurs."),
    ],
    9: [
        ("vanadium", "Aciers à haute résistance des engrenages et des vis."),
        ("tungsten", "Carbures cémentés des outils d'usinage de précision."),
    ],
    10: [
        ("light-ree", "Aimants des micro-moteurs des doigts."),
    ],
    11: [],
    12: [
        ("bauxite", "Aluminium des structures et des carters."),
        ("magnesium", "Alliages légers des membres et du châssis."),
    ],
}

# name, id, countries, bloc, couches, role
ACTORS = [
    ("MP Materials", "mp-materials", ["US"], "us", [1], "Terres rares : mine de Mountain Pass (Californie) et usine d'aimants au Texas."),
    ("Lynas Rare Earths", "lynas", ["AU"], "other", [1], "Producteur de terres rares séparées hors de Chine."),
    ("JL MAG Rare-Earth", "jl-mag", ["CN"], "cn", [1], "Fabricant d'aimants permanents NdFeB."),
    ("Nvidia", "nvidia", ["US"], "us", [2, 11], "Puces embarquées Jetson, simulation Omniverse et Isaac, modèles GR00T."),
    ("Qualcomm", "qualcomm", ["US"], "us", [2], "Calcul IA embarqué."),
    ("AMD", "amd", ["US"], "us", [2], "Calcul IA."),
    ("TSMC", "tsmc", ["TW"], "as", [2], "Fonderie des puces IA."),
    ("Bosch", "bosch", ["DE"], "eu", [3], "Centrales inertielles et capteurs MEMS, intégration système de rang 1."),
    ("Onsemi", "onsemi", ["US"], "us", [3], "Capteurs d'image global shutter et à temps de vol."),
    ("STMicroelectronics", "stmicroelectronics", ["FR", "IT"], "eu", [3, 5], "Capteurs d'image et de temps de vol, centrales inertielles MEMS, électronique de puissance."),
    ("Orbbec", "orbbec", ["CN"], "cn", [3], "Caméras de profondeur 3D pour la robotique."),
    ("RealSense", "realsense", ["US"], "us", [3], "Modules de vision 3D et de cartographie."),
    ("Novanta (ATI)", "novanta-ati", ["US"], "us", [4], "Capteurs de force et de couple six axes."),
    ("VPG (Vishay Precision Group)", "vpg", ["US"], "us", [4], "Jauges de contrainte de précision."),
    ("Honeywell", "honeywell", ["US"], "us", [4], "Capteurs de force et de couple."),
    ("Sunrise Instruments (SRI)", "sri", ["CN"], "cn", [4], "Capteurs de force et de couple, fournisseur d'OEM asiatiques."),
    ("Infineon", "infineon", ["DE"], "eu", [5], "Semi-conducteurs de puissance (silicium, SiC, GaN)."),
    ("Texas Instruments", "texas-instruments", ["US"], "us", [5], "Électronique analogique, de puissance et de contrôle moteur."),
    ("Analog Devices", "analog-devices", ["US"], "us", [5], "Semi-conducteurs analogiques et de puissance."),
    ("Renesas", "renesas", ["JP"], "as", [5], "Microcontrôleurs et semi-conducteurs de puissance."),
    ("TE Connectivity", "te-connectivity", ["US"], "us", [6], "Capteurs et faisceaux d'interconnexion."),
    ("Amphenol", "amphenol", ["US"], "us", [6], "Connectique miniature haute densité."),
    ("Molex", "molex", ["US"], "us", [6], "Connectique."),
    ("BizLink", "bizlink", ["TW"], "as", [6], "Faisceaux et câblage."),
    ("Rosenberger", "rosenberger", ["DE"], "eu", [6], "Connectique haute densité."),
    ("LG Energy Solution", "lg-energy-solution", ["KR"], "as", [7], "Cellules lithium-ion."),
    ("EVE Energy", "eve-energy", ["CN"], "cn", [7], "Cellules lithium-ion."),
    ("Nidec", "nidec", ["JP"], "as", [8], "Moteurs de précision."),
    ("Maxon", "maxon", ["CH"], "eu", [8], "Moteurs miniatures de précision."),
    ("Kollmorgen", "kollmorgen", ["US"], "us", [8], "Moteurs et servo-entraînements."),
    ("Sanhua", "sanhua", ["CN"], "cn", [8], "Actionneurs intégrés pour constructeurs d'humanoïdes."),
    ("Tuopu", "tuopu", ["CN"], "cn", [8], "Équipementier automobile diversifié dans les actionneurs."),
    ("Inovance", "inovance", ["CN"], "cn", [8], "Moteurs et entraînements pour l'industrie et l'automobile électrique."),
    ("Schaeffler", "schaeffler", ["DE"], "eu", [8, 9], "Roulements, vis à rouleaux et actionneurs intégrés."),
    ("SKF", "skf", ["SE"], "eu", [9], "Roulements et vis à rouleaux."),
    ("Leaderdrive", "leaderdrive", ["CN"], "cn", [9], "Réducteurs harmoniques."),
    ("Harmonic Drive Systems", "harmonic-drive", ["JP"], "as", [9], "Réducteurs harmoniques."),
    ("Nabtesco", "nabtesco", ["JP"], "as", [9], "Réducteurs cycloïdaux."),
    ("THK", "thk", ["JP"], "as", [9], "Vis et guidages linéaires."),
    ("Hiwin", "hiwin", ["TW"], "as", [9], "Vis à billes, vis à rouleaux et guidages linéaires."),
    ("Shadow Robot", "shadow-robot", ["GB"], "eu", [10], "Mains dextres pour la recherche."),
    ("Tesollo", "tesollo", ["KR"], "as", [10], "Mains robotiques dextres."),
    ("Wonik Robotics", "wonik-robotics", ["KR"], "as", [10], "Mains robotiques dextres."),
    ("Robotis", "robotis", ["KR"], "as", [10], "Mains et actionneurs robotiques."),
    ("Schunk", "schunk", ["DE"], "eu", [10], "Pinces et préhenseurs industriels."),
    ("Google DeepMind", "google-deepmind", ["US"], "us", [11], "Modèles Gemini Robotics."),
    ("Physical Intelligence", "physical-intelligence", ["US"], "us", [11], "Modèles de fondation pour robots."),
    ("Skild AI", "skild-ai", ["US"], "us", [11], "Modèle de fondation généraliste pour robots."),
    ("Siemens", "siemens", ["DE"], "eu", [11], "Logiciels PLM et simulation d'usine (jumeau numérique)."),
    ("Dassault Systèmes", "dassault-systemes", ["FR"], "eu", [11], "Plateforme de conception et de simulation 3DEXPERIENCE."),
    ("Tesla", "tesla", ["US"], "us", [12], "Humanoïde Optimus."),
    ("Figure AI", "figure-ai", ["US"], "us", [12], "Humanoïde Figure 03."),
    ("Boston Dynamics", "boston-dynamics", ["US"], "us", [12], "Humanoïde Atlas ; filiale du groupe Hyundai."),
    ("Agility Robotics", "agility-robotics", ["US"], "us", [12], "Humanoïde Digit."),
    ("Apptronik", "apptronik", ["US"], "us", [12], "Humanoïde Apollo."),
    ("1X Technologies", "1x-technologies", ["NO", "US"], "us", [12], "Humanoïde domestique NEO."),
    ("UBTECH", "ubtech", ["CN"], "cn", [12], "Humanoïde industriel Walker S2."),
    ("AgiBot", "agibot", ["CN"], "cn", [12], "Humanoïdes industriels et de service."),
    ("Unitree", "unitree", ["CN"], "cn", [12], "Humanoïdes G1 et H1."),
    ("Fourier", "fourier", ["CN"], "cn", [12], "Humanoïdes."),
]
