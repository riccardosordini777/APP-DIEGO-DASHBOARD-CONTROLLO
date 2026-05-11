import { Bell, Settings, Sparkles } from 'lucide-react'
import { useDashboardStore } from '../store/useDashboardStore'

export function TopBar() {
  const { setAnalystOpen } = useDashboardStore()

  return (
    <div className="h-20 border-b border-[#1f1f22] bg-[#0a0a0b]/80 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-10 w-full shrink-0">
      <div className="flex gap-2">
        <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1e] rounded-full border border-[#27272a] text-base text-zinc-300">
          <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></span>
          Sistema Operativo
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button
          onClick={() => setAnalystOpen(true)}
          className="relative group w-80 cursor-pointer"
        >
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Sparkles className="h-4 w-4 text-electric group-hover:animate-pulse transition-colors" />
          </div>
          <div className="w-full flex items-center bg-[#1a1a1e] border border-[#27272a] hover:border-electric/50 rounded-full py-2.5 pl-11 pr-4 text-base text-zinc-400 transition-colors">
            Chiedi all'Analista AI...
            <div className="ml-auto">
              <kbd className="hidden md:inline-flex items-center gap-1 rounded bg-[#27272a] px-1.5 font-mono text-[10px] font-medium text-zinc-300">
                ⌘K
              </kbd>
            </div>
          </div>
        </button>

        <div className="flex bg-[#1a1a1e] border border-[#27272a] rounded-full p-1">
          <button className="p-2.5 rounded-full hover:bg-[#27272a] transition-colors relative">
            <Bell size={22} className="text-zinc-400" />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-electric rounded-full border-2 border-[#1a1a1e]" />
          </button>
          <button className="p-2.5 rounded-full hover:bg-[#27272a] transition-colors">
            <Settings size={22} className="text-zinc-400" />
          </button>
        </div>

        <div className="flex items-center gap-3 pl-4 border-l border-[#27272a]">
          <div className="w-11 h-11 rounded-full bg-electric/20 border border-electric/30 flex items-center justify-center text-base font-bold text-electric">
            D
          </div>
          <div className="hidden md:block">
            <p className="text-base font-medium text-zinc-100">Diego Avorio</p>
            <p className="text-base text-zinc-400">Manager Strategy</p>
          </div>
        </div>
      </div>
    </div>
  )
}
