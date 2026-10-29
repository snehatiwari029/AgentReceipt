// Shared stub for the Supabase client used by the render tests.
export type Result = { data: unknown; error: { message: string } | null }
export const mock = {
  next: { data: [], error: null } as Result,
  hang: false,
  // Per-table results; any table not listed falls back to `next`.
  tables: {} as Record<string, Result>,
  // Rows passed to insert(), and the error the next insert returns.
  inserted: [] as { table: string; row: unknown }[],
  insertError: null as { message: string } | null,
}

export const fakeClient = {
  from: (table: string) => ({
    insert: async (row: unknown) => {
      if (mock.insertError) return { data: null, error: mock.insertError }
      mock.inserted.push({ table, row })
      return { data: null, error: null }
    },
    select: () => query(table, []),
  }),
}

// select() supports order(), and eq() / in() filters applied to the table's rows, as the real client does.
type Filter = (row: Record<string, unknown>) => boolean
function query(table: string, filters: Filter[]) {
  return {
    order: () => query(table, filters),
    eq: (col: string, val: unknown) => query(table, [...filters, (r) => r[col] === val]),
    in: (col: string, vals: unknown[]) => query(table, [...filters, (r) => vals.includes(r[col])]),
    then: (ok: (r: Result) => void) => {
      if (mock.hang) return
      const res = mock.tables[table] ?? mock.next
      ok(filters.length && Array.isArray(res.data) ? { ...res, data: (res.data as Record<string, unknown>[]).filter((r) => filters.every((f) => f(r))) } : res)
    },
  }
}
