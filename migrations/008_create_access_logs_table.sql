-- ============================================================================
-- MIGRATION 008: Create Access Logs Table
-- ============================================================================
-- SCOPO: Creare tabella per tracciare accessi e navigazione utenti
-- DATA: 2026-01-20
-- VISIBILITÀ: Solo sviluppatore può visualizzare questi log
-- ============================================================================

BEGIN;

-- ============================================================================
-- TABELLA: linktop_access_logs
-- ============================================================================
-- Traccia login, logout e navigazione pagine degli utenti

CREATE TABLE IF NOT EXISTS linktop_access_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    username VARCHAR(50) NOT NULL,
    nome VARCHAR(100),
    cognome VARCHAR(100),
    ruolo VARCHAR(50),
    action_type VARCHAR(20) NOT NULL,  -- 'login', 'logout', 'page_visit'
    page_url VARCHAR(500),              -- URL della pagina visitata (NULL per login/logout)
    ip_address VARCHAR(50),             -- IP dell'utente
    user_agent TEXT,                    -- Browser/client info
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key su linktop_users
    CONSTRAINT fk_access_logs_user
        FOREIGN KEY (user_id)
        REFERENCES linktop_users(id)
        ON DELETE CASCADE,

    -- Constraint: action_type deve essere valido
    CONSTRAINT access_logs_action_type_check
        CHECK (action_type IN ('login', 'logout', 'page_visit'))
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id
    ON linktop_access_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_access_logs_username
    ON linktop_access_logs(username);

CREATE INDEX IF NOT EXISTS idx_access_logs_action_type
    ON linktop_access_logs(action_type);

CREATE INDEX IF NOT EXISTS idx_access_logs_created_at
    ON linktop_access_logs(created_at DESC);

-- Indice composto per query comuni (user + data)
CREATE INDEX IF NOT EXISTS idx_access_logs_user_date
    ON linktop_access_logs(user_id, created_at DESC);

-- ============================================================================
-- VERIFICA CREAZIONE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Tabella linktop_access_logs creata con successo!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Struttura tabella:';
    RAISE NOTICE '   - id: identificatore univoco';
    RAISE NOTICE '   - user_id: riferimento a linktop_users';
    RAISE NOTICE '   - username, nome, cognome, ruolo: info utente denormalizzate';
    RAISE NOTICE '   - action_type: login | logout | page_visit';
    RAISE NOTICE '   - page_url: URL visitato (per page_visit)';
    RAISE NOTICE '   - ip_address: IP client';
    RAISE NOTICE '   - user_agent: browser/client';
    RAISE NOTICE '   - created_at: timestamp evento';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Query test:';
    RAISE NOTICE '   SELECT * FROM linktop_access_logs ORDER BY created_at DESC LIMIT 10;';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK (da eseguire manualmente se necessario)
-- ============================================================================
-- DROP TABLE IF EXISTS linktop_access_logs CASCADE;
