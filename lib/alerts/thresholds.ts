/**
 * Gestione Soglie Alert
 *
 * Recupera le soglie dal database (linktop_alert_rules)
 * con priorità: regole specifiche paziente > regole globali
 */

import pool from '@/lib/db'
import { AlertRule, ParameterType, ThresholdConfig } from './types'

/**
 * Cache in-memory per le regole globali (refresh ogni 5 minuti)
 */
let globalRulesCache: Map<ParameterType, ThresholdConfig> | null = null
let globalRulesCacheTime: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minuti

/**
 * Recupera le regole globali (paziente_id IS NULL)
 */
export async function getGlobalRules(): Promise<Map<ParameterType, ThresholdConfig>> {
  const now = Date.now()

  // Usa cache se valida
  if (globalRulesCache && (now - globalRulesCacheTime) < CACHE_TTL) {
    return globalRulesCache
  }

  const result = await pool.query<AlertRule>(`
    SELECT
      parameter_type,
      min_warning,
      max_warning,
      min_critical,
      max_critical,
      priority
    FROM linktop_alert_rules
    WHERE paziente_id IS NULL
      AND enabled = true
    ORDER BY parameter_type
  `)

  const rules = new Map<ParameterType, ThresholdConfig>()

  for (const row of result.rows) {
    rules.set(row.parameter_type, {
      parameter_type: row.parameter_type,
      min_warning: row.min_warning ? parseFloat(String(row.min_warning)) : null,
      max_warning: row.max_warning ? parseFloat(String(row.max_warning)) : null,
      min_critical: row.min_critical ? parseFloat(String(row.min_critical)) : null,
      max_critical: row.max_critical ? parseFloat(String(row.max_critical)) : null,
      priority: row.priority,
    })
  }

  // Aggiorna cache
  globalRulesCache = rules
  globalRulesCacheTime = now

  return rules
}

/**
 * Recupera le regole specifiche per un paziente
 */
export async function getPatientRules(pazienteId: number): Promise<Map<ParameterType, ThresholdConfig>> {
  const result = await pool.query<AlertRule>(`
    SELECT
      parameter_type,
      min_warning,
      max_warning,
      min_critical,
      max_critical,
      priority
    FROM linktop_alert_rules
    WHERE paziente_id = $1
      AND enabled = true
    ORDER BY parameter_type
  `, [pazienteId])

  const rules = new Map<ParameterType, ThresholdConfig>()

  for (const row of result.rows) {
    rules.set(row.parameter_type, {
      parameter_type: row.parameter_type,
      min_warning: row.min_warning ? parseFloat(String(row.min_warning)) : null,
      max_warning: row.max_warning ? parseFloat(String(row.max_warning)) : null,
      min_critical: row.min_critical ? parseFloat(String(row.min_critical)) : null,
      max_critical: row.max_critical ? parseFloat(String(row.max_critical)) : null,
      priority: row.priority,
    })
  }

  return rules
}

/**
 * Recupera le soglie personalizzate dal campo JSONB del paziente
 */
export async function getPatientCustomThresholds(pazienteId: number): Promise<Record<string, any> | null> {
  const result = await pool.query(`
    SELECT custom_thresholds
    FROM linktop_pazienti
    WHERE id = $1
  `, [pazienteId])

  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0].custom_thresholds
}

/**
 * Recupera le soglie effettive per un paziente
 * Priorità: custom_thresholds > regole paziente > regole globali
 */
export async function getEffectiveThresholds(pazienteId: number): Promise<Map<ParameterType, ThresholdConfig>> {
  // 1. Ottieni regole globali (dalla cache se disponibile)
  const globalRules = await getGlobalRules()

  // 2. Ottieni regole specifiche paziente (sovrascrivono globali)
  const patientRules = await getPatientRules(pazienteId)

  // 3. Ottieni soglie personalizzate JSONB (sovrascrivono tutto)
  const customThresholds = await getPatientCustomThresholds(pazienteId)

  // Merge: global -> patient rules -> custom thresholds
  const effectiveRules = new Map<ParameterType, ThresholdConfig>(globalRules)

  // Sovrascrivi con regole paziente
  patientRules.forEach((config, param) => {
    effectiveRules.set(param, config)
  })

  // Sovrascrivi con custom_thresholds JSONB (se presenti)
  if (customThresholds) {
    for (const [param, thresholds] of Object.entries(customThresholds)) {
      const paramType = param as ParameterType
      const existing = effectiveRules.get(paramType)

      if (existing && thresholds) {
        effectiveRules.set(paramType, {
          ...existing,
          min_warning: thresholds.min_warning ?? thresholds.min ?? existing.min_warning,
          max_warning: thresholds.max_warning ?? thresholds.max ?? existing.max_warning,
          min_critical: thresholds.min_critical ?? existing.min_critical,
          max_critical: thresholds.max_critical ?? existing.max_critical,
        })
      }
    }
  }

  return effectiveRules
}

/**
 * Invalida la cache delle regole globali
 * Da chiamare quando le regole vengono modificate
 */
export function invalidateGlobalRulesCache(): void {
  globalRulesCache = null
  globalRulesCacheTime = 0
}

/**
 * Crea o aggiorna una regola per un paziente
 */
export async function upsertPatientRule(
  pazienteId: number,
  parameterType: ParameterType,
  config: Partial<ThresholdConfig>,
  createdBy?: number
): Promise<void> {
  await pool.query(`
    INSERT INTO linktop_alert_rules (
      paziente_id,
      parameter_type,
      min_warning,
      max_warning,
      min_critical,
      max_critical,
      priority,
      created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (paziente_id, parameter_type)
    WHERE paziente_id IS NOT NULL
    DO UPDATE SET
      min_warning = EXCLUDED.min_warning,
      max_warning = EXCLUDED.max_warning,
      min_critical = EXCLUDED.min_critical,
      max_critical = EXCLUDED.max_critical,
      priority = EXCLUDED.priority,
      updated_at = CURRENT_TIMESTAMP
  `, [
    pazienteId,
    parameterType,
    config.min_warning ?? null,
    config.max_warning ?? null,
    config.min_critical ?? null,
    config.max_critical ?? null,
    config.priority ?? 5,
    createdBy ?? null,
  ])
}

/**
 * Aggiorna le regole globali
 */
export async function updateGlobalRule(
  parameterType: ParameterType,
  config: Partial<ThresholdConfig>,
  updatedBy?: number
): Promise<void> {
  await pool.query(`
    UPDATE linktop_alert_rules
    SET
      min_warning = COALESCE($2, min_warning),
      max_warning = COALESCE($3, max_warning),
      min_critical = COALESCE($4, min_critical),
      max_critical = COALESCE($5, max_critical),
      priority = COALESCE($6, priority),
      updated_at = CURRENT_TIMESTAMP
    WHERE paziente_id IS NULL
      AND parameter_type = $1
  `, [
    parameterType,
    config.min_warning,
    config.max_warning,
    config.min_critical,
    config.max_critical,
    config.priority,
  ])

  // Invalida cache
  invalidateGlobalRulesCache()
}
