// Mirrors the products table (supabase/001_schema_v0.2.sql + 002_products_store_columns.sql).
export type ReturnsTerm = 'free' | 'fee' | 'final_sale'

export type Product = {
  id: string
  merchant_id: string
  name: string
  brand: string | null
  category: 'snowboard' | 'ski'
  size_cm: number
  colour: string
  price_cents: number
  currency: string
  image_url: string | null
  marketing_blurb: string | null
  formal_returns: ReturnsTerm
  formal_terms_text: string
  terms_version: string
  standard_shipping_cents: number
  standard_delivery_days: number
  expedited_shipping_cents: number | null
  expedited_delivery_days: number | null
  featured: boolean
  sort_order: number
}
