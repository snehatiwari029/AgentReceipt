// One-time importer: copies the 9 product PNGs from the Drive folder into the
// Supabase Storage bucket "product-images", then sets image_url, image_id and image_hash
// on each product row (matched by products.image_file = the CSV "Image Link" filename).
//
// Runs inside Supabase, so the service role key never leaves the server and is never
// typed into chat. Protected by a one-time secret you set yourself (IMPORT_SECRET).
// The Drive link is only the SOURCE of the bytes. It is never stored as an image URL.
//
//   image_id   = storage path in the bucket, e.g. "products/burton-spellbinder.png"
//   image_hash = "sha256:" + SHA-256 of the exact PNG bytes that were uploaded
//   image_url  = the public Supabase Storage URL of that object
//
// Needs the 9 Drive files to be shared as "Anyone with the link can view".

import { createClient } from 'npm:@supabase/supabase-js@2';

const DRIVE_IDS: Record<string, string> = {
  'burton-spellbinder.png': '1cU6FB7_xnTXvKs3TMBTqn7_zDLLayiT8',
  'lib-tech-orca.png': '1IWfvkqQLQXX0tBamrgvkD3cq3RgN5asK',
  'capita-outerspace-living.png': '1aZXSXNxM_HOgwUrPPWJHQHlHOzDKUR-J',
  'salomon-assassin.png': '1um5Wejl1TuaL4t1lxJhOWkA6L-fWb40f',
  'jones-airheart.png': '1Sx4wkKZO7UnyJ_6ZqDemzad9cK6pV5cq',
  'atomic-bent-85.png': '1dzYbZ7eCUFOuSknu0SQ5zC2n8FtC1xfs',
  'salomon-qst-92.png': '1LflDuWFj_3OuLEZBXJcFqVxf5C9-qO7K',
  'rossignol-sender-soul-92.png': '17AnoSq0CA4cueXV6eykbRQhqIFNYLDiS',
  'nitro-alternator.png': '11UnV6N-2ZmnBceoYHJLlJswulCq7XTI6',
};

const BUCKET = 'product-images';
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('IMPORT_SECRET');
  if (!secret || req.headers.get('x-import-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Missing or wrong x-import-secret.' }), { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const results: Record<string, unknown>[] = [];

  for (const [file, driveId] of Object.entries(DRIVE_IDS)) {
    try {
      const res = await fetch(`https://drive.google.com/uc?export=download&id=${driveId}`, { redirect: 'follow' });
      if (!res.ok) throw new Error(`Drive returned ${res.status}. Is the file shared as "Anyone with the link"?`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!PNG_MAGIC.every((v, i) => bytes[i] === v)) {
        throw new Error('Downloaded bytes are not a PNG (Drive probably sent a sign-in or warning page).');
      }

      const hash = `sha256:${await sha256Hex(bytes)}`;
      const path = `products/${file}`;

      const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/png', upsert: true });
      if (up.error) throw new Error(`Storage upload failed: ${up.error.message}`);

      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

      const upd = await supabase
        .from('products')
        .update({ image_url: publicUrl, image_id: path, image_hash: hash })
        .eq('image_file', file)
        .select('id');
      if (upd.error) throw new Error(`Product update failed: ${upd.error.message}`);
      if (!upd.data || upd.data.length !== 1) {
        throw new Error(`Expected to update exactly 1 product for ${file}, updated ${upd.data?.length ?? 0}.`);
      }

      results.push({ file, ok: true, bytes: bytes.length, image_id: path, image_hash: hash });
    } catch (e) {
      results.push({ file, ok: false, error: (e as Error).message });
    }
  }

  const allOk = results.every((r) => r.ok);
  return new Response(JSON.stringify({ allOk, results }, null, 2), {
    status: allOk ? 200 : 207,
    headers: { 'content-type': 'application/json' },
  });
});
