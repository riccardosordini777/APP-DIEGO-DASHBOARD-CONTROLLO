/// <reference lib="webworker" />
import * as XLSX from 'xlsx'
import Decimal from 'decimal.js'
import { SCHEMAS, detectModuleFromFilename, type FieldType } from '../lib/schemas'
import { buildHeaderMap } from '../lib/mapper'
import type { ModuleId, ParsedColumns, FieldTypeMap, ColumnArray } from '../store/useDashboardStore'

// === Sanitize con error tracking ==================================================

interface NumericParseResult { value: number; error?: string; decimalValue?: Decimal }

function safeParseNumber(val: unknown): NumericParseResult {
  if (typeof val === 'number') {
    try {
      const d = new Decimal(val)
      return d.isFinite() ? { value: val, decimalValue: d } : { value: 0, error: 'numero non finito' }
    } catch {
      return { value: 0, error: 'numero non finito' }
    }
  }
  if (val === null || val === undefined || val === '') return { value: 0, decimalValue: new Decimal(0) }
  const s = String(val).trim()
  if (!s) return { value: 0, decimalValue: new Decimal(0) }
  const cleaned = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-eE]/g, '')
    : s.replace(/[^0-9.\-eE]/g, '')
  try {
    const d = new Decimal(cleaned)
    return d.isFinite() ? { value: d.toNumber(), decimalValue: d } : { value: 0, error: `"${s}" non è numero valido` }
  } catch {
    return { value: 0, error: `"${s}" non è numero valido` }
  }
}

function safeParseDateMs(val: unknown): NumericParseResult {
  if (val === null || val === undefined || val === '') return { value: NaN }
  if (typeof val === 'number' && val > 1) {
    const ms = (val - 25569) * 86400 * 1000
    return isFinite(ms) ? { value: ms } : { value: NaN, error: 'numero Excel data invalido' }
  }
  const s = String(val).trim()
  if (!s) return { value: NaN }
  let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s) || /^(\d{2})-(\d{2})-(\d{4})$/.exec(s)
  if (match) {
    const [, d, m, y] = match
    const ms = new Date(`${y}-${m}-${d}T00:00:00`).getTime()
    return isNaN(ms) ? { value: NaN, error: `data invalida: ${s}` } : { value: ms }
  }
  const ms = new Date(s).getTime()
  return isNaN(ms) ? { value: NaN, error: `formato data sconosciuto: ${s}` } : { value: ms }
}

function safeParseYesNo(val: unknown): NumericParseResult {
  if (val === null || val === undefined || val === '') return { value: 0 }
  const s = String(val).trim().toUpperCase()
  if (['SI', 'SÌ', 'YES', 'Y', '1', 'TRUE', 'S'].includes(s)) return { value: 1 }
  if (['NO', 'N', '0', 'FALSE'].includes(s)) return { value: 0 }
  return { value: 0, error: `valore yes_no sconosciuto: ${s}` }
}

function findHeaderRow(raw: unknown[][]): number {
  for (let i = 0; i < Math.min(20, raw.length); i++) {
    const nonEmpty = (raw[i] as unknown[]).filter(
      (c) => c !== '' && c !== null && c !== undefined,
    )
    if (nonEmpty.length >= 3) return i
  }
  return -1
}

function allocateColumn(type: FieldType | undefined, n: number): ColumnArray {
  switch (type) {
    case 'number':
    case 'currency':
    case 'percent':
    case 'date':
      return new Float64Array(n)
    case 'yes_no':
      return new Uint8Array(n)
    default:
      return new Array<string>(n)
  }
}

function fillColumn(
  col: ColumnArray,
  idx: number,
  value: unknown,
  type: FieldType | undefined,
): string | undefined {
  if (col instanceof Float64Array) {
    if (type === 'date') {
      const r = safeParseDateMs(value)
      col[idx] = r.value
      return r.error
    } else if (type === 'percent') {
      const r = safeParseNumber(value)
      if (r.error) return r.error
      // Valida che il percentuale sia 0-100 (o 0-1 se normalizzato)
      const normalized = r.decimalValue!.greaterThan(1) ? r.decimalValue!.dividedBy(100) : r.decimalValue!
      if (normalized.isNegative()) return 'percentuale negativa'
      col[idx] = normalized.toNumber()
      return undefined
    } else {
      const r = safeParseNumber(value)
      if (r.error) return r.error
      // Valida che importi finanziari non siano negativi (tranne per specifici campi)
      if (type === 'currency' && r.decimalValue!.isNegative()) return 'importo negativo'
      col[idx] = r.value
      return undefined
    }
  } else if (col instanceof Uint8Array) {
    const r = safeParseYesNo(value)
    col[idx] = r.value
    return r.error
  } else {
    ;(col as string[])[idx] =
      value !== null && value !== undefined ? String(value).trim() : ''
    return undefined
  }
}

// === Result types ==================================================================

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
}

export interface ParseErrorResult {
  success: false
  error: string
  filename: string
}

export type ParseResult = ParseSuccess | ParseErrorResult

// === Parser specializzato NA302 ====================================================

function parseNA302(workbook: XLSX.WorkBook, filename: string): ParseResult {
  const sheetName =
    workbook.SheetNames.find((s) => s.toLowerCase().includes('punti vendita')) ??
    workbook.SheetNames[0]
  const ws = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][]

  // O(n) pivot via Map invece di rows.find() O(n²)
  const pvMap = new Map<string, { premi: number; ap: number }>()
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
    const premioVal =
      typeof row[totaleColIdx] === 'number' ? (row[totaleColIdx] as number) : 0

    // "Portafoglio Fine Anno" = AC (anno corrente), "Portafoglio Fine Anno Prec." = AP
    const isAC = cell1 === 'Portafoglio AC' || cell1 === 'Portafoglio Fine Anno'
    const isAP = cell1 === 'Portafoglio AP' || cell1 === 'Portafoglio Fine Anno Prec.' || cell1 === 'Portafoglio Fine Anno Prec'
    if (isAC) {
      const existing = pvMap.get(currentPV)
      if (existing) existing.premi = premioVal
      else pvMap.set(currentPV, { premi: premioVal, ap: 0 })
    } else if (isAP) {
      const existing = pvMap.get(currentPV)
      if (existing) existing.ap = premioVal
      else pvMap.set(currentPV, { premi: 0, ap: premioVal })
    }
  }

  const n = pvMap.size
  const pvCol: string[] = new Array(n)
  const premiCol = new Float64Array(n)
  const apCol = new Float64Array(n)
  let i = 0
  for (const [pv, d] of pvMap) {
    pvCol[i] = pv
    premiCol[i] = d.premi
    apCol[i] = d.ap
    i++
  }

  // Validazione NA302
  const errors: ValidationError[] = []
  for (let i = 0; i < n; i++) {
    if (!pvCol[i] || !pvCol[i].trim()) {
      errors.push({ row: i + 1, field: 'pv', rawValue: pvCol[i], reason: 'PV vuoto' })
    }
    if (premiCol[i] < 0) {
      errors.push({ row: i + 1, field: 'premi', rawValue: premiCol[i], reason: 'premio AC negativo' })
    }
    if (apCol[i] < 0) {
      errors.push({ row: i + 1, field: 'annioPrecedente', rawValue: apCol[i], reason: 'premio AP negativo' })
    }
  }

  return {
    success: true,
    moduleId: 'na302',
    columns: { pv: pvCol, premi: premiCol, annioPrecedente: apCol },
    fieldTypes: { pv: 'string', premi: 'currency', annioPrecedente: 'currency' },
    rowCount: n,
    columnCount: 3,
    filename,
    loadedAt: Date.now(),
    errors,
  }
}

// === Parser generico SI014 / NA013 / NA108 =========================================

function parseGeneric(
  moduleId: ModuleId,
  workbook: XLSX.WorkBook,
  filename: string,
): ParseResult {
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

  const headers = (raw[headerRowIdx] as unknown[]).map((h) =>
    String(h ?? '').trim(),
  )
  const headerMap = buildHeaderMap(headers, schema)

  // Filtra righe con almeno 3 valori non vuoti (rimuove footer/totali/blank)
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

  // Alloca colonne tipizzate per ogni field dello schema
  const columns: ParsedColumns = {}
  const fieldTypes: FieldTypeMap = {}
  for (const [fieldName, colSchema] of Object.entries(schema.columns)) {
    columns[fieldName] = allocateColumn(colSchema.type, n)
    fieldTypes[fieldName] = colSchema.type ?? 'string'
  }

  // Pre-calcola indici header → field per evitare lookup ripetuti
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

  // Hot loop: popola colonne + error tracking
  const errors: ValidationError[] = []
  for (let r = 0; r < n; r++) {
    const row = dataRows[r] as unknown[]
    for (const { field, idx, type } of fieldHeaderIdx) {
      const err = fillColumn(columns[field], r, row[idx], type)
      if (err) errors.push({ row: headerRowIdx + r + 1, field, rawValue: row[idx], reason: err })
    }
  }

  // Validazione business logic: PV non vuoto, importi coerenti
  const pvCol = columns['pv'] as string[]
  const premiCol = columns['premi'] as Float64Array | undefined
  const polizzeCol = columns['polizze'] as Float64Array | undefined
  for (let r = 0; r < n; r++) {
    if (!pvCol[r] || !pvCol[r].trim()) {
      errors.push({ row: headerRowIdx + r + 1, field: 'pv', rawValue: pvCol[r], reason: 'PV vuoto' })
    }
    if (premiCol && new Decimal(premiCol[r]).isNegative()) {
      errors.push({ row: headerRowIdx + r + 1, field: 'premi', rawValue: premiCol[r], reason: 'premio negativo' })
    }
    if (polizzeCol && new Decimal(polizzeCol[r]).lessThan(1)) {
      errors.push({ row: headerRowIdx + r + 1, field: 'polizze', rawValue: polizzeCol[r], reason: 'polizze < 1' })
    }
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
  }
}

// === Worker message handler ========================================================

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.onmessage = (e: MessageEvent<{ buffer: ArrayBuffer; filename: string }>) => {
  const { buffer, filename } = e.data
  try {
    const moduleId = detectModuleFromFilename(filename)
    if (!moduleId) {
      const msg: ParseErrorResult = {
        success: false,
        error: `File "${filename}": nome non riconosciuto. Deve contenere SI014, NA013, NA302 o NA108`,
        filename,
      }
      ctx.postMessage(msg)
      return
    }

    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false, raw: true })
    const result =
      moduleId === 'na302'
        ? parseNA302(workbook, filename)
        : parseGeneric(moduleId, workbook, filename)

    // Costruisci transferable list (solo ArrayBuffer dei Typed Arrays)
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
