/// <reference lib="webworker" />
import * as XLSX from 'xlsx'
import Decimal from 'decimal.js'
import { SCHEMAS, detectModuleFromFilename, type FieldType } from '../lib/schemas'
import { buildHeaderMap } from '../lib/mapper'
import { parseItalianCurrency, parseItalianDate, parseYesNo } from '../lib/sanitize'
import type { ModuleId, ParsedColumns, FieldTypeMap, ColumnArray } from '../store/useDashboardStore'

// ============================================================================
// TIPI INTERNI
// ============================================================================

export interface ValidationError {
  row: number
  field: string
  rawValue: unknown
  reason: string
}

export interface ParseSuccess {
  success: true
  moduleId: ModuleId
  columns: ParsedColumns
  fieldTypes: FieldTypeMap
  rowCount: number
  columnCount: number
  filename: string
  loadedAt: number
  errors: ValidationError[]
  checksums: { fileHash: string; rowCount: number; sumPremi?: string } // Per riconciliazione
}

export interface ParseErrorResult {
  success: false
  error: string
  filename: string
}

export type ParseResult = ParseSuccess | ParseErrorResult

// ============================================================================
// PARSING FINANZA — Tolleranza Zero a Errori Floating-Point
// ============================================================================

/**
 * Alloca array tipizzato per una colonna in base al tipo di dato.
 *
 * CRITICO: currency e numero usano Float64Array (non Float32Array!)
 * perché Float32 non ha precisione sufficiente per importi europei.
 */
function allocateColumn(type: FieldType | undefined, n: number): ColumnArray {
  switch (type) {
    case 'number':
    case 'currency':
    case 'percent':
    case 'date':
      return new Float64Array(n) // 64-bit per precisione finanza
    case 'yes_no':
      return new Uint8Array(n)
    default:
      return new Array<string>(n)
  }
}

/**
 * fillColumn: Scrive un valore in una colonna tipizzata, con gestione errori.
 *
 * Logica per tipo:
 *   currency: parseItalianCurrency() → Decimal validation → Float64Array
 *   number: parseFloat raw → Decimal validation
 *   date: parseItalianDate() → milliseconds
 *   yes_no: 0 | 1 | 255 (marker "ignoto")
 *   string: trim e salva
 *
 * Se errore: ritorna messaggio di errore, scrive 0 nella colonna per continuare parsing.
 */
function fillColumn(
  col: ColumnArray,
  idx: number,
  value: unknown,
  type: FieldType | undefined,
): string | undefined {
  try {
    if (col instanceof Float64Array) {
      if (type === 'currency') {
        // CRITTICO: Usa parseItalianCurrency (Decimal-safe) per TUTTE le valute
        const numVal = parseItalianCurrency(value)
        col[idx] = numVal
        return undefined
      } else if (type === 'date') {
        const ms = parseItalianDate(value)
        col[idx] = ms
        return isNaN(ms) ? `data non riconosciuta: ${value}` : undefined
      } else if (type === 'percent') {
        const numVal = parseItalianCurrency(value) // Percentuali in formato monetario (p.es. "5,50")
        const normalized = numVal > 1 ? numVal / 100 : numVal
        if (new Decimal(normalized).isNegative()) {
          col[idx] = 0
          return 'percentuale negativa'
        }
        col[idx] = normalized
        return undefined
      } else {
        // number generico
        const numVal = parseItalianCurrency(value)
        col[idx] = numVal
        return undefined
      }
    } else if (col instanceof Uint8Array) {
      col[idx] = parseYesNo(value)
      return undefined
    } else {
      // String array
      ;(col as string[])[idx] = value !== null && value !== undefined ? String(value).trim() : ''
      return undefined
    }
  } catch (err) {
    if (col instanceof Float64Array) {
      (col as Float64Array)[idx] = 0
    } else if (col instanceof Uint8Array) {
      (col as Uint8Array)[idx] = 0
    } else {
      (col as string[])[idx] = ''
    }
    return `eccezione interno: ${err}`
  }
}

/**
 * Calcola un checksum semplice della lista di righe per riconciliazione.
 * Serve per verificare che i dati nell'app corrispondano al file caricato.
 */
function calculateChecksum(columns: ParsedColumns, moduleId: ModuleId): string {
  const pvCol = columns['pv'] as string[] | undefined
  if (!pvCol) return 'N/A'

  let sum = 0
  for (let i = 0; i < pvCol.length; i++) {
    for (let j = 0; j < pvCol[i].length; j++) {
      sum += pvCol[i].charCodeAt(j)
    }
  }
  return `${moduleId}:${sum}`
}

/**
 * Valida totali finanziari per coerenza.
 * Es: Sum(premi) in file non dovrebbe essere palesemente sbagliato.
 */
function validateFinancialIntegrity(
  columns: ParsedColumns,
  moduleId: ModuleId,
): Array<{ field: string; issue: string }> {
  const issues: Array<{ field: string; issue: string }> = []

  // Controlla colonne critiche
  const premiCol = columns['premi'] as Float64Array | undefined
  if (premiCol) {
    let sum = new Decimal(0)
    for (let i = 0; i < premiCol.length; i++) {
      sum = sum.plus(premiCol[i])
    }
    if (sum.isNegative()) {
      issues.push({ field: 'premi', issue: 'somma totale premi negativa' })
    }
  }

  const incassoCol = columns['incasso'] as Float64Array | undefined
  if (incassoCol) {
    let sum = new Decimal(0)
    for (let i = 0; i < incassoCol.length; i++) {
      sum = sum.plus(incassoCol[i])
    }
    if (sum.isNegative()) {
      issues.push({ field: 'incasso', issue: 'somma totale incassi negativa' })
    }
  }

  return issues
}

/**
 * Trova la riga di header nel foglio Excel.
 * Cerca la prima riga con almeno 3 celle non vuote.
 */
function findHeaderRow(raw: unknown[][]): number {
  for (let i = 0; i < Math.min(20, raw.length); i++) {
    const nonEmpty = (raw[i] as unknown[]).filter(
      (c) => c !== '' && c !== null && c !== undefined,
    )
    if (nonEmpty.length >= 3) return i
  }
  return -1
}

// ============================================================================
// PARSER SPECIALIZZATO — NA302 (Cruscotto Agenzia)
// ============================================================================

function parseNA302(workbook: XLSX.WorkBook, filename: string): ParseResult {
  // NA302 ha struttura particolare: blocchi per PV
  const sheetName =
    workbook.SheetNames.find((s) => s.toLowerCase().includes('punti vendita')) ??
    workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][]

  const pvMap = new Map<string, { premi: Decimal; ap: Decimal }>()
  let currentPV = ''
  let totaleColIdx = -1

  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as unknown[]
    const cell1 = String(row[1] ?? '').trim()

    if (cell1.startsWith('Punto Vendita:')) {
      currentPV = cell1.replace('Punto Vendita:', '').trim()
      totaleColIdx = -1
      continue
    }

    if (cell1 === 'RAMI DANNI') {
      for (let j = 5; j < row.length; j++) {
        if (String(row[j]).trim() === 'TOTALE') {
          totaleColIdx = j
          break
        }
      }
      continue
    }

    if (!currentPV || totaleColIdx < 0) continue

    const premioVal = parseItalianCurrency(row[totaleColIdx])

    if (cell1 === 'Portafoglio AC') {
      const existing = pvMap.get(currentPV)
      if (existing) existing.premi = new Decimal(premioVal)
      else pvMap.set(currentPV, { premi: new Decimal(premioVal), ap: new Decimal(0) })
    } else if (cell1 === 'Portafoglio AP') {
      const existing = pvMap.get(currentPV)
      if (existing) existing.ap = new Decimal(premioVal)
      else pvMap.set(currentPV, { premi: new Decimal(0), ap: new Decimal(premioVal) })
    }
  }

  const n = pvMap.size
  const pvCol: string[] = new Array(n)
  const premiCol = new Float64Array(n)
  const apCol = new Float64Array(n)
  let i = 0
  for (const [pv, d] of pvMap) {
    pvCol[i] = pv
    premiCol[i] = d.premi.toNumber()
    apCol[i] = d.ap.toNumber()
    i++
  }

  const columns = { pv: pvCol, premi: premiCol, annioPrecedente: apCol }
  const integrityIssues = validateFinancialIntegrity(columns, 'na302')

  return {
    success: true,
    moduleId: 'na302',
    columns,
    fieldTypes: { pv: 'string', premi: 'currency', annioPrecedente: 'currency' },
    rowCount: n,
    columnCount: 3,
    filename,
    loadedAt: Date.now(),
    errors: integrityIssues.map((issue) => ({
      row: 0,
      field: issue.field,
      rawValue: null,
      reason: issue.issue,
    })),
    checksums: {
      fileHash: calculateChecksum(columns, 'na302'),
      rowCount: n,
      sumPremi: (premiCol.reduce((a, b) => a + b, 0) as number).toString(),
    },
  }
}

// ============================================================================
// PARSER GENERICO — SI014 / NA013 / NA108
// ============================================================================

function parseGeneric(moduleId: ModuleId, workbook: XLSX.WorkBook, filename: string): ParseResult {
  const schema = SCHEMAS[moduleId]
  const sheetName = workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]

  const raw = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][]

  if (raw.length < 2) {
    return {
      success: false,
      error: `File "${filename}": nessun dato trovato (< 2 righe)`,
      filename,
    }
  }

  const headerRowIdx = findHeaderRow(raw)
  if (headerRowIdx < 0) {
    return {
      success: false,
      error: `File "${filename}": impossibile trovare la riga degli header`,
      filename,
    }
  }

  const headers = (raw[headerRowIdx] as unknown[]).map((h) => String(h ?? '').trim())
  const headerMap = buildHeaderMap(headers, schema)

  const dataRows = raw.slice(headerRowIdx + 1).filter((row) => {
    const arr = row as unknown[]
    let count = 0
    for (const v of arr) {
      if (v !== '' && v !== null && v !== undefined) {
        count++
        if (count >= 3) return true
      }
    }
    return false
  })
  const n = dataRows.length

  const columns: ParsedColumns = {}
  const fieldTypes: FieldTypeMap = {}
  for (const [fieldName, colSchema] of Object.entries(schema.columns)) {
    columns[fieldName] = allocateColumn(colSchema.type, n)
    fieldTypes[fieldName] = colSchema.type ?? 'string'
  }

  const fieldHeaderIdx: Array<{ field: string; idx: number; type: FieldType | undefined }> = []
  for (const [fieldName, headerKey] of Object.entries(headerMap)) {
    const idx = headers.indexOf(headerKey)
    if (idx >= 0) {
      fieldHeaderIdx.push({
        field: fieldName,
        idx,
        type: schema.columns[fieldName].type,
      })
    }
  }

  // === Hot Loop: Parsing + Error Tracking ===
  const errors: ValidationError[] = []
  for (let r = 0; r < n; r++) {
    const row = dataRows[r] as unknown[]
    for (const { field, idx, type } of fieldHeaderIdx) {
      const err = fillColumn(columns[field], r, row[idx], type)
      if (err) {
        errors.push({
          row: headerRowIdx + r + 1,
          field,
          rawValue: row[idx],
          reason: err,
        })
      }
    }
  }

  // === Validazione Business Logic ===
  const pvCol = columns['pv'] as string[]
  for (let r = 0; r < n; r++) {
    if (!pvCol[r] || !pvCol[r].trim()) {
      errors.push({
        row: headerRowIdx + r + 1,
        field: 'pv',
        rawValue: pvCol[r],
        reason: 'PV vuoto',
      })
    }
  }

  // === Validazione Integrità Finanziaria ===
  const integrityIssues = validateFinancialIntegrity(columns, moduleId)
  for (const issue of integrityIssues) {
    errors.push({
      row: 0,
      field: issue.field,
      rawValue: null,
      reason: issue.issue,
    })
  }

  return {
    success: true,
    moduleId,
    columns,
    fieldTypes,
    rowCount: n,
    columnCount: headers.length,
    filename,
    loadedAt: Date.now(),
    errors,
    checksums: {
      fileHash: calculateChecksum(columns, moduleId),
      rowCount: n,
    },
  }
}

// ============================================================================
// WORKER MESSAGE HANDLER
// ============================================================================

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = (e: MessageEvent<{ buffer: ArrayBuffer; filename: string }>) => {
  const { buffer, filename } = e.data
  try {
    const moduleId = detectModuleFromFilename(filename)
    if (!moduleId) {
      ctx.postMessage({
        success: false,
        error: `File "${filename}": nome non riconosciuto. Deve contenere SI014, NA013, NA302 o NA108`,
        filename,
      } as ParseErrorResult)
      return
    }

    // === Opzioni SheetJS Ottimizzate ===
    // cellStyles: false → scarta metadata visivi (colori, font)
    // cellNF: false → scarta number format strings
    // cellDates: true → riconosci automaticamente date Excel
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellStyles: false,
      cellNF: false,
      cellDates: true,
      raw: true,
    })

    const result =
      moduleId === 'na302'
        ? parseNA302(workbook, filename)
        : parseGeneric(moduleId, workbook, filename)

    // === Transferable Objects: Sposta ownership degli array al main thread ===
    const transferable: Transferable[] = []
    if (result.success) {
      for (const col of Object.values(result.columns)) {
        if (col instanceof Float64Array || col instanceof Uint8Array) {
          transferable.push(col.buffer as Transferable)
        }
      }
    }

    ctx.postMessage(result, transferable)
  } catch (err) {
    const msg: ParseErrorResult = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      filename,
    }
    ctx.postMessage(msg)
  }
}
