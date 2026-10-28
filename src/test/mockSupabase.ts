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
    select: () => ({
      order: () => ({
        then: (ok: (r: Result) => void) => {
          if (!mock.hang) ok(mock.tables[table] ?? mock.next)
        },
      }),
    }),
  }),
}
