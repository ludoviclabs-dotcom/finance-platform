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
- Exception métier d'un connecteur remontant nue hors de `run_pipeline()` (violation de l'invariant « toujours un rapport ») : observé en P03B (`AqueductSchemaError` du connecteur WRI n'héritait pas d'`AdapterError`, seul type capturé au stage `normalize`). **Résolu (P03C)** : `AqueductError` hérite désormais d'`AdapterError` ; contrat documenté pour P06-P09 dans `handoffs/P03C_CONNECTOR_ERROR_BOUNDARY.md`. Limite de portée restante, non résolue : le `geography_resolver` d'un connecteur (stage `derive`) reste soumis au seul contrat `PipelineDataUnavailableError` préexistant, cf. handoff §6.
