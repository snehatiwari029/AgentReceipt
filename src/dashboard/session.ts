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
