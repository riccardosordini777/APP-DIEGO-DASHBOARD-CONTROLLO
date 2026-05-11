import * as aq from 'arquero'
import type { ModuleId, ParsedColumns, GlobalFilters } from '../store/useDashboardStore'

/**
 * Data engine in-memory basato su Arquero.
 * Costruisce ColumnTable dalle colonne tipizzate del worker (zero copy quando possibile).
 * Espone query KPI veloci (<10ms su 50k righe) con filtri globali applicati.
 *
 * Tables cache: una per ModuleId, ricostruita al setParsedModule.
 */

// Cache delle tabelle Arquero — chiave: moduleId
const tables: Map<ModuleId, aq.ColumnTable> = new Map()

/**
 * Costruisce o aggiorna la tabella Arquero per un modulo.
 * Le Float64Array vengono convertite in Array per compat con Arquero
 * (op.sum/op.mean lavorano comunque su Typed Arrays via wrapping interno).
 */
export function buildTable(moduleId: ModuleId, columns: ParsedColumns) {
  // Arquero accetta Record<string, ArrayLike<unknown>> direttamente
  const t = aq.table(columns as Record<string, ArrayLike<unknown>>)
  tables.set(moduleId, t)
}

export function getTable(moduleId: ModuleId): aq.ColumnTable | undefined {
  return tables.get(moduleId)
}

export function clearTable(moduleId: ModuleId) {
  tables.delete(moduleId)
}

export function clearAllTables() {
  tables.clear()
}

// === Filtri globali ===============================================================

/**
 * Applica i filtri globali a una tabella.
 * Se un filtro è 'Tutti' viene saltato.
 * Period è gestito separatamente (richiede una colonna data).
 */
export function applyGlobalFilters(
  t: aq.ColumnTable,
  f: GlobalFilters,
): aq.ColumnTable {
  let q = t
  const fields = q.columnNames()

  if (f.pv !== 'Tutti' && fields.includes('pv')) {
    q = q.params({ pv: f.pv }).filter((d: Record<string, unknown>, $: Record<string, unknown>) => d.pv === $.pv)
  }
  if (f.produttore !== 'Tutti' && fields.includes('produttore')) {
    q = q.params({ produttore: f.produttore }).filter((d: Record<string, unknown>, $: Record<string, unknown>) => d.produttore === $.produttore)
  }
  if (f.ramo !== 'Tutti' && fields.includes('ramo')) {
    q = q.params({ ramo: f.ramo }).filter((d: Record<string, unknown>, $: Record<string, unknown>) => d.ramo === $.ramo)
  }

  return q
}

// === Distinct helpers per popolare i dropdown filtro ==============================

export function getDistinctValues(moduleId: ModuleId, field: string): string[] {
  const t = tables.get(moduleId)
  if (!t || !t.columnNames().includes(field)) return []
  const values = new Set<string>()
  // Su una tabella non filtrata .column().get() è sicuro,
  // ma per coerenza usiamo l'API che rispetta sempre i filtri
  const rows = t.objects() as Array<Record<string, unknown>>
  for (const r of rows) {
    const v = r[field]
    if (v !== null && v !== undefined && v !== '') {
      values.add(String(v))
    }
  }
  return Array.from(values).sort()
}

/**
 * Unisce le PV viste in tutti i moduli caricati (per popolare il dropdown filtro globale).
 */
export function getAllDistinctPV(): string[] {
  const all = new Set<string>()
  for (const moduleId of tables.keys()) {
    for (const pv of getDistinctValues(moduleId, 'pv')) all.add(pv)
  }
  return Array.from(all).sort()
}

export function getAllDistinctProduttore(): string[] {
  const all = new Set<string>()
  for (const moduleId of tables.keys()) {
    for (const p of getDistinctValues(moduleId, 'produttore')) all.add(p)
  }
  return Array.from(all).sort()
}

export function getAllDistinctRamo(): string[] {
  const all = new Set<string>()
  for (const moduleId of tables.keys()) {
    for (const r of getDistinctValues(moduleId, 'ramo')) all.add(r)
  }
  return Array.from(all).sort()
}

// === Query KPI per modulo =========================================================

export interface IncassiKPI {
  totalePremiLordi: number
  totaleProvvigioni: number
  countTitoli: number
  countScaduti: number
  importoScaduto: number
}

/**
 * Calcola KPI incassi dal modulo NA013 applicando i filtri globali.
 * Restituisce null se NA013 non è caricato.
 */
export function queryIncassiKPI(filters: GlobalFilters): IncassiKPI | null {
  const t = tables.get('na013')
  if (!t) return null

  const q = applyGlobalFilters(t, filters)
  if (q.numRows() === 0) {
    return { totalePremiLordi: 0, totaleProvvigioni: 0, countTitoli: 0, countScaduti: 0, importoScaduto: 0 }
  }

  const now = Date.now()
  const fields = q.columnNames()

  const agg = q
    .rollup({
      totalePremiLordi: fields.includes('premioLordo')
        ? aq.op.sum('premioLordo')
        : aq.op.count(),
      totaleProvvigioni: fields.includes('provvigioni')
        ? aq.op.sum('provvigioni')
        : aq.op.count(),
      countTitoli: aq.op.count(),
    })
    .object() as { totalePremiLordi: number; totaleProvvigioni: number; countTitoli: number }

  // Conta titoli scaduti (scadenza < oggi && incasso vuoto/null)
  let countScaduti = 0
  let importoScaduto = 0
  if (fields.includes('scadenza')) {
    // .objects() rispetta i filtri; .column().get() no
    const rows = q.objects() as Array<Record<string, unknown>>
    for (const r of rows) {
      const scad = r.scadenza
      if (typeof scad !== 'number' || !isFinite(scad)) continue
      if (scad >= now) continue
      const inc = r.incasso
      const isUnpaid =
        inc === null ||
        inc === undefined ||
        inc === '' ||
        (typeof inc === 'number' && !isFinite(inc))
      if (isUnpaid) {
        countScaduti++
        const p = r.premioLordo
        if (typeof p === 'number' && isFinite(p)) importoScaduto += p
      }
    }
  }

  return {
    totalePremiLordi: agg.totalePremiLordi || 0,
    totaleProvvigioni: agg.totaleProvvigioni || 0,
    countTitoli: agg.countTitoli || 0,
    countScaduti,
    importoScaduto,
  }
}

export interface ProduzioneKPI {
  totalePremi: number
  countRighe: number
  countClienti: number
}

export function queryProduzioneKPI(filters: GlobalFilters): ProduzioneKPI | null {
  const t = tables.get('na108')
  if (!t) return null

  const q = applyGlobalFilters(t, filters)
  if (q.numRows() === 0) {
    return { totalePremi: 0, countRighe: 0, countClienti: 0 }
  }
  const fields = q.columnNames()

  const agg = q
    .rollup({
      totalePremi: fields.includes('premi') ? aq.op.sum('premi') : aq.op.count(),
      countRighe: aq.op.count(),
      countClienti: fields.includes('cliente') ? aq.op.distinct('cliente') : aq.op.count(),
    })
    .object() as { totalePremi: number; countRighe: number; countClienti: number }

  return {
    totalePremi: agg.totalePremi || 0,
    countRighe: agg.countRighe || 0,
    countClienti: agg.countClienti || 0,
  }
}

export interface CanalizzazioneKPI {
  totale: number
  canalizzati: number
  nonCanalizzati: number
  percentuale: number
}

export function queryCanalizzazioneKPI(
  filters: GlobalFilters,
): CanalizzazioneKPI | null {
  const t = tables.get('si014')
  if (!t) return null

  const q = applyGlobalFilters(t, filters)
  const nRows = q.numRows()
  if (nRows === 0) {
    return { totale: 0, canalizzati: 0, nonCanalizzati: 0, percentuale: 0 }
  }

  const fields = q.columnNames()
  if (!fields.includes('canalizzato')) {
    return { totale: nRows, canalizzati: 0, nonCanalizzati: nRows, percentuale: 0 }
  }

  // canalizzato è Uint8Array: 1 = SI, 0 = NO, 255 = unknown
  // .objects() rispetta i filtri
  let si = 0
  let no = 0
  const rows = q.objects() as Array<Record<string, unknown>>
  for (const r of rows) {
    const v = r.canalizzato
    if (v === 1 || v === 'SI') si++
    else if (v === 0 || v === 'NO') no++
  }
  const tot = si + no
  return {
    totale: tot,
    canalizzati: si,
    nonCanalizzati: no,
    percentuale: tot > 0 ? (si / tot) * 100 : 0,
  }
}

export interface PortafoglioKPI {
  totalePremiAC: number
  totalePremiAP: number
  deltaPct: number
  countPV: number
}

export function queryPortafoglioKPI(
  filters: GlobalFilters,
): PortafoglioKPI | null {
  const t = tables.get('na302')
  if (!t) return null

  const q = applyGlobalFilters(t, filters)
  if (q.numRows() === 0) {
    return { totalePremiAC: 0, totalePremiAP: 0, deltaPct: 0, countPV: 0 }
  }

  const agg = q
    .rollup({
      ac: aq.op.sum('premi'),
      ap: aq.op.sum('annioPrecedente'),
      countPV: aq.op.count(),
    })
    .object() as { ac: number; ap: number; countPV: number }

  const ac = agg.ac || 0
  const ap = agg.ap || 0
  return {
    totalePremiAC: ac,
    totalePremiAP: ap,
    deltaPct: ap > 0 ? ((ac - ap) / ap) * 100 : 0,
    countPV: agg.countPV || 0,
  }
}
