/**
 * Alert System - Export principale
 *
 * Sistema di monitoraggio intelligente per parametri vitali.
 * Rileva automaticamente anomalie e genera alert.
 */

// Types
export * from './types'

// Engine
export {
  evaluateMeasurement,
  getActiveAlertsForPatient,
  getAllActiveAlerts,
  updateAlertStatus,
  getAlertCountsBySeverity,
} from './engine'

// Thresholds
export {
  getGlobalRules,
  getPatientRules,
  getEffectiveThresholds,
  invalidateGlobalRulesCache,
  upsertPatientRule,
  updateGlobalRule,
} from './thresholds'

// Dispatcher
export {
  dispatchAlertNotifications,
  sendTestNotification,
} from './dispatcher'
