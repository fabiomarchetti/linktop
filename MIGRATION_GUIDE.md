# Guida alla Migrazione: VPS -> Supabase + Vercel

Questa guida riassume i passaggi critici e le configurazioni scoperte durante la migrazione del progetto Linktop.

## 1. Architettura
- **Database**: Supabase (PostgreSQL) in `eu-west-1`.
- **Backend/Frontend**: Next.js su Vercel.
- **Connessione**: Connection Pooler (Supavisor) in modalità Session (Porta 5432).

## 2. Problemi Comuni e Soluzioni

### A. Vercel non si connette (ENOTFOUND / IPv6)
**Problema**: Vercel usa spesso reti IPv4-only per le connessioni in uscita (AWS lambda), mentre l'endpoint diretto di Supabase (`db.xxx.supabase.co`) è IPv6-only nel piano gratuito.
**Soluzione**: Usare SEMPRE il **Session Pooler** di Supabase che supporta IPv4.

### B. Errore "Tenant or user not found" (XX000)
**Problema**: Tentativo di connessione al Pooler usando un username errato o la porta Transaction (6543) con utente postgres.
**Soluzione**:
1. Usare il **Session Pooler** (Porta 5432).
2. Usare l'username COMPLETO col suffisso del progetto: `postgres.jgtaebnbwlydljbqkogc`.

### C. Errore "Self-signed certificate"
**Problema**: Node.js su Vercel non riconosce il certificato SSL di Supabase.
**Soluzione**: Configurare `pg` con `ssl: { rejectUnauthorized: false }` e rimuovere `?sslmode=require` dalla connection string se crea conflitti.

## 3. Configurazione Finale (Vercel Env Vars)

La variabile chiave su Vercel è `LINKTOP_DB_URL` (configurata nel codice per avere priorità su tutto).

**Formato corretto:**
```
postgresql://[DB_USER]:[DB_PASSWORD]@[POOLER_HOST]:5432/postgres
```

**Esempio Reale (Linktop):**
- **User**: `postgres.jgtaebnbwlydljbqkogc`
- **Host**: `aws-0-eu-central-1.pooler.supabase.com` (o simile, vedi Supabase -> Settings -> Database -> Connection Pooling)
- **Port**: `5432` (Session Mode)

## 4. Gestione Database (Backup/Restore)

### Export dalla VPS (Legacy)
```bash
# Solo schema
pg_dump -h 127.0.0.1 -U gpsuser -d gpswatch --no-owner --no-acl --schema-only > schema.sql

# Solo dati (INSERTs)
pg_dump -h 127.0.0.1 -U gpsuser -d gpswatch --no-owner --no-acl --data-only --inserts --column-inserts > data.sql
```

### Import su Supabase
Usare l'SQL Editor di Supabase dashboard.
1. Caricare `schema.sql` (rimuovere prima eventuali `SET ...` o `\connect`).
2. Caricare `data.sql` (se >10MB, splittarlo in pezzi).

## 5. Codice (`lib/db.ts`)
Il file `lib/db.ts` è stato aggiornato per gestire:
1. Variabile `LINKTOP_DB_URL` (Priorità massima).
2. Variabili standard `POSTGRES_URL` / `DATABASE_URL`.
3. Fallback a `DB_HOST` per sviluppo locale/tunnel.
4. Configurazione SSL automatica per ambienti di produzione.
