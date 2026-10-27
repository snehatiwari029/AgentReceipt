import type { ReactNode } from 'react'

// A centred iPhone-style frame on a neutral page. The "Muse" header lives inside the phone.
export default function PhoneFrame({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-200 p-4">
      <div
        data-testid="phone-frame"
        className="relative flex h-[min(820px,calc(100dvh-2rem))] w-[390px] max-w-full flex-col overflow-hidden rounded-[48px] border-[10px] border-neutral-900 bg-white shadow-2xl"
      >
        <div aria-hidden="true" className="absolute left-1/2 top-2 z-10 h-6 w-28 -translate-x-1/2 rounded-full bg-neutral-900" />
        <header className="shrink-0 border-b border-neutral-200 bg-white px-5 pb-3 pt-11 text-center">
          <h1 className="text-lg font-bold text-neutral-900">Muse</h1>
          <p className="text-xs text-neutral-500">Your personal shopper at Northwind Outfitters</p>
        </header>
        {children}
        <div className="shrink-0 border-t border-neutral-200 bg-white px-3 pb-5 pt-3">{footer}</div>
      </div>
    </div>
  )
}
