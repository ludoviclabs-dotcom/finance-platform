"""scripts/water_intelligence — commandes OPÉRATEUR de Water Intelligence.

Ce paquet est le SEUL endroit du dépôt où un octet transite réellement vers
une source hydrique officielle. Il vit délibérément hors de
`services/water_intelligence`, qui n'importe aucun client HTTP et dont
l'absence de réseau est vérifiée par analyse AST
(`test_water_intelligence_pipeline.py::TestNoRealNetworkOrDatabase`).

La dépendance va dans un seul sens : ces scripts importent les services, les
services n'importent jamais ces scripts. Un test le vérifie
(`test_water_intelligence_operator_scripts.py`).

Rien ici n'est déclenché par une requête utilisateur, un cron ou le démarrage
de l'API. Chaque exécution est un geste opérateur explicite, borné, et laisse
un rapport expurgé.
"""
