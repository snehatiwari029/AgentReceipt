// Shared stub for the Supabase client used by the render tests.
export type Result = { data: unknown; error: { message: string } | null }
export const mock = { next: { data: [], error: null } as Result, hang: false }

export const fakeClient = {
  from: () => ({
    select: () => ({
      order: () => ({
        then: (ok: (r: Result) => void) => {
          if (!mock.hang) ok(mock.next)
        },
      }),
    }),
  }),
}
