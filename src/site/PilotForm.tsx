import { useState, type FormEvent } from 'react'
import { supabase } from '../shared/supabase'
import { content } from './content'
import { Arrow } from './icons'

type State = 'idle' | 'sending' | 'ok' | 'error'

// Saves one row to the pilot_requests table (insert only). No other table is touched.
export default function PilotForm() {
  const p = content.pilot
  const [state, setState] = useState<State>('idle')

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    if (String(f.get('website') ?? '') !== '') { setState('ok'); return } // hidden trap field: a bot filled it in
    if (!supabase) { setState('error'); return }
    setState('sending')
    const text = (k: string) => String(f.get(k) ?? '').trim()
    const { error } = await supabase.from('pilot_requests').insert({
      name: text('name'), work_email: text('email'), company: text('company'),
      store_url: text('url') || null, interest: text('interest'), message: text('message') || null,
    })
    if (error) { setState('error'); return }
    form.reset()
    setState('ok')
  }

  return (
    <form className="form" onSubmit={onSubmit} aria-label="Pilot request">
      <div className="form-2">
        <div className="field">
          <label htmlFor="pf-name">{p.fields.name}</label>
          <input id="pf-name" name="name" required maxLength={120} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="pf-email">{p.fields.email}</label>
          <input id="pf-email" name="email" type="email" required maxLength={200} autoComplete="email" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="pf-company">{p.fields.company}</label>
        <input id="pf-company" name="company" required maxLength={160} autoComplete="organization" />
      </div>
      <div className="field">
        <label htmlFor="pf-url">{p.fields.url}</label>
        <input id="pf-url" name="url" type="url" maxLength={300} placeholder={p.fields.urlPlaceholder} />
      </div>
      <div className="field">
        <label htmlFor="pf-interest">{p.fields.interest}</label>
        <select id="pf-interest" name="interest" defaultValue={p.interestOptions[0]}>
          {p.interestOptions.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="pf-message">{p.fields.message}</label>
        <textarea id="pf-message" name="message" maxLength={2000} />
      </div>
      <div className="hp" aria-hidden="true">
        <label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <button className="btn btn-block" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? p.sending : <>{p.submit} <Arrow /></>}
      </button>
      {state === 'ok' && <p className="form-msg ok" role="status">{p.success}</p>}
      {state === 'error' && <p className="form-msg err" role="alert">{p.error}</p>}
      <p className="form-priv">{p.privacy}</p>
    </form>
  )
}
