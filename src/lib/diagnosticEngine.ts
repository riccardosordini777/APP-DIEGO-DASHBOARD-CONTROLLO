import type {
  GlobalFilters,
  DiagnosticMap,
  DiagnosticLevel,
  Diagnostic,
} from '../store/useDashboardStore'
import {
  getTable,
  applyGlobalFilters,
  queryIncassiKPI,
} from './dataEngine'
import { formatCurrency } from './utils'

/**
 * Intelligent Highlighter — evidenzia anomalie senza interrompere Diego.
 *
 * Output: Map<key, Diagnostic> dove la chiave codifica scope/oggetto.
 * Es:
 *   - 'na013:summary:scaduti'          → KPI globale incassi scaduti
 *   - 'si014:row:TERNI:canalizzazione' → riga PV con canalizzazione bassa
 *   - 'na302:row:VITTORIA:delta_ap'    → PV con calo significativo vs anno precedente
 *
 * Approccio: regole di dominio assicurativo + soglie di significatività
 * (NON puro Z-score, per evitare falsi positivi su PV piccole).
 */

// === Soglie di dominio ============================================================

// Incassi scaduti: numero titoli che fa scattare il livello
const SCADUTI_WARNING = 10
const SCADUTI_CRITICAL = 50

// Canalizzazione: solo PV con volume minimo di sinistri
const CANAL_MIN_SINISTRI = 20
const CANAL_SOGLIA_WARNING = 70  // sotto 70% = warning
const CANAL_SOGLIA_CRITICAL = 50 // sotto 50% = critical

// Delta AC vs AP: solo PV con volume premi minimo
const DELTA_MIN_PREMI_AP = 5000
const DELTA_WARNING = -10   // calo > 10% = warning
const DELTA_CRITICAL = -20  // calo > 20% = critical

// === Helpers ======================================================================

function levelFromScaduti(count: number): DiagnosticLevel | null {
  if (count >= SCADUTI_CRITICAL) return 'critical'
  if (count >= SCADUTI_WARNING) return 'warning'
  if (count > 0) return 'info'
  return null
}

function levelFromCanalizzazione(pct: number): DiagnosticLevel | null {
  if (pct < CANAL_SOGLIA_CRITICAL) return 'critical'
  if (pct < CANAL_SOGLIA_WARNING) return 'warning'
  return null
}

function levelFromDeltaAP(deltaPct: number): DiagnosticLevel | null {
  if (deltaPct <= DELTA_CRITICAL) return 'critical'
  if (deltaPct <= DELTA_WARNING) return 'warning'
  return null
}

// === Singole regole ===============================================================

function diagnoseIncassiScaduti(filters: GlobalFilters, map: DiagnosticMap) {
  const kpi = queryIncassiKPI(filters)
  if (!kpi) return
  const level = levelFromScaduti(kpi.countScaduti)
  if (!level) return

  map['na013:summary:scaduti'] = {
    level,
    metric: 'titoli_scaduti',
    value: kpi.countScaduti,
    hint: `${kpi.countScaduti} titoli scaduti senza incasso · ${formatCurrency(
      kpi.importoScaduto,
    )} bloccati`,
  }
}

function diagnoseCanalizzazione(filters: GlobalFilters, map: DiagnosticMap) {
  const t = getTable('si014')
  if (!t) return
  const fields = t.columnNames()
  if (!fields.includes('pv') || !fields.includes('canalizzato')) return

  const filtered = applyGlobalFilters(t, filters)
  if (filtered.numRows() === 0) return

  // Aggrega per PV: conta SI / NO
  const pvStats = new Map<string, { si: number; no: number }>()
  const rows = filtered.objects() as Array<Record<string, unknown>>
  for (const r of rows) {
    const pv = r.pv ? String(r.pv) : ''
    if (!pv) continue
    if (!pvStats.has(pv)) pvStats.set(pv, { si: 0, no: 0 })
    const s = pvStats.get(pv)!
    const c = r.canalizzato
    if (c === 1 || c === 'SI') s.si++
    else if (c === 0 || c === 'NO') s.no++
  }

  for (const [pv, s] of pvStats) {
    const tot = s.si + s.no
    if (tot < CANAL_MIN_SINISTRI) continue
    const pct = (s.si / tot) * 100
    const level = levelFromCanalizzazione(pct)
    if (!level) continue

    map[`si014:row:${pv}:canalizzazione`] = {
      level,
      metric: 'canalizzazione',
      value: pct,
      hint: `${pct.toFixed(1)}% canalizzato su ${tot} sinistri (sotto la soglia ${CANAL_SOGLIA_WARNING}%)`,
    }
  }
}

function diagnoseDeltaAP(filters: GlobalFilters, map: DiagnosticMap) {
  const t = getTable('na302')
  if (!t) return
  const fields = t.columnNames()
  if (
    !fields.includes('pv') ||
    !fields.includes('premi') ||
    !fields.includes('annioPrecedente')
  )
    return

  const filtered = applyGlobalFilters(t, filters)
  if (filtered.numRows() === 0) return

  const rows = filtered.objects() as Array<Record<string, unknown>>
  for (const r of rows) {
    const pv = r.pv ? String(r.pv) : ''
    if (!pv) continue
    const ac = typeof r.premi === 'number' ? r.premi : 0
    const ap = typeof r.annioPrecedente === 'number' ? r.annioPrecedente : 0
    if (ap < DELTA_MIN_PREMI_AP) continue

    const deltaPct = ((ac - ap) / ap) * 100
    const level = levelFromDeltaAP(deltaPct)
    if (!level) continue

    map[`na302:row:${pv}:delta_ap`] = {
      level,
      metric: 'delta_ap',
      value: deltaPct,
      hint: `${deltaPct.toFixed(1)}% vs anno precedente · AP era ${formatCurrency(ap)}`,
    }
  }
}

// === Public API ===================================================================

/**
 * Esegue tutte le regole diagnostiche e ritorna la mappa O(1).
 * I componenti leggono la mappa via store: useDashboardStore(s => s.diagnostics).
 */
export function runDiagnostics(filters: GlobalFilters): DiagnosticMap {
  const map: DiagnosticMap = {}
  diagnoseIncassiScaduti(filters, map)
  diagnoseCanalizzazione(filters, map)
  diagnoseDeltaAP(filters, map)
  return map
}

/**
 * Helper per componenti: ritorna il diagnostic associato a una riga PV.
 * Cerca tra tutti i moduli/metriche per il PV dato.
 */
export function getDiagnosticForPV(
  map: DiagnosticMap,
  moduleId: 'si014' | 'na013' | 'na302' | 'na108',
  pv: string,
): Diagnostic[] {
  const out: Diagnostic[] = []
  const prefix = `${moduleId}:row:${pv}:`
  for (const [key, diag] of Object.entries(map)) {
    if (key.startsWith(prefix)) out.push(diag)
  }
  return out
}

/**
 * Ritorna il diagnostic globale (summary) per un modulo/metrica.
 */
export function getSummaryDiagnostic(
  map: DiagnosticMap,
  moduleId: 'si014' | 'na013' | 'na302' | 'na108',
  metric: string,
): Diagnostic | undefined {
  return map[`${moduleId}:summary:${metric}`]
}

/**
 * Conta diagnostiche per livello (per il badge sull'AnalystDrawer).
 */
export function countByLevel(map: DiagnosticMap): Record<DiagnosticLevel, number> {
  const out: Record<DiagnosticLevel, number> = {
    critical: 0,
    warning: 0,
    info: 0,
    ok: 0,
  }
  for (const d of Object.values(map)) out[d.level]++
  return out
}
