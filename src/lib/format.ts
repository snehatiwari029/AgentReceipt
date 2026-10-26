import type { ReturnsTerm } from '../types'

export function formatMoney(cents: number, currency = 'USD'): string {
  const whole = cents % 100 === 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100)
}

export function returnsLabel(term: ReturnsTerm): string {
  switch (term) {
    case 'free':
      return 'Free returns'
    case 'final_sale':
      return 'Final sale'
    case 'fee':
      return 'Returns with fee'
  }
}

export function shippingLabel(cents: number): string {
  return cents === 0 ? 'Free' : formatMoney(cents)
}

export function daysLabel(days: number): string {
  return days === 1 ? '1 day' : `${days} days`
}

const SWATCH: Record<string, string> = {
  blue: '#3b82f6',
  black: '#0f172a',
  red: '#ef4444',
  grey: '#94a3b8',
  gray: '#94a3b8',
  white: '#f8fafc',
}

// "Black/Red" -> ["#0f172a", "#ef4444"]. Unknown colour names fall back to a neutral tone.
export function swatchColours(colour: string | null): string[] {
  if (!colour) return ['#94a3b8']
  return colour.split('/').map((part) => SWATCH[part.trim().toLowerCase()] ?? '#64748b')
}
