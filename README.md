# SamSecure

## Installation

### 1. Bases de donnees

En superuser PostgreSQL, sur la base `postgres` :

    psql -U postgres -f server/bdd/manual/000_init_databases.sql

Le script demande interactivement les mots de passe des roles `samsecure_app`
et `samsecure_api_ro`. Generer chaque valeur avec `openssl rand -hex 24`.

### 2. Configuration

    cd server
    cp .env.example         .env
    cp .env.dev.example     .env.dev
    cp .env.staging.example .env.staging
    chown <votre_compte>:<compte_pm2> .env .env.dev .env.staging
    chmod 640 .env .env.dev .env.staging

Renseigner chaque `A_RENSEIGNER` :
- `PGPASSWORD` : le mot de passe choisi a l'etape 1 pour `samsecure_app`
- `JWT_ACCESS_SECRET` et `JWT_REFRESH_SECRET` : `openssl rand -hex 32`,
  une valeur unique par cle et par environnement

### 3. Schema

    npm ci
    APP_ENV=dev     npm run migrate
    APP_ENV=staging npm run migrate

### 4. Demarrage

    pm2 start ecosystem.config.cjs
    pm2 save

## Depannage

**`Configuration incomplete pour APP_ENV="..."`** au demarrage : le compte qui
execute PM2 ne peut pas lire `server/.env*`, ou un `A_RENSEIGNER` subsiste.
Verifier les droits (etape 2) avant de chercher ailleurs.

**`permission denied for schema public`** au `npm run migrate` : la base
n'appartient pas a `samsecure_app`. Corriger avec
`ALTER DATABASE <base> OWNER TO samsecure_app;` en superuser.
