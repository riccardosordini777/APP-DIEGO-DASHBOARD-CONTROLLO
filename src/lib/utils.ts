import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getFrequenzaColor(val: number) {
  if (val < 3.9) return 'text-accent-green'
  if (val <= 4.9) return 'text-yellow-500'
  return 'text-accent-red'
}

export function getCanalizzazioneColor(val: number) {
  if (val > 60) return 'text-accent-green'
  if (val >= 40) return 'text-yellow-500'
  return 'text-accent-red'
}

export function formatCurrency(value: number) {
  const rounded = Math.round(value * 100) / 100
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rounded)
}

export function formatNumber(value: number) {
  const rounded = Math.round(value * 100) / 100
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rounded)
}

export function formatPercent(value: number, decimals = 1) {
  return `${Math.round(value * 10 ** decimals) / 10 ** decimals}%`
}
