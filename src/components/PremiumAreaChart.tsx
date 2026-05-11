import { useMemo } from 'react'
import { HChart } from './HChart'
import type Highcharts from 'highcharts'

interface Props {
  data: { month: string; value: number }[]
}

export function PremiumAreaChart({ data }: Props) {
  const options = useMemo((): Highcharts.Options => ({
    chart: { type: 'area', height: 260, marginLeft: 55, marginRight: 10 },
    xAxis: { categories: data.map((d) => d.month) },
    yAxis: {
      labels: {
        formatter() { return `${((this.value as number) / 1000).toFixed(0)}k` },
      },
    },
    tooltip: {
      formatter() {
        return `<b>${this.x}</b><br/>${new Intl.NumberFormat('it-IT', {
          style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
        }).format(this.y ?? 0)}`
      },
    },
    plotOptions: {
      area: {
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, 'rgba(59,130,246,0.35)'],
            [1, 'rgba(59,130,246,0)'],
          ],
        },
        lineWidth: 3,
        marker: { enabled: false, states: { hover: { enabled: true, radius: 4 } } },
        states: { hover: { lineWidth: 3 } },
        threshold: null,
      },
    },
    series: [{
      type: 'area',
      name: 'Premi Lordi',
      data: data.map((d) => d.value),
      color: '#3b82f6',
    }],
  }), [data])

  return <HChart options={options} style={{ height: 260 }} />
}
