// Copy and demo data for the B2B site. Every figure here is a demo value from the seeded or live hero order
// (12322), labelled "Demo data" where it is shown. Nothing here is a customer, a metric or a price.

export const HERO_SUB =
  'AI agents are placing orders for your customers. AgentReceipt proves what the agent was authorized to do, what it actually did, and whether you should ship it — before fulfillment, not after a dispute.'
export const DEMO_NOTE = 'Demo data only. No real payment, no real auth in this demo.'
export const LOGIN_NOTE = 'Demo merchant — no real auth in hackathon build'

export const GAP_LINE =
  "Existing intent protocols give you an authorization. They don’t give you mismatch detection, a merchant verdict, or a dispute evidence pack. That’s the gap AgentReceipt fills."
export const LIABILITY_LINE =
  'AgentReceipt shows mismatch facts only; it does not decide liability and no network rule moves liability on this screen.'

// The hero order as the live 2-day prompt recorded it (order 12322 in Supabase).
export const HERO_ORDER = {
  ref: '12322',
  total_cents: 50995,
  decision: 'review_required',
  problems: 2,
}

export type VerdictRow = {
  field: string
  grant: string
  terms: string
  actual: string
  match: 'mismatch' | 'match' | 'none'
  matchLabel: string
  cause: string
  next: string
  who: string
}

export const VERDICT_ROWS: VerdictRow[] = [
  {
    field: 'Budget', grant: '$500 total', terms: '—', actual: '$509.95 total', match: 'mismatch', matchLabel: '✕ Mismatch',
    cause: 'Agent treated cap as item-only ($449.95 item < $500, total $509.95 > $500)',
    next: 'Merchant reviews — ask customer to confirm $509.95 total, or cancel / adjust', who: 'Merchant',
  },
  {
    field: 'Returns', grant: 'Returnable required', terms: 'Final Sale', actual: '“Easy returns” summary', match: 'mismatch', matchLabel: '✕ Mismatch',
    cause: 'Agent summary misrepresented formal terms',
    next: 'Merchant reviews — confirm Final sale terms with customer, or cancel / offer returnable alternative', who: 'Merchant',
  },
  { field: 'Size', grant: '150-165 cm', terms: '—', actual: '156 cm', match: 'match', matchLabel: '✓ Match', cause: '—', next: '—', who: '—' },
  {
    field: 'Delivery', grant: 'Wed Oct 28, 2026 (live 2-day prompt)', terms: '—', actual: 'Wed Oct 28', match: 'match', matchLabel: '✓ Match',
    cause: '—', next: '—', who: '—',
  },
  {
    field: 'Colour', grant: 'Not specified — no check', terms: '—', actual: 'Serpent', match: 'none', matchLabel: '— No check',
    cause: '—', next: '—', who: '—',
  },
  { field: 'Merchant', grant: 'Northwind Outfitters only', terms: '—', actual: 'Northwind Outfitters', match: 'match', matchLabel: '✓ Match', cause: '—', next: '—', who: '—' },
  {
    field: 'Payment', grant: 'Demo Checkout present', terms: '—', actual: 'Demo Checkout (PayPal, as chosen)', match: 'match', matchLabel: '✓ Match',
    cause: 'Payment detail does not affect Budget/Returns', next: '—', who: '—',
  },
]

export const ISSUES = [
  {
    title: 'Product page says “Easy returns”, formal terms are Final Sale.',
    evidence: 'marketing_blurb “Easy returns” vs terms_text “Final Sale”.',
    fix: 'Change page summary to “Final Sale — no returns” or change terms to Free returns, do not leave them contradicting.',
    impact: 'Fewer Returns mismatches on Spellbinder orders.',
  },
  {
    title: 'Total including expedited shipping is not shown before confirmation.',
    evidence: 'Proposal showed $449.95 item only, total $509.95 only after order.',
    fix: 'Show total including shipping before confirmation, so the $500 cap is checked on total, not item-only.',
    impact: 'Fewer Budget mismatches.',
  },
  {
    title: 'Size guide missing for 150-165 cm.',
    evidence: 'Grant size range 150-165 cm, no size guide on page.',
    fix: 'Add size guide for 150-165 cm range.',
    impact: 'Fewer size-related questions / mismatches.',
  },
]

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'Is the shopper agent part of AgentReceipt?',
    a: "No. The shopper is the customer’s own personal agent (like Muse). In this demo it’s simulated by Muse Spark in the phone screen, so you can see a complete flow. In real life it would be the customer’s own assistant, not ours.",
  },
  {
    q: 'Is the verifying agent the same for all merchants?',
    a: 'Yes. One AgentReceipt auditor service, same model (Muse Spark), same prompt, same rules for every merchant. That sameness is what makes it neutral. If each merchant had a different auditor, a merchant could bias its own verdicts.',
  },
  {
    q: "Does the auditor see the customer’s chat?",
    a: 'No. The auditor reads only structured fields: grant fields, formal terms, action record, and structured agent summary fields (e.g. agent_summary_returns = "Easy returns"). It never sees full chat, never sees proposal free text, never sees other orders\' data. Full chat stays private with the customer\'s personal agent.',
  },
  {
    q: 'What does the merchant actually see?',
    a: "For that purchase only: that grant’s fields, that action, that verdict, that evidence pack. Merchant A never sees Merchant B’s orders. A further excerpt from chat only with fresh customer consent for that specific dispute — described in text, not built as a feature.",
  },
  {
    q: 'How is this different from Mastercard Verifiable Intent?',
    a: "AgentReceipt is VI-aligned, not VI-compliant. It borrows VI’s grant-field idea (explicit scope, hash-sealed, confirmation before action), but VI alone doesn’t give you mismatch detection, a merchant verdict, or a dispute evidence pack. AgentReceipt adds those, plus extensions VI doesn’t cover: product scope, size range, colour, delivery date, return policy.",
  },
  {
    q: 'What are the three decisions?',
    a: 'Pass (0 problems, ship), Review Required (≥1 field mismatch, record trustworthy, do not ship yet, merchant review needed — this is the hero $509.95 order), Hold for Suspicion (record cannot be trusted, or agent suspicious — hash fails, component missing, grant expired, agent unverified — do not proceed, investigate first). Orders requiring attention = Review Required + Hold for Suspicion.',
  },
  {
    q: 'Does AgentReceipt block checkout or shipment?',
    a: "No, directly. It returns a signal (Pass / Review Required / Hold for Suspicion), and the merchant’s order system holds shipment/capture based on that signal. It is not a checkout control.",
  },
  {
    q: 'Does AgentReceipt decide liability?',
    a: 'No. It shows mismatch facts only; it does not decide liability, and no network rule moves liability on any AgentReceipt screen. The merchant decides to represent, concede, hold, or cancel, based on evidence strength.',
  },
  {
    q: 'What about the $509.95 hero order — does it have a dispute?',
    a: 'No. It is Review Required before fulfillment, so it never ships in that flow, so there is no dispute. A dispute example in the demo is a SEPARATE order (13422 Orca, Pass, disputed "agent overstep", disproved, merchant represented and won), never the hero order.',
  },
  {
    q: 'Is checkout real in this demo?',
    a: 'No, for Meta. Payment is Demo Checkout, simulated, labelled as such, no real charge. Real PayPal Sandbox checkout is the PayPal hackathon sprint (Nov 5-12), same receipt/dashboard shape, swapped in then.',
  },
  {
    q: 'What about AgentOptimize — does it auto-fix my listings?',
    a: 'No. It recommends fixes only. Merchant approves a fix, AgentOptimize never auto-edits a product page, price, or terms on its own.',
  },
]

// Where each "Login for demo" lands after the phone flow and the tour. Same login, same popup.
export type Landing = '/dashboard' | '/dashboard/orders' | '/dashboard/optimize'
