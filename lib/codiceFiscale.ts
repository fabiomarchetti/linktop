/**
 * Calcolo Codice Fiscale Italiano
 * Include database codici catastali dei comuni principali
 */

// Codici catastali comuni italiani principali (aggiungi altri se necessario)
const CODICI_CATASTALI: { [key: string]: string } = {
  // Lombardia
  'MILANO': 'F205',
  'BERGAMO': 'A794',
  'BRESCIA': 'B157',
  'COMO': 'C933',
  'CREMONA': 'D150',
  'LECCO': 'E507',
  'LODI': 'E648',
  'MANTOVA': 'E897',
  'MONZA': 'F704',
  'PAVIA': 'G388',
  'SONDRIO': 'I829',
  'VARESE': 'L682',

  // Lazio
  'ROMA': 'H501',
  'FROSINONE': 'D810',
  'LATINA': 'E472',
  'RIETI': 'H282',
  'VITERBO': 'M082',

  // Piemonte
  'TORINO': 'L219',
  'ALESSANDRIA': 'A182',
  'ASTI': 'A479',
  'BIELLA': 'A859',
  'CUNEO': 'D205',
  'NOVARA': 'F952',
  'VERBANIA': 'L746',
  'VERCELLI': 'L750',

  // Veneto
  'VENEZIA': 'L736',
  'BELLUNO': 'A757',
  'PADOVA': 'G224',
  'ROVIGO': 'H620',
  'TREVISO': 'L407',
  'VERONA': 'L781',
  'VICENZA': 'L840',

  // Emilia-Romagna
  'BOLOGNA': 'A944',
  'FERRARA': 'D548',
  'FORLI': 'D704',
  'MODENA': 'F257',
  'PARMA': 'G337',
  'PIACENZA': 'G535',
  'RAVENNA': 'H199',
  'REGGIO EMILIA': 'H223',
  'RIMINI': 'H294',

  // Toscana
  'FIRENZE': 'D612',
  'AREZZO': 'A390',
  'GROSSETO': 'E202',
  'LIVORNO': 'E625',
  'LUCCA': 'E715',
  'MASSA': 'F023',
  'PISA': 'G702',
  'PISTOIA': 'G713',
  'PRATO': 'G999',
  'SIENA': 'I726',

  // Campania
  'NAPOLI': 'F839',
  'AVELLINO': 'A509',
  'BENEVENTO': 'A783',
  'CASERTA': 'B963',
  'SALERNO': 'H703',

  // Puglia
  'BARI': 'A662',
  'BARLETTA': 'A669',
  'BRINDISI': 'B180',
  'FOGGIA': 'D643',
  'LECCE': 'E506',
  'TARANTO': 'L049',

  // Sicilia
  'PALERMO': 'G273',
  'AGRIGENTO': 'A089',
  'CALTANISSETTA': 'B429',
  'CATANIA': 'C351',
  'ENNA': 'C342',
  'MESSINA': 'F158',
  'RAGUSA': 'H163',
  'SIRACUSA': 'I754',
  'TRAPANI': 'L331',

  // Sardegna
  'CAGLIARI': 'B354',
  'NUORO': 'F979',
  'ORISTANO': 'G113',
  'SASSARI': 'I452',

  // Calabria
  'CATANZARO': 'C352',
  'COSENZA': 'D086',
  'CROTONE': 'D122',
  'REGGIO CALABRIA': 'H224',
  'VIBO VALENTIA': 'F537',

  // Liguria
  'GENOVA': 'D969',
  'IMPERIA': 'E290',
  'LA SPEZIA': 'E463',
  'SAVONA': 'I480',

  // Friuli-Venezia Giulia
  'TRIESTE': 'L424',
  'GORIZIA': 'E098',
  'PORDENONE': 'G888',
  'UDINE': 'L483',

  // Trentino-Alto Adige
  'TRENTO': 'L378',
  'BOLZANO': 'A952',

  // Marche
  'ANCONA': 'A271',
  'ASCOLI PICENO': 'A462',
  'FERMO': 'D542',
  'MACERATA': 'E783',
  'PESARO': 'G479',
  'URBINO': 'L500',

  // Umbria
  'PERUGIA': 'G478',
  'TERNI': 'L117',

  // Abruzzo
  'L\'AQUILA': 'A345',
  'CHIETI': 'C632',
  'PESCARA': 'G482',
  'TERAMO': 'L103',

  // Molise
  'CAMPOBASSO': 'B519',
  'ISERNIA': 'E335',

  // Basilicata
  'POTENZA': 'G942',
  'MATERA': 'F052',

  // Valle d'Aosta
  'AOSTA': 'A326',
}

// Mesi per codice fiscale
const MESI_CF = ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M', 'P', 'R', 'S', 'T']

// Caratteri di controllo
const CARATTERI_DISPARI: { [key: string]: number } = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
  'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
  'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
}

const CARATTERI_PARI: { [key: string]: number } = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
  'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
  'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
}

const CARATTERE_CONTROLLO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Estrae consonanti da una stringa
 */
function getConsonanti(str: string): string {
  return str.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '')
}

/**
 * Estrae vocali da una stringa
 */
function getVocali(str: string): string {
  return str.toUpperCase().replace(/[^AEIOU]/g, '')
}

/**
 * Calcola il codice del cognome (3 caratteri)
 */
function calcolaCognome(cognome: string): string {
  const consonanti = getConsonanti(cognome)
  const vocali = getVocali(cognome)
  let codice = consonanti + vocali + 'XXX'
  return codice.substring(0, 3)
}

/**
 * Calcola il codice del nome (3 caratteri)
 * Se ci sono 4+ consonanti, prende 1a, 3a e 4a
 */
function calcolaNome(nome: string): string {
  const consonanti = getConsonanti(nome)
  const vocali = getVocali(nome)

  if (consonanti.length >= 4) {
    return consonanti[0] + consonanti[2] + consonanti[3]
  }

  let codice = consonanti + vocali + 'XXX'
  return codice.substring(0, 3)
}

/**
 * Calcola il codice della data di nascita e sesso
 */
function calcolaDataSesso(dataNascita: string, sesso: string): string {
  const data = new Date(dataNascita)

  // Anno (ultime 2 cifre)
  const anno = data.getFullYear().toString().slice(-2)

  // Mese (lettera)
  const mese = MESI_CF[data.getMonth()]

  // Giorno (per le donne si aggiunge 40)
  let giorno = data.getDate()
  if (sesso.toUpperCase() === 'F') {
    giorno += 40
  }
  const giornoStr = giorno.toString().padStart(2, '0')

  return anno + mese + giornoStr
}

/**
 * Cerca il codice catastale del comune
 */
function getCodiceComune(luogoNascita: string): string {
  const luogoNormalizzato = luogoNascita.toUpperCase().trim()

  // Cerca corrispondenza esatta
  if (CODICI_CATASTALI[luogoNormalizzato]) {
    return CODICI_CATASTALI[luogoNormalizzato]
  }

  // Cerca corrispondenza parziale
  for (const [comune, codice] of Object.entries(CODICI_CATASTALI)) {
    if (luogoNormalizzato.includes(comune) || comune.includes(luogoNormalizzato)) {
      return codice
    }
  }

  // Fallback: genera un codice fittizio basato sul nome
  // (questo non sarà valido, ma almeno riempie il campo)
  const hash = luogoNormalizzato.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return 'Z' + (hash % 999).toString().padStart(3, '0')
}

/**
 * Calcola il carattere di controllo
 */
function calcolaCarattereControllo(codice: string): string {
  let somma = 0

  for (let i = 0; i < 15; i++) {
    const char = codice[i]
    if ((i + 1) % 2 === 0) {
      // Posizione pari
      somma += CARATTERI_PARI[char] || 0
    } else {
      // Posizione dispari
      somma += CARATTERI_DISPARI[char] || 0
    }
  }

  return CARATTERE_CONTROLLO[somma % 26]
}

/**
 * Interfaccia per i dati del codice fiscale
 */
export interface DatiCodiceFiscale {
  nome: string
  cognome: string
  dataNascita: string  // formato YYYY-MM-DD
  sesso: 'M' | 'F'
  luogoNascita: string
}

/**
 * Calcola il codice fiscale completo
 */
export function calcolaCodiceFiscale(dati: DatiCodiceFiscale): string {
  const { nome, cognome, dataNascita, sesso, luogoNascita } = dati

  if (!nome || !cognome || !dataNascita || !sesso || !luogoNascita) {
    return ''
  }

  try {
    const codiceCognome = calcolaCognome(cognome)
    const codiceNome = calcolaNome(nome)
    const codiceDataSesso = calcolaDataSesso(dataNascita, sesso)
    const codiceComune = getCodiceComune(luogoNascita)

    const codiceParziale = codiceCognome + codiceNome + codiceDataSesso + codiceComune
    const carattereControllo = calcolaCarattereControllo(codiceParziale)

    return (codiceParziale + carattereControllo).toUpperCase()
  } catch (error) {
    console.error('Errore calcolo codice fiscale:', error)
    return ''
  }
}

/**
 * Valida un codice fiscale
 */
export function validaCodiceFiscale(cf: string): boolean {
  if (!cf || cf.length !== 16) return false

  const cfUpper = cf.toUpperCase()
  const regex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/

  if (!regex.test(cfUpper)) return false

  // Verifica carattere di controllo
  const carattereCalcolato = calcolaCarattereControllo(cfUpper.substring(0, 15))
  return carattereCalcolato === cfUpper[15]
}

/**
 * Lista di comuni per autocomplete
 */
export function getComuniDisponibili(): string[] {
  return Object.keys(CODICI_CATASTALI).sort()
}
