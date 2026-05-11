import { TrendingDown, TrendingUp, Activity } from 'lucide-react'
import { getFrequenzaColor, formatNumber, formatCurrency } from '../lib/utils'

interface KpiItem {
  name: string
  premi: number
  performance: number
  polizze: number
  frequenzaSinistri?: number
}

interface Props {
  items: KpiItem[]
}

export function KpiGrid({ items }: Props) {
  if (items.length === 0) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-[#1a1a1e] border border-[#27272a] rounded-2xl p-4 animate-pulse h-24"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.slice(0, 4).map((item) => {
        const freq = item.frequenzaSinistri ?? 0
        const colorClass = getFrequenzaColor(freq)
        const isPositive = item.performance >= 0

        return (
          <div
            key={item.name}
            className="bg-[#1a1a1e] border border-[#27272a] rounded-2xl p-4 flex flex-col justify-between hover:border-[#3f3f46] transition-colors cursor-pointer relative overflow-hidden group"
          >
            <div
              className={`absolute inset-0 bg-gradient-to-tr opacity-0 group-hover:opacity-5 transition-opacity duration-300 ${
                freq < 3.9 ? 'from-green-500' : freq <= 4.9 ? 'from-yellow-500' : 'from-red-500'
              }`}
            />
            <div className="z-10">
              <div className="flex justify-between items-start mb-1">
                <h4 className="text-lg font-semibold text-white">
                  {formatCurrency(item.premi)}
                </h4>
                {freq > 0 && (
                  <span
                    className={`text-base font-bold px-2 py-0.5 rounded flex items-center bg-[#121214] border border-[#27272a] ${colorClass}`}
                  >
                    <Activity size={10} className="mr-1" />
                    {freq.toFixed(1)}%
                  </span>
                )}
              </div>
              <p
                className={`text-base flex items-center font-medium ${
                  isPositive ? 'text-accent-green' : 'text-accent-red'
                }`}
              >
                {isPositive ? (
                  <TrendingUp size={12} className="mr-1" />
                ) : (
                  <TrendingDown size={12} className="mr-1" />
                )}
                {isPositive ? '+' : ''}
                {item.performance.toFixed(1)}% vs PY
              </p>
            </div>
            <div className="mt-6 flex justify-between items-center border-t border-[#27272a] pt-3 z-10">
              <span className="text-base font-semibold text-zinc-200 truncate">{item.name}</span>
              <span className="text-base text-zinc-400 shrink-0 ml-2">
                {formatNumber(item.polizze)} pol.
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
