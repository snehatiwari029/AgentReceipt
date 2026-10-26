import type { Product } from '../types'
import { swatchColours } from '../lib/format'

// Shows image_url when the products row has one. Until Muse Image product photos
// are generated and stored, it draws a neutral placeholder tinted with the product's
// colour. The placeholder carries no text and no claims about the product.
export default function ProductImage({ product, className = '' }: { product: Product; className?: string }) {
  if (product.image_url) {
    return (
      <img
        src={product.image_url}
        alt={product.brand ? `${product.brand} ${product.name}` : product.name}
        loading="lazy"
        className={`h-full w-full object-cover ${className}`}
      />
    )
  }

  const colours = swatchColours(product.colour)
  const isSki = product.category === 'ski'

  return (
    <div
      aria-hidden="true"
      data-testid="image-placeholder"
      className={`flex h-full w-full items-center justify-center bg-slate-100 ${className}`}
    >
      <div className={`flex ${isSki ? 'gap-3' : ''} -rotate-[18deg]`}>
        {(isSki ? [0, 1] : [0]).map((i) => (
          <div
            key={i}
            className={`overflow-hidden rounded-full border border-slate-400 shadow-sm ${isSki ? 'h-44 w-3.5' : 'h-48 w-12'}`}
            style={{
              background:
                colours.length > 1
                  ? `linear-gradient(90deg, ${colours[0]} 0 50%, ${colours[1]} 50% 100%)`
                  : colours[0],
            }}
          />
        ))}
      </div>
    </div>
  )
}
