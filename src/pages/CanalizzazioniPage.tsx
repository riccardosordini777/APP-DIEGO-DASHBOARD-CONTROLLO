import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useDashboardStore } from '../store/useDashboardStore'
import { HChart } from '../components/HChart'
import { DataTable } from '../components/DataTable'
import { KpiCard } from '../components/KpiCard'
import { BlurFade } from '../components/ui/BlurFade'
import { MultiSelect } from '../components/ui/MultiSelect'
import { RankList } from '../components/ui/RankList'
import { PageTabs } from '../components/ui/PageTabs'
import { formatPercent, formatNumber, getCanalizzazioneColor } from '../lib/utils'
import type Highcharts from 'highcharts'
import type { ColumnDef } from '@tanstack/react-table'

type TabKey = 'panoramica' | 'pv' | 'produttore' | 'carrozzeria' | 'attenzione' | 'tabella'

interface CanalRow { name: string; si: number; no: number; tot: number; pct: number }

// Domain thresholds
const SOGLIA_CRITICO = 30   // below 30% = critical
const SOGLIA_WARN = 50      // below 50% = warning
const SOGLIA_BUONO = 65     // above 65% = good

type AnomalyLevel = 'critico' | 'attenzione' | 'ok' | 'buono'

function getAnomalyLevel(pct: number): AnomalyLevel {
  if (pct < SOGLIA_CRITICO) return 'critico'
  if (pct < SOGLIA_WARN) return 'attenzione'
  if (pct >= SOGLIA_BUONO) return 'buono'
  return 'ok'
}

const TABS = [
  { key: 'panoramica', label: 'Panoramica' },
  { key: 'pv', label: 'Per PV' },
  { key: 'produttore', label: 'Per Produttore' },
  { key: 'carrozzeria', label: 'Per Carrozzeria' },
  { key: 'attenzione', label: 'Attenzione' },
  { key: 'tabella', label: 'Tabella' },
] as const

const tableColumns: ColumnDef<CanalRow>[] = [
  { accessorKey: 'name', header: 'Punto Vendita', cell: i => <span className="font-medium text-zinc-200">{i.getValue() as string}</span> },
  { accessorKey: 'tot', header: 'Totale', cell: i => formatNumber(i.getValue() as number) },
  { accessorKey: 'si', header: 'Canalizzati', cell: i => <span className="text-accent-green font-semibold">{formatNumber(i.getValue() as number)}</span> },
  { accessorKey: 'no', header: 'Non Canal.', cell: i => <span className="text-accent-red font-semibold">{formatNumber(i.getValue() as number)}</span> },
  {
    accessorKey: 'pct',
    header: '% Canal.',
    cell: i => {
      const v = i.getValue() as number
      return <span className={`${getCanalizzazioneColor(v)} font-bold`}>{formatPercent(v)}</span>
    },
  },
]

function aggregateCanal(
  rows: Record<string, unknown>[],
  keyFn: (r: Record<string, unknown>) => string,
): CanalRow[] {
  const map: Record<string, { si: number; no: number }> = {}
  for (const r of rows) {
    const key = (keyFn(r) || '').trim() || 'N/D'
    if (!map[key]) map[key] = { si: 0, no: 0 }
    const c = r['canalizzato']
    if (c === 'SI' || c === 1) map[key].si++
    else if (c === 'NO' || c === 0) map[key].no++
  }
  return Object.entries(map)
    .map(([name, d]) => ({ name, si: d.si, no: d.no, tot: d.si + d.no, pct: d.si + d.no > 0 ? (d.si / (d.si + d.no)) * 100 : 0 }))
    .sort((a, b) => b.tot - a.tot)
}

function buildBarOptions(data: CanalRow[], height = 300): Highcharts.Options {
  return {
    chart: { type: 'bar', height },
    xAxis: { categories: data.slice(0, 12).map(d => d.name) },
    yAxis: { title: { text: 'Sinistri' } },
    plotOptions: { bar: { stacking: 'normal', borderRadius: 3 } },
    tooltip: { shared: true },
    legend: { enabled: true },
    series: [
      { type: 'bar', name: 'Canalizzati', data: data.slice(0, 12).map(d => d.si), color: '#22c55e' },
      { type: 'bar', name: 'Non Canal.', data: data.slice(0, 12).map(d => d.no), color: '#ef4444' },
    ],
  }
}

function toRankItems(data: CanalRow[], skipND = true) {
  const filtered = skipND ? data.filter(d => d.name !== 'N/D') : data
  return filtered.map(d => ({
    name: d.name,
    value: formatPercent(d.pct),
    sub: `${formatNumber(d.si)} SI · ${formatNumber(d.no)} NO · ${formatNumber(d.tot)} tot.`,
    pct: d.pct,
  }))
}

export function CanalizzazioniPage() {
  const { parsedModules, filters: gf } = useDashboardStore()
  const si014 = parsedModules['si014']

  const [activeTab, setActiveTab] = useState<TabKey>('panoramica')
  const [filterPV, setFilterPV] = useState<string[]>([])
  const [filterProd, setFilterProd] = useState<string[]>([])
  const [filterTipo, setFilterTipo] = useState<string[]>([])

  const allRows = useMemo(() => si014?.rows ?? [], [si014])

  const optionsPV = useMemo(
    () => [...new Set(allRows.map(r => (r['pv'] as string) || '').filter(Boolean))].sort(),
    [allRows],
  )
  const optionsProd = useMemo(
    () => [...new Set(allRows.map(r => (r['produttore'] as string) || '').filter(Boolean))].sort(),
    [allRows],
  )
  const optionsTipo = useMemo(
    () => [...new Set(allRows.map(r => (r['tipo'] as string) || '').filter(Boolean))].sort(),
    [allRows],
  )

  const filteredRows = useMemo(() => {
    const gfActive = gf.pv !== 'Tutti' || gf.produttore !== 'Tutti'
    if (!gfActive && !filterPV.length && !filterProd.length && !filterTipo.length) return allRows
    return allRows.filter(r => {
      if (gf.pv !== 'Tutti' && (r['pv'] as string)?.trim() !== gf.pv) return false
      if (gf.produttore !== 'Tutti' && (r['produttore'] as string)?.trim() !== gf.produttore) return false
      if (filterPV.length && !filterPV.includes(r['pv'] as string)) return false
      if (filterProd.length && !filterProd.includes(r['produttore'] as string)) return false
      if (filterTipo.length && !filterTipo.includes(r['tipo'] as string)) return false
      return true
    })
  }, [allRows, gf, filterPV, filterProd, filterTipo])

  const pvData = useMemo(() => aggregateCanal(filteredRows, r => r['pv'] as string), [filteredRows])
  const prodData = useMemo(() => aggregateCanal(filteredRows, r => r['produttore'] as string), [filteredRows])
  const carrozzeriaData = useMemo(() => aggregateCanal(filteredRows, r => r['carrozzeria'] as string), [filteredRows])

  const totale = pvData.reduce((s, r) => s + r.tot, 0)
  const canalizzati = pvData.reduce((s, r) => s + r.si, 0)
  const nonCanalizzati = totale - canalizzati
  const pctGlobale = totale > 0 ? (canalizzati / totale) * 100 : 0

  // Anomaly counts (PV with at least 5 sinistri to filter noise)
  const pvSignificant = useMemo(() => pvData.filter(d => d.tot >= 5), [pvData])
  const pvCritici = useMemo(() => pvSignificant.filter(d => getAnomalyLevel(d.pct) === 'critico'), [pvSignificant])
  const pvAttenzione = useMemo(() => pvSignificant.filter(d => getAnomalyLevel(d.pct) === 'attenzione'), [pvSignificant])
  const pvBuoni = useMemo(() => pvSignificant.filter(d => getAnomalyLevel(d.pct) === 'buono'), [pvSignificant])

  // Lost sinistri: non-canalizzati from critical PVs
  const persiDaCritici = pvCritici.reduce((s, d) => s + d.no, 0)

  const insightText = useMemo(() => {
    if (!pvData.length) return ''
    const parts: string[] = []
    const levelLabel = pctGlobale >= SOGLIA_BUONO ? 'buona' : pctGlobale >= SOGLIA_WARN ? 'nella media' : 'sotto soglia'
    parts.push(`${formatPercent(pctGlobale)} di canalizzazione globale (${levelLabel})`)
    parts.push(`${formatNumber(canalizzati)} SI · ${formatNumber(nonCanalizzati)} NO su ${formatNumber(totale)} sinistri`)
    if (pvCritici.length > 0)
      parts.push(`${pvCritici.length} PV critici (sotto ${SOGLIA_CRITICO}%) — ${formatNumber(persiDaCritici)} sinistri non canalizzati`)
    if (pvBuoni.length > 0)
      parts.push(`${pvBuoni.length} PV sopra ${SOGLIA_BUONO}%`)
    return parts.join(' · ')
  }, [pvData, pctGlobale, canalizzati, nonCanalizzati, totale, pvCritici, persiDaCritici, pvBuoni])

  const pvBarOptions = useMemo(() => buildBarOptions(pvData), [pvData])
  const prodBarOptions = useMemo(() => buildBarOptions(prodData), [prodData])
  const carrozzeriaBarOptions = useMemo(() => buildBarOptions(carrozzeriaData), [carrozzeriaData])

  const pvRankItems = useMemo(() => toRankItems(pvData, false), [pvData])
  const prodRankItems = useMemo(() => toRankItems(prodData), [prodData])
  const carrozzeriaRankItems = useMemo(() => toRankItems(carrozzeriaData), [carrozzeriaData])

  const hasFilters = filterPV.length > 0 || filterProd.length > 0 || filterTipo.length > 0

  if (!si014) return (
    <div className="p-8 flex items-center justify-center h-[calc(100vh-80px)]">
      <div className="text-center space-y-2">
        <p className="text-2xl font-semibold text-white">Canalizzazioni SI014</p>
        <p className="text-zinc-400">Carica il file SI014 per visualizzare l'analisi</p>
      </div>
    </div>
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="p-6 space-y-5"
    >
      {/* Insight banner */}
      {insightText && (
        <BlurFade delay={0}>
          <div className={`border rounded-2xl px-4 py-3 ${
            pvCritici.length > 0
              ? 'bg-red-500/5 border-red-500/20'
              : pctGlobale >= SOGLIA_BUONO
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-yellow-500/5 border-yellow-500/20'
          }`}>
            <p className="text-base text-zinc-400 leading-relaxed">{insightText}</p>
          </div>
        </BlurFade>
      )}

      {/* Filter bar */}
      <BlurFade delay={0.02}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base text-zinc-500 font-semibold uppercase tracking-wide">Filtri</span>
          <MultiSelect label="Punto Vendita" options={optionsPV} selected={filterPV} onChange={setFilterPV} />
          {optionsProd.length > 0 && (
            <MultiSelect label="Produttore" options={optionsProd} selected={filterProd} onChange={setFilterProd} />
          )}
          {optionsTipo.length > 0 && (
            <MultiSelect label="Tipo Sinistro" options={optionsTipo} selected={filterTipo} onChange={setFilterTipo} />
          )}
          {hasFilters && (
            <button
              onClick={() => { setFilterPV([]); setFilterProd([]); setFilterTipo([]) }}
              className="text-base text-zinc-400 hover:text-red-400 transition-colors px-2 py-1 rounded"
            >
              × Reset
            </button>
          )}
          <span className="ml-auto text-base text-zinc-500 tabular-nums">
            {filteredRows.length.toLocaleString('it-IT')} sinistri
          </span>
        </div>
      </BlurFade>

      {/* KPI strip */}
      <BlurFade delay={0.05}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Sinistri Totali" value={totale} />
          <KpiCard
            label="Canalizzati (SI)"
            value={canalizzati}
            sub={`${((canalizzati / (totale || 1)) * 100).toFixed(1)}% del totale`}
          />
          <KpiCard
            label="Non Canalizzati"
            value={nonCanalizzati}
            sub={`${(((nonCanalizzati) / (totale || 1)) * 100).toFixed(1)}% del totale`}
            positiveIsGood={false}
          />
          <KpiCard
            label="% Canalizzazione"
            value={pctGlobale}
            formatter={n => `${n.toFixed(1)}%`}
            sub={pvCritici.length > 0 ? `${pvCritici.length} PV critici` : pvBuoni.length > 0 ? `${pvBuoni.length} PV sopra ${SOGLIA_BUONO}%` : undefined}
            className={
              pctGlobale >= SOGLIA_BUONO
                ? 'border-accent-green/30'
                : pctGlobale >= SOGLIA_WARN
                  ? 'border-yellow-500/30'
                  : 'border-accent-red/30'
            }
          />
        </div>
      </BlurFade>

      {/* Tabs */}
      <BlurFade delay={0.08}>
        <PageTabs tabs={TABS} active={activeTab} onChange={k => setActiveTab(k as TabKey)} />
      </BlurFade>

      {/* Tab content */}
      <BlurFade delay={0.12}>
        {activeTab === 'panoramica' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  Top Punti Vendita per Volume
                </p>
                <RankList
                  items={pvRankItems}
                  maxItems={10}
                  gradientFrom="#22c55e"
                  gradientTo="#06b6d4"
                />
              </div>
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  {prodRankItems.length > 0 ? 'Top Produttori per Volume' : 'Top Carrozzerie per Volume'}
                </p>
                {prodRankItems.length > 0 ? (
                  <RankList
                    items={prodRankItems}
                    maxItems={10}
                    gradientFrom="#f59e0b"
                    gradientTo="#f97316"
                  />
                ) : (
                  <p className="text-base text-zinc-400 pt-4">
                    Colonna "Produttore" non disponibile nel file caricato.
                  </p>
                )}
              </div>
            </div>

            {/* Distribution overview */}
            {pvSignificant.length > 0 && (
              <div className="bg-card border border-border rounded-3xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold">
                    Distribuzione Livelli Canalizzazione
                  </p>
                  <span className="text-base text-zinc-500">{pvSignificant.length} PV con ≥5 sinistri</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Critici', count: pvCritici.length, desc: `< ${SOGLIA_CRITICO}%`, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
                    { label: 'Da Monitorare', count: pvAttenzione.length, desc: `${SOGLIA_CRITICO}–${SOGLIA_WARN}%`, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
                    { label: 'Nella Media', count: pvSignificant.filter(d => getAnomalyLevel(d.pct) === 'ok').length, desc: `${SOGLIA_WARN}–${SOGLIA_BUONO}%`, color: 'text-zinc-300', bg: 'bg-zinc-500/10 border-zinc-500/20' },
                    { label: 'Buoni', count: pvBuoni.length, desc: `≥ ${SOGLIA_BUONO}%`, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                  ].map(({ label, count, desc, color, bg }) => (
                    <div key={label} className={`border rounded-2xl p-4 text-center ${bg}`}>
                      <p className={`text-3xl font-bold ${color}`}>{count}</p>
                      <p className="text-base font-semibold text-zinc-200 mt-1">{label}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pv' && (
          <div className="grid grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-3xl p-5">
              <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                Classifica Punti Vendita
              </p>
              <RankList items={pvRankItems} gradientFrom="#22c55e" gradientTo="#06b6d4" />
            </div>
            <div className="bg-card border border-border rounded-3xl p-5">
              <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                SI vs NO per PV (Top 12)
              </p>
              <HChart options={pvBarOptions} style={{ height: 300 }} />
            </div>
          </div>
        )}

        {activeTab === 'produttore' && (
          prodRankItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  Classifica Produttori
                </p>
                <RankList items={prodRankItems} gradientFrom="#f59e0b" gradientTo="#f97316" />
              </div>
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  SI vs NO per Produttore (Top 12)
                </p>
                <HChart options={prodBarOptions} style={{ height: 300 }} />
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl p-10 text-center">
              <p className="text-zinc-400">
                Colonna "Produttore" non trovata nel file SI014 caricato.
              </p>
            </div>
          )
        )}

        {activeTab === 'carrozzeria' && (
          carrozzeriaRankItems.length > 0 ? (
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  Classifica Carrozzerie
                </p>
                <RankList
                  items={carrozzeriaRankItems}
                  gradientFrom="#8b5cf6"
                  gradientTo="#06b6d4"
                />
              </div>
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  SI vs NO per Carrozzeria (Top 12)
                </p>
                <HChart options={carrozzeriaBarOptions} style={{ height: 300 }} />
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl p-10 text-center">
              <p className="text-zinc-400">
                Colonna "Carrozzeria" non trovata nel file SI014 caricato.
              </p>
            </div>
          )
        )}

        {activeTab === 'attenzione' && (
          <div className="space-y-5">
            {pvCritici.length === 0 && pvAttenzione.length === 0 ? (
              <div className="bg-card border border-emerald-500/20 rounded-3xl p-10 text-center">
                <p className="text-emerald-400 font-semibold text-lg">Nessuna anomalia rilevata</p>
                <p className="text-zinc-400 text-base mt-2">Tutti i PV con dati sufficienti sono sopra la soglia di attenzione ({SOGLIA_WARN}%).</p>
              </div>
            ) : (
              <>
                {pvCritici.length > 0 && (
                  <div className="bg-card border border-red-500/20 rounded-3xl p-5">
                    <p className="text-base text-red-400 uppercase tracking-wide font-bold mb-1">
                      Critici — sotto {SOGLIA_CRITICO}% · {pvCritici.length} PV
                    </p>
                    <p className="text-[11px] text-zinc-500 mb-4">
                      {formatNumber(persiDaCritici)} sinistri non canalizzati — azione immediata richiesta
                    </p>
                    <div className="space-y-3">
                      {pvCritici.map(d => (
                        <div key={d.name} className="flex items-center gap-4 p-3 bg-red-500/5 border border-red-500/15 rounded-2xl">
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-zinc-200 truncate">{d.name}</p>
                            <p className="text-base text-zinc-400 mt-0.5">
                              {formatNumber(d.si)} SI · {formatNumber(d.no)} NO · {formatNumber(d.tot)} tot.
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-2xl font-bold text-red-400">{d.pct.toFixed(1)}%</p>
                            <p className="text-[11px] text-zinc-500">{formatNumber(d.no)} non canal.</p>
                          </div>
                          {/* Mini progress bar */}
                          <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden flex-shrink-0">
                            <div
                              className="h-full bg-red-500 rounded-full"
                              style={{ width: `${d.pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pvAttenzione.length > 0 && (
                  <div className="bg-card border border-yellow-500/20 rounded-3xl p-5">
                    <p className="text-base text-yellow-400 uppercase tracking-wide font-bold mb-1">
                      Da Monitorare — {SOGLIA_CRITICO}–{SOGLIA_WARN}% · {pvAttenzione.length} PV
                    </p>
                    <p className="text-[11px] text-zinc-500 mb-4">
                      Sotto la soglia di performance target — richiede follow-up
                    </p>
                    <div className="space-y-3">
                      {pvAttenzione.map(d => (
                        <div key={d.name} className="flex items-center gap-4 p-3 bg-yellow-500/5 border border-yellow-500/15 rounded-2xl">
                          <div className="flex-1 min-w-0">
                            <p className="text-base font-semibold text-zinc-200 truncate">{d.name}</p>
                            <p className="text-base text-zinc-400 mt-0.5">
                              {formatNumber(d.si)} SI · {formatNumber(d.no)} NO · {formatNumber(d.tot)} tot.
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-2xl font-bold text-yellow-400">{d.pct.toFixed(1)}%</p>
                            <p className="text-[11px] text-zinc-500">{formatNumber(d.no)} non canal.</p>
                          </div>
                          <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden flex-shrink-0">
                            <div
                              className="h-full bg-yellow-500 rounded-full"
                              style={{ width: `${d.pct}%` }}
                            />
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

        {activeTab === 'tabella' && (
          <div className="bg-card border border-border rounded-3xl p-6">
            <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-5">
              Dettaglio per Punto Vendita
            </p>
            <DataTable
              columns={tableColumns}
              data={pvData}
              searchPlaceholder="Cerca PV..."
              pageSize={15}
            />
          </div>
        )}
      </BlurFade>
    </motion.div>
  )
}
