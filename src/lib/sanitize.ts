import Decimal from 'decimal.js'

// ============================================================================
// PARSING FINANZIARIO ITALIANO — Tolleranza Zero ai Floating-Point Errors
// ============================================================================

/**
 * parseItalianCurrency: Converte stringhe sporche in valori monetari affidabili.
 *
 * Input accettati:
 *   '1.234.567,89' (formato italiano 100%)
 *   '1234567.89' (formato USA)
 *   '-1.000,50' (negativi)
 *   '€ 1.234,56' (con simboli)
 *   '1,234.56 USD' (formato misto)
 *   1234567.89 (numero nativo JavaScript — ma verrà Decimal-validato)
 *
 * Processo:
 *   1. Intercetta celle corrotte (#N/A, #DIV/0!, testo sporco)
 *   2. Rimuove simboli valuta, spazi, parentesi
 *   3. Distingue formato italiano (1.234,56) da USA (1,234.56) via euristica
 *   4. Normalizza a punto decimale
 *   5. Passa a Decimal per validazione matematica
 *   6. Ritorna Number solo dopo che Decimal garantisce correttezza
 *
 * CRITTICO: Non usare parseFloat() o + unario su monetario. Sempre Decimal.
 */
export function parseItalianCurrency(value: unknown): number {
  // === Caso 1: Cella vuota o null ===
  if (value === null || value === undefined || value === '') {
    return 0
  }

  // === Caso 2: Numero nativo JavaScript ===
  if (typeof value === 'number') {
    // Valida che sia finito (non Infinity, NaN)
    if (!isFinite(value)) {
      console.warn(`[parseItalianCurrency] numero non finito: ${value}`)
      return 0
    }
    // Passa per Decimal per garantire precisione
    try {
      const d = new Decimal(value)
      return d.toNumber()
    } catch {
      console.warn(`[parseItalianCurrency] Decimal fallito su numero: ${value}`)
      return 0
    }
  }

  // === Caso 3: Stringa (il caso più delicato) ===
  const str = String(value).trim()
  if (!str) return 0

  // Intercetta celle di errore Excel
  if (str.startsWith('#')) {
    console.warn(`[parseItalianCurrency] cella Excel errore: ${str}`)
    return 0
  }

  // Controlla se negativo (trattini iniziali O parentesi)
  let isNegative = str.includes('-') || (str.includes('(') && str.includes(')'))

  // Rimuove simboli di valuta e parentesi
  let cleaned = str
    .replace(/[$€£¥]/g, '') // Valute
    .replace(/[()]/g, '') // Parentesi per negativi
    .replace(/\s+/g, '') // Tutti gli spazi
    .replace(/^-/, '') // Trattini iniziali (gestiti come flag isNegative)

  // Se cleaned contiene lettere non numeriche, prova a estrarre solo i numeri
  if (!/^[\d.,]+$/.test(cleaned)) {
    const numMatch = cleaned.match(/[\d.,]+/)
    if (numMatch) {
      cleaned = numMatch[0]
    } else {
      // Nessun numero trovato
      console.warn(`[parseItalianCurrency] nessun numero trovato in: "${str}"`)
      return 0
    }
  }

  // === Euristica: Formato italiano vs USA ===
  // Italiano: ultima virgola è decimale, punti sono separatori migliaia (1.234.567,89)
  // USA: ultimo punto è decimale, virgole sono separatori (1,234,567.89)
  const lastCommaIdx = cleaned.lastIndexOf(',')
  const lastDotIdx = cleaned.lastIndexOf('.')

  let normalized = ''

  if (lastCommaIdx > lastDotIdx) {
    // Formato italiano: 1.234.567,89 o 1.234,56
    // Rimuovi TUTTI i punti (separatori migliaia), sostituisci virgola con punto
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (lastDotIdx > lastCommaIdx) {
    // Formato USA: 1,234,567.89 o 1,234.56
    // Rimuovi TUTTE le virgole (separatori migliaia), punto rimane
    normalized = cleaned.replace(/,/g, '')
  } else {
    // Nessuna virgola né punto: assume stringa pulita tipo "1234567"
    normalized = cleaned
  }

  // Ripristina il segno negativo
  if (isNegative) normalized = '-' + normalized

  // === Validazione Decimal ===
  try {
    const decimal = new Decimal(normalized)

    // Controlla che sia un numero valido
    if (!decimal.isFinite()) {
      console.warn(`[parseItalianCurrency] stringa non convertibile: "${str}" → "${normalized}"`)
      return 0
    }

    // Ritorna Number solo dopo che Decimal ha garantito correttezza matematica
    return decimal.toNumber()
  } catch (err) {
    console.warn(`[parseItalianCurrency] Decimal errore su "${str}": ${err}`)
    return 0
  }
}

/**
 * parseItalianDate: Converte date italiane in timestamp millisecondi.
 *
 * Formati supportati:
 *   '31/12/2024' (DD/MM/YYYY)
 *   '31-12-2024' (DD-MM-YYYY)
 *   numero Excel (giorni dal 1900-01-01)
 *
 * Fallback: stringa non riconosciuta ritorna NaN (distingue da 0 per logica downstream)
 */
export function parseItalianDate(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return NaN
  }

  // Numero Excel (serial date)
  if (typeof value === 'number' && value > 1) {
    const ms = (value - 25569) * 86400 * 1000
    return isFinite(ms) ? ms : NaN
  }

  const str = String(value).trim()
  if (!str) return NaN

  // Formato DD/MM/YYYY
  let match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(str)
  if (match) {
    const [, d, m, y] = match
    const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`)
    const ms = date.getTime()
    return isNaN(ms) ? NaN : ms
  }

  // Formato DD-MM-YYYY
  match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(str)
  if (match) {
    const [, d, m, y] = match
    const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`)
    const ms = date.getTime()
    return isNaN(ms) ? NaN : ms
  }

  // Fallback: prova ISO standard
  const date = new Date(str)
  return isNaN(date.getTime()) ? NaN : date.getTime()
}

/**
 * parseYesNo: Converte booleani italiani a numero (0 = No, 1 = Si).
 *
 * Quando una cella è corrotta o non riconosciuta, ritorna 255 (marker speciale)
 * per distinguere da "genuino zero" o "genuino uno".
 */
export function parseYesNo(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 255 // Marker: "non impostato"
  }

  const str = String(value).trim().toUpperCase()
  if (['SI', 'SÌ', 'YES', 'Y', '1', 'TRUE', 'S'].includes(str)) return 1
  if (['NO', 'N', '0', 'FALSE'].includes(str)) return 0

  // Fallback: cella non riconosciuta
  return 255
}

/**
 * parseNumber: Parsing generico di numeri (usa parseItalianCurrency internamente).
 * Mantenuto per backward compatibility con AnalystDrawer.
 */
export function parseNumber(val: unknown): number {
  return parseItalianCurrency(val)
}

/**
 * col: Seleziona il primo valore non vuoto da una lista di chiavi in un oggetto.
 * Utility per cercare colonne con nomi alternativi.
 *
 * Esempio: col(row, ['Premio', 'Premi', 'ImportoLordo']) → valore della prima chiave esistente
 */
export function col(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim()
  }
  return ''
}
