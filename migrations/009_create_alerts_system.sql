-- =====================================================
-- MIGRATION 009: Sistema Alert AI Control Room
-- Data: 24 Gennaio 2026
-- Descrizione: Crea le tabelle per il sistema di alert
--              automatico e notifiche multi-canale
-- =====================================================

-- -----------------------------------------------------
-- Tabella 1: linktop_alert_rules
-- Regole di alert personalizzate (globali o per paziente)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS linktop_alert_rules (
    id SERIAL PRIMARY KEY,

    -- NULL = regola globale, altrimenti specifica per paziente
    paziente_id INTEGER REFERENCES linktop_pazienti(id) ON DELETE CASCADE,

    -- Tipo parametro: heart_rate, spo2, temperature, systolic_bp, diastolic_bp
    parameter_type VARCHAR(50) NOT NULL,

    -- Range valori WARNING (allerta moderata)
    min_warning DECIMAL(10,2),
    max_warning DECIMAL(10,2),

    -- Range valori CRITICAL (allerta critica)
    min_critical DECIMAL(10,2),
    max_critical DECIMAL(10,2),

    -- Configurazione
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES linktop_users(id)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_alert_rules_paziente ON linktop_alert_rules(paziente_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_parameter ON linktop_alert_rules(parameter_type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON linktop_alert_rules(enabled) WHERE enabled = true;

-- Commento tabella
COMMENT ON TABLE linktop_alert_rules IS 'Regole personalizzate per la generazione di alert. paziente_id NULL = regola globale.';

-- -----------------------------------------------------
-- Tabella 2: linktop_alerts
-- Storico di tutti gli alert generati dal sistema
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS linktop_alerts (
    id SERIAL PRIMARY KEY,

    -- Paziente associato
    paziente_id INTEGER NOT NULL REFERENCES linktop_pazienti(id) ON DELETE CASCADE,

    -- Tipo e severità alert
    alert_type VARCHAR(100) NOT NULL,  -- heart_rate_high, spo2_critical, temperature_warning, etc.
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'alarm', 'emergency')),

    -- Dati dell'anomalia rilevata
    parameter_type VARCHAR(50) NOT NULL,  -- heart_rate, spo2, temperature, systolic_bp, diastolic_bp
    measured_value DECIMAL(10,2) NOT NULL,
    threshold_exceeded DECIMAL(10,2),  -- Il valore soglia superato
    health_data_id INTEGER REFERENCES linktop_health_data(id) ON DELETE SET NULL,

    -- Messaggio descrittivo
    message TEXT,

    -- Stato gestione alert
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'false_positive', 'escalated')),

    -- Tracking acknowledgment
    acknowledged_at TIMESTAMP,
    acknowledged_by INTEGER REFERENCES linktop_users(id),

    -- Tracking risoluzione
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES linktop_users(id),
    resolution_notes TEXT,

    -- Escalation tracking
    escalation_level INTEGER DEFAULT 0,  -- 0 = nessuna, 1+ = livelli escalation
    escalated_at TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per query frequenti
CREATE INDEX IF NOT EXISTS idx_alerts_paziente_status ON linktop_alerts(paziente_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity_created ON linktop_alerts(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status_created ON linktop_alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON linktop_alerts(status) WHERE status = 'active';

-- Commento tabella
COMMENT ON TABLE linktop_alerts IS 'Storico di tutti gli alert generati dal sistema AI. Traccia anomalie rilevate e loro gestione.';

-- -----------------------------------------------------
-- Tabella 3: linktop_notifications
-- Log di tutte le notifiche inviate per gli alert
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS linktop_notifications (
    id SERIAL PRIMARY KEY,

    -- Alert associato
    alert_id INTEGER NOT NULL REFERENCES linktop_alerts(id) ON DELETE CASCADE,

    -- Destinatario
    recipient_type VARCHAR(50) NOT NULL,  -- staff, caregiver, patient, emergency_contact_1, emergency_contact_2
    recipient_id INTEGER,  -- user_id se staff, paziente_id se paziente
    recipient_name VARCHAR(255),
    recipient_contact VARCHAR(255) NOT NULL,  -- email, telefono, etc.

    -- Canale di invio
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'call', 'push', 'whatsapp', 'dashboard')),

    -- Contenuto messaggio
    message_subject VARCHAR(255),
    message_content TEXT,

    -- Stato invio
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'delivered', 'failed', 'acknowledged')),

    -- Timestamp eventi
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    failed_at TIMESTAMP,

    -- Dettagli provider esterno
    provider VARCHAR(50),  -- twilio, sendgrid, fcm, etc.
    provider_message_id VARCHAR(255),
    provider_status VARCHAR(100),

    -- Errori
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per query frequenti
CREATE INDEX IF NOT EXISTS idx_notifications_alert ON linktop_notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON linktop_notifications(status, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON linktop_notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON linktop_notifications(recipient_type, recipient_contact);

-- Commento tabella
COMMENT ON TABLE linktop_notifications IS 'Log di tutte le notifiche inviate. Traccia delivery e acknowledgment per ogni canale.';

-- -----------------------------------------------------
-- Modifica tabella linktop_pazienti
-- Aggiunge preferenze notifica e soglie personalizzate
-- -----------------------------------------------------
DO $$
BEGIN
    -- Aggiunge colonna notification_preferences se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'linktop_pazienti' AND column_name = 'notification_preferences'
    ) THEN
        ALTER TABLE linktop_pazienti ADD COLUMN notification_preferences JSONB DEFAULT '{
            "email_enabled": true,
            "sms_enabled": true,
            "call_enabled": true,
            "quiet_hours_start": null,
            "quiet_hours_end": null,
            "language": "it"
        }'::jsonb;

        COMMENT ON COLUMN linktop_pazienti.notification_preferences IS 'Preferenze di notifica del paziente (canali abilitati, orari silenziosi)';
    END IF;

    -- Aggiunge colonna custom_thresholds se non esiste
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'linktop_pazienti' AND column_name = 'custom_thresholds'
    ) THEN
        ALTER TABLE linktop_pazienti ADD COLUMN custom_thresholds JSONB DEFAULT NULL;

        COMMENT ON COLUMN linktop_pazienti.custom_thresholds IS 'Soglie personalizzate per parametri vitali. Es: {"heart_rate": {"min": 55, "max": 110}}';
    END IF;
END $$;

-- -----------------------------------------------------
-- Inserimento regole globali di default
-- Basate sui range definiti in /api/dashboard/stats
-- -----------------------------------------------------
INSERT INTO linktop_alert_rules (paziente_id, parameter_type, min_warning, max_warning, min_critical, max_critical, priority, created_by)
SELECT NULL, 'heart_rate', 55, 105, 40, 150, 8, NULL
WHERE NOT EXISTS (SELECT 1 FROM linktop_alert_rules WHERE paziente_id IS NULL AND parameter_type = 'heart_rate');

INSERT INTO linktop_alert_rules (paziente_id, parameter_type, min_warning, max_warning, min_critical, max_critical, priority, created_by)
SELECT NULL, 'spo2', 92, NULL, 88, NULL, 9, NULL
WHERE NOT EXISTS (SELECT 1 FROM linktop_alert_rules WHERE paziente_id IS NULL AND parameter_type = 'spo2');

INSERT INTO linktop_alert_rules (paziente_id, parameter_type, min_warning, max_warning, min_critical, max_critical, priority, created_by)
SELECT NULL, 'systolic_bp', 85, 145, 70, 180, 7, NULL
WHERE NOT EXISTS (SELECT 1 FROM linktop_alert_rules WHERE paziente_id IS NULL AND parameter_type = 'systolic_bp');

INSERT INTO linktop_alert_rules (paziente_id, parameter_type, min_warning, max_warning, min_critical, max_critical, priority, created_by)
SELECT NULL, 'diastolic_bp', 55, 95, 40, 110, 7, NULL
WHERE NOT EXISTS (SELECT 1 FROM linktop_alert_rules WHERE paziente_id IS NULL AND parameter_type = 'diastolic_bp');

INSERT INTO linktop_alert_rules (paziente_id, parameter_type, min_warning, max_warning, min_critical, max_critical, priority, created_by)
SELECT NULL, 'temperature', 35.5, 37.8, 34.0, 39.5, 6, NULL
WHERE NOT EXISTS (SELECT 1 FROM linktop_alert_rules WHERE paziente_id IS NULL AND parameter_type = 'temperature');

-- -----------------------------------------------------
-- Funzione helper per determinare severità alert
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION get_alert_severity(
    p_parameter_type VARCHAR(50),
    p_value DECIMAL(10,2),
    p_paziente_id INTEGER DEFAULT NULL
) RETURNS VARCHAR(20) AS $$
DECLARE
    v_rule RECORD;
    v_severity VARCHAR(20) := NULL;
BEGIN
    -- Cerca prima regola specifica per paziente, poi globale
    SELECT * INTO v_rule
    FROM linktop_alert_rules
    WHERE parameter_type = p_parameter_type
      AND enabled = true
      AND (paziente_id = p_paziente_id OR paziente_id IS NULL)
    ORDER BY paziente_id NULLS LAST  -- Priorità a regole specifiche
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Verifica critical first
    IF (v_rule.min_critical IS NOT NULL AND p_value < v_rule.min_critical) OR
       (v_rule.max_critical IS NOT NULL AND p_value > v_rule.max_critical) THEN
        RETURN 'emergency';
    END IF;

    -- Verifica warning
    IF (v_rule.min_warning IS NOT NULL AND p_value < v_rule.min_warning) OR
       (v_rule.max_warning IS NOT NULL AND p_value > v_rule.max_warning) THEN
        RETURN 'warning';
    END IF;

    -- Valore normale
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_alert_severity IS 'Determina la severità di un alert basandosi sulle regole configurate. Ritorna NULL se il valore è normale.';

-- =====================================================
-- Fine Migration 009
-- =====================================================
