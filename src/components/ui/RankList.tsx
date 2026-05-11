import { cn } from '~/lib/utils'

export interface RankItem {
  name: string
  value: string
  sub?: string
  pct?: number
}

interface RankListProps {
  items: RankItem[]
  maxItems?: number
  gradientFrom?: string
  gradientTo?: string
  className?: string
}

export function RankList({
  items,
  maxItems,
  gradientFrom = '#3b82f6',
  gradientTo = '#06b6d4',
  className,
}: RankListProps) {
  const displayed = maxItems ? items.slice(0, maxItems) : items

  return (
    <div className={cn('', className)}>
      {displayed.map((item, i) => {
        const rank = i + 1
        const rankClass =
          rank === 1
            ? 'text-yellow-400'
            : rank === 2
              ? 'text-zinc-300'
              : rank === 3
                ? 'text-amber-600'
                : 'text-zinc-600'

        return (
          <div
            key={`${item.name}-${i}`}
            className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0"
          >
            <span className={cn('text-xs font-bold w-5 text-right flex-shrink-0 tabular-nums', rankClass)}>
              {rank}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-200 truncate">{item.name}</span>
                <span className="text-sm font-bold text-zinc-100 flex-shrink-0 tabular-nums">
                  {item.value}
                </span>
              </div>
              {item.sub && (
                <p className="text-[11px] text-zinc-500 mt-0.5 leading-none">{item.sub}</p>
              )}
              {item.pct !== undefined && (
                <div className="mt-1.5 h-[3px] bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.min(100, Math.max(0, item.pct))}%`,
                      background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
