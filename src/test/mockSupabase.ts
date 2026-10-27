// Shared stub for the Supabase client used by the render tests.
export type Result = { data: unknown; error: { message: string } | null }
export const mock = {
  next: { data: [], error: null } as Result,
  hang: false,
  // Per-table results; any table not listed falls back to `next`.
  tables: {} as Record<string, Result>,
}

export const fakeClient = {
  from: (table: string) => ({
    select: () => ({
      order: () => ({
        then: (ok: (r: Result) => void) => {
          if (!mock.hang) ok(mock.tables[table] ?? mock.next)
        },
      }),
    }),
  }),
}
