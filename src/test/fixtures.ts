import type { Product } from '../shared/types'

// TEST fixtures only. The app itself contains no product data: it reads the products table.
export function row(over: Partial<Product>): Product {
  return {
    id: crypto.randomUUID(),
    merchant_id: 'm1',
    name: 'X',
    brand: 'BRAND',
    category: 'snowboard',
    size_cm: 150,
    colour: null,
    gender: null,
    style: null,
    details: null,
    mrp_cents: null,
    discount_pct: null,
    price_cents: 10000,
    currency: 'USD',
    image_url: null,
    image_file: null,
    image_id: null,
    image_hash: null,
    marketing_blurb: null,
    formal_returns: 'free',
    formal_terms_text: 'Free returns within 30 days',
    terms_version: 'v1',
    standard_shipping_cents: 0,
    standard_delivery_days: 3,
    expedited_shipping_cents: null,
    expedited_delivery_days: null,
    featured: false,
    sort_order: 0,
    ...over,
  }
}

const final = { formal_returns: 'final_sale' as const, formal_terms_text: 'Final Sale', standard_delivery_days: 5, expedited_shipping_cents: 6000, expedited_delivery_days: 2 }
const photo = (f: string) => `https://example.test/storage/product-images/products/${f}`

export const NINE: Product[] = [
  row({ name: 'Spellbinder Snowboard 2026/2027', brand: 'Burton', size_cm: 156, colour: 'Blue/Black', price_cents: 44995, featured: true, sort_order: 1, marketing_blurb: 'Easy returns.', image_url: photo('burton-spellbinder.png'), ...final }),
  row({ name: 'T. Rice Orca Snowboard 2025/2026', brand: 'Lib Tech', size_cm: 156, price_cents: 48983, sort_order: 2 }),
  row({ name: 'Outerspace Living Snowboard 2025/2026', brand: 'Capita', size_cm: 156, price_cents: 37083, sort_order: 3 }),
  row({ name: 'Assassin Snowboard 2025/2026', brand: 'Salomon', size_cm: 156, price_cents: 45483, sort_order: 4 }),
  row({ name: "Airheart 2.0 Snowboard Women's 2025/2026", brand: 'Jones', size_cm: 152, price_cents: 44083, sort_order: 5 }),
  row({ name: 'Alternator Snowboard 2026/2027', brand: 'Nitro', size_cm: 159, price_cents: 59995, sort_order: 6, ...final }),
  row({ name: 'Bent 85 Skis with Bindings 2026/2027', brand: 'Atomic', category: 'ski', size_cm: 170, price_cents: 59995, sort_order: 7 }),
  row({ name: 'QST 92 Skis with Bindings 2025/2026', brand: 'Salomon', category: 'ski', size_cm: 152, price_cents: 71995, sort_order: 8 }),
  row({ name: 'Sender Soul 92 Skis with Bindings 2025/2026', brand: 'Rossignol', category: 'ski', size_cm: 166, price_cents: 74995, sort_order: 9 }),
]
