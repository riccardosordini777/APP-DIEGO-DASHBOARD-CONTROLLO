import { cn } from '~/lib/utils'

interface Tab {
  key: string
  label: string
}

interface PageTabsProps {
  tabs: readonly Tab[]
  active: string
  onChange: (key: string) => void
  className?: string
}

export function PageTabs({ tabs, active, onChange, className }: PageTabsProps) {
  return (
    <div className={cn('flex gap-2 flex-wrap', className)}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'px-4 py-1.5 rounded-lg border text-sm font-semibold transition-all',
            tab.key === active
              ? 'bg-electric border-electric text-white shadow-sm shadow-electric/20'
              : 'bg-card border-border text-zinc-400 hover:border-zinc-600 hover:text-zinc-200',
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
