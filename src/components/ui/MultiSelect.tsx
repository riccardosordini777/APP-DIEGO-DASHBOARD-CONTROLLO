import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '~/lib/utils'

interface MultiSelectProps {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
  className?: string
}

interface DropdownPos { top: number; left: number; minWidth: number }

export function MultiSelect({ label, options, selected, onChange, className }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0, minWidth: 200 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const recalcPos = useCallback(() => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, minWidth: Math.max(r.width, 200) })
  }, [])

  useEffect(() => {
    if (!open) return
    recalcPos()
    const handle = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        btnRef.current && !btnRef.current.contains(target) &&
        dropRef.current && !dropRef.current.contains(target)
      ) {
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

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
  const count = selected.length
  const allSelected = count === 0

  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val])

  const displayLabel =
    allSelected ? label : count === 1 ? selected[0] : `${label} (${count})`

  return (
    <div className={cn('relative', className)}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all whitespace-nowrap',
          open || count > 0
            ? 'border-electric/60 bg-electric/10 text-electric'
            : 'border-border bg-card text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
        )}
      >
        <span className="truncate max-w-[140px]">{displayLabel}</span>
        {count > 0 && (
          <span className="bg-electric text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none flex-shrink-0">
            {count}
          </span>
        )}
        <ChevronDown
          size={11}
          className={cn('flex-shrink-0 transition-transform text-zinc-500', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.minWidth, zIndex: 9999 }}
          className="bg-[#1a1a1e] border border-[#27272a] rounded-xl shadow-2xl max-w-[300px] w-max"
        >
          <div className="flex items-center gap-2 p-2 border-b border-[#27272a]">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca…"
              className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
            />
            {count > 0 && (
              <button
                onClick={() => { onChange([]); setSearch('') }}
                className="text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 px-3 py-2 border-b border-[#27272a]/50 cursor-pointer hover:bg-white/3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => { if (!allSelected) onChange([]) }}
              className="accent-electric"
            />
            Tutti
          </label>

          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-zinc-600 py-4">Nessun risultato</p>
            ) : (
              filtered.map(opt => (
                <label
                  key={opt}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/3 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => toggle(opt)}
                    className="accent-electric"
                  />
                  <span className="text-sm text-zinc-300 truncate">{opt}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
