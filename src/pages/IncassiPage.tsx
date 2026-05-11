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
import { formatCurrency, formatPercent } from '../lib/utils'
import type Highcharts from 'highcharts'
import type { ColumnDef } from '@tanstack/react-table'

type TabKey = 'panoramica' | 'pv' | 'produttore' | 'scadenziario' | 'tabella'

interface IncassoRow { name: string; premi: number; prov: number; pctProv: number; tipoPagamento: string }
interface ProdIncassoRow { name: string; premi: number; prov: number }
interface ScadutoRow { pv: string; produttore: string; scadenza: string; premioLordo: number; tipoPagamento: string; daysOverdue: number }

const TABS = [
  { key: 'panoramica', label: 'Panoramica' },
  { key: 'pv', label: 'Per PV' },
  { key: 'produttore', label: 'Per Produttore' },
  { key: 'scadenziario', label: 'Scadenziario' },
  { key: 'tabella', label: 'Tabella' },
] as const

const tableColumns: ColumnDef<IncassoRow>[] = [
  { accessorKey: 'name', header: 'Punto Vendita', cell: i => <span className="font-medium text-zinc-200">{i.getValue() as string}</span> },
  { accessorKey: 'premi', header: 'Premi Lordi', cell: i => <span className="font-semibold">{formatCurrency(i.getValue() as number)}</span> },
  { accessorKey: 'prov', header: 'Provvigioni', cell: i => <span className="text-accent-green">{formatCurrency(i.getValue() as number)}</span> },
  { accessorKey: 'pctProv', header: '% Prov.', cell: i => formatPercent(i.getValue() as number) },
  { accessorKey: 'tipoPagamento', header: 'Modalità', cell: i => <span className="text-zinc-400">{(i.getValue() as string) || '—'}</span> },
]

const scadutiColumns: ColumnDef<ScadutoRow>[] = [
  { accessorKey: 'pv', header: 'Punto Vendita', cell: i => <span className="font-medium text-zinc-200">{i.getValue() as string}</span> },
  { accessorKey: 'produttore', header: 'Produttore', cell: i => <span className="text-zinc-300">{(i.getValue() as string) || '—'}</span> },
  {
    accessorKey: 'scadenza',
    header: 'Scadenza',
    cell: i => {
      const row = i.row.original
      const v = i.getValue() as string
      if (!v) return <span className="text-zinc-400">—</span>
      const d = new Date(v)
      return (
        <span className={row.daysOverdue > 90 ? 'text-accent-red font-semibold' : row.daysOverdue > 30 ? 'text-yellow-500' : 'text-zinc-300'}>
          {d.toLocaleDateString('it-IT')}
          {row.daysOverdue > 0 && <span className="text-base ml-1 opacity-70">({row.daysOverdue}gg)</span>}
        </span>
      )
    },
  },
  { accessorKey: 'premioLordo', header: 'Premio Lordo', cell: i => <span className="text-accent-red font-bold">{formatCurrency(i.getValue() as number)}</span> },
  { accessorKey: 'tipoPagamento', header: 'Modalità', cell: i => <span className="text-zinc-400">{(i.getValue() as string) || '—'}</span> },
]

const AGEING_BUCKETS = [
  { key: '0-30', label: '0–30 gg', color: '#f59e0b', bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-400' },
  { key: '31-60', label: '31–60 gg', color: '#f97316', bg: 'bg-orange-500/10 border-orange-500/20', text: 'text-orange-400' },
  { key: '61-90', label: '61–90 gg', color: '#ef4444', bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400' },
  { key: '90+', label: '>90 gg', color: '#b91c1c', bg: 'bg-red-700/10 border-red-700/20', text: 'text-red-500' },
] as const

export function IncassiPage() {
  const { parsedModules, filters: gf } = useDashboardStore()
  const na013 = parsedModules['na013']

  const [activeTab, setActiveTab] = useState<TabKey>('panoramica')
  const [filterPV, setFilterPV] = useState<string[]>([])
  const [filterProd, setFilterProd] = useState<string[]>([])
  const [filterRamo, setFilterRamo] = useState<string[]>([])

  const allRows = useMemo(() => na013?.rows ?? [], [na013])

  const optionsPV = useMemo(
    () => [...new Set(allRows.map(r => (r['pv'] as string) || '').filter(Boolean))].sort(),
    [allRows],
  )
  const optionsProd = useMemo(
    () => [...new Set(allRows.map(r => (r['produttore'] as string) || '').filter(Boolean))].sort(),
    [allRows],
  )
  const optionsRamo = useMemo(
    () => [...new Set(allRows.map(r => (r['ramo'] as string) || '').filter(Boolean))].sort(),
    [allRows],
  )

  const filteredRows = useMemo(() => {
    const gfActive = gf.pv !== 'Tutti' || gf.produttore !== 'Tutti' || gf.ramo !== 'Tutti'
    if (!gfActive && !filterPV.length && !filterProd.length && !filterRamo.length) return allRows
    return allRows.filter(r => {
      if (gf.pv !== 'Tutti' && (r['pv'] as string)?.trim() !== gf.pv) return false
      if (gf.produttore !== 'Tutti' && (r['produttore'] as string)?.trim() !== gf.produttore) return false
      if (gf.ramo !== 'Tutti' && (r['ramo'] as string)?.trim() !== gf.ramo) return false
      if (filterPV.length && !filterPV.includes(r['pv'] as string)) return false
      if (filterProd.length && !filterProd.includes(r['produttore'] as string)) return false
      if (filterRamo.length && !filterRamo.includes(r['ramo'] as string)) return false
      return true
    })
  }, [allRows, gf, filterPV, filterProd, filterRamo])

  const pvData = useMemo((): IncassoRow[] => {
    const map: Record<string, { premi: number; prov: number; tipo: string }> = {}
    for (const r of filteredRows) {
      const pv = ((r['pv'] as string) || '').trim() || 'N/D'
      if (!map[pv]) map[pv] = { premi: 0, prov: 0, tipo: '' }
      map[pv].premi += (r['premioLordo'] as number) || 0
      map[pv].prov += (r['provvigioni'] as number) || 0
      if (!map[pv].tipo) map[pv].tipo = (r['tipoPagamento'] as string) || ''
    }
    return Object.entries(map)
      .map(([name, d]) => ({
        name, premi: d.premi, prov: d.prov,
        pctProv: d.premi > 0 ? (d.prov / d.premi) * 100 : 0,
        tipoPagamento: d.tipo,
      }))
      .sort((a, b) => b.premi - a.premi)
  }, [filteredRows])

  const prodData = useMemo((): ProdIncassoRow[] => {
    const map: Record<string, { premi: number; prov: number }> = {}
    for (const r of filteredRows) {
      const prod = ((r['produttore'] as string) || '').trim() || 'N/D'
      if (!map[prod]) map[prod] = { premi: 0, prov: 0 }
      map[prod].premi += (r['premioLordo'] as number) || 0
      map[prod].prov += (r['provvigioni'] as number) || 0
    }
    return Object.entries(map)
      .map(([name, d]) => ({ name, premi: d.premi, prov: d.prov }))
      .sort((a, b) => b.premi - a.premi)
  }, [filteredRows])

  const scadutiRows = useMemo((): ScadutoRow[] => {
    const now = Date.now()
    return filteredRows
      .filter(r => {
        const scad = r['scadenza'] as string
        if (!scad || scad === '') return false
        const ms = new Date(scad).getTime()
        if (!isFinite(ms) || ms >= now) return false
        const inc = r['incasso'] as string
        return !inc || inc === ''
      })
      .map(r => {
        const ms = new Date(r['scadenza'] as string).getTime()
        const daysOverdue = Math.floor((now - ms) / 86400000)
        return {
          pv: ((r['pv'] as string) || 'N/D'),
          produttore: ((r['produttore'] as string) || ''),
          scadenza: r['scadenza'] as string,
          premioLordo: (r['premioLordo'] as number) || 0,
          tipoPagamento: ((r['tipoPagamento'] as string) || ''),
          daysOverdue,
        }
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
  }, [filteredRows])

  // Ageing buckets
  const ageingBuckets = useMemo(() => {
    const b: Record<string, { count: number; importo: number }> = {
      '0-30': { count: 0, importo: 0 },
      '31-60': { count: 0, importo: 0 },
      '61-90': { count: 0, importo: 0 },
      '90+': { count: 0, importo: 0 },
    }
    for (const r of scadutiRows) {
      const k = r.daysOverdue <= 30 ? '0-30' : r.daysOverdue <= 60 ? '31-60' : r.daysOverdue <= 90 ? '61-90' : '90+'
      b[k].count++
      b[k].importo += r.premioLordo
    }
    return b
  }, [scadutiRows])

  // PV breakdown of scaduti (which PVs have most overdue)
  const pvScadutiData = useMemo(() => {
    const map: Record<string, { count: number; importo: number }> = {}
    for (const r of scadutiRows) {
      if (!map[r.pv]) map[r.pv] = { count: 0, importo: 0 }
      map[r.pv].count++
      map[r.pv].importo += r.premioLordo
    }
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.importo - a.importo)
  }, [scadutiRows])

  const totPremi = pvData.reduce((s, r) => s + r.premi, 0)
  const totProv = pvData.reduce((s, r) => s + r.prov, 0)
  const pctMedia = totPremi > 0 ? (totProv / totPremi) * 100 : 0
  const maxPremi = pvData[0]?.premi || 1
  const maxProdPremi = prodData[0]?.premi || 1
  const totScadutiImporto = scadutiRows.reduce((s, r) => s + r.premioLordo, 0)
  const critici90 = ageingBuckets['90+'].count

  const insightText = useMemo(() => {
    if (!pvData.length) return ''
    const parts: string[] = []
    parts.push(`${formatCurrency(totPremi)} su ${pvData.length} PV · provvigioni medie ${pctMedia.toFixed(1)}%`)
    if (scadutiRows.length > 0) {
      parts.push(`${scadutiRows.length} titoli scaduti — ${formatCurrency(totScadutiImporto)} bloccati`)
      if (critici90 > 0) parts.push(`${critici90} da oltre 90 giorni — rischio perdita`)
    } else {
      parts.push('nessun titolo scaduto in portafoglio')
    }
    return parts.join(' · ')
  }, [pvData, totPremi, pctMedia, scadutiRows, totScadutiImporto, critici90])

  const pvRankItems = useMemo(() => pvData.map(d => ({
    name: d.name,
    value: formatCurrency(d.premi),
    sub: `Prov: ${formatCurrency(d.prov)} (${formatPercent(d.pctProv)})`,
    pct: (d.premi / maxPremi) * 100,
  })), [pvData, maxPremi])

  const prodRankItems = useMemo(() => prodData.filter(d => d.name !== 'N/D').map(d => ({
    name: d.name,
    value: formatCurrency(d.premi),
    sub: `Prov: ${formatCurrency(d.prov)}`,
    pct: (d.premi / maxProdPremi) * 100,
  })), [prodData, maxProdPremi])

  const pvScadutiRankItems = useMemo(() => {
    const maxImporto = pvScadutiData[0]?.importo || 1
    return pvScadutiData.map(d => ({
      name: d.name,
      value: formatCurrency(d.importo),
      sub: `${d.count} titoli scaduti`,
      pct: (d.importo / maxImporto) * 100,
    }))
  }, [pvScadutiData])

  const pvBarOptions = useMemo((): Highcharts.Options => ({
    chart: { type: 'column', height: 300 },
    xAxis: { categories: pvData.slice(0, 10).map(d => d.name), labels: { rotation: -30 } },
    yAxis: { labels: { formatter() { return `${((this.value as number) / 1000).toFixed(0)}k` } } },
    tooltip: { pointFormatter() { return `<b>${this.series.name}</b>: ${formatCurrency(this.y ?? 0)}<br/>` } },
    plotOptions: { column: { groupPadding: 0.1 } },
    series: [
      { type: 'column', name: 'Premi Lordi', data: pvData.slice(0, 10).map(d => d.premi), color: '#3b82f6' },
      { type: 'column', name: 'Provvigioni', data: pvData.slice(0, 10).map(d => d.prov), color: '#22c55e' },
    ],
  }), [pvData])

  const prodBarOptions = useMemo((): Highcharts.Options => ({
    chart: { type: 'bar', height: 300 },
    xAxis: { categories: prodData.slice(0, 12).map(d => d.name) },
    yAxis: { labels: { formatter() { return `${((this.value as number) / 1000).toFixed(0)}k` } } },
    series: [{ type: 'bar', name: 'Premi Lordi', data: prodData.slice(0, 12).map(d => d.premi), color: '#3b82f6' }],
  }), [prodData])

  const ageingChartOptions = useMemo((): Highcharts.Options => ({
    chart: { type: 'column', height: 200 },
    xAxis: { categories: AGEING_BUCKETS.map(b => b.label) },
    yAxis: { title: { text: '' }, labels: { formatter() { return formatCurrency(this.value as number) } } },
    plotOptions: { column: { borderRadius: 4 } },
    tooltip: { pointFormatter() { return `<b>${this.series.name}</b>: ${formatCurrency(this.y ?? 0)}<br/>` } },
    series: [{
      type: 'column',
      name: 'Importo scaduto',
      data: AGEING_BUCKETS.map(b => ageingBuckets[b.key].importo),
      colorByPoint: true,
      colors: AGEING_BUCKETS.map(b => b.color),
    }],
  }), [ageingBuckets])

  const hasFilters = filterPV.length > 0 || filterProd.length > 0 || filterRamo.length > 0

  if (!na013) return (
    <div className="p-8 flex items-center justify-center h-[calc(100vh-80px)]">
      <div className="text-center space-y-2">
        <p className="text-2xl font-semibold text-white">Incassi NA013</p>
        <p className="text-zinc-400">Carica il file NA013 per visualizzare l'analisi</p>
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
            critici90 > 0
              ? 'bg-red-500/5 border-red-500/20'
              : scadutiRows.length > 0
                ? 'bg-yellow-500/5 border-yellow-500/20'
                : 'bg-electric/5 border-electric/20'
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
          {optionsRamo.length > 0 && (
            <MultiSelect label="Ramo" options={optionsRamo} selected={filterRamo} onChange={setFilterRamo} />
          )}
          {hasFilters && (
            <button
              onClick={() => { setFilterPV([]); setFilterProd([]); setFilterRamo([]) }}
              className="text-base text-zinc-400 hover:text-red-400 transition-colors px-2 py-1 rounded"
            >
              × Reset
            </button>
          )}
          <span className="ml-auto text-base text-zinc-500 tabular-nums">
            {filteredRows.length.toLocaleString('it-IT')} titoli
          </span>
        </div>
      </BlurFade>

      {/* KPI strip */}
      <BlurFade delay={0.05}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Premi Lordi Totali" value={totPremi} formatter={formatCurrency} />
          <KpiCard label="Provvigioni Totali" value={totProv} formatter={formatCurrency} />
          <KpiCard
            label="% Media Provvigioni"
            value={pctMedia}
            formatter={n => `${n.toFixed(1)}%`}
            sub={`su ${pvData.length} PV`}
          />
          <KpiCard
            label="Titoli Scaduti"
            value={scadutiRows.length}
            sub={totScadutiImporto > 0 ? `${formatCurrency(totScadutiImporto)} bloccati` : undefined}
            positiveIsGood={false}
            className={scadutiRows.length > 0 ? 'border-accent-red/30' : ''}
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
                  Top Punti Vendita per Premi
                </p>
                <RankList
                  items={pvRankItems}
                  maxItems={10}
                  gradientFrom="#3b82f6"
                  gradientTo="#06b6d4"
                />
              </div>
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  {prodRankItems.length > 0 ? 'Top Produttori per Premi' : 'Premi & Provvigioni per PV (Top 10)'}
                </p>
                {prodRankItems.length > 0 ? (
                  <RankList
                    items={prodRankItems}
                    maxItems={10}
                    gradientFrom="#8b5cf6"
                    gradientTo="#3b82f6"
                  />
                ) : (
                  <HChart options={pvBarOptions} style={{ height: 300 }} />
                )}
              </div>
            </div>

            {/* Scaduti alert strip in panoramica */}
            {scadutiRows.length > 0 && (
              <div className="bg-card border border-accent-red/20 rounded-3xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-base text-red-400 uppercase tracking-wide font-bold">
                    Allerta Scadenziario — {scadutiRows.length} titoli · {formatCurrency(totScadutiImporto)} bloccati
                  </p>
                  <button
                    onClick={() => setActiveTab('scadenziario')}
                    className="text-base text-electric hover:underline"
                  >
                    Vedi dettaglio →
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {AGEING_BUCKETS.map(b => (
                    <div key={b.key} className={`border rounded-2xl p-3 text-center ${b.bg}`}>
                      <p className={`text-2xl font-bold ${b.text}`}>{ageingBuckets[b.key].count}</p>
                      <p className="text-base text-zinc-300 font-semibold mt-0.5">{b.label}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{formatCurrency(ageingBuckets[b.key].importo)}</p>
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
              <RankList items={pvRankItems} gradientFrom="#3b82f6" gradientTo="#06b6d4" />
            </div>
            <div className="bg-card border border-border rounded-3xl p-5">
              <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                Premi & Provvigioni per PV (Top 10)
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
                <RankList items={prodRankItems} gradientFrom="#8b5cf6" gradientTo="#3b82f6" />
              </div>
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  Premi per Produttore (Top 12)
                </p>
                <HChart options={prodBarOptions} style={{ height: 300 }} />
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl p-10 text-center">
              <p className="text-zinc-400">
                Colonna "Produttore" non trovata nel file NA013 caricato.
              </p>
            </div>
          )
        )}

        {activeTab === 'scadenziario' && (
          <div className="space-y-5">
            {scadutiRows.length === 0 ? (
              <div className="bg-card border border-emerald-500/20 rounded-3xl p-10 text-center">
                <p className="text-emerald-400 font-semibold text-lg">Nessun titolo scaduto</p>
                <p className="text-base text-zinc-400 mt-2">Tutti i titoli risultano incassati o non ancora scaduti.</p>
              </div>
            ) : (
              <>
                {/* Ageing buckets */}
                <div className="grid grid-cols-4 gap-4">
                  {AGEING_BUCKETS.map(b => (
                    <div key={b.key} className={`bg-card border rounded-3xl p-5 ${b.bg}`}>
                      <p className={`text-3xl font-bold tabular-nums ${b.text}`}>{ageingBuckets[b.key].count}</p>
                      <p className="text-base font-semibold text-zinc-200 mt-1">{b.label}</p>
                      <p className="text-base text-zinc-400 mt-0.5">{formatCurrency(ageingBuckets[b.key].importo)}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-5">
                  {/* PV breakdown */}
                  {pvScadutiRankItems.length > 0 && (
                    <div className="bg-card border border-border rounded-3xl p-5">
                      <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                        PV con più importo bloccato
                      </p>
                      <RankList
                        items={pvScadutiRankItems}
                        gradientFrom="#ef4444"
                        gradientTo="#f97316"
                        maxItems={10}
                      />
                    </div>
                  )}

                  {/* Ageing chart */}
                  <div className="bg-card border border-border rounded-3xl p-5">
                    <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-1">
                      Distribuzione Aging
                    </p>
                    <p className="text-[11px] text-zinc-500 mb-4">Importo scaduto per fascia temporale</p>
                    <HChart options={ageingChartOptions} style={{ height: 200 }} />
                  </div>
                </div>

                {/* Detail table */}
                <div className="bg-card border border-border rounded-3xl p-6">
                  <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-5">
                    Titoli scaduti senza incasso · ordinati per anzianità
                  </p>
                  <DataTable
                    columns={scadutiColumns}
                    data={scadutiRows}
                    searchPlaceholder="Cerca PV, produttore..."
                    pageSize={15}
                  />
                </div>
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
