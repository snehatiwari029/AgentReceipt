import { useState } from 'react'
import { Link } from 'react-router-dom'
import { content as c } from './content'
import { Arrow, Fingerprint, Logo, iconFor } from './icons'
import PilotForm from './PilotForm'
import './site.css'

function Receipt() {
  const k = c.hero.card
  const Row = ({ r }: { r: { label: string; value: string; flag: boolean } }) => (
    <div className={`rrow${r.flag ? ' flag' : ''}`}><span>{r.label}</span><b>{r.value}</b></div>
  )
  return (
    <div className="card-stage">
      <div className="card-ring" aria-hidden="true" />
      <div className="rcard" role="img" aria-label="Sample receipt: customer authorized $180 maximum, agent ordered $212.40 with expedited delivery, flagged Review required">
        <div className="rcard-top">
          <span className="rcard-order">{k.orderLabel} / {k.orderNumber}</span>
          <span className="badge">{k.badge}</span>
        </div>
        <h3>{k.grantTitle}</h3>
        {k.grantRows.map((r) => <Row key={r.label} r={r} />)}
        <h3>{k.actionTitle}</h3>
        {k.actionRows.map((r) => <Row key={r.label} r={r} />)}
        <div className="rcard-foot">
          <span>{k.footnote}</span>
          <span className="rcard-seal"><Fingerprint size={26} /></span>
        </div>
      </div>
      <span className="side-note">{k.sideNote}</span>
    </div>
  )
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="acc">
      {c.faq.items.map((it, i) => {
        const isOpen = open === i
        return (
          <div className="acc-item" key={it.q}>
            <h3>
              <button className="acc-q" aria-expanded={isOpen} aria-controls={`faq-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                {it.q}<span className="acc-sign" aria-hidden="true">{isOpen ? '×' : '+'}</span>
              </button>
            </h3>
            {isOpen && <div className="acc-a" id={`faq-${i}`}>{it.a.map((t) => <p key={t}>{t}</p>)}</div>}
          </div>
        )
      })}
    </div>
  )
}

// The public page. Words: content.ts. Look: site.css.
export default function LandingPage() {
  const h = c.hero
  return (
    <div className="site">
      <header className="header">
        <div className="header-in">
          <a className="logo" href="#top" aria-label={`${c.brand} home`}><Logo />{c.brand}</a>
          <nav className="nav" aria-label="Main">
            {c.nav.links.map((l) => <a key={l.href} className="nav-link" href={l.href}>{l.label}</a>)}
            <Link className="btn btn-sm" to={c.nav.loginTo}>{c.nav.loginLabel} <Arrow /></Link>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <p className="eyebrow">{h.eyebrow}</p>
              <h1>{h.headlineBefore}<em>{h.headlineEmphasis}</em>{h.headlineAfter}</h1>
              <p className="hero-body">{h.body}</p>
              <div className="hero-cta">
                <Link className="btn" to={c.nav.loginTo}>{h.primaryCta} <Arrow /></Link>
                <a className="link-btn" href={`#${c.steps.id}`}>{h.secondaryCta} <Arrow down /></a>
              </div>
            </div>
            <Receipt />
          </div>
        </section>

        <section className="gap" aria-labelledby="gap-h">
          <div className="wrap gap-grid">
            <div>
              <p className="eyebrow">{c.gap.eyebrow}</p>
              <h2 id="gap-h">{c.gap.headline}</h2>
              <div className="gap-rule mono-foot">{c.gap.footLabel}</div>
            </div>
            <div>
              <p className="gap-body">{c.gap.body}</p>
              <p className="gap-quote">{c.gap.pullQuote}</p>
            </div>
          </div>
        </section>

        <section className="partner" aria-labelledby="partner-h">
          <div className="wrap">
            <p className="eyebrow">{c.partner.eyebrow}</p>
            <h2 id="partner-h">{c.partner.headline}</h2>
            <div className="cols">
              {c.partner.columns.map((col) => (
                <div className="col" key={col.tag}>
                  <p className="col-tag">{col.tag}</p>
                  <h3>{col.title}</h3>
                  <p>{col.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="steps" id={c.steps.id} aria-labelledby="steps-h">
          <div className="wrap steps-grid">
            <div>
              <p className="eyebrow">{c.steps.eyebrow}</p>
              <h2 id="steps-h">
                {c.steps.headlineLines.map((l) => <span key={l} style={{ display: 'block' }}>{l}</span>)}
                <em>{c.steps.headlineEmphasis}</em>
              </h2>
              <p className="steps-body">{c.steps.body}</p>
            </div>
            <div className="step-list">
              {c.steps.items.map((s) => (
                <div className="step" key={s.num}>
                  <span className="step-num">{s.num}</span>
                  <div><h3>{s.title}</h3><p>{s.body}</p></div>
                  <span className="step-ico">{iconFor(s.icon)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="products" id={c.products.id} aria-labelledby="products-h">
          <div className="wrap">
            <p className="eyebrow">{c.products.eyebrow}</p>
            <h2 id="products-h">{c.products.headline}</h2>
            <p className="products-intro">{c.products.intro}</p>
            <div className="pcols">
              {c.products.items.map((p) => (
                <div className="pcol" key={p.title}><h3>{p.title}</h3><p>{p.body}</p></div>
              ))}
            </div>
            <div className="demo-box">
              <h3>{c.products.demoTitle}</h3>
              <p className="demo-note">{c.products.demoNote}</p>
              <div className="doors">
                {c.products.doors.map((d) => (
                  <Link className="door" key={d.to} to={d.to}><b>{d.title}</b><span>{d.note}</span></Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="faq" id={c.faq.id} aria-labelledby="faq-h">
          <div className="wrap faq-grid">
            <div>
              <p className="eyebrow">{c.faq.eyebrow}</p>
              <h2 id="faq-h">{c.faq.headline}</h2>
              <p className="faq-sub">{c.faq.body}</p>
            </div>
            <Faq />
          </div>
        </section>

        <section className="pilot" id={c.pilot.id} aria-labelledby="pilot-h">
          <div className="wrap pilot-grid">
            <div>
              <p className="eyebrow">{c.pilot.eyebrow}</p>
              <h2 id="pilot-h">{c.pilot.headline}</h2>
              <p className="pilot-sub">{c.pilot.body}</p>
              <p className="pilot-foot mono-foot">{c.pilot.footLabel}</p>
            </div>
            <PilotForm />
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap"><p>{c.footer.line}</p><p>{c.footer.note}</p></div>
      </footer>
    </div>
  )
}
