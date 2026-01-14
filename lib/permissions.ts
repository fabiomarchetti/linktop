/**
 * Utility per la gestione dei permessi basati sui ruoli
 * LINKTOP Health Monitor - Sistema di controllo accessi
 */

export interface Ruolo {
  id: number
  nome: string
  descrizione: string
  livello: number
}

export interface UserWithRuolo {
  id: number
  nome: string
  cognome: string
  username: string
  ruolo: Ruolo
}

// Livelli di accesso
export const LIVELLI_ACCESSO = {
  UTENTE_BASE: 1,
  CONTROLLO_PARENTALE: 2,
  ASSISTENTE_CONTROL: 3,
  ANIMATORE_DIGITALE: 4,
  SVILUPPATORE: 5,
} as const

// Nomi ruoli
export const RUOLI = {
  UTENTE_BASE: 'utente_base',
  CONTROLLO_PARENTALE: 'controllo_parentale',
  ASSISTENTE_CONTROL: 'assistente_control',
  ANIMATORE_DIGITALE: 'animatore_digitale',
  SVILUPPATORE: 'sviluppatore',
} as const

/**
 * Verifica se l'utente ha un livello di accesso >= a quello richiesto
 */
export function hasPermission(userLevel: number, requiredLevel: number): boolean {
  return userLevel >= requiredLevel
}

/**
 * Verifica se l'utente ha uno specifico ruolo
 */
export function hasRole(user: UserWithRuolo, roleName: string): boolean {
  return user.ruolo.nome === roleName
}

/**
 * Verifica se l'utente è uno sviluppatore (accesso completo)
 */
export function isSviluppatore(user: UserWithRuolo): boolean {
  return user.ruolo.livello >= LIVELLI_ACCESSO.SVILUPPATORE
}

/**
 * Verifica se l'utente può configurare dispositivi medici
 * Richiesto: animatore_digitale (livello 4) o superiore
 */
export function canConfigureDevices(user: UserWithRuolo): boolean {
  return hasPermission(user.ruolo.livello, LIVELLI_ACCESSO.ANIMATORE_DIGITALE)
}

/**
 * Verifica se l'utente può gestire altri utenti (staff)
 * Richiesto: sviluppatore (livello 5)
 */
export function canManageUsers(user: UserWithRuolo): boolean {
  return hasPermission(user.ruolo.livello, LIVELLI_ACCESSO.SVILUPPATORE)
}

/**
 * Verifica se l'utente può accedere alla health monitor dashboard
 * Richiesto: assistente_control (livello 3) o superiore
 */
export function canAccessHealthMonitor(user: UserWithRuolo): boolean {
  return hasPermission(user.ruolo.livello, LIVELLI_ACCESSO.ASSISTENTE_CONTROL)
}

/**
 * Verifica se l'utente può monitorare pazienti
 * Richiesto: controllo_parentale (livello 2) o superiore
 */
export function canMonitorPatients(user: UserWithRuolo): boolean {
  return hasPermission(user.ruolo.livello, LIVELLI_ACCESSO.CONTROLLO_PARENTALE)
}

/**
 * Verifica se l'utente può visualizzare i propri dati
 * Richiesto: utente_base (livello 1) - tutti gli utenti autenticati
 */
export function canViewOwnData(user: UserWithRuolo): boolean {
  return hasPermission(user.ruolo.livello, LIVELLI_ACCESSO.UTENTE_BASE)
}

/**
 * Verifica se l'utente può gestire configurazioni di sistema
 * Richiesto: sviluppatore (livello 5)
 */
export function canManageSystemConfig(user: UserWithRuolo): boolean {
  return hasPermission(user.ruolo.livello, LIVELLI_ACCESSO.SVILUPPATORE)
}

/**
 * Verifica se l'utente può gestire dispositivi medici BLE
 * Richiesto: animatore_digitale (livello 4) o superiore
 */
export function canManageMedicalDevices(user: UserWithRuolo): boolean {
  return hasPermission(user.ruolo.livello, LIVELLI_ACCESSO.ANIMATORE_DIGITALE)
}

/**
 * Verifica se l'utente può ricevere notifiche di emergenza
 * Richiesto: controllo_parentale (livello 2) o superiore
 */
export function canReceiveEmergencyAlerts(user: UserWithRuolo): boolean {
  return hasPermission(user.ruolo.livello, LIVELLI_ACCESSO.CONTROLLO_PARENTALE)
}

/**
 * Verifica se l'utente può accedere ai log di sistema
 * Richiesto: assistente_control (livello 3) o superiore
 */
export function canAccessSystemLogs(user: UserWithRuolo): boolean {
  return hasPermission(user.ruolo.livello, LIVELLI_ACCESSO.ASSISTENTE_CONTROL)
}

/**
 * Restituisce una descrizione testuale del livello di permesso
 */
export function getPermissionDescription(level: number): string {
  switch (level) {
    case LIVELLI_ACCESSO.SVILUPPATORE:
      return 'Accesso completo al sistema'
    case LIVELLI_ACCESSO.ANIMATORE_DIGITALE:
      return 'Configurazione dispositivi medici'
    case LIVELLI_ACCESSO.ASSISTENTE_CONTROL:
      return 'Monitoraggio multi-paziente'
    case LIVELLI_ACCESSO.CONTROLLO_PARENTALE:
      return 'Monitoraggio pazienti assegnati'
    case LIVELLI_ACCESSO.UTENTE_BASE:
      return 'Visualizzazione solo dei propri dati'
    default:
      return 'Nessun permesso'
  }
}

/**
 * Restituisce l'emoji associato al ruolo
 */
export function getRoleEmoji(roleName: string): string {
  switch (roleName) {
    case RUOLI.SVILUPPATORE:
      return '🔧'
    case RUOLI.ANIMATORE_DIGITALE:
      return '💻'
    case RUOLI.ASSISTENTE_CONTROL:
      return '📊'
    case RUOLI.CONTROLLO_PARENTALE:
      return '👨‍👩‍👧'
    case RUOLI.UTENTE_BASE:
      return '👤'
    default:
      return '👤'
  }
}

/**
 * Verifica se l'utente può modificare un altro utente
 * Un utente può essere modificato solo da utenti con livello superiore
 */
export function canModifyUser(currentUser: UserWithRuolo, targetUserLevel: number): boolean {
  return currentUser.ruolo.livello > targetUserLevel
}

/**
 * Verifica se l'utente può eliminare un altro utente
 * Solo sviluppatori possono eliminare utenti
 */
export function canDeleteUser(currentUser: UserWithRuolo): boolean {
  return isSviluppatore(currentUser)
}
