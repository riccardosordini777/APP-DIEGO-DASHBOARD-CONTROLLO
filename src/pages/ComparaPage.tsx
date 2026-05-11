import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useDashboardStore } from '../store/useDashboardStore'
import { BlurFade } from '../components/ui/BlurFade'
import { formatCurrency, formatNumber, formatPercent } from '../lib/utils'

// ── Metric definition ──────────────────────────────────────────────────────
interface MetricDef {
  key: string
  label: string
  format: (v: number) => string
  higherBetter: boolean
  isDelta?: boolean   // for % delta: >0 is colored green/red
  isRisk?: boolean    // for risk metrics: lower is better (scaduti)
}

interface MetricGroup {
  moduleId: string
  label: string
  color: string
  metrics: MetricDef[]
}

const METRIC_GROUPS: MetricGroup[] = [
  {
    moduleId: 'na302',
    label: 'Portafoglio AC/AP',
    color: '#f59e0b',
    metrics: [
      { key: 'ac',        label: 'Premi Anno Corrente',  format: formatCurrency, higherBetter: true },
      { key: 'ap',        label: 'Premi Anno Precedente', format: formatCurrency, higherBetter: true },
      { key: 'deltaACAP', label: 'Delta AC vs AP',        format: v => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`, higherBetter: true, isDelta: true },
      { key: 'deltaEuro', label: 'Delta €',               format: v => `${v >= 0 ? '+' : ''}${formatCurrency(v)}`, higherBetter: true },
    ],
  },
  {
    moduleId: 'na108',
    label: 'Produzione',
    color: '#8b5cf6',
    metrics: [
      { key: 'premi',       label: 'Premi Lordi',         format: formatCurrency, higherBetter: true },
      { key: 'polizze',     label: 'N. Polizze',          format: formatNumber,   higherBetter: true },
      { key: 'clienti',     label: 'Clienti Unici',       format: formatNumber,   higherBetter: true },
      { key: 'premioPerPol',label: 'Premio Medio/Polizza', format: formatCurrency, higherBetter: true },
    ],
  },
  {
    moduleId: 'na013',
    label: 'Incassi',
    color: '#3b82f6',
    metrics: [
      { key: 'incassi',       label: 'Premi Incassati',    format: formatCurrency, higherBetter: true },
      { key: 'provvigioni',   label: 'Provvigioni',        format: formatCurrency, higherBetter: true },
      { key: 'pctProv',       label: '% Provvigioni',      format: v => `${v.toFixed(1)}%`, higherBetter: true },
      { key: 'scaduti',       label: 'Titoli Scaduti',     format: formatNumber,   higherBetter: false, isRisk: true },
      { key: 'scadutiImporto',label: 'Importo Scaduto',    format: formatCurrency, higherBetter: false, isRisk: true },
    ],
  },
  {
    moduleId: 'si014',
    label: 'Canalizzazioni',
    color: '#22c55e',
    metrics: [
      { key: 'sinistri',   label: 'Sinistri Totali',    format: formatNumber,  higherBetter: true },
      { key: 'canalizzati',label: 'Canalizzati (SI)',   format: formatNumber,  higherBetter: true },
      { key: 'nonCanal',   label: 'Non Canalizzati',    format: formatNumber,  higherBetter: false, isRisk: true },
      { key: 'pctCanal',   label: '% Canalizzazione',   format: v => `${v.toFixed(1)}%`, higherBetter: true },
    ],
  },
]

// ── Metric computation ─────────────────────────────────────────────────────
type PVMetrics = Partial<Record<string, number>>

function computeMetrics(pv: string, parsedModules: ReturnType<typeof useDashboardStore.getState>['parsedModules']): PVMetrics {
  const m: PVMetrics = {}
  const match = (r: Record<string, unknown>) => (r['pv'] as string)?.trim() === pv.trim()

  const na302 = parsedModules['na302']
  if (na302) {
    const rows = na302.rows.filter(match)
    const ac = rows.reduce((s, r) => s + ((r['premi'] as number) || 0), 0)
    const ap = rows.reduce((s, r) => s + ((r['annioPrecedente'] as number) || 0), 0)
    m.ac = ac
    m.ap = ap
    m.deltaACAP = ap > 0 ? ((ac - ap) / ap) * 100 : 0
    m.deltaEuro = ac - ap
  }

  const na108 = parsedModules['na108']
  if (na108) {
    const rows = na108.rows.filter(match)
    const clientSet = new Set<string>()
    let premi = 0, polizze = 0
    for (const r of rows) {
      premi += (r['premi'] as number) || 0
      polizze += (r['polizze'] as number) || 1
      const c = r['cliente'] as string
      if (c) clientSet.add(c)
    }
    m.premi = premi
    m.polizze = polizze
    m.clienti = clientSet.size
    m.premioPerPol = polizze > 0 ? premi / polizze : 0
  }

  const na013 = parsedModules['na013']
  if (na013) {
    const rows = na013.rows.filter(match)
    const incassi = rows.reduce((s, r) => s + ((r['premioLordo'] as number) || 0), 0)
    const prov = rows.reduce((s, r) => s + ((r['provvigioni'] as number) || 0), 0)
    const now = Date.now()
    let scadutiCount = 0
    let scadutiImporto = 0
    for (const r of rows) {
      const scad = r['scadenza'] as string
      if (!scad) continue
      const ms = new Date(scad).getTime()
      if (!isFinite(ms) || ms >= now) continue
      const inc = r['incasso'] as string
      if (!inc || inc === '') {
        scadutiCount++
        scadutiImporto += (r['premioLordo'] as number) || 0
      }
    }
    m.incassi = incassi
    m.provvigioni = prov
    m.pctProv = incassi > 0 ? (prov / incassi) * 100 : 0
    m.scaduti = scadutiCount
    m.scadutiImporto = scadutiImporto
  }

  const si014 = parsedModules['si014']
  if (si014) {
    const rows = si014.rows.filter(match)
    let si = 0, no = 0
    for (const r of rows) {
      const c = r['canalizzato']
      if (c === 'SI' || c === 1) si++
      else if (c === 'NO' || c === 0) no++
    }
    const tot = si + no
    m.sinistri = tot
    m.canalizzati = si
    m.nonCanal = no
    m.pctCanal = tot > 0 ? (si / tot) * 100 : 0
  }

  return m
}

// ── PV search dropdown ─────────────────────────────────────────────────────
function PVSelect({ label, value, options, onChange, color }: {
  label: string; value: string; options: string[]
  onChange: (v: string) => void; color: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const filtered = options.filter(o => o.toLowerCase().startsWith(search.toLowerCase()) || search === '')
  const isSelected = value !== ''

  const recalcPos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [])

  useEffect(() => {
    if (!open) return
    recalcPos()
    const handle = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current && !btnRef.current.contains(t) && dropRef.current && !dropRef.current.contains(t)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handle)
    window.addEventListener('scroll', recalcPos, true)
    window.addEventListener('resize', recalcPos)
    return () => {
      document.removeEventListener('mousedown', handle)
      window.removeEventListener('scroll', recalcPos, true)
      window.removeEventListener('resize', recalcPos)
    }
  }, [open, recalcPos])

  return (
    <div className="flex-1 min-w-0">
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl border text-base transition-all"
        style={{
          borderColor: isSelected ? color + '60' : '#27272a',
          background: isSelected ? color + '10' : '#1a1a1e',
          color: isSelected ? color : '#a1a1aa',
        }}
      >
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: isSelected ? color : '#3f3f46' }} />
        <span className="flex-1 text-left truncate font-semibold">
          {isSelected ? value : label}
        </span>
        {isSelected && (
          <span
            className="text-zinc-400 hover:text-white transition-colors"
            onClick={e => { e.stopPropagation(); onChange(''); setSearch('') }}
          >
            ×
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, zIndex: 99999 }}
          className="bg-[#1a1a1e] border border-[#27272a] rounded-xl shadow-2xl max-h-64 flex flex-col"
        >
          <div className="p-2 border-b border-[#27272a]">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca PV…"
              className="w-full bg-transparent text-base text-zinc-200 placeholder:text-zinc-500 outline-none"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="text-center text-base text-zinc-500 py-4">Nessun risultato</p>
            ) : (
              filtered.map(o => (
                <button
                  key={o}
                  className="w-full text-left px-3 py-2 text-base hover:bg-white/5 transition-colors text-zinc-300"
                  onClick={() => { onChange(o); setOpen(false); setSearch('') }}
                >
                  {o}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── Winner badge ───────────────────────────────────────────────────────────
function Winner({ v1, v2, higherBetter }: { v1?: number; v2?: number; higherBetter: boolean }) {
  if (v1 == null || v2 == null) return null
  const diff = Math.abs(v1 - v2)
  const pct = Math.max(v1, v2) > 0 ? (diff / Math.max(v1, v2)) * 100 : 0
  if (pct < 1) return <span className="text-[10px] text-zinc-400">≈</span>
  const pv1wins = higherBetter ? v1 > v2 : v1 < v2
  return (
    <div className="flex gap-1">
      {pv1wins
        ? <TrendingUp size={12} className="text-accent-green" />
        : <TrendingDown size={12} className="text-accent-red" />
      }
    </div>
  )
}

function MetricValue({ value, metricDef }: { value?: number; metricDef: MetricDef }) {
  if (value == null || value === 0 && metricDef.isRisk) {
    if (metricDef.isRisk && value === 0) {
      return <span className="text-accent-green font-semibold text-base">0 ✓</span>
    }
    return <span className="text-zinc-500 text-base">—</span>
  }
  const formatted = metricDef.format(value)
  let color = 'text-zinc-200'
  if (metricDef.isDelta) color = value > 5 ? 'text-emerald-400' : value > 0 ? 'text-accent-green' : value > -20 ? 'text-yellow-400' : 'text-accent-red'
  if (metricDef.isRisk && value > 0) color = 'text-accent-red'
  return <span className={`font-semibold text-base ${color}`}>{formatted}</span>
}

// ── Page ───────────────────────────────────────────────────────────────────
export function ComparaPage() {
  const { parsedModules } = useDashboardStore()

  const hasAnyData = Object.keys(parsedModules).length > 0

  // All PV names from all loaded modules
  const allPVs = useMemo(() => {
    const s = new Set<string>()
    for (const mod of Object.values(parsedModules)) {
      if (mod) for (const row of mod.rows) { const v = (row['pv'] as string)?.trim(); if (v) s.add(v) }
    }
    return [...s].sort()
  }, [parsedModules])

  const [pv1, setPV1] = useState('')
  const [pv2, setPV2] = useState('')

  const metrics1 = useMemo(() => pv1 ? computeMetrics(pv1, parsedModules) : null, [pv1, parsedModules])
  const metrics2 = useMemo(() => pv2 ? computeMetrics(pv2, parsedModules) : null, [pv2, parsedModules])

  if (!hasAnyData) return (
    <div className="p-8 flex items-center justify-center h-[calc(100vh-120px)]">
      <div className="text-center space-y-2">
        <ArrowLeftRight size={40} className="text-zinc-700 mx-auto" />
        <p className="text-xl font-semibold text-white">Confronta PV</p>
        <p className="text-zinc-400 text-base">Carica almeno un file per iniziare il confronto</p>
      </div>
    </div>
  )

  const loadedModules = METRIC_GROUPS.filter(g => !!parsedModules[g.moduleId as keyof typeof parsedModules])

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-6 space-y-5"
    >
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-electric/10 border border-electric/20 flex items-center justify-center">
            <ArrowLeftRight size={18} className="text-electric" />
          </div>
          <div>
            <p className="text-lg font-bold text-white">Confronta Punti Vendita</p>
            <p className="text-base text-zinc-400">Analisi comparativa su tutti i moduli caricati</p>
          </div>
          <div className="ml-auto flex gap-2">
            {loadedModules.map(g => (
              <span key={g.moduleId} className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: g.color + '20', color: g.color }}>
                {g.moduleId.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </BlurFade>

      {/* PV Selectors */}
      <BlurFade delay={0.05}>
        <div className="flex items-center gap-3">
          <PVSelect label="Seleziona PV 1" value={pv1} options={allPVs.filter(p => p !== pv2)} onChange={setPV1} color="#3b82f6" />
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <ArrowLeftRight size={14} className="text-zinc-400" />
          </div>
          <PVSelect label="Seleziona PV 2" value={pv2} options={allPVs.filter(p => p !== pv1)} onChange={setPV2} color="#8b5cf6" />
        </div>
      </BlurFade>

      {/* Comparison table */}
      {pv1 && pv2 && metrics1 && metrics2 ? (
        <BlurFade delay={0.1}>
          <div className="space-y-4">
            {loadedModules.map(group => (
              <div key={group.moduleId} className="bg-card border border-border rounded-3xl overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-border" style={{ backgroundColor: group.color + '10' }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
                  <p className="text-base font-bold uppercase tracking-wider" style={{ color: group.color }}>
                    {group.label}
                  </p>
                  <span className="text-[10px] text-zinc-500">{group.moduleId.toUpperCase()}</span>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-[2fr_1fr_1fr_40px] gap-0 px-5 py-2 border-b border-border/50">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide font-semibold">Metrica</p>
                  <p className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-wide truncate">{pv1}</p>
                  <p className="text-[10px] font-bold text-[#8b5cf6] uppercase tracking-wide truncate">{pv2}</p>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide text-center">Δ</p>
                </div>

                {/* Metric rows */}
                {group.metrics.map((metric, idx) => {
                  const v1 = metrics1[metric.key]
                  const v2 = metrics2[metric.key]
                  const hasData = v1 != null || v2 != null

                  return (
                    <div
                      key={metric.key}
                      className={`grid grid-cols-[2fr_1fr_1fr_40px] gap-0 px-5 py-3 transition-colors hover:bg-white/3 ${
                        idx < group.metrics.length - 1 ? 'border-b border-border/30' : ''
                      }`}
                    >
                      <p className="text-base text-zinc-400 flex items-center">{metric.label}</p>
                      <div className="flex items-center">
                        {hasData ? <MetricValue value={v1} metricDef={metric} /> : <span className="text-zinc-700 text-base">N/D</span>}
                      </div>
                      <div className="flex items-center">
                        {hasData ? <MetricValue value={v2} metricDef={metric} /> : <span className="text-zinc-700 text-base">N/D</span>}
                      </div>
                      <div className="flex items-center justify-center">
                        <Winner v1={v1} v2={v2} higherBetter={metric.higherBetter} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Summary bar */}
            <div className="bg-card border border-border rounded-2xl px-5 py-3 flex items-center gap-6">
              <p className="text-base text-zinc-400 font-semibold uppercase tracking-wide">Riepilogo</p>
              {loadedModules.map(group => {
                let wins1 = 0, wins2 = 0
                for (const metric of group.metrics) {
                  const v1 = metrics1[metric.key]
                  const v2 = metrics2[metric.key]
                  if (v1 == null || v2 == null) continue
                  const pct = Math.max(v1, v2) > 0 ? (Math.abs(v1 - v2) / Math.max(v1, v2)) * 100 : 0
                  if (pct < 1) continue
                  if (metric.higherBetter ? v1 > v2 : v1 < v2) wins1++
                  else wins2++
                }
                return (
                  <div key={group.moduleId} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: group.color + '20', color: group.color }}>
                      {group.moduleId.toUpperCase()}
                    </span>
                    <span className="text-base text-[#3b82f6] font-bold">{pv1.slice(0, 10)}: {wins1}</span>
                    <span className="text-base text-zinc-500">vs</span>
                    <span className="text-base text-[#8b5cf6] font-bold">{pv2.slice(0, 10)}: {wins2}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </BlurFade>
      ) : (
        <BlurFade delay={0.1}>
          <div className="bg-card border border-border/50 rounded-3xl p-12 text-center">
            <ArrowLeftRight size={32} className="text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400 font-medium">
              {!pv1 && !pv2
                ? 'Seleziona due PV per iniziare il confronto'
                : 'Seleziona anche il secondo PV per comparare'
              }
            </p>
            <p className="text-zinc-500 text-base mt-1">
              {allPVs.length} PV disponibili da {Object.keys(parsedModules).length} file caricati
            </p>
          </div>
        </BlurFade>
      )}
    </motion.div>
  )
}
