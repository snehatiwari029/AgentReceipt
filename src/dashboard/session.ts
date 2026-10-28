// Demo sign-in only. There is no real account, password or token: this just remembers, for this
// browser tab, that the demo merchant signed in. Real merchant auth is out of scope for the hackathon.
const KEY = 'agentreceipt-demo-merchant'

export function isSignedIn(): boolean {
  try {
    return sessionStorage.getItem(KEY) === 'yes'
  } catch {
    return false
  }
}

export function signIn(): void {
  try {
    sessionStorage.setItem(KEY, 'yes')
  } catch {
    /* storage unavailable: caller keeps state in memory */
  }
}

export function signOut(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* nothing to clear */
  }
}

// Set by the B2B site's phone popup when its order completes: the dashboard then offers the guided tour once,
// and sends the merchant to this landing page afterwards. A direct dashboard login never sets it.
const TOUR_OFFER = 'agentreceipt-tour-offer'

export function offerTour(landing: string): void {
  try {
    sessionStorage.setItem(TOUR_OFFER, landing)
  } catch {
    /* storage unavailable: the dashboard shows its Start tour button instead */
  }
}

export function peekTourOffer(): string | null {
  try {
    return sessionStorage.getItem(TOUR_OFFER)
  } catch {
    return null
  }
}

export function clearTourOffer(): void {
  try {
    sessionStorage.removeItem(TOUR_OFFER)
  } catch {
    /* nothing to clear */
  }
}
