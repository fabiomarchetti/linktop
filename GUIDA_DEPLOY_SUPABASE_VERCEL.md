# Guida Completa: Migrazione e Deployment su Vercel + Supabase
*(Con mantenimento parallelo su VPS legacy)*

Questa procedura descrive passo dopo passo come portare un'applicazione Next.js esistente (ospitata su VPS) verso un'architettura moderna Serverless (Vercel) e Database as a Service (Supabase), garantendo la massima compatibilità e prestazioni.

---

## FASE 1: Preparazione Database (Supabase)

### 1.1 Creazione Progetto
1. Accedi a [Supabase Dashboard](https://supabase.com/dashboard).
2. Clicca su **"New Project"**.
3. Seleziona l'organizzazione e dai un nome al progetto (es. `Linktop-Cloud`).
4. Genera una **Password Sicura** e **SALVALA** subito in un posto sicuro (servirà dopo).
5. Seleziona la **Region** più vicina ai tuoi utenti (es. `Frankfurt (eu-central-1)`).
6. Clicca **"Create new project"** e attendi qualche minuto.

### 1.2 Configurazione Connection Pooler (CRUCIALE per Vercel)
Vercel usa indirizzi IPv4, mentre il DB diretto di Supabase è spesso IPv6. È **obbligatorio** usare il Pooler.

1. Vai su **Settings** (icona ingranaggio) -> **Database**.
2. Cerca la sezione **"Connection Pooling"** (o Connection parameters).
3. Verifica che sia attivo.
4. Prendi nota dei parametri del **Session Pooler** (Porta **5432**):
   - **Host**: es. `aws-0-eu-central-1.pooler.supabase.com`
   - **User**: es. `postgres.vostroprojectid` (formato completo)
   - **Port**: `5432` (Session Mode)
   - **Mode**: Assicurati che sia impostato su `Session`.

### 1.3 Export Dati dalla VPS (Legacy)
Dal tuo terminale locale, apri un tunnel verso la VPS ed esporta i dati.

```bash
# 1. Apri Tunnel SSH (lascia aperto in una finestra terminale)
ssh -i ~/.ssh/id_ed25519 -L 5433:127.0.0.1:5432 root@IP_VPS

# 2. Esporta Schema (in un'altra finestra)
pg_dump -h 127.0.0.1 -p 5433 -U [DB_USER] -d [DB_NAME] --no-owner --no-acl --schema-only > schema.sql

# 3. Esporta Dati
pg_dump -h 127.0.0.1 -p 5433 -U [DB_USER] -d [DB_NAME] --no-owner --no-acl --data-only --inserts --column-inserts > data.sql
```

### 1.4 Import su Supabase
1. Vai su Supabase -> **SQL Editor**.
2. Apri il file `schema.sql` col tuo editor di testo.
3. Rimuovi eventuali righe iniziali tipo `SET ...` o `\connect` che potrebbero dare errore.
4. Copia il contenuto e incollalo nell'SQL Editor di Supabase -> Clicca **RUN**.
5. Fai lo stesso con `data.sql`.
   - *Nota:* Se il file dati è enorme (>10MB), dividilo in più parti o usa uno script di importazione.

---

## FASE 2: Preparazione Codice (Next.js)

### 2.1 Adattamento Configurazione DB (`lib/db.ts`)
Modifica il file di connessione al database per supportare sia la VPS (vecchio metodo) che Supabase (nuovo metodo con URL).

**Codice Raccomandato:**
```typescript
import { Pool, PoolConfig } from 'pg'

const getPoolConfig = (): PoolConfig => {
  // A. Priorità ASSOLUTA alla variabile Vercel/Supabase
  if (process.env.LINKTOP_DB_URL) {
    console.log('🔌 Cloud Mode: Usando Supabase Pooler')
    return {
      connectionString: process.env.LINKTOP_DB_URL,
      ssl: { rejectUnauthorized: false }, // Fondamentale per Supabase
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  }

  // B. Fallback VPS / Locale Legacy
  console.log('🔌 Legacy Mode: Usando VPS/Tunnel')
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // SSL disabilitato di default per VPS locale
  }
}

const pool = new Pool(getPoolConfig())
export default pool
```

### 2.2 Configurazione Locale Cloud-First (`.env.local`)
Per sviluppare in locale collegandosi a Supabase (senza tunnel):

```bash
# .env.local
LINKTOP_DB_URL="postgresql://postgres.projectid:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
```

---

## FASE 3: Deployment su Vercel

### 3.1 Creazione Progetto Vercel
1. Vai su [Vercel Dashboard](https://vercel.com).
2. Clicca **"Add New..."** -> **"Project"**.
3. Seleziona il repository GitHub.
4. **NON** cliccare ancora Deploy. Configura prima le variabili.

### 3.2 Configurazione Variabili d'Ambiente (CRUCIALE)
Nella sezione "Environment Variables", aggiungi:

**Variabile Chiave:**
- **Key**: `LINKTOP_DB_URL`
- **Value**: La stringa del **Session Pooler** (Porta 5432) copiata da Supabase.
  - Formato: `postgresql://[USER]:[PASSWORD]@[HOST]:5432/postgres`
  - *Attenzione:* Sostituisci `[PASSWORD]` con quella vera (senza parentesi!).

**Altre Variabili (se necessarie):**
- `NEXT_PUBLIC_SUPABASE_URL`: URL del progetto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Chiave pubblica API.

### 3.3 Deploy Finale
1. Clicca **"Deploy"**.
2. Attendi la build.
3. Se tutto è verde, il sito è online!

---

## FASE 4: Gestione Ibrida (Confronto VPS vs Cloud)

Per mantenere attiva l'applicazione anche sulla vecchia VPS per confronto:

1. **VPS**: Continua a girare con il suo codice e il suo DB locale PostgreSQL (su `localhost:5432`). Non toccare nulla.
2. **Vercel**: Gira nel cloud e punta a Supabase.

**Come sincronizzare i dati (Opzionale):**
Se vuoi che i dati siano identici, dovrai periodicamente rifare l'export dalla VPS e l'import su Supabase (svuotando prima le tabelle su Supabase con `TRUNCATE` o `DROP schema`).

**Verifica Prestazioni:**
- Usa l'endpoint `/api/test-db` (se creato) su entrambe le versioni per misurare la latenza di connessione.
- Vercel + Supabase (stessa regione) dovrebbe avere latenze < 50ms.

---

## Risoluzione Problemi Comuni

- **Errore `ENOTFOUND`**: Stai usando l'endpoint diretto IPv6 su Vercel. -> **Soluzione**: Usa il Session Pooler (Porta 5432).
- **Errore `Tenant or user not found`**: Stai usando il Transaction Pooler (6543) con utente errato. -> **Soluzione**: Passa alla porta 5432.
- **Errore `Self-signed certificate`**: Manca la config SSL nel client `pg`. -> **Soluzione**: Aggiungi `ssl: { rejectUnauthorized: false }` in `lib/db.ts`.
- **Errore `Password authentication failed`**: Password sbagliata o caratteri speciali non encodati. -> **Soluzione**: Resetta password su Supabase (usa solo alfanumerici) e aggiorna Vercel.
