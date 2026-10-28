import { useState, type FormEvent } from 'react'
import { supabase } from '../shared/supabase'

type Interest = 'pilot' | 'stay_in_loop'
type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; interest: Interest } | { kind: 'failed' }
type Errors = Partial<Record<'name' | 'work_email' | 'company' | 'store_url' | 'interest', string>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function normaliseUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(withScheme)
    return u.hostname.includes('.') ? u.toString() : null
  } catch {
    return null
  }
}

// One row into pilot_signups with the publishable key. RLS lets anon INSERT and nothing else, so the browser
// can write a request but never read anyone's back. Success shows only after the insert returns without error.
export default function PilotForm() {
  const [interest, setInterest] = useState<Interest | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const name = String(f.get('name') ?? '').trim()
    const work_email = String(f.get('work_email') ?? '').trim()
    const company = String(f.get('company') ?? '').trim()
    const urlRaw = String(f.get('store_url') ?? '').trim()
    const message = String(f.get('message') ?? '').trim()
    const store_url = urlRaw ? normaliseUrl(urlRaw) : null

    const errs: Errors = {}
    if (!name) errs.name = 'Enter your name.'
    if (!EMAIL.test(work_email)) errs.work_email = 'Enter an email address like name@yourstore.com.'
    if (!company) errs.company = 'Enter your company or store name.'
    if (urlRaw && !store_url) errs.store_url = 'Enter a web address like yourstore.com, or leave it empty.'
    if (!interest) errs.interest = 'Choose one: join a pilot or stay in the loop.'
    setErrors(errs)
    const first = Object.keys(errs)[0]
    if (first) {
      const el = form.querySelector<HTMLElement>(`[name="${first}"]`)
      el?.focus()
      return
    }
    if (!supabase) {
      setStatus({ kind: 'failed' })
      return
    }
    setStatus({ kind: 'saving' })
    const { error } = await supabase.from('pilot_signups').insert({
      name, work_email, company, store_url, interest, message: message || null, source: 'b2b_site',
    })
    if (error) {
      setStatus({ kind: 'failed' })
      return
    }
    setStatus({ kind: 'saved', interest: interest as Interest })
    form.reset()
    setInterest(null)
  }

  const label = interest === 'pilot' ? 'Request pilot' : interest === 'stay_in_loop' ? 'Stay in the loop' : 'Request pilot / Stay in the loop'
  const err = (k: keyof Errors) => (errors[k] ? { 'aria-invalid': true, 'aria-describedby': `${k}-err` } : {})

  return (
    <form className="pilot" onSubmit={(e) => void submit(e)} noValidate>
      <div className="field">
        <label htmlFor="pf-name">Name</label>
        <input id="pf-name" name="name" type="text" autoComplete="name" required {...err('name')} />
        <p className="field__err" id="name-err">{errors.name}</p>
      </div>
      <div className="field">
        <label htmlFor="pf-email">Work email</label>
        <input id="pf-email" name="work_email" type="email" inputMode="email" autoComplete="email" required {...err('work_email')} />
        <p className="field__err" id="work_email-err">{errors.work_email}</p>
      </div>
      <div className="field">
        <label htmlFor="pf-company">Company / Store name</label>
        <input id="pf-company" name="company" type="text" autoComplete="organization" required {...err('company')} />
        <p className="field__err" id="company-err">{errors.company}</p>
      </div>
      <div className="field">
        <label htmlFor="pf-url">Store URL <span className="field__opt">(optional)</span></label>
        <input id="pf-url" name="store_url" type="text" inputMode="url" autoComplete="url" {...err('store_url')} />
        <p className="field__err" id="store_url-err">{errors.store_url}</p>
      </div>
      <fieldset className="field field--choice" {...(errors.interest ? { 'aria-describedby': 'interest-err' } : {})}>
        <legend>I want to:</legend>
        <div className="seg">
          <input type="radio" id="pf-pilot" name="interest" value="pilot" checked={interest === 'pilot'} onChange={() => setInterest('pilot')} />
          <label htmlFor="pf-pilot">Join a pilot</label>
          <input type="radio" id="pf-loop" name="interest" value="stay_in_loop" checked={interest === 'stay_in_loop'} onChange={() => setInterest('stay_in_loop')} />
          <label htmlFor="pf-loop">Stay in the loop</label>
        </div>
        <p className="field__err" id="interest-err">{errors.interest}</p>
      </fieldset>
      <div className="field field--wide">
        <label htmlFor="pf-msg">Message <span className="field__opt">(optional)</span></label>
        <textarea id="pf-msg" name="message" rows={4} maxLength={2000} />
      </div>
      <div className="field--wide pilot__send">
        <button type="submit" className="btn btn--primary" disabled={status.kind === 'saving'} aria-busy={status.kind === 'saving'}>
          {status.kind === 'saving' ? 'Saving…' : label}
        </button>
        <p className="pilot__status" role="status" aria-live="polite">
          {status.kind === 'saved' &&
            (status.interest === 'pilot'
              ? "Thanks — we've recorded your request. We'll be in touch about the pilot."
              : "Thanks — we've recorded your request. We'll be in touch with launch updates.")}
          {status.kind === 'failed' && (
            <span className="pilot__fail">Something went wrong saving your request — please try again later.</span>
          )}
        </p>
      </div>
    </form>
  )
}
