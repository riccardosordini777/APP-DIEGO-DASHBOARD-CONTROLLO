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
import { formatCurrency, formatNumber } from '../lib/utils'
import type Highcharts from 'highcharts'
import type { ColumnDef } from '@tanstack/react-table'

type TabKey = 'panoramica' | 'pv' | 'produttore' | 'ramo' | 'tabella'

interface ProdRow { name: string; premi: number; polizze: number; clienti: number; premioPerPol: number }
interface ProdProdRow { name: string; premi: number; polizze: number }
interface RamoRow { name: string; premi: number }

const TABS = [
  { key: 'panoramica', label: 'Panoramica' },
  { key: 'pv', label: 'Per PV' },
  { key: 'produttore', label: 'Per Produttore' },
  { key: 'ramo', label: 'Per Ramo' },
  { key: 'tabella', label: 'Tabella' },
] as const

const tableColumns: ColumnDef<ProdRow>[] = [
  { accessorKey: 'name', header: 'Punto Vendita', cell: i => <span className="font-medium text-zinc-200">{i.getValue() as string}</span> },
  { accessorKey: 'premi', header: 'Premi Lordi', cell: i => <span className="font-semibold">{formatCurrency(i.getValue() as number)}</span> },
  { accessorKey: 'polizze', header: 'N. Polizze', cell: i => formatNumber(i.getValue() as number) },
  { accessorKey: 'clienti', header: 'Clienti Unici', cell: i => formatNumber(i.getValue() as number) },
  { accessorKey: 'premioPerPol', header: 'Premio / Polizza', cell: i => <span className="text-zinc-300">{formatCurrency(i.getValue() as number)}</span> },
]

export function ProduzionePage() {
  const { parsedModules, filters: gf } = useDashboardStore()
  const na108 = parsedModules['na108']

  const [activeTab, setActiveTab] = useState<TabKey>('panoramica')
  const [filterPV, setFilterPV] = useState<string[]>([])
  const [filterProd, setFilterProd] = useState<string[]>([])
  const [filterRamo, setFilterRamo] = useState<string[]>([])

  const allRows = useMemo(() => na108?.rows ?? [], [na108])

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

  const pvData = useMemo((): ProdRow[] => {
    const map: Record<string, { premi: number; polizze: number; clienti: Set<string> }> = {}
    for (const r of filteredRows) {
      const pv = ((r['pv'] as string) || '').trim() || 'N/D'
      if (!map[pv]) map[pv] = { premi: 0, polizze: 0, clienti: new Set() }
      map[pv].premi += (r['premi'] as number) || 0
      map[pv].polizze += (r['polizze'] as number) || 1
      const c = r['cliente'] as string
      if (c) map[pv].clienti.add(c)
    }
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        premi: d.premi,
        polizze: d.polizze,
        clienti: d.clienti.size,
        premioPerPol: d.polizze > 0 ? d.premi / d.polizze : 0,
      }))
      .sort((a, b) => b.premi - a.premi)
  }, [filteredRows])

  const prodData = useMemo((): ProdProdRow[] => {
    const map: Record<string, { premi: number; polizze: number }> = {}
    for (const r of filteredRows) {
      const prod = ((r['produttore'] as string) || '').trim() || 'N/D'
      if (!map[prod]) map[prod] = { premi: 0, polizze: 0 }
      map[prod].premi += (r['premi'] as number) || 0
      map[prod].polizze += (r['polizze'] as number) || 1
    }
    return Object.entries(map)
      .map(([name, d]) => ({ name, premi: d.premi, polizze: d.polizze }))
      .sort((a, b) => b.premi - a.premi)
  }, [filteredRows])

  const ramoData = useMemo((): RamoRow[] => {
    const map: Record<string, number> = {}
    for (const r of filteredRows) {
      const ramo = ((r['ramo'] as string) || '').trim() || 'N/D'
      map[ramo] = (map[ramo] || 0) + ((r['premi'] as number) || 0)
    }
    return Object.entries(map)
      .map(([name, premi]) => ({ name, premi }))
      .sort((a, b) => b.premi - a.premi)
  }, [filteredRows])

  const totPremi = pvData.reduce((s, r) => s + (Number.isFinite(r.premi) ? r.premi : 0), 0)
  const totPolizze = pvData.reduce((s, r) => s + (Number.isFinite(r.polizze) ? r.polizze : 0), 0)
  const totClienti = pvData.reduce((s, r) => s + (Number.isFinite(r.clienti) ? r.clienti : 0), 0)
  const premioMedioGlobale = totPolizze > 0 ? totPremi / totPolizze : 0
  const maxPremi = pvData[0]?.premi || 1
  const maxProdPremi = prodData[0]?.premi || 1
  const totRamoPremi = ramoData.reduce((s, r) => s + r.premi, 0)

  // Concentration analysis
  const top3Premi = pvData.slice(0, 3).reduce((s, r) => s + r.premi, 0)
  const top3Pct = totPremi > 0 ? (top3Premi / totPremi) * 100 : 0
  const top1Pct = totPremi > 0 ? ((pvData[0]?.premi || 0) / totPremi) * 100 : 0
  const concentrationLevel = top3Pct > 60 ? 'alta' : top3Pct > 40 ? 'moderata' : 'distribuita'

  // Max premioPerPol for bar scale in efficiency ranking
  const maxPremioPerPol = Math.max(...pvData.map(d => d.premioPerPol), 1)

  const insightText = useMemo(() => {
    if (!pvData.length) return ''
    const parts: string[] = []
    parts.push(`Produzione di ${formatCurrency(totPremi)} su ${pvData.length} PV attivi`)
    parts.push(`${formatNumber(totPolizze)} polizze emesse`)
    if (premioMedioGlobale > 0) parts.push(`premio medio ${formatCurrency(premioMedioGlobale)}/polizza`)
    if (top3Pct > 0) {
      const risk = top3Pct > 60 ? '⚠ concentrazione alta' : top3Pct > 40 ? 'concentrazione moderata' : 'portafoglio distribuito'
      parts.push(`top 3 PV = ${top3Pct.toFixed(0)}% del totale (${risk})`)
    }
    return parts.join(' · ')
  }, [pvData, totPremi, totPolizze, premioMedioGlobale, top3Pct])

  const pvRankItems = useMemo(() => pvData.map(d => ({
    name: d.name,
    value: formatCurrency(d.premi),
    sub: `${formatNumber(d.polizze)} polizze · ${formatCurrency(d.premioPerPol)}/polizza`,
    pct: (d.premi / maxPremi) * 100,
  })), [pvData, maxPremi])

  const pvEfficiencyRankItems = useMemo(() => [...pvData]
    .filter(d => d.polizze >= 3)
    .sort((a, b) => b.premioPerPol - a.premioPerPol)
    .map(d => ({
      name: d.name,
      value: formatCurrency(d.premioPerPol),
      sub: `${formatNumber(d.polizze)} polizze · ${formatCurrency(d.premi)} totali`,
      pct: (d.premioPerPol / maxPremioPerPol) * 100,
    })), [pvData, maxPremioPerPol])

  const prodRankItems = useMemo(() => prodData.filter(d => d.name !== 'N/D').map(d => ({
    name: d.name,
    value: formatCurrency(d.premi),
    sub: `${formatNumber(d.polizze)} polizze`,
    pct: (d.premi / maxProdPremi) * 100,
  })), [prodData, maxProdPremi])

  const ramoRankItems = useMemo(() => ramoData.map(d => ({
    name: d.name,
    value: formatCurrency(d.premi),
    sub: totRamoPremi > 0 ? `${((d.premi / totRamoPremi) * 100).toFixed(1)}% del portafoglio` : '',
    pct: totRamoPremi > 0 ? (d.premi / totRamoPremi) * 100 : 0,
  })), [ramoData, totRamoPremi])

  const pvBarOptions = useMemo((): Highcharts.Options => ({
    chart: { type: 'bar', height: 320 },
    xAxis: { categories: pvData.slice(0, 12).map(d => d.name) },
    yAxis: { labels: { formatter() { return `${((this.value as number) / 1000).toFixed(0)}k` } } },
    plotOptions: { bar: { borderRadius: 4, dataLabels: { enabled: false } } },
    series: [{ type: 'bar', name: 'Premi Lordi', data: pvData.slice(0, 12).map(d => d.premi), color: '#3b82f6' }],
  }), [pvData])

  const pvEfficiencyBarOptions = useMemo((): Highcharts.Options => ({
    chart: { type: 'bar', height: 320 },
    xAxis: {
      categories: [...pvData].filter(d => d.polizze >= 3).sort((a, b) => b.premioPerPol - a.premioPerPol).slice(0, 12).map(d => d.name),
    },
    yAxis: { labels: { formatter() { return `${((this.value as number) / 1000).toFixed(0)}k` } } },
    plotOptions: { bar: { borderRadius: 4 } },
    tooltip: { valuePrefix: '€', valueDecimals: 0 },
    series: [{
      type: 'bar',
      name: 'Premio / Polizza',
      data: [...pvData].filter(d => d.polizze >= 3).sort((a, b) => b.premioPerPol - a.premioPerPol).slice(0, 12).map(d => d.premioPerPol),
      color: '#06b6d4',
    }],
  }), [pvData])

  const prodBarOptions = useMemo((): Highcharts.Options => ({
    chart: { type: 'bar', height: 320 },
    xAxis: { categories: prodData.slice(0, 12).map(d => d.name) },
    yAxis: { labels: { formatter() { return `${((this.value as number) / 1000).toFixed(0)}k` } } },
    plotOptions: { bar: { borderRadius: 4 } },
    series: [{ type: 'bar', name: 'Premi Lordi', data: prodData.slice(0, 12).map(d => d.premi), color: '#8b5cf6' }],
  }), [prodData])

  const ramoDonutOptions = useMemo((): Highcharts.Options => ({
    chart: { type: 'pie', height: 300 },
    plotOptions: {
      pie: {
        innerSize: '50%',
        dataLabels: { enabled: true, format: '<b>{point.name}</b>: {point.percentage:.1f}%' },
      },
    },
    series: [{ type: 'pie', name: 'Premi', data: ramoData.map(d => ({ name: d.name, y: d.premi })) }],
  }), [ramoData])

  const hasFilters = filterPV.length > 0 || filterProd.length > 0 || filterRamo.length > 0

  if (!na108) return (
    <div className="p-8 flex items-center justify-center h-[calc(100vh-80px)]">
      <div className="text-center space-y-2">
        <p className="text-2xl font-semibold text-white">Produzione NA108</p>
        <p className="text-zinc-400">Carica il file NA108 per visualizzare l'analisi</p>
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
          <div className="bg-electric/5 border border-electric/20 rounded-2xl px-4 py-3">
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
            {filteredRows.length.toLocaleString('it-IT')} righe
          </span>
        </div>
      </BlurFade>

      {/* KPI strip */}
      <BlurFade delay={0.05}>
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Premi Lordi Totali" value={totPremi} formatter={formatCurrency} />
          <KpiCard label="Polizze Totali" value={totPolizze} />
          <KpiCard label="Clienti Unici" value={totClienti} sub={`su ${pvData.length} PV attivi`} />
          <KpiCard
            label="Premio Medio / Polizza"
            value={premioMedioGlobale}
            formatter={formatCurrency}
            sub="ticket medio per polizza emessa"
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
                  {prodRankItems.length > 0 ? 'Top Produttori per Premi' : 'Top Rami per Premi'}
                </p>
                {prodRankItems.length > 0 ? (
                  <RankList
                    items={prodRankItems}
                    maxItems={10}
                    gradientFrom="#8b5cf6"
                    gradientTo="#06b6d4"
                  />
                ) : (
                  <RankList
                    items={ramoRankItems}
                    maxItems={10}
                    gradientFrom="#f59e0b"
                    gradientTo="#f97316"
                  />
                )}
              </div>
            </div>

            {/* Concentration analysis card */}
            {pvData.length > 0 && (
              <div className="bg-card border border-border rounded-3xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold">
                    Analisi Concentrazione Portafoglio
                  </p>
                  <span className={`text-base font-bold px-2.5 py-1 rounded-full ${
                    concentrationLevel === 'alta'
                      ? 'bg-red-500/15 text-red-400'
                      : concentrationLevel === 'moderata'
                        ? 'bg-yellow-500/15 text-yellow-400'
                        : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    Concentrazione {concentrationLevel}
                  </span>
                </div>

                {/* Stacked concentration bar */}
                <div className="flex h-7 rounded-xl overflow-hidden gap-px mb-4">
                  {pvData.slice(0, 5).map((pv, i) => {
                    const pct = totPremi > 0 ? (pv.premi / totPremi) * 100 : 0
                    const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899']
                    return (
                      <div
                        key={pv.name}
                        style={{ width: `${pct}%`, backgroundColor: colors[i] }}
                        title={`${pv.name}: ${pct.toFixed(1)}%`}
                      />
                    )
                  })}
                  {pvData.length > 5 && (
                    <div
                      style={{
                        flex: 1,
                        backgroundColor: '#27272a',
                      }}
                      title="Altri PV"
                    />
                  )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {pvData.slice(0, 5).map((pv, i) => {
                    const pct = totPremi > 0 ? (pv.premi / totPremi) * 100 : 0
                    const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899']
                    return (
                      <div key={pv.name} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: colors[i] }} />
                        <span className="text-base text-zinc-400">{pv.name}</span>
                        <span className="text-base font-semibold text-zinc-200">{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                  {pvData.length > 5 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm bg-zinc-700 flex-shrink-0" />
                      <span className="text-base text-zinc-400">Altri {pvData.length - 5} PV</span>
                      <span className="text-base font-semibold text-zinc-200">
                        {totPremi > 0 ? (100 - pvData.slice(0, 5).reduce((s, d) => s + (d.premi / totPremi) * 100, 0)).toFixed(1) : 0}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-border/50 flex gap-6">
                  <div>
                    <p className="text-base text-zinc-500">Top PV</p>
                    <p className="text-base font-semibold text-zinc-200">{pvData[0]?.name ?? '–'} · {top1Pct.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-base text-zinc-500">Top 3 PV</p>
                    <p className="text-base font-semibold text-zinc-200">{top3Pct.toFixed(1)}% del portafoglio</p>
                  </div>
                  <div>
                    <p className="text-base text-zinc-500">PV attivi</p>
                    <p className="text-base font-semibold text-zinc-200">{pvData.length}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pv' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  Classifica per Premi Lordi
                </p>
                <RankList items={pvRankItems} gradientFrom="#3b82f6" gradientTo="#06b6d4" />
              </div>
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  Premi per PV (Top 12)
                </p>
                <HChart options={pvBarOptions} style={{ height: 320 }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-1">
                  Efficienza — Premio Medio / Polizza
                </p>
                <p className="text-[11px] text-zinc-500 mb-4">Solo PV con almeno 3 polizze</p>
                <RankList items={pvEfficiencyRankItems} gradientFrom="#06b6d4" gradientTo="#3b82f6" />
              </div>
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-1">
                  Premio Medio / Polizza per PV (Top 12)
                </p>
                <p className="text-[11px] text-zinc-500 mb-4">Ticket medio — misura la qualità della produzione</p>
                <HChart options={pvEfficiencyBarOptions} style={{ height: 320 }} />
              </div>
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
                <RankList items={prodRankItems} gradientFrom="#8b5cf6" gradientTo="#06b6d4" />
              </div>
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  Premi per Produttore (Top 12)
                </p>
                <HChart options={prodBarOptions} style={{ height: 320 }} />
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-3xl p-10 text-center">
              <p className="text-zinc-400">
                Colonna "Produttore" non trovata nel file NA108 caricato.
              </p>
            </div>
          )
        )}

        {activeTab === 'ramo' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  Classifica Rami
                </p>
                <RankList items={ramoRankItems} gradientFrom="#f59e0b" gradientTo="#f97316" />
              </div>
              <div className="bg-card border border-border rounded-3xl p-5">
                <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-4">
                  Distribuzione per Ramo
                </p>
                <HChart options={ramoDonutOptions} style={{ height: 300 }} />
              </div>
            </div>

            {/* Ramo concentration card */}
            {ramoData.length > 1 && (
              <div className="bg-card border border-border rounded-3xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold">
                    Esposizione per Ramo
                  </p>
                  {ramoData[0] && (
                    <span className="text-base text-zinc-400">
                      Ramo principale: <span className="font-semibold text-zinc-200">{ramoData[0].name}</span>
                      {' '}({totRamoPremi > 0 ? ((ramoData[0].premi / totRamoPremi) * 100).toFixed(1) : 0}%)
                    </span>
                  )}
                </div>
                <div className="flex h-5 rounded-xl overflow-hidden gap-px">
                  {ramoData.slice(0, 8).map((ramo, i) => {
                    const pct = totRamoPremi > 0 ? (ramo.premi / totRamoPremi) * 100 : 0
                    const hue = (i * 37 + 200) % 360
                    return (
                      <div
                        key={ramo.name}
                        style={{ width: `${pct}%`, backgroundColor: `hsl(${hue}, 70%, 55%)` }}
                        title={`${ramo.name}: ${pct.toFixed(1)}%`}
                      />
                    )
                  })}
                  {ramoData.length > 8 && (
                    <div style={{ flex: 1, backgroundColor: '#27272a' }} title="Altri rami" />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
                  {ramoData.slice(0, 8).map((ramo, i) => {
                    const pct = totRamoPremi > 0 ? (ramo.premi / totRamoPremi) * 100 : 0
                    const hue = (i * 37 + 200) % 360
                    return (
                      <div key={ramo.name} className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: `hsl(${hue}, 70%, 55%)` }} />
                        <span className="text-base text-zinc-400">{ramo.name}</span>
                        <span className="text-base font-semibold text-zinc-200">{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'tabella' && (
          <div className="bg-card border border-border rounded-3xl p-6">
            <p className="text-base text-zinc-400 uppercase tracking-wide font-semibold mb-5">
              Dettaglio Produzione per PV
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
