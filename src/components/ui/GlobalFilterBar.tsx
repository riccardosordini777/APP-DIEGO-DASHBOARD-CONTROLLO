import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X, Filter, SlidersHorizontal } from 'lucide-react'
import { useDashboardStore } from '../../store/useDashboardStore'
import { cn } from '../../lib/utils'

interface DropdownPos { top: number; left: number; minWidth: number }

function GlobalSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0, minWidth: 200 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const isActive = value !== 'Tutti'

  const recalcPos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, minWidth: Math.max(r.width, 220) })
  }, [])

  useEffect(() => {
    if (!open) return
    recalcPos()
    const handle = (e: MouseEvent) => {
      const t = e.target as Node
      if (
        btnRef.current && !btnRef.current.contains(t) &&
        dropRef.current && !dropRef.current.contains(t)
      ) { setOpen(false); setSearch('') }
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

  const filtered = options.filter(o => o.toLowerCase().startsWith(search.toLowerCase()) || search === '')

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-all whitespace-nowrap font-medium',
          isActive || open
            ? 'border-electric/60 bg-electric/10 text-electric'
            : 'border-border bg-card text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
        )}
      >
        <span className="max-w-[160px] truncate">
          {isActive ? value : label}
        </span>
        {isActive && (
          <span
            className="flex-shrink-0 text-electric hover:text-white transition-colors"
            onClick={e => { e.stopPropagation(); onChange('Tutti') }}
          >
            <X size={10} />
          </span>
        )}
        <ChevronDown size={14} className={cn('flex-shrink-0 transition-transform text-zinc-500', open && 'rotate-180')} />
      </button>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.minWidth, zIndex: 99999 }}
          className="bg-[#1a1a1e] border border-[#27272a] rounded-xl shadow-2xl max-w-[300px] w-max"
        >
          <div className="flex items-center gap-2 p-2.5 border-b border-[#27272a]">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca…"
              className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 outline-none"
            />
          </div>

          <button
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2.5 text-sm border-b border-[#27272a]/50 hover:bg-white/3 transition-colors',
              value === 'Tutti' ? 'text-electric font-semibold' : 'text-zinc-500',
            )}
            onClick={() => { onChange('Tutti'); setOpen(false); setSearch('') }}
          >
            Tutti (reset)
          </button>

          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-zinc-600 py-4">Nessun risultato</p>
            ) : (
              filtered.map(opt => (
                <button
                  key={opt}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/3 transition-colors text-left',
                    value === opt ? 'text-electric font-semibold' : 'text-zinc-300',
                  )}
                  onClick={() => { onChange(opt); setOpen(false); setSearch('') }}
                >
                  {value === opt && <span className="text-electric">✓</span>}
                  <span className="truncate">{opt}</span>
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

export function GlobalFilterBar() {
  const { parsedModules, filters, setFilter, resetFilters } = useDashboardStore()

  const hasAnyData = Object.keys(parsedModules).length > 0
  const isFiltered = filters.pv !== 'Tutti' || filters.produttore !== 'Tutti' || filters.ramo !== 'Tutti'

  const allPVs = useMemo(() => {
    const s = new Set<string>()
    for (const mod of Object.values(parsedModules)) {
      if (mod) for (const row of mod.rows) { const v = (row['pv'] as string)?.trim(); if (v) s.add(v) }
    }
    return [...s].sort()
  }, [parsedModules])

  const allProd = useMemo(() => {
    const s = new Set<string>()
    for (const mod of Object.values(parsedModules)) {
      if (mod) for (const row of mod.rows) { const v = (row['produttore'] as string)?.trim(); if (v) s.add(v) }
    }
    return [...s].sort()
  }, [parsedModules])

  const allRami = useMemo(() => {
    const s = new Set<string>()
    for (const mod of Object.values(parsedModules)) {
      if (mod) for (const row of mod.rows) { const v = (row['ramo'] as string)?.trim(); if (v) s.add(v) }
    }
    return [...s].sort()
  }, [parsedModules])

  return (
    <div className={cn(
      'border-b px-5 py-3 flex items-center gap-3 flex-wrap shrink-0 transition-all duration-300 min-h-[52px]',
      !hasAnyData
        ? 'bg-[#0a0a0b]/40 border-[#1f1f22]/50'
        : isFiltered
          ? 'bg-electric/5 border-electric/25'
          : 'bg-[#0a0a0b] border-[#1f1f22]',
    )}>

      <div className="flex items-center gap-2 flex-shrink-0">
        <SlidersHorizontal size={14} className={isFiltered ? 'text-electric' : 'text-zinc-500'} />
        <span className={cn('text-xs font-bold uppercase tracking-wider', isFiltered ? 'text-electric' : 'text-zinc-500')}>
          {isFiltered ? 'Contesto attivo' : 'Contesto globale'}
        </span>
      </div>

      <div className="w-px h-4 bg-zinc-800 flex-shrink-0" />

      {allPVs.length > 0 && (
        <GlobalSelect label="Tutti i PV" value={filters.pv} options={allPVs} onChange={v => setFilter('pv', v)} />
      )}
      {allProd.length > 1 && (
        <GlobalSelect label="Tutti i Produttori" value={filters.produttore} options={allProd} onChange={v => setFilter('produttore', v)} />
      )}
      {allRami.length > 1 && (
        <GlobalSelect label="Tutti i Rami" value={filters.ramo} options={allRami} onChange={v => setFilter('ramo', v)} />
      )}

      {isFiltered && (
        <>
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0"
          >
            <X size={11} />
            Reset tutto
          </button>

          <div className="ml-auto flex items-center gap-1.5 text-[11px] text-zinc-500 flex-shrink-0">
            <Filter size={10} />
            <span>
              Tutte le pagine:{' '}
              <span className="text-zinc-200 font-semibold">
                {[
                  filters.pv !== 'Tutti' && filters.pv,
                  filters.produttore !== 'Tutti' && filters.produttore,
                  filters.ramo !== 'Tutti' && filters.ramo,
                ].filter(Boolean).join(' · ')}
              </span>
            </span>
          </div>
        </>
      )}
    </div>
  )
}
