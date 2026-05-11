import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import { KpiCard } from './KpiCard'
import { DataTable } from './DataTable'
import { BlurFade } from './ui/BlurFade'
import { RankList } from './ui/RankList'
import { PageTabs } from './ui/PageTabs'
import { MultiSelect } from './ui/MultiSelect'
import { useDashboardStore } from '../store/useDashboardStore'
import { formatCurrency, formatNumber } from '../lib/utils'
import type { ColumnDef } from '@tanstack/react-table'

// ─── Soglie dominio ────────────────────────────────────────────────────────────
const SOGLIA_CRITICO = -20   // delta% < -20 → critico
const SOGLIA_CALO    = -5    // delta% < -5  → in calo
const SOGLIA_CRESCITA = 5    // delta% > +5  → forte crescita

type DeltaLevel = 'strong-up' | 'up' | 'stable' | 'warning' | 'critical'

function getDeltaLevel(delta: number): DeltaLevel {
  if (delta > SOGLIA_CRESCITA) return 'strong-up'
  if (delta > 0) return 'up'
  if (delta >= SOGLIA_CALO) return 'stable'
  if (delta >= SOGLIA_CRITICO) return 'warning'
  return 'critical'
}

function getDeltaTextColor(delta: number) {
  const l = getDeltaLevel(delta)
  if (l === 'strong-up') return 'text-emerald-400'
  if (l === 'up') return 'text-accent-green'
  if (l === 'stable') return 'text-yellow-400'
  if (l === 'warning') return 'text-orange-400'
  return 'text-accent-red'
}

function getDeltaBadgeClass(delta: number) {
  const l = getDeltaLevel(delta)
  if (l === 'strong-up') return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
  if (l === 'up') return 'bg-accent-green/10 text-accent-green border border-accent-green/20'
  if (l === 'stable') return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
  if (l === 'warning') return 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
  return 'bg-accent-red/10 text-accent-red border border-accent-red/20'
}

function getDeltaBadgeLabel(delta: number) {
  const l = getDeltaLevel(delta)
  if (l === 'strong-up') return 'In crescita'
  if (l === 'up') return 'Crescita'
  if (l === 'stable') return 'Stabile'
  if (l === 'warning') return 'In calo'
  return 'Critico'
}

// ─── Interfaces ────────────────────────────────────────────────────────────────
interface PVStats {
  name: string
  ac: number
  ap: number
  delta: number     // %
  deltaEuro: number // assoluto
}

interface RamoStats {
  name: string
  ac: number
  ap: number
  delta: number
}

const TABS = [
  { key: 'panoramica', label: 'Panoramica' },
  { key: 'pv',         label: 'Per PV' },
  { key: 'ramo',       label: 'Per Ramo' },
  { key: 'attenzione', label: 'Attenzione' },
  { key: 'tabella',    label: 'Tabella' },
] as const

type TabKey = typeof TABS[number]['key']

const tableColumns: ColumnDef<PVStats>[] = [
  {
    accessorKey: 'name',
    header: 'Punto Vendita',
    cell: i => <span className="font-medium text-zinc-200">{i.getValue() as string}</span>,
  },
  {
    accessorKey: 'ac',
    header: 'Premi AC',
    cell: i => <span className="font-semibold">{formatCurrency(i.getValue() as number)}</span>,
  },
  {
    accessorKey: 'ap',
    header: 'Premi AP',
    cell: i => <span className="text-zinc-400">{formatCurrency(i.getValue() as number)}</span>,
  },
  {
    accessorKey: 'deltaEuro',
    header: 'Δ €',
    cell: i => {
      const v = i.getValue() as number
      return (
        <span className={v >= 0 ? 'text-accent-green font-semibold' : 'text-accent-red font-semibold'}>
          {v >= 0 ? '+' : ''}{formatCurrency(v)}
        </span>
      )
    },
  },
  {
    accessorKey: 'delta',
    header: 'Δ %',
    cell: i => {
      const v = i.getValue() as number
      const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus
      return (
        <span className={`flex items-center gap-1 font-bold ${getDeltaTextColor(v)}`}>
          <Icon size={12} />
          {v > 0 ? '+' : ''}{v.toFixed(1)}%
        </span>
      )
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: i => {
      const v = (i.row.original as PVStats).delta
      return (
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${getDeltaBadgeClass(v)}`}>
          {getDeltaBadgeLabel(v)}
        </span>
      )
    },
  },
]

// ─── Component ─────────────────────────────────────────────────────────────────
export function DashboardHome() {
  const { parsedModules, filters: gf } = useDashboardStore()
  const na302 = parsedModules['na302']
  const na013 = parsedModules['na013']
  const si014 = parsedModules['si014']

  const [activeTab, setActiveTab] = useState<TabKey>('panoramica')
  const [filterPV, setFilterPV] = useState<string[]>([])

  const allRows = useMemo(() => na302?.rows ?? [], [na302])

  const baseRows = useMemo(() => {
    if (gf.pv === 'Tutti' && gf.produttore === 'Tutti' && gf.ramo === 'Tutti') return allRows
    return allRows.filter(r => {
      if (gf.pv !== 'Tutti' && (r['pv'] as string)?.trim() !== gf.pv) return false
      if (gf.produttore !== 'Tutti' && (r['produttore'] as string)?.trim() !== gf.produttore) return false
      if (gf.ramo !== 'Tutti' && (r['ramo'] as string)?.trim() !== gf.ramo) return false
      return true
    })
  }, [allRows, gf])

  // ── PV aggregation ──────────────────────────────────────────────────────────
  const pvStats = useMemo((): PVStats[] => {
    const map: Record<string, { ac: number; ap: number }> = {}
    for (const r of baseRows) {
      const pv = ((r['pv'] as string) || '').trim() || 'N/D'
      if (!map[pv]) map[pv] = { ac: 0, ap: 0 }
      map[pv].ac += (r['premi'] as number) || 0
      map[pv].ap += (r['annioPrecedente'] as number) || 0
    }
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        ac: d.ac,
        ap: d.ap,
        delta: d.ap > 0 ? ((d.ac - d.ap) / d.ap) * 100 : 0,
        deltaEuro: d.ac - d.ap,
      }))
      .sort((a, b) => b.ac - a.ac)
  }, [baseRows])

  // ── Ramo aggregation ───────────────────────────────────────────────────────
  const ramoStats = useMemo((): RamoStats[] => {
    const map: Record<string, { ac: number; ap: number }> = {}
    for (const r of baseRows) {
      const ramo = ((r['ramo'] as string) || '').trim() || 'N/D'
      if (!map[ramo]) map[ramo] = { ac: 0, ap: 0 }
      map[ramo].ac += (r['premi'] as number) || 0
      map[ramo].ap += (r['annioPrecedente'] as number) || 0
    }
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        ac: d.ac,
        ap: d.ap,
        delta: d.ap > 0 ? ((d.ac - d.ap) / d.ap) * 100 : 0,
      }))
      .sort((a, b) => b.ac - a.ac)
  }, [baseRows])

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totAC = pvStats.reduce((s, p) => s + p.ac, 0)
  const totAP = pvStats.reduce((s, p) => s + p.ap, 0)
  const totDelta = totAP > 0 ? ((totAC - totAP) / totAP) * 100 : 0
  const totDeltaEuro = totAC - totAP

  // ── Segment counts ──────────────────────────────────────────────────────────
  const countCrescita = pvStats.filter(p => p.delta > 0).length
  const countCalo = pvStats.filter(p => p.delta < 0).length
  const countCritici = pvStats.filter(p => p.delta <= SOGLIA_CRITICO).length
  const countAttenzione = pvStats.filter(p => p.delta < SOGLIA_CALO).length

  // ── Insight text ────────────────────────────────────────────────────────────
  const insightText = useMemo(() => {
    if (pvStats.length === 0) return null
    const direction = totDelta >= 0 ? 'in crescita' : 'in calo'
    const absPerdu = totDeltaEuro < 0 ? Math.abs(totDeltaEuro) : 0
    let text = `Portafoglio ${direction} del ${Math.abs(totDelta).toFixed(1)}% vs anno precedente`
    if (absPerdu > 0) text += ` · ${formatCurrency(absPerdu)} persi`
    text += `. ${countCrescita} PV in crescita, ${countCalo} in calo`
    if (countCritici > 0) text += ` — ${countCritici} in situazione critica (< ${SOGLIA_CRITICO}%)`
    text += '.'
    if (countAttenzione > 0) {
      const worst = [...pvStats].sort((a, b) => a.delta - b.delta)[0]
      text += ` Massima attenzione su ${worst.name} (${worst.delta.toFixed(1)}%).`
    }
    return text
  }, [pvStats, totDelta, totDeltaEuro, countCrescita, countCalo, countCritici, countAttenzione])

  // ── Incassi / Canalizzazione cross-module ──────────────────────────────────
  const canalPct = useMemo(() => {
    if (!si014) return null
    let si = 0, tot = 0
    for (const r of si014.rows) {
      if (gf.pv !== 'Tutti' && (r['pv'] as string)?.trim() !== gf.pv) continue
      if (gf.produttore !== 'Tutti' && (r['produttore'] as string)?.trim() !== gf.produttore) continue
      const c = r['canalizzato']
      if (c === 'SI' || c === 1) si++
      if (c === 'SI' || c === 'NO' || c === 1 || c === 0) tot++
    }
    return tot > 0 ? (si / tot) * 100 : 0
  }, [si014, gf])

  const scadutiCount = useMemo(() => {
    if (!na013) return null
    const now = Date.now()
    return na013.rows.filter(r => {
      if (gf.pv !== 'Tutti' && (r['pv'] as string)?.trim() !== gf.pv) return false
      if (gf.produttore !== 'Tutti' && (r['produttore'] as string)?.trim() !== gf.produttore) return false
      if (gf.ramo !== 'Tutti' && (r['ramo'] as string)?.trim() !== gf.ramo) return false
      const scad = r['scadenza'] as string
      if (!scad) return false
      const ms = new Date(scad).getTime()
      if (!isFinite(ms) || ms >= now) return false
      const inc = r['incasso'] as string
      return !inc || inc === ''
    }).length
  }, [na013, gf])

  // ── Filtered PV data (for Per PV tab) ─────────────────────────────────────
  const optionsPV = useMemo(
    () => pvStats.map(p => p.name).filter(n => n !== 'N/D'),
    [pvStats],
  )
  const filteredPVStats = useMemo(
    () => filterPV.length ? pvStats.filter(p => filterPV.includes(p.name)) : pvStats,
    [pvStats, filterPV],
  )

  // ── Rank list helpers ───────────────────────────────────────────────────────
  const topCrescite = useMemo(
    () => [...pvStats]
      .filter(p => p.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 7)
      .map(p => ({
        name: p.name,
        value: `+${p.delta.toFixed(1)}%`,
        sub: `AC: ${formatCurrency(p.ac)} · +${formatCurrency(p.deltaEuro)} vs AP`,
        pct: Math.min(100, p.delta * 2),
      })),
    [pvStats],
  )

  const topCali = useMemo(
    () => [...pvStats]
      .filter(p => p.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 7)
      .map(p => ({
        name: p.name,
        value: `${p.delta.toFixed(1)}%`,
        sub: `AC: ${formatCurrency(p.ac)} · ${formatCurrency(p.deltaEuro)} vs AP`,
        pct: Math.min(100, Math.abs(p.delta) * 2),
      })),
    [pvStats],
  )

  const ramoRankItems = useMemo(
    () => ramoStats.map(r => ({
      name: r.name,
      value: formatCurrency(r.ac),
      sub: `Δ: ${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(1)}% · AP: ${formatCurrency(r.ap)}`,
      pct: (r.ac / (ramoStats[0]?.ac || 1)) * 100,
    })),
    [ramoStats],
  )

  const maxAC = pvStats[0]?.ac || 1
  const pvRankItems = useMemo(
    () => filteredPVStats.map(p => ({
      name: p.name,
      value: formatCurrency(p.ac),
      sub: `Δ ${p.delta >= 0 ? '+' : ''}${p.delta.toFixed(1)}% · AP: ${formatCurrency(p.ap)}`,
      pct: (p.ac / maxAC) * 100,
    })),
    [filteredPVStats, maxAC],
  )

  // ── Attenzione data ──────────────────────────────────────────────────────────
  const critici = pvStats.filter(p => p.delta <= SOGLIA_CRITICO).sort((a, b) => a.delta - b.delta)
  const inCalo = pvStats.filter(p => p.delta > SOGLIA_CRITICO && p.delta < SOGLIA_CALO).sort((a, b) => a.delta - b.delta)

  // ─── Empty / Landing screen ────────────────────────────────────────────────
  const loadedCount = [na302, parsedModules['na108'], na013, si014].filter(Boolean).length

  if (!na302) return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]"
    >
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <BlurFade delay={0}>
          <div className="text-center mb-2">
            <p className="text-2xl font-bold text-white mb-1">Control Tower</p>
            <p className="text-base text-zinc-400">
              {loadedCount === 0
                ? 'Carica i file Excel dalla barra laterale per iniziare l\'analisi'
                : `${loadedCount}/4 file caricati — aggiungi NA302 per attivare il Cruscotto`
              }
            </p>
          </div>
        </BlurFade>

        {/* Module cards */}
        <BlurFade delay={0.05}>
          <div className="grid grid-cols-2 gap-3">
            {([
              { id: 'na302', label: 'Cruscotto Portafoglio', desc: 'Premi AC vs AP, trend PV, anomalie', icon: '📊', tab: 'cruscotto' },
              { id: 'na108', label: 'Produzione',            desc: 'Premi lordi, polizze, efficienza PV', icon: '📈', tab: 'produzione' },
              { id: 'na013', label: 'Incassi',               desc: 'Provvigioni, titoli scaduti, aging', icon: '💰', tab: 'incassi' },
              { id: 'si014', label: 'Canalizzazioni',        desc: 'Tasso SI/NO per PV e produttore',   icon: '🔄', tab: 'canalizzazioni' },
            ] as const).map(({ id, label, desc, icon }) => {
              const loaded = !!parsedModules[id]
              return (
                <div key={id} className={`rounded-2xl border p-5 transition-all ${
                  loaded
                    ? 'border-accent-green/25 bg-accent-green/5'
                    : 'border-zinc-700 bg-card opacity-70'
                }`}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">{icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          loaded ? 'bg-accent-green/15 text-accent-green' : 'bg-zinc-800 text-zinc-400'
                        }`}>
                          {id.toUpperCase()}
                        </span>
                        {loaded
                          ? <span className="text-[10px] text-accent-green font-semibold">✓ caricato</span>
                          : <span className="text-[10px] text-zinc-500">← Carica dalla sidebar</span>
                        }
                      </div>
                      <p className="text-base font-semibold text-zinc-200">{label}</p>
                      <p className="text-base text-zinc-400 mt-0.5 leading-relaxed">{desc}</p>
                      {loaded && parsedModules[id] && (
                        <p className="text-base text-zinc-500 mt-2 tabular-nums">
                          {parsedModules[id]!.rowCount.toLocaleString('it-IT')} righe · {parsedModules[id]!.filename.replace(/\.(xlsx|xls)$/i, '')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </BlurFade>

        {/* Instruction */}
        <BlurFade delay={0.12}>
          <div className="bg-card border-2 border-zinc-700/50 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-electric/10 border border-electric/20 flex items-center justify-center flex-shrink-0">
              <span className="text-electric text-lg">←</span>
            </div>
            <div>
              <p className="text-base font-semibold text-zinc-200">Come caricare i dati</p>
              <p className="text-base text-zinc-400 mt-0.5 leading-relaxed">
                Nella barra sinistra, sezione <span className="text-zinc-300 font-medium">Dati</span>,
                clicca su un modulo non caricato oppure usa il pulsante <span className="text-electric font-medium">Carica</span> per più file in una volta sola.
                Puoi ricaricare o sostituire i file in qualsiasi momento.
              </p>
            </div>
          </div>
        </BlurFade>
      </div>
    </motion.div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-6 space-y-5"
    >
      {/* Insight Banner */}
      {insightText && (
        <BlurFade delay={0}>
          <div className={`rounded-2xl border px-5 py-3.5 flex items-start gap-3 ${
            totDelta < SOGLIA_CRITICO
              ? 'border-accent-red/25 bg-accent-red/5'
              : totDelta < 0
                ? 'border-orange-500/25 bg-orange-500/5'
                : 'border-accent-green/20 bg-accent-green/5'
          }`}>
            <span className="text-lg mt-0.5 flex-shrink-0">
              {totDelta < SOGLIA_CRITICO ? '🔴' : totDelta < 0 ? '🟡' : '🟢'}
            </span>
            <p className="text-base text-zinc-300 leading-relaxed">{insightText}</p>
          </div>
        </BlurFade>
      )}

      {/* Hero + KPI strip */}
      <BlurFade delay={0.04}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Hero portafoglio */}
          <div className={`col-span-2 rounded-2xl border p-5 relative overflow-hidden ${
            getDeltaLevel(totDelta) === 'critical' || getDeltaLevel(totDelta) === 'warning'
              ? 'border-orange-500/20 bg-gradient-to-br from-orange-950/30 to-card'
              : 'border-accent-green/20 bg-gradient-to-br from-emerald-950/20 to-card'
          }`}>
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold mb-2">
              Portafoglio AC Totale
            </p>
            <p className="text-4xl font-black text-white tabular-nums leading-none mb-2">
              {formatCurrency(totAC)}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`flex items-center gap-1.5 text-base font-bold ${getDeltaTextColor(totDelta)}`}>
                {totDelta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {totDelta >= 0 ? '+' : ''}{totDelta.toFixed(1)}% vs AP
              </span>
              <span className="text-base text-zinc-400">
                AP: {formatCurrency(totAP)}
              </span>
              <span className={`text-base font-semibold ${totDeltaEuro >= 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                ({totDeltaEuro >= 0 ? '+' : ''}{formatCurrency(totDeltaEuro)})
              </span>
            </div>
          </div>

          {/* Chips status */}
          <div className="bg-card border-2 border-zinc-700 rounded-2xl p-5">
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold mb-3">
              Distribuzione PV
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-base text-accent-green">In crescita</span>
                <span className="text-base font-bold text-accent-green tabular-nums">{countCrescita}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base text-zinc-400">Stabili</span>
                <span className="text-base font-bold text-zinc-400 tabular-nums">
                  {pvStats.length - countCrescita - countCalo}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base text-orange-400">In calo</span>
                <span className="text-base font-bold text-orange-400 tabular-nums">
                  {countCalo - countCritici}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-zinc-700 pt-2 mt-2">
                <span className="text-base text-accent-red font-semibold">Critici</span>
                <span className="text-base font-black text-accent-red tabular-nums">{countCritici}</span>
              </div>
            </div>
          </div>

          {/* Cross-module KPIs */}
          <div className="bg-card border-2 border-zinc-700 rounded-2xl p-5">
            <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold mb-3">
              Altri Moduli
            </p>
            <div className="space-y-2">
              {canalPct !== null ? (
                <div className="flex items-center justify-between">
                  <span className="text-base text-zinc-400">Canalizzazione</span>
                  <span className={`text-base font-bold tabular-nums ${canalPct > 60 ? 'text-accent-green' : canalPct >= 40 ? 'text-yellow-400' : 'text-accent-red'}`}>
                    {canalPct.toFixed(1)}%
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-base text-zinc-500">Canalizzazione</span>
                  <span className="text-base text-zinc-500">— SI014</span>
                </div>
              )}
              {scadutiCount !== null ? (
                <div className="flex items-center justify-between">
                  <span className="text-base text-zinc-400">Titoli scaduti</span>
                  <span className={`text-base font-bold tabular-nums ${scadutiCount > 10 ? 'text-accent-red' : scadutiCount > 0 ? 'text-yellow-400' : 'text-accent-green'}`}>
                    {formatNumber(scadutiCount)}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-base text-zinc-500">Titoli scaduti</span>
                  <span className="text-base text-zinc-500">— NA013</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-base text-zinc-400">PV totali</span>
                <span className="text-base font-bold text-zinc-200 tabular-nums">{pvStats.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base text-zinc-400">Rami</span>
                <span className="text-base font-bold text-zinc-200 tabular-nums">{ramoStats.length}</span>
              </div>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Tabs */}
      <BlurFade delay={0.08}>
        <PageTabs tabs={TABS} active={activeTab} onChange={k => setActiveTab(k as TabKey)} />
      </BlurFade>

      {/* Tab content */}
      <BlurFade delay={0.12}>

        {/* PANORAMICA ─────────────────────────────────────────────────────── */}
        {activeTab === 'panoramica' && (
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-card border border-accent-green/15 rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={14} className="text-accent-green" />
                <p className="text-base text-accent-green uppercase tracking-wide font-semibold">
                  Migliori performance — Top crescite
                </p>
              </div>
              {topCrescite.length > 0 ? (
                <RankList items={topCrescite} gradientFrom="#22c55e" gradientTo="#06b6d4" />
              ) : (
                <p className="text-base text-zinc-400 py-4 text-center">
                  Nessun PV in crescita nel periodo
                </p>
              )}
            </div>

            <div className="bg-card border border-accent-red/15 rounded-3xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown size={14} className="text-orange-400" />
                <p className="text-base text-orange-400 uppercase tracking-wide font-semibold">
                  Da monitorare — Maggiori cali
                </p>
              </div>
              {topCali.length > 0 ? (
                <RankList items={topCali} gradientFrom="#ef4444" gradientTo="#f97316" />
              ) : (
                <p className="text-base text-zinc-400 py-4 text-center">
                  Nessun PV in calo nel periodo
                </p>
              )}
            </div>
          </div>
        )}

        {/* PER PV ─────────────────────────────────────────────────────────── */}
        {activeTab === 'pv' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base text-zinc-500 font-semibold uppercase tracking-wide">Filtri</span>
              <MultiSelect label="Punto Vendita" options={optionsPV} selected={filterPV} onChange={setFilterPV} />
              {filterPV.length > 0 && (
                <button onClick={() => setFilterPV([])} className="text-base text-zinc-400 hover:text-red-400 transition-colors px-2 py-1">
                  × Reset
                </button>
              )}
              <span className="ml-auto text-base text-zinc-500">{filteredPVStats.length} PV</span>
            </div>
            <div className="bg-card border-2 border-zinc-700 rounded-3xl p-5">
              <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                Tutti i Punti Vendita — ordinati per Premi AC
              </p>
              <RankList items={pvRankItems} gradientFrom="#3b82f6" gradientTo="#06b6d4" />
            </div>
          </div>
        )}

        {/* PER RAMO ───────────────────────────────────────────────────────── */}
        {activeTab === 'ramo' && (
          <div className="bg-card border-2 border-zinc-700 rounded-3xl p-5">
            <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
              Portafoglio per Ramo — AC vs AP
            </p>
            <RankList items={ramoRankItems} gradientFrom="#8b5cf6" gradientTo="#06b6d4" />
          </div>
        )}

        {/* ATTENZIONE ─────────────────────────────────────────────────────── */}
        {activeTab === 'attenzione' && (
          <div className="space-y-4">
            {countAttenzione === 0 ? (
              <div className="bg-card border border-accent-green/20 rounded-2xl p-8 text-center">
                <p className="text-accent-green font-semibold text-lg mb-1">Tutto sotto controllo</p>
                <p className="text-base text-zinc-400">
                  Nessun PV con calo significativo (soglia: {Math.abs(SOGLIA_CALO)}%)
                </p>
              </div>
            ) : (
              <>
                {critici.length > 0 && (
                  <div className="bg-accent-red/5 border border-accent-red/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle size={14} className="text-accent-red" />
                      <p className="text-base text-accent-red font-bold uppercase tracking-wide">
                        Critici — calo superiore al {Math.abs(SOGLIA_CRITICO)}%
                      </p>
                      <span className="ml-auto bg-accent-red/15 text-accent-red text-base font-bold px-2 py-0.5 rounded-full">
                        {critici.length} PV
                      </span>
                    </div>
                    <div className="space-y-3">
                      {critici.map(p => (
                        <div key={p.name} className="flex items-center gap-4 bg-black/20 rounded-xl px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-zinc-100 truncate">{p.name}</p>
                            <p className="text-base text-zinc-400 mt-0.5">
                              AC: {formatCurrency(p.ac)} · AP: {formatCurrency(p.ap)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-accent-red font-black text-lg tabular-nums">
                              {p.delta.toFixed(1)}%
                            </p>
                            <p className="text-base text-accent-red/70 tabular-nums">
                              {formatCurrency(p.deltaEuro)} vs AP
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {inCalo.length > 0 && (
                  <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingDown size={14} className="text-orange-400" />
                      <p className="text-base text-orange-400 font-bold uppercase tracking-wide">
                        In calo — da monitorare
                      </p>
                      <span className="ml-auto bg-orange-500/15 text-orange-400 text-base font-bold px-2 py-0.5 rounded-full">
                        {inCalo.length} PV
                      </span>
                    </div>
                    <div className="space-y-3">
                      {inCalo.map(p => (
                        <div key={p.name} className="flex items-center gap-4 bg-black/20 rounded-xl px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-zinc-100 truncate">{p.name}</p>
                            <p className="text-base text-zinc-400 mt-0.5">
                              AC: {formatCurrency(p.ac)} · AP: {formatCurrency(p.ap)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-orange-400 font-black text-lg tabular-nums">
                              {p.delta.toFixed(1)}%
                            </p>
                            <p className="text-base text-orange-400/70 tabular-nums">
                              {formatCurrency(p.deltaEuro)} vs AP
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TABELLA ────────────────────────────────────────────────────────── */}
        {activeTab === 'tabella' && (
          <div className="bg-card border-2 border-zinc-700 rounded-3xl p-6">
            <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-5">
              Portafoglio completo — PV × AC vs AP
            </p>
            <DataTable
              columns={tableColumns}
              data={pvStats}
              searchPlaceholder="Cerca PV..."
              pageSize={15}
            />
          </div>
        )}

      </BlurFade>
    </motion.div>
  )
}
