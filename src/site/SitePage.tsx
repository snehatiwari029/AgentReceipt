import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { needsAttention, useAgentOrders } from '../dashboard/pages/AgentOrders'
import { formatMoney } from '../shared/format'
import { DECISION_LABEL } from '../shared/schemas'
import PhoneDemo from './PhoneDemo'
import PilotForm from './PilotForm'
import {
  DEMO_NOTE, FAQ, GAP_LINE, HERO_ORDER, HERO_SUB, ISSUES, LIABILITY_LINE, LOGIN_NOTE, VERDICT_ROWS, type Landing,
} from './content'
import './site.css'

const NAV = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#detect', label: 'Detect' },
  { href: '#prevent', label: 'Prevent' },
  { href: '#faq', label: 'FAQ' },
  { href: '#pilot', label: 'Pilot' },
]

// The AgentReceipt B2B site at /. Display and navigation only, plus the pilot form insert.
export default function SitePage() {
  const [demo, setDemo] = useState<Landing | null>(null)
  const [menu, setMenu] = useState(false)

  useEffect(() => {
    const prev = document.title
    document.title = 'AgentReceipt, the trust layer for agentic shopping'
    return () => { document.title = prev }
  }, [])

  const login = (landing: Landing) => () => { setMenu(false); setDemo(landing) }

  return (
    <div className="site">
      <a className="skip" href="#main">Skip to content</a>
      <header className="nav">
        <div className="container nav__bar">
          <a href="#top" className="wordmark" aria-label="AgentReceipt, back to top">AgentReceipt</a>
          <button
            type="button"
            className="nav__toggle"
            aria-expanded={menu}
            aria-controls="site-menu"
            onClick={() => setMenu((m) => !m)}
          >
            {menu ? 'Close' : 'Menu'}
          </button>
          <nav id="site-menu" aria-label="Site" className={`nav__links${menu ? ' is-open' : ''}`}>
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setMenu(false)}>{n.label}</a>
            ))}
            <button type="button" className="btn btn--line nav__login" onClick={login('/dashboard')}>Login for demo</button>
          </nav>
        </div>
      </header>

      <main id="main">
        <Hero onLogin={login('/dashboard')} />
        <Problem />
        <HowItWorks />
        <Detect onLogin={login('/dashboard/orders')} />
        <Prevent onLogin={login('/dashboard/optimize')} />
        <Faq />
        <Pilot />
      </main>
      <Footer />

      {demo && <PhoneDemo landing={demo} onClose={() => setDemo(null)} />}
    </div>
  )
}

function LoginAction({ label, onLogin, note = true }: { label: string; onLogin: () => void; note?: boolean }) {
  return (
    <div className="login">
      <button type="button" className="btn btn--primary" onClick={onLogin}>{label}</button>
      {note && <p className="login__note">{LOGIN_NOTE}</p>}
    </div>
  )
}

function Hero({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="container hero__grid">
        <div className="hero__text">
          <h1 id="hero-title">Trust layer for agentic shopping</h1>
          <p className="lead hero__lead">{HERO_SUB}</p>
          <div className="hero__actions">
            <LoginAction label="Login for demo" onLogin={onLogin} note={false} />
            <a className="btn btn--line" href="#how-it-works">See how it works</a>
          </div>
          <p className="login__note hero__note">{LOGIN_NOTE}</p>
          <p className="hero__demo">{DEMO_NOTE}</p>
        </div>
        <HeroSheet />
      </div>
    </section>
  )
}

// The signature: one order as AgentReceipt records it, grant then action then verdict, on the printed sheet.
function HeroSheet() {
  return (
    <figure className="sheet hero__sheet" aria-label="Diagram: grant, action and verdict for demo order 12322">
      <div className="sheet__head">
        <p className="sheet__title">Order 12322</p>
        <p className="sheet__date">Northwind Outfitters</p>
      </div>
      <ol className="flow">
        <li className="flow__step">
          <p className="flow__name">Grant</p>
          <dl className="kv">
            <div><dt>Budget</dt><dd className="num">$500 total</dd></div>
            <div><dt>Size</dt><dd className="num">150-165 cm</dd></div>
            <div><dt>Delivery by</dt><dd>Wed Oct 28</dd></div>
            <div><dt>Returns</dt><dd>Returnable required</dd></div>
          </dl>
        </li>
        <li className="flow__step">
          <p className="flow__name">Action</p>
          <dl className="kv">
            <div><dt>Burton Spellbinder, 156 cm</dt><dd className="num">$449.95</dd></div>
            <div><dt>Expedited shipping</dt><dd className="num">$60.00</dd></div>
            <div className="kv__total"><dt>Total</dt><dd className="num">$509.95</dd></div>
            <div><dt>Terms</dt><dd>Final Sale</dd></div>
            <div><dt>Agent summary</dt><dd>“Easy returns”</dd></div>
          </dl>
        </li>
        <li className="flow__step">
          <p className="flow__name">Verdict</p>
          <div className="flow__verdict">
            <p className="decision decision--review">Review Required</p>
            <ul className="flags">
              <li><span className="mark mark--bad">✕ Mismatch</span> Budget</li>
              <li><span className="mark mark--bad">✕ Mismatch</span> Returns</li>
            </ul>
          </div>
        </li>
      </ol>
      <figcaption className="caption">Demo data. Hero order 12322, live 2-day prompt.</figcaption>
    </figure>
  )
}

function Problem() {
  return (
    <section className="section problem" aria-labelledby="problem-title">
      <div className="container">
        <h2 id="problem-title" className="section__head">The problem: you see the order, not the authorization</h2>
        <ol className="story">
          <li className="story__row">
            <h3>The customer tells an agent</h3>
            <blockquote className="story__quote">“Budget under $500, size 150-165 cm, arrive by Friday, returnable if it doesn’t work.”</blockquote>
          </li>
          <li className="story__row">
            <h3>The agent shops</h3>
            <p className="story__body">It sees a marketing summary, picks a board and places an order.</p>
          </li>
          <li className="story__row">
            <h3>The merchant sees only the order</h3>
            <p className="story__body">
              No grant, no agent summary, no proof the total or return terms matched what the customer approved. When the
              customer disputes, it’s he-said-she-said.
            </p>
          </li>
        </ol>
        <p className="gap">{GAP_LINE}</p>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="section how" id="how-it-works" aria-labelledby="how-title">
      <div className="container">
        <h2 id="how-title" className="section__head">How it works: grant, action, verdict — in real time, before fulfillment</h2>
        <ol className="stages">
          <li className="stage">
            <div className="stage__text">
              <h3>1. Grant</h3>
              <p>
                The customer’s personal agent records what the customer authorized, as fields only. Never a verbatim
                sentence, never the full chat.
              </p>
            </div>
            <figure className="sheet stage__obj">
              <dl className="kv kv--wide">
                <div><dt>Merchant</dt><dd>Northwind Outfitters only</dd></div>
                <div><dt>Total budget</dt><dd className="num">$500 including shipping</dd></div>
                <div><dt>Size</dt><dd className="num">150-165 cm</dd></div>
                <div><dt>Delivery by</dt><dd>Fri Oct 30, 2026 (seeded) / Wed Oct 28, 2026 (live 2-day prompt)</dd></div>
                <div><dt>Returns</dt><dd>Returnable required</dd></div>
                <div><dt>Payment</dt><dd>Demo Checkout</dd></div>
              </dl>
              <figcaption className="caption">Demo data. Example grant.</figcaption>
            </figure>
          </li>
          <li className="stage">
            <div className="stage__text">
              <h3>2. Action</h3>
              <p>The agent places the order. The action is recorded beside the grant, with the store’s formal terms.</p>
            </div>
            <figure className="sheet stage__obj">
              <p className="receipt__item">Burton Spellbinder Snowboard 2026/2027, 156 cm, Serpent</p>
              <table className="lines">
                <caption className="visually-hidden">Example action</caption>
                <tbody>
                  <tr><th scope="row">Item</th><td className="num">$449.95</td></tr>
                  <tr><th scope="row">Expedited shipping</th><td className="num">$60.00</td></tr>
                  <tr className="lines__total"><th scope="row">Total</th><td className="num">$509.95</td></tr>
                  <tr><th scope="row">Delivery</th><td>Fri Oct 30 / Wed Oct 28</td></tr>
                  <tr><th scope="row">Formal terms</th><td>Final Sale</td></tr>
                  <tr><th scope="row">Agent summary</th><td>“Easy returns”</td></tr>
                </tbody>
              </table>
              <figcaption className="caption">Demo data. Example action.</figcaption>
            </figure>
          </li>
          <li className="stage">
            <div className="stage__text">
              <h3>3. Auditor</h3>
              <p>
                A separate verifying agent, part of AgentReceipt: same model, same rules for every merchant, a fresh
                isolated call per order. It checks grant against action against formal terms.
              </p>
            </div>
            <div className="reads stage__obj">
              <div className="reads__col">
                <h4>Reads only</h4>
                <ul>
                  <li>Grant fields</li>
                  <li>Formal terms</li>
                  <li>The action record</li>
                  <li>Structured agent summary fields, like <code>agent_summary_returns = "Easy returns"</code></li>
                </ul>
              </div>
              <div className="reads__col">
                <h4>Never reads</h4>
                <ul>
                  <li>The full customer chat</li>
                  <li>Proposal free text</li>
                  <li>Other orders’ data</li>
                </ul>
              </div>
            </div>
          </li>
          <li className="stage">
            <div className="stage__text">
              <h3>4. Verdict</h3>
              <p>One of three decisions, in real time at order received, before fulfillment.</p>
              <p className="signal">
                AgentReceipt returns a signal. It does not block checkout, payment or shipment directly: your order system
                holds shipment or capture based on that signal.
              </p>
            </div>
            <table className="decisions stage__obj">
              <caption className="visually-hidden">The three decisions</caption>
              <thead>
                <tr><th scope="col">Decision</th><th scope="col">When</th><th scope="col">What you do</th></tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row"><span className="decision decision--pass">Pass</span></th>
                  <td>0 problems</td>
                  <td>Proceed: ship or finalize capture.</td>
                </tr>
                <tr className="is-hero">
                  <th scope="row"><span className="decision decision--review">Review Required</span></th>
                  <td>≥1 field mismatch, record trustworthy. The hero order is this.</td>
                  <td>Do not ship yet. Merchant review needed.</td>
                </tr>
                <tr>
                  <th scope="row"><span className="decision decision--hold">Hold for Suspicion</span></th>
                  <td>Record cannot be trusted, or agent suspicious: hash fails, component missing, grant expired, agent unverified.</td>
                  <td>Do not proceed. Investigate first.</td>
                </tr>
              </tbody>
            </table>
          </li>
          <li className="stage">
            <div className="stage__text">
              <h3>5. Evidence</h3>
              <p>
                If a dispute later arrives on a separate shipped order, never the hero order, AgentReceipt generates an
                evidence pack mapped to compelling-evidence fields. No full chat in the pack.
              </p>
            </div>
            <ul className="pack stage__obj" aria-label="Evidence pack contents">
              <li>Grant fields</li>
              <li>Action record</li>
              <li>Receipt with hash chain</li>
              <li>Verdict table</li>
              <li>Proposal record, structured fields only</li>
              <li>Formal terms</li>
            </ul>
          </li>
        </ol>
        <p className="liability">{LIABILITY_LINE}</p>
      </div>
    </section>
  )
}

const MARK: Record<string, string> = { mismatch: 'mark mark--bad', match: 'mark mark--ok', none: 'mark mark--none' }

function Detect({ onLogin }: { onLogin: () => void }) {
  const orders = useAgentOrders()
  const live = orders.status === 'ready' ? orders.rows : null
  const attention = live ? live.filter(needsAttention) : null
  const hero = live?.find((o) => o.order === HERO_ORDER.ref) ?? null
  const heroDiffers =
    hero !== null &&
    (hero.total_cents !== HERO_ORDER.total_cents || hero.decision !== HERO_ORDER.decision || (hero.receipt?.problems_found ?? null) !== HERO_ORDER.problems)

  return (
    <section className="section detect band" id="detect" aria-labelledby="detect-title">
      <div className="container">
        <div className="split-head">
          <h2 id="detect-title" className="section__head">Detect: know, before you ship, whether to ship it</h2>
          <p className="lead">AgentReceipt — the trust layer</p>
        </div>

        <figure className="sheet verdict">
          <div className="verdict__top">
            <p className="decision decision--review decision--large">
              Review Required — Do not ship yet. Merchant review needed before fulfillment.
            </p>
          </div>
          <table className="vt">
            <caption className="visually-hidden">Verdict table for hero order 12322</caption>
            <thead>
              <tr>
                <th scope="col">Field</th><th scope="col">Grant</th><th scope="col">Merchant terms</th><th scope="col">Actual</th>
                <th scope="col">Match</th><th scope="col">Cause</th><th scope="col">Next action / Who acts</th>
              </tr>
            </thead>
            <tbody>
              {VERDICT_ROWS.map((r) => (
                <tr key={r.field} className={r.match === 'mismatch' ? 'is-bad' : undefined}>
                  <th scope="row">{r.field}</th>
                  <td data-label="Grant" className={r.match === 'none' ? 'is-quiet' : undefined}>{r.grant}</td>
                  <td data-label="Merchant terms">{r.terms}</td>
                  <td data-label="Actual">{r.actual}</td>
                  <td data-label="Match"><span className={MARK[r.match]}>{r.matchLabel}</span></td>
                  <td data-label="Cause">{r.cause}</td>
                  <td data-label="Next action / Who acts">
                    <span>
                      {r.next}
                      {r.who !== '—' && <span className="vt__who">Who: {r.who}</span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <figcaption className="caption">
            Demo data, hero order 12322. Delivery shows the live 2-day prompt version; colour was not in that prompt, so it is not checked.
            {hero && !heroDiffers && ' Matches the live receipt for order 12322.'}
            {hero && heroDiffers && (
              <> The live receipt for order 12322 now reads {hero.total_cents === null ? 'no total' : formatMoney(hero.total_cents)}, {hero.decision ? DECISION_LABEL[hero.decision] : 'no decision'}.</>
            )}
          </figcaption>
        </figure>

        <div className="detect__foot">
          <div className="attention">
            <p>
              Orders requiring attention = Review Required + Hold for Suspicion.{' '}
              {attention ? (
                <>
                  Live count on the dashboard is <strong className="num">{attention.length}</strong>
                  {attention.length > 0 && (
                    <> ({attention.map((o) => `${o.order ?? 'no order number'} ${o.decision ? DECISION_LABEL[o.decision] : ''}`.trim()).join(', ')})</>
                  )}
                  .
                </>
              ) : (
                <>Live count on the dashboard is 3 (12322 Review Required, 15001 Review Required, 14522 Hold for Suspicion).</>
              )}{' '}
              Pass orders are not counted. A Review Required order does NOT appear as a dispute.
            </p>
            <p className="attention__src">
              {attention ? 'Read live from the same tables as the dashboard.' : orders.status === 'loading' ? 'Seeded count shown while the live count loads.' : 'Seeded count shown: the live count could not be read just now.'}
            </p>
          </div>
          <LoginAction label="Login for demo — see Detect" onLogin={onLogin} />
        </div>
      </div>
    </section>
  )
}

function Prevent({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="section prevent" id="prevent" aria-labelledby="prevent-title">
      <div className="container prevent__grid">
        <div className="prevent__text">
          <h2 id="prevent-title" className="section__head">Prevent: fix the listing, so the next agent doesn’t make the same mistake</h2>
          <p className="lead">AgentOptimize — inside AgentReceipt, using the same mismatch data</p>
          <p className="prevent__why">
            Receipt tells you what went wrong on one order. Optimize tells you why it keeps going wrong across orders, and what
            to fix on the product page. Same data, same merchant, no new integration.
          </p>
          <LoginAction label="Login for demo — see Prevent" onLogin={onLogin} />
        </div>
        <div className="prevent__list">
          <p className="prevent__subject">Burton Spellbinder Snowboard 2026/2027. Demo data.</p>
          <ol className="issues">
            {ISSUES.map((i, n) => (
              <li key={i.title} className="issue">
                <h3>Issue {n + 1}: {i.title}</h3>
                <dl className="issue__dl">
                  <div><dt>Evidence</dt><dd>{i.evidence}</dd></div>
                  <div><dt>Suggested fix</dt><dd>{i.fix}</dd></div>
                  <div><dt>Expected impact</dt><dd>{i.impact}</dd></div>
                </dl>
              </li>
            ))}
          </ol>
          <p className="rules">
            Recommendation only, not a checkout control, not a block, not a verification system. Merchant approves a fix,
            AgentOptimize never auto-edits a product page, never changes a price or terms on its own.
          </p>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section className="section faq" id="faq" aria-labelledby="faq-title">
      <div className="container faq__grid">
        <h2 id="faq-title" className="section__head faq__head">FAQ: what merchants ask first</h2>
        <div className="faq__list">
          {FAQ.map((f) => (
            <details key={f.q} className="qa">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function Pilot() {
  return (
    <section className="section pilot-sec band" id="pilot" aria-labelledby="pilot-title">
      <div className="container pilot__grid">
        <div className="pilot__text">
          <h2 id="pilot-title" className="section__head">Reach out for pilot / Stay in the loop</h2>
          <p className="pilot__lede">
            Pilot merchants get the trust layer on their store, with the same grant → action → verdict flow. Stay-in-the-loop
            subscribers get launch updates only, no sales spam.
          </p>
          <p className="pilot__price">Pricing: Pilot — contact us.</p>
        </div>
        <PilotForm />
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="foot">
      <div className="container foot__grid">
        <p className="foot__name">
          <span className="wordmark">AgentReceipt</span>
          Trust layer for agentic shopping
        </p>
        <ul className="foot__links" aria-label="Links">
          <li><a href="https://github.com/snehatiwari029/AgentReceipt" rel="noreferrer">GitHub repo</a></li>
          <li><Link to="/dashboard">Dashboard</Link></li>
          <li><Link to="/shop">Store</Link></li>
        </ul>
        <div className="foot__legal">
          <p>{DEMO_NOTE}</p>
          <p>Decisions: Pass / Review Required / Hold for Suspicion only.</p>
        </div>
      </div>
    </footer>
  )
}
