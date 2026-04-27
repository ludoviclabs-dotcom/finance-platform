# Mesurer le ROI d'un projet IA : méthode et indicateurs

Quand une direction approuve un budget IA, elle le fait sur la base d'une promesse de gain. Quelques mois plus tard, la question revient : "alors, ça vaut quoi concrètement ?" Et là, beaucoup d'équipes projet se retrouvent sans réponse claire.

Selon McKinsey (The State of AI, 2025), 72 % des projets IA n'atteignent pas le ROI attendu lors de la première année. Non pas parce que la technologie ne fonctionne pas, mais parce que les métriques n'étaient pas définies en amont, ou que le périmètre mesuré ne correspondait pas au périmètre réel d'impact.

## Pourquoi la mesure du ROI IA est difficile

La valeur créée par un système IA est rarement immédiate ni linéaire. Trois raisons principales :

**Les bénéfices sont diffus.** Un assistant IA qui aide un juriste à analyser des contrats ne réduit pas d'un coup sec le temps de traitement. Il réduit la charge cognitive, améliore la précision, et libère du temps pour les cas à plus forte valeur. Cette valeur est réelle mais difficile à isoler.

**Le périmètre évolue.** Au lancement, 10 utilisateurs pilotes testent le système sur un cas d'usage précis. Trois mois plus tard, ils l'utilisent sur cinq cas différents, parfois hors scope initial. La mesure d'origine ne capture plus rien.

**Le coût total est sous-estimé.** On compte le coût API et parfois la licence, mais rarement le temps de formation, la supervision humaine nécessaire pour valider les sorties, ni le coût de maintenance des prompts et intégrations. Un projet à "5 000 € de compute" peut facilement coûter 50 000 € en coûts complets sur 12 mois.

## Les trois catégories de valeur à mesurer

Pour structurer la mesure, on distingue trois niveaux :

**Gains directs** — les plus simples à mesurer : temps économisé par tâche, volume de documents traités, coût opérationnel réduit. Exemple : un traitement de dossier qui prend 45 minutes tombe à 12 minutes avec assistance IA. Sur 200 dossiers/mois, c'est 110 heures récupérées.

**Gains indirects** — moins visibles mais souvent plus impactants : erreurs évitées, qualité de sortie améliorée, satisfaction des collaborateurs. Une erreur de contrat évitée peut valoir dix fois plus que les 110 heures économisées. Ces gains se mesurent par des indicateurs de qualité (taux d'erreur, relance client, retravailler un livrable).

**Valeur stratégique** — la plus difficile à chiffrer : compétence interne développée, capacité nouvelle acquise, avantage concurrentiel. Ce niveau se mesure à 12-24 mois, pas à 3 mois.

La plupart des projets ne mesurent que les gains directs et manquent donc 60 à 70 % de la valeur réelle créée.

## Une méthode de mesure en 4 étapes

### Étape 1 : définir la baseline avant déploiement

Avant de lancer quoi que ce soit, mesurer l'état actuel. Combien de temps prend la tâche cible ? Quel est le taux d'erreur ? Quel est le coût humain par unité ? Cette baseline est la référence absolue sans laquelle aucune mesure de ROI n'est possible.

### Étape 2 : identifier les indicateurs de succès par cas d'usage

Chaque cas d'usage a ses propres métriques pertinentes. Pour un cas de synthèse documentaire : temps de traitement, qualité de la synthèse (évaluée par l'utilisateur), taux d'utilisation réelle. Pour un cas de génération de contenu : temps de révision humaine, nombre de versions avant validation, satisfaction de l'équipe.

Ne pas utiliser les mêmes indicateurs pour tous les cas — c'est une erreur fréquente qui dilue la mesure.

### Étape 3 : mesurer à J+30, J+90, J+180

Les premiers 30 jours sont toujours décevants. La courbe d'apprentissage est réelle. Les vrais gains apparaissent à partir de J+60 quand les utilisateurs ont intégré l'outil dans leur workflow.

Mesurer à J+30 donne une baseline d'adoption. À J+90, les gains se stabilisent. À J+180, on peut distinguer les effets durables des effets de nouveauté.

### Étape 4 : distinguer l'effet IA de l'effet formation

Un projet IA implique presque toujours une refonte partielle du processus. Les gains de productivité viennent parfois de la rationalisation du workflow, pas de l'IA elle-même. C'est utile — mais il faut le savoir pour attribuer la valeur correctement.

## Les erreurs les plus courantes

**Compter des heures économisées sans vérifier leur réallocation.** Si les 110 heures récupérées sont absorbées par d'autres tâches sans valeur ajoutée, le ROI réel est proche de zéro. La valeur n'existe que si le temps libéré est réalloué à des activités à plus haute valeur.

**Ignorer le coût de supervision.** Pour la plupart des cas d'usage professionnels, la validation humaine reste indispensable. Un système IA qui génère 95 % de sorties correctes nécessite encore de vérifier les 5 % restants — parfois les plus importants.

**Projeter le POC sur 100 % du flux.** Un POC sur 50 dossiers triés ne garantit pas les mêmes performances sur 2 000 dossiers avec toute leur variance réelle. La montée en charge révèle les limitations.

---

Mesurer le ROI d'un projet IA n'est pas une démarche comptable accessoire. C'est ce qui permet de distinguer les projets qui créent vraiment de la valeur de ceux qui créent surtout de l'activité. Et c'est la condition pour décider en connaissance de cause : continuer, pivoter, ou arrêter.

Sources :
- McKinsey — The State of AI 2025 : https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
- Harvard Business Review — Measuring the ROI of Generative AI : https://hbr.org/2023/11/measuring-the-roi-of-generative-ai
