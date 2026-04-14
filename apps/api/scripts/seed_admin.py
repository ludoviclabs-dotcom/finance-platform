"""
seed_admin.py — Crée le premier compte admin en production.

Usage :
  DATABASE_URL="postgresql://..." AUTH_JWT_SECRET="..." python scripts/seed_admin.py

Variables d'environnement requises :
  DATABASE_URL     — URL Postgres (injectée par Neon via Vercel)
  ADMIN_EMAIL      — email du compte admin à créer (défaut : admin@carbonco.fr)
  ADMIN_PASSWORD   — mot de passe (défaut : généré aléatoirement)
"""

from __future__ import annotations

import os
import secrets
import sys

# Ajoute le répertoire parent au path pour importer les modules de l'API
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL non défini. Exporte la variable avant de lancer ce script.")
        sys.exit(1)

    # Lance les migrations DDL avant d'insérer
    from db.migrations import run_migrations
    run_migrations()

    import psycopg2

    email = os.environ.get("ADMIN_EMAIL", "admin@carbonco.fr")
    password = os.environ.get("ADMIN_PASSWORD", secrets.token_urlsafe(16))
    password_hash = _pwd_context.hash(password)

    conn = psycopg2.connect(database_url)
    try:
        with conn:
            with conn.cursor() as cur:
                # Crée la company par défaut si elle n'existe pas
                cur.execute("""
                    INSERT INTO companies (name, slug, plan)
                    VALUES ('CarbonCo', 'carbonco', 'pro')
                    ON CONFLICT (slug) DO NOTHING
                    RETURNING id
                """)
                row = cur.fetchone()
                if row:
                    company_id = row[0]
                else:
                    cur.execute("SELECT id FROM companies WHERE slug = 'carbonco'")
                    company_id = cur.fetchone()[0]

                # Crée l'admin
                cur.execute("""
                    INSERT INTO users (company_id, email, password_hash, role)
                    VALUES (%s, %s, %s, 'admin')
                    ON CONFLICT (email) DO UPDATE SET
                        password_hash = EXCLUDED.password_hash,
                        role = 'admin',
                        is_active = TRUE
                    RETURNING id
                """, (company_id, email, password_hash))
                user_id = cur.fetchone()[0]

        print(f"✅ Compte admin créé (id={user_id})")
        print(f"   Email    : {email}")
        if not os.environ.get("ADMIN_PASSWORD"):
            print(f"   Password : {password}  ← NOTE: ce mot de passe ne sera plus affiché")
        else:
            print(f"   Password : (défini via ADMIN_PASSWORD)")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
