// Import finished. This stub refuses every request.
Deno.serve(() => new Response(JSON.stringify({ error: 'Import finished; this endpoint is retired.' }), { status: 410, headers: { 'content-type': 'application/json' } }));
