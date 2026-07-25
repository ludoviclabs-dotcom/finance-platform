> **Mission en cours — Wave E-Interface & Closeout.**
> **Dernière étape du chantier.** Après elle, aucune vague ne suit : le chantier
> attend une **revue humaine**, puis une décision de production.

# Wave E-Interface & Closeout (E4 cockpit + E6 QA/E2E/sécurité + E7 clôture)

**Branche :** `feat/water-intelligence-wave-e-ui-closeout`
**Base :** `master` @ `7ea6772` (PR #158 Wave E-Core fusionnée).

---

## État à l'entrée

| Vague | Statut | PR | Merge SHA |
|---|---|---|---|
| Wave A — connecteurs européens | **fusionnée** | #153 | `e36c97c` |
| Blueprint UX/UI | **fusionné** | #154 | `a56ab62` |
| Wave B — famille Hub'Eau | **fusionnée** | #155 | `daaf8f0` |
| Wave C — produit public | **fusionnée** | #156 | `eb2a898` |
| Wave D — couche décisionnelle | **fusionnée** | #157 | `618a222` |
| Wave E-Core — E0/E1/E2/E3/E5 | **fusionnée** | #158 | `7ea6772` |

- Vercel `carbon` et `carbonco-api` production **READY** sur ce merge, aucune
  erreur runtime sur 24 h (vérifié au préflight).
- Dernière migration : `043`. Cette vague n'en créera aucune.
- Les quatre endpoints de la Wave E-Core sont en production ; aucune interface
  ne les consomme encore.

## Ce que la Wave E-Core a laissé

1. **Quatre endpoints sans consommateur.** Snapshot public, registre juridique
   public, synthèse authentifiée et évaluation financière existent et sont
   testés ; aucune page ne les appelle.
2. **Aucun test E2E.** Le workflow existant ne se déclenche pas sur
   `pull_request` — décision de politique documentée dans
   `E2E_SECRETS_POLICY_PROPOSAL.md`, à appliquer ici.
3. **Aucune vérification visuelle humaine.** Les surfaces publiques n'ont jamais
   été regardées dans un navigateur par un humain.

## Contraintes constantes

- aucune donnée tenant sur `/water-intelligence` ;
- aucune source approuvée par le modèle ;
- aucun texte juridique instruit ;
- aucune probabilité ni taux d'actualisation par défaut ;
- aucun score composite ;
- aucune migration ;
- **aucune dépendance ajoutée** ;
- aucun appel externe au runtime ni en test ;
- aucune fixture présentée comme donnée réelle.

## Ce que le modèle ne peut pas faire, et ne doit pas prétendre faire

- **Cocher une vérification visuelle.** La Preview Vercel est derrière le SSO de
  l'équipe : l'état des déploiements et les erreurs runtime sont vérifiables par
  API, le rendu ne l'est pas.
- **Exécuter les E2E authentifiés** tant que l'environnement GitHub et ses
  secrets n'existent pas — les créer est une décision humaine.
- **Signer une décision de publication**, désigner un réviseur juridique, ou
  fournir une hypothèse financière.

Un rapport qui prétendrait le contraire serait faux, et c'est le seul défaut
que ce chantier n'a jamais toléré.
