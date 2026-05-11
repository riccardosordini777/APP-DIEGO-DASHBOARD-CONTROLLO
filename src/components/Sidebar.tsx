import { useRef, useState, type ElementType } from 'react'
import { motion } from 'framer-motion'
import { useDashboardStore, type TabId, type ModuleId } from '../store/useDashboardStore'
import { useFileParser } from '../hooks/useFileParser'
import {
  BarChart3, LayoutDashboard, Activity, Receipt, Users, Settings,
  Upload, CheckCircle2, X, Loader2, Circle, ArrowLeftRight,
} from 'lucide-react'

const navItems: { id: TabId; label: string; icon: ElementType }[] = [
  { id: 'cruscotto',      label: 'Cruscotto',       icon: LayoutDashboard },
  { id: 'produzione',     label: 'Produzione',       icon: BarChart3 },
  { id: 'piani_lavoro',   label: 'Piani Lavoro',     icon: Users },
  { id: 'canalizzazioni', label: 'Canalizzazioni',   icon: Activity },
  { id: 'incassi',        label: 'Incassi',          icon: Receipt },
  { id: 'confronta',      label: 'Confronta PV',     icon: ArrowLeftRight },
]

const MODULE_CONFIG: { id: ModuleId; label: string; tab: TabId; tag: string }[] = [
  { id: 'na302', label: 'Portafoglio AC/AP', tab: 'cruscotto',      tag: 'NA302' },
  { id: 'na108', label: 'Produzione',        tab: 'produzione',     tag: 'NA108' },
  { id: 'na013', label: 'Incassi',           tab: 'incassi',        tag: 'NA013' },
  { id: 'si014', label: 'Canalizzazioni',    tab: 'canalizzazioni', tag: 'SI014' },
]

export function Sidebar() {
  const { activeTab, setActiveTab, parsedModules, clearModule } = useDashboardStore()
  const { parseFile } = useFileParser()
  const [isUploading, setIsUploading] = useState(false)
  const fileRefs = useRef<Partial<Record<ModuleId, HTMLInputElement | null>>>({})
  const globalInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files).filter(f => /\.(xlsx|xls)$/i.test(f.name))
    if (!arr.length) return
    setIsUploading(true)
    for (const file of arr) {
      await parseFile(file)
    }
    setIsUploading(false)
  }

  const loadedCount = MODULE_CONFIG.filter(m => !!parsedModules[m.id]).length

  return (
    <div className="w-72 border-r border-[#1f1f22] bg-[#0a0a0b] flex flex-col h-screen shrink-0">

      {/* Logo */}
      <div className="px-4 py-5 flex justify-center border-b border-[#1f1f22]">
        <img src="/logo.png" alt="Febbraro & Avorio" className="h-20 w-auto object-contain" />
      </div>

      {/* User */}
      <div className="px-6 py-4 border-b border-[#1f1f22]">
        <p className="text-base font-medium text-zinc-100">
          Benvenuto, <span className="font-semibold text-white">Diego</span>
        </p>
        <p className="text-base text-zinc-400 mt-0.5">Control Tower Manageriale</p>
      </div>

      {/* Navigation */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-3 px-2">Moduli</p>
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <motion.button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                whileHover={isActive ? {} : { scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium relative ${
                  isActive
                    ? 'bg-electric text-white shadow-lg shadow-electric/25 border border-white/20'
                    : 'text-zinc-300 border border-transparent hover:text-white hover:border-white/30 hover:bg-white/8 transition-all duration-200'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeGlow"
                    className="absolute inset-0 rounded-xl bg-electric/30 blur-md -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon size={22} />
                {item.label}
              </motion.button>
            )
          })}
        </nav>
      </div>

      {/* ── File Manager ───────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-4 border-t border-[#1f1f22] flex-1 flex flex-col overflow-hidden">

        {/* Section header */}
        <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-zinc-400 uppercase tracking-wider">Dati</p>
            <span className={`text-base px-2 py-0.5 rounded-full font-bold ${
              loadedCount === 4
                ? 'bg-accent-green/15 text-accent-green'
                : loadedCount > 0
                  ? 'bg-electric/15 text-electric'
                  : 'bg-zinc-800 text-zinc-400'
            }`}>
              {loadedCount}/4
            </span>
          </div>
          <button
            onClick={() => globalInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 text-base text-electric hover:opacity-70 disabled:opacity-40 transition-opacity font-medium"
          >
            {isUploading
              ? <Loader2 size={13} className="animate-spin" />
              : <Upload size={13} />
            }
            {isUploading ? 'Caricamento…' : 'Carica'}
          </button>
          <input
            ref={globalInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".xlsx,.xls"
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
          />
        </div>

        {/* Module slots */}
        <div className="space-y-1.5 flex-1 overflow-y-auto pr-2 min-h-0">
          {MODULE_CONFIG.map(({ id, label, tab, tag }) => {
            const mod = parsedModules[id]
            const isLoaded = !!mod

            return (
              <div
                key={id}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all select-none ${
                  isLoaded
                    ? 'hover:bg-white/5'
                    : 'opacity-60 hover:opacity-95 hover:bg-white/3'
                }`}
                onClick={() => {
                  if (isLoaded) setActiveTab(tab)
                  else fileRefs.current[id]?.click()
                }}
              >
                <div className="w-5 flex-shrink-0 flex items-center justify-center">
                  {isLoaded
                    ? <CheckCircle2 size={16} className="text-accent-green" />
                    : <Circle size={16} className="text-zinc-500" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded flex-shrink-0 ${
                      isLoaded ? 'bg-electric/15 text-electric' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {tag}
                    </span>
                    <span className={`text-base truncate leading-tight font-medium ${isLoaded ? 'text-zinc-200' : 'text-zinc-400'}`}>
                      {isLoaded
                        ? mod!.filename.replace(/\.(xlsx|xls)$/i, '').slice(0, 20)
                        : label
                      }
                    </span>
                  </div>
                  <p className="text-base mt-0.5 pl-0.5">
                    {isLoaded
                      ? <span className="text-zinc-400">{mod!.rowCount.toLocaleString('it-IT')} righe</span>
                      : <span className="text-zinc-500">Clicca per caricare</span>
                    }
                  </p>
                </div>

                {isLoaded && (
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <label
                      className="p-1.5 rounded text-zinc-400 hover:text-electric hover:bg-electric/10 transition-colors cursor-pointer"
                      title="Sostituisci file"
                      onClick={e => e.stopPropagation()}
                    >
                      <Upload size={13} />
                      <input
                        ref={el => { fileRefs.current[id] = el }}
                        type="file"
                        className="hidden"
                        accept=".xlsx,.xls"
                        onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
                      />
                    </label>
                    <button
                      className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Rimuovi dati"
                      onClick={e => { e.stopPropagation(); clearModule(id) }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                {!isLoaded && (
                  <input
                    ref={el => { fileRefs.current[id] = el }}
                    type="file"
                    className="hidden"
                    accept=".xlsx,.xls"
                    onChange={e => { handleFiles(e.target.files); e.target.value = '' }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {loadedCount === 0 && (
          <div
            className="mt-3 border border-dashed border-zinc-700/50 rounded-xl p-3 cursor-pointer hover:border-electric/40 transition-colors flex-shrink-0"
            onClick={() => globalInputRef.current?.click()}
          >
            <p className="text-[11px] text-zinc-500 text-center leading-relaxed">
              Trascina i file Excel qui<br />
              o clicca <span className="text-electric">Carica</span> sopra
            </p>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="px-4 pb-6 border-t border-[#1f1f22] pt-4">
        <motion.button
          whileHover={{ scale: 1.02, x: 2 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-base font-medium text-zinc-400 hover:text-white border border-transparent hover:border-white/15 hover:bg-white/5 transition-colors duration-150"
        >
          <Settings size={18} />
          Impostazioni
        </motion.button>
      </div>
    </div>
  )
}
