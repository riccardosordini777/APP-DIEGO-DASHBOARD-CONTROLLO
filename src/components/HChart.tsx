import { useEffect } from 'react'
import Highcharts from 'highcharts'
import HighchartsReactModule from 'highcharts-react-official'

// CJS/ESM interop: Vite può esporre { default: Component } invece del componente diretto
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HighchartsReact: typeof HighchartsReactModule = (HighchartsReactModule as any).default ?? HighchartsReactModule

// Dark theme globale — applicato una volta sola
let themeApplied = false
function applyDarkTheme() {
  if (themeApplied) return
  themeApplied = true
  Highcharts.setOptions({
    chart: {
      backgroundColor: 'transparent',
      style: { fontFamily: "'Inter', system-ui, sans-serif" },
      animation: { duration: 400 },
    },
    title: { text: '', style: { color: '#e4e4e7' } },
    subtitle: { style: { color: '#71717a' } },
    xAxis: {
      gridLineColor: '#1f1f22',
      lineColor: '#27272a',
      tickColor: '#27272a',
      labels: { style: { color: '#71717a', fontSize: '12px' } },
      title: { style: { color: '#71717a' } },
    },
    yAxis: {
      gridLineColor: '#1f1f22',
      lineColor: 'transparent',
      labels: { style: { color: '#71717a', fontSize: '12px' } },
      title: { text: '', style: { color: '#71717a' } },
    },
    tooltip: {
      backgroundColor: '#1a1a1e',
      borderColor: '#27272a',
      borderRadius: 10,
      style: { color: '#e4e4e7', fontSize: '13px' },
      shadow: false,
    },
    legend: {
      itemStyle: { color: '#a1a1aa', fontWeight: '400', fontSize: '12px' },
      itemHoverStyle: { color: '#e4e4e7' },
    },
    plotOptions: {
      series: {
        animation: { duration: 400 },
        borderWidth: 0,
        states: { hover: { brightness: 0.1 } },
      },
      column: { borderRadius: 4 },
      bar: { borderRadius: 4 },
      pie: {
        dataLabels: { color: '#a1a1aa', style: { fontSize: '12px', fontWeight: '400', textOutline: 'none' } },
      },
    },
    credits: { enabled: false },
    colors: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'],
  })
}

interface HChartProps {
  options: Highcharts.Options
  style?: React.CSSProperties
  className?: string
}

export function HChart({ options, style, className }: HChartProps) {
  useEffect(() => { applyDarkTheme() }, [])

  return (
    <div style={style} className={className}>
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
        containerProps={{ style: { height: '100%', width: '100%' } }}
      />
    </div>
  )
}
