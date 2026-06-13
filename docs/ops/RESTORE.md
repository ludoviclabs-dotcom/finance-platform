# Restauration d'une sauvegarde Neon (T1.8)

Les sauvegardes sont produites par `.github/workflows/backup.yml` :
`pg_dump -Fc` → chiffrement GPG AES256 → artefact GitHub (rétention 30 jours).
Le même workflow rejoue automatiquement une **restauration de vérification**
dans un Postgres jetable (job `restore-check`).

## Runbook (restauration manuelle)

1. **Récupérer l'artefact** : Actions → run du workflow « DB backup (Neon) » →
   artefact `neon-backup-<run_id>` → télécharger `backup.dump.gpg`.

2. **Déchiffrer** (passphrase = secret `BACKUP_PASSPHRASE`) :
   ```bash
   gpg -d --batch --passphrase "$BACKUP_PASSPHRASE" backup.dump.gpg > backup.dump
   ```

3. **Restaurer** vers une cible (branche Neon de test, ou Postgres local) :
   ```bash
   pg_restore --no-owner -d "$TARGET_DATABASE_URL" backup.dump
   ```
   Préférer une **branche Neon** dédiée (ou une base locale) pour ne jamais
   restaurer par-dessus la prod sans validation.

4. **Vérifications post-restauration** :
   ```sql
   \dt                                  -- les tables attendues sont présentes
   SELECT count(*) FROM facts_events;   -- chaîne de preuve
   SELECT count(*) FROM snapshots;
   ```
   Puis rejouer la vérification d'intégrité applicative :
   `GET /facts/verify` doit retourner `{ ok: true }`.

5. **Rotation de la passphrase** : si compromise, régénérer `BACKUP_PASSPHRASE`
   (secret GitHub) ; les anciennes archives restent déchiffrables avec l'ancienne.

## Secrets GitHub requis

| Secret | Usage |
|---|---|
| `NEON_DATABASE_URL` | source du `pg_dump` |
| `BACKUP_PASSPHRASE` | chiffrement/déchiffrement GPG |

Sans ces secrets, le workflow s'arrête proprement (skip), sans échec.
