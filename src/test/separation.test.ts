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
})
