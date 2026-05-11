import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { AnimatedNumber } from './ui/AnimatedNumber'
import { cn } from '~/lib/utils'

interface KpiCardProps {
  label: string
  value: number
  formatter?: (n: number) => string
  delta?: number
  deltaLabel?: string
  apValue?: number
  apFormatter?: (n: number) => string
  sub?: string
  className?: string
  /** When false, a decrease is shown green (e.g. sinistri non canalizzati) */
  positiveIsGood?: boolean
}

export function KpiCard({
  label,
  value,
  formatter,
  delta,
  deltaLabel = 'vs AP',
  apValue,
  apFormatter,
  sub,
  className,
  positiveIsGood = true,
}: KpiCardProps) {
  const hasDelta = delta !== undefined
  const isPositive = hasDelta && delta > 0
  const isNegative = hasDelta && delta < 0

  const deltaColor = !hasDelta
    ? ''
    : positiveIsGood
      ? isPositive
        ? 'text-accent-green'
        : isNegative
          ? 'text-accent-red'
          : 'text-zinc-400'
      : isNegative
        ? 'text-accent-green'
        : isPositive
          ? 'text-accent-red'
          : 'text-zinc-400'

  const DeltaIcon = !hasDelta || delta === 0 ? Minus : isPositive ? TrendingUp : TrendingDown

  const fmt = formatter ?? ((n: number) => n.toLocaleString('it-IT'))
  const apFmt = apFormatter ?? fmt

  return (
    <div
      className={cn(
        'bg-card border-2 border-zinc-700 rounded-2xl p-6 flex flex-col gap-2 hover:border-zinc-600 transition-colors',
        className,
      )}
    >
      <p className="text-base text-zinc-400 uppercase tracking-wider font-semibold">
        {label}
      </p>

      <AnimatedNumber
        value={value}
        formatter={fmt}
        className="text-4xl font-bold font-mono text-white leading-none"
      />

      {hasDelta && (
        <div className={cn('flex items-center gap-1.5 text-base font-medium mt-1', deltaColor)}>
          <DeltaIcon size={12} />
          <span>
            {isPositive ? '+' : ''}
            {delta.toFixed(1)}% {deltaLabel}
          </span>
          {apValue !== undefined && (
            <span className="text-zinc-300 ml-1.5 font-normal">
              AP: {apFmt(apValue)}
            </span>
          )}
        </div>
      )}

      {sub && <p className="text-base text-zinc-400 mt-1">{sub}</p>}
    </div>
  )
}
