# Water Intelligence — Registre des risques

Risques initiaux identifiés au démarrage du chantier.

- Licence incompatible.
- Dataset trop lourd.
- Schéma externe modifié.
- Jointure géographique incertaine.
- Donnée absente.
- Collision de route.
- Fuite de données tenant.
- Fait juridique non sourcé.
- Redaction par licence non répliquée à la construction du snapshot public : `display_allowed` n'est aujourd'hui vérifié qu'à la lecture (`value_withheld`), pas à la porte de publication d'une release — P10 devra le contrôler explicitement lors de la construction du snapshot public, pas uniquement au moment de la lecture (constat P00, cf. `03_RISKS_AND_STOP_CONDITIONS.md`).
- Exception métier d'un connecteur remontant nue hors de `run_pipeline()` (violation de l'invariant « toujours un rapport ») : observé en P03B (`AqueductSchemaError` du connecteur WRI n'héritait pas d'`AdapterError`, seul type capturé au stage `normalize`). **Résolu (P03C)** : `AqueductError` hérite désormais d'`AdapterError` ; contrat documenté pour P06-P09 dans `handoffs/P03C_CONNECTOR_ERROR_BOUNDARY.md`. La limite de portée restante — le `geography_resolver` au stage `derive` — est **résolue à son tour (Wave A, commit A1)** : `AqueductGeographyUnavailableError` et `WeiPlusGeographyUnavailableError` héritent de `PipelineDataUnavailableError`, seul type capturé autour du résolveur. Les deux connecteurs européens appliquent le contrat d'emblée.
- **Source distribuée uniquement en format lourd** : Copernicus EDO ne publie le CDI qu'en GeoTIFF et NetCDF, sans export tabulaire. Décoder la grille exigerait une dépendance géospatiale lourde sans ADR. **Non résolu — blocage assumé et documenté** (Wave A) : le connecteur refuse explicitement de produire une valeur plutôt que de simuler une couche. `COPERNICUS_EDO` doit rester exclu du snapshot public P10 tant qu'un humain n'a pas arbitré (cf. `handoffs/P09_COPERNICUS_EDO.md` §6). Risque à surveiller pour les sources suivantes : une source dont le seul format officiel est lourd n'est pas ingérable à budget de dépendances constant.
- **Période saisonnière non portée par le read model** : `derive_observations()` aplatit `period_start`/`period_end` sur une date unique et ne recopie pas les métadonnées du draft. Contourné en Wave A par l'encodage du trimestre dans le `metric_code`, mais le risque grandit avec Hub'Eau (vraies chroniques). **À arbitrer en P10** avant que la convention ne se fige par accident.
- **Incertitudes de source à ne pas perdre en chemin** : l'EEA signale de fortes incertitudes sur le WEI+ pour la Suisse et la France ; le portail EDO signale un CDI à interpréter avec prudence depuis la mi-mai 2025 à l'est du domaine. Ces avertissements sont portés par les connecteurs — ils doivent rester visibles jusqu'au lecteur en P10/P11, jamais filtrés à l'assemblage.
