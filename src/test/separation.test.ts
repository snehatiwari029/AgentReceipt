import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}
const read = (dir: string) => files(join(SRC, dir)).map((p) => [p.replace(SRC, 'src'), readFileSync(p, 'utf8')] as const)
const importsOf = (text: string) => [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])

describe('Audience separation', () => {
  it('shop source never mentions dashboard, grant, receipt, tamper or dispute', () => {
    const forbidden = /dashboard|grant|receipt|tamper|dispute|verdict|\/admin/i
    for (const [name, text] of read('shop')) expect(text, name).not.toMatch(forbidden)
  })

  it('shop imports nothing from the dashboard, and only react, shared or its own files', () => {
    for (const [name, text] of read('shop')) {
      for (const spec of importsOf(text)) {
        expect(spec, name).not.toMatch(/dashboard/i)
        expect(spec, name).not.toMatch(/react-router/)
        const ok = !spec.startsWith('.') || /(^|\/)shared(\/|$)/.test(spec) || spec.startsWith('./') || /^\.\.\/(\.\.\/)?[A-Za-z]/.test(spec) && !spec.includes('dashboard')
        expect(ok, `${name} imports ${spec}`).toBe(true)
      }
    }
  })

  it('dashboard imports nothing from the shop', () => {
    for (const [name, text] of read('dashboard')) {
      for (const spec of importsOf(text)) expect(spec, name).not.toMatch(/(^|\/)shop(\/|$)/)
    }
  })

  it('shared imports nothing from shop or dashboard', () => {
    for (const [name, text] of read('shared')) {
      for (const spec of importsOf(text)) expect(spec, name).not.toMatch(/shop|dashboard/)
    }
  })

  it('shop uses the light theme: no dashboard colour tokens or navy/teal values', () => {
    const dashboardLook = /dash-|teal|#0a1128|#0b0f1a|#16233a|#1e2a44|#26365e|#2dd4bf/i
    for (const [name, text] of read('shop')) expect(text, name).not.toMatch(dashboardLook)
    expect(readFileSync(join(SRC, '..', 'index.html'), 'utf8')).toMatch(/color-scheme" content="light"/)
  })

  it('no Lovable code or external repo links anywhere in the app source', () => {
    for (const [name, text] of [...read('shop'), ...read('dashboard'), ...read('shared'), ...read('app')]) {
      expect(text, name).not.toMatch(/lovable|github\.com|gptengineer/i)
    }
  })

  it('the phone screen (chat) mentions no merchant-side words and holds no brain logic or keys', () => {
    const forbidden = /dashboard|grant|receipt|tamper|dispute|verdict|auditor|mismatch|\/admin/i
    const brain = /MODEL_API_KEY|api\.meta\.ai|muse-spark|terms_text|formal_|service_role|sb_secret/i
    const dashLook = /dash-|teal|#0a1128|#0b0f1a|#16233a|#1e2a44|#26365e|#2dd4bf/i
    for (const [name, text] of read('chat')) {
      expect(text, name).not.toMatch(forbidden)
      expect(text, name).not.toMatch(brain)
      expect(text, name).not.toMatch(dashLook)
      expect(text, name).not.toMatch(/lovable|github\.com/i)
      for (const spec of importsOf(text)) {
        expect(spec, name).not.toMatch(/dashboard|(^|\/)shop(\/|$)|supabase|shared\/(supabase|useProducts|schemas|chain)/i)
      }
    }
  })

  it('the phone screen calls only the shopper-agent function', () => {
    const urls = read('chat').flatMap(([, text]) => [...text.matchAll(/functions\/v1\/([a-z-]+)/g)].map((m) => m[1]))
    expect(urls).toEqual(['shopper-agent'])
  })

  it('shop and dashboard never import the phone screen', () => {
    for (const [name, text] of [...read('shop'), ...read('dashboard'), ...read('shared')]) {
      for (const spec of importsOf(text)) expect(spec, name).not.toMatch(/(^|\/)chat(\/|$)/)
    }
  })
})

describe('Shopper agent function (the brain)', () => {
  const FN = join(SRC, '..', 'supabase', 'functions', 'shopper-agent')
  const code = () =>
    readdirSync(FN).filter((f) => f.endsWith('.ts') && f !== 'hash.ts')
      .map((f) => [f, readFileSync(join(FN, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')] as const)

  it('never reads formal terms, auditor output, receipts, disputes or dashboard data', () => {
    for (const [name, text] of code()) {
      // index.ts holds the one "order received" signal to the order system (session id out, reply never read)
      const pattern = name === 'index.ts' ? /terms_text|formal_|verdict|mismatch|dispute|dashboard|tamper/i : /terms_text|formal_|verdict|auditor|mismatch|dispute|dashboard|tamper/i
      expect(text, name).not.toMatch(pattern)
      expect(text, name).not.toMatch(/from\(\s*['"](receipts|disputes|dispute_events)['"]/)
      expect(text, name).not.toMatch(/select\(\s*['"`]\*['"`]/)
    }
  })

  it('reads only the allowed product columns', () => {
    const store = readFileSync(join(FN, 'store.ts'), 'utf8')
    const cols = /PRODUCT_COLUMNS =\s*'([^']+)'/.exec(store)![1].split(',')
    expect(cols).toEqual(['id', 'name', 'brand', 'category', 'size_cm', 'colour', 'price_cents', 'currency', 'marketing_blurb', 'standard_shipping_cents', 'standard_delivery_days', 'expedited_shipping_cents', 'expedited_delivery_days'])
  })

  it('reads the model key only from the environment, by name', () => {
    const index = readFileSync(join(FN, 'index.ts'), 'utf8')
    expect(index).toContain("Deno.env.get('MODEL_API_KEY')")
    expect(index).not.toMatch(/MODEL_API_KEY\s*=/)
  })

  it('keeps its copy of the hash spec identical to the shared one', () => {
    expect(readFileSync(join(FN, 'hash.ts'), 'utf8')).toBe(readFileSync(join(FN, '..', '_shared', 'hash.ts'), 'utf8'))
  })

  it('has no secret key or token in the repo', () => {
    const root = join(SRC, '..')
    const scan = [...files(SRC), ...files(join(root, 'supabase')), ...files(join(root, 'scripts')), join(root, '.env.example'), join(root, 'README.md')]
    for (const p of scan) {
      if (!/\.(ts|tsx|sql|md|json|example)$/.test(p) && !p.endsWith('.env.example')) continue
      const text = readFileSync(p, 'utf8')
      expect(text, p).not.toMatch(/sb_secret_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}/)
      expect(text, p).not.toMatch(/MODEL_API_KEY\s*=\s*[^\s#]/)
    }
  })
})

describe('Auditor function (separate from the shopper)', () => {
  const AUD = join(SRC, '..', 'supabase', 'functions', 'auditor')
  const SHARED = join(SRC, '..', 'supabase', 'functions', '_shared')
  const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '')

  it('never imports shopper code and never reads chat, reasoning, disputes or the tamper page', () => {
    for (const f of readdirSync(AUD).filter((x) => x.endsWith('.ts'))) {
      const text = strip(readFileSync(join(AUD, f), 'utf8'))
      expect(text, f).not.toMatch(/shopper-agent|from\s+['"]\.\.\//)
      expect(text, f).not.toMatch(/from\(\s*['"](disputes|dispute_events)['"]/)
      expect(text, f).not.toMatch(/private_chat|messages\b.*chat|reasoning|select\(\s*['"`]\*['"`]\s*\)\s*\.\s*neq/i)
    }
  })

  it('reads from the chain view hashes only, and the model key by name from the environment', () => {
    const store = readFileSync(join(AUD, 'store.ts'), 'utf8')
    expect([...store.matchAll(/from\('chain_entries'\)\.select\('([^']+)'\)/g)].map((m) => m[1])).toEqual(['entry_hash', 'entry_hash'])
    const index = readFileSync(join(AUD, 'index.ts'), 'utf8')
    expect(index).toContain("Deno.env.get('MODEL_API_KEY')")
    expect(index).not.toMatch(/MODEL_API_KEY\s*=/)
  })

  it('keeps byte-identical copies of the shared engine, input builder and hash spec', () => {
    for (const f of ['audit.ts', 'audit-input.ts', 'hash.ts']) {
      expect(readFileSync(join(AUD, f), 'utf8'), f).toBe(readFileSync(join(SHARED, f), 'utf8'))
    }
    expect(readFileSync(join(AUD, 'chain.ts'), 'utf8')).toBe(readFileSync(join(SRC, '..', 'supabase', 'functions', 'shopper-agent', 'chain.ts'), 'utf8'))
  })

  it('the engine has no model, network or hashing in it, and no liability column or card-network wording', () => {
    const engine = strip(readFileSync(join(SHARED, 'audit.ts'), 'utf8'))
    expect(engine).not.toMatch(/fetch\(|crypto|sha256|sha-256|api\.meta\.ai/i)
    expect(engine).not.toMatch(/liability column|mastercard|visa|••/i)
  })
})
