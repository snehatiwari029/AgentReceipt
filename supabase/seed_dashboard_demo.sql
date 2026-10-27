-- =====================================================================
-- AgentReceipt dashboard demo seed. GENERATED FILE: do not edit by hand.
-- Regenerate with: npm run seed:generate   (script: scripts/seed-dashboard-demo.ts)
--
-- Run ONCE in Supabase > SQL Editor, after 001 to 006. It does not change the schema.
-- It stops with an error, and writes nothing, if the ids below do not match this project,
-- if the seed was already applied, or if the chain already has entries.
--
-- Rows: orders 12322 (AR-2026-0042, hero, dispute received), 13422 (AR-2026-0043, Scenario B,
-- merchant represents and wins), 14522 (gap, no receipt), and the tamper example receipt
-- AR-2026-0041 ($449.95). Customers are demo names only. Payment label: Demo PayPal.
-- Hashes: supabase/functions/_shared/hash.ts, chained from the origin hash. Seeded demo data:
-- no real chat exists, so private_chat_hash is a hash of a fixed label.
-- To re-seed: select demo_reset();  (this clears ALL sessions, grants, receipts and disputes)
-- =====================================================================
begin;

do $$
begin
  if (select id from merchants where name = 'Northwind Outfitters') is distinct from '32b14be6-26e6-49df-a7af-79532f910510'::uuid then
    raise exception 'Seed stopped: merchant id does not match this project.';
  end if;
  if not exists (select 1 from products where id = '40c70768-77ac-4953-8bae-c75c8319fcf4'::uuid and image_file = 'burton-spellbinder.png')
     or not exists (select 1 from products where id = 'd53088eb-40e0-4fa5-b2f8-1b81e9c7c37e'::uuid and image_file = 'lib-tech-orca.png')
     or not exists (select 1 from products where id = '9a3f8acb-8e2f-4ffe-b83c-085d54b96765'::uuid and image_file = 'nitro-alternator.png') then
    raise exception 'Seed stopped: product ids do not match this project.';
  end if;
  if exists (select 1 from receipts) or exists (select 1 from grants) or exists (select 1 from sessions) then
    raise exception 'Seed stopped: sessions, grants or receipts already exist. Run select demo_reset(); first to re-seed.';
  end if;
end;
$$;

-- Catalog facts the seeded orders depend on (data only, not schema):
--  * Burton Spellbinder colourway is Serpent.
--  * Expedited delivery takes 2 days (Mon 26 Oct + 2 = Wed 28 Oct); free standard takes 5-7 days (Amendment 6).
--    Nitro Alternator has the same expedited terms.
update products set colour = 'Serpent', expedited_delivery_days = 2 where id = '40c70768-77ac-4953-8bae-c75c8319fcf4'::uuid;
update products set expedited_delivery_days = 2 where id = '9a3f8acb-8e2f-4ffe-b83c-085d54b96765'::uuid;
update products set standard_delivery_days = 5 + (sort_order % 3) where standard_shipping_cents = 0 and expedited_shipping_cents is null;

insert into sessions (id, merchant_id, detection_source, agent_id, agent_verified, agent_verified_simulated, gap_note, opened_at) values (
  'e5262b18-5dfc-470d-a1dc-556a936b48df'::uuid,
  '32b14be6-26e6-49df-a7af-79532f910510'::uuid,
  'self_declared_simulated',
  'instinct-kk14680',
  true,
  true,
  null,
  '2026-10-26T13:00:00.000Z'::timestamptz
);

insert into sessions (id, merchant_id, detection_source, agent_id, agent_verified, agent_verified_simulated, gap_note, opened_at) values (
  '67d5234f-2d0a-4214-a8f0-f7182da29f7b'::uuid,
  '32b14be6-26e6-49df-a7af-79532f910510'::uuid,
  'self_declared_simulated',
  'meta-muse-j0376672',
  true,
  true,
  null,
  '2026-10-26T17:05:00.000Z'::timestamptz
);

insert into sessions (id, merchant_id, detection_source, agent_id, agent_verified, agent_verified_simulated, gap_note, opened_at) values (
  '30e321ed-b682-4c2e-a2a2-1789eb052e2b'::uuid,
  '32b14be6-26e6-49df-a7af-79532f910510'::uuid,
  'self_declared_simulated',
  'instinct-kk14680',
  true,
  true,
  null,
  '2026-10-26T18:00:00.000Z'::timestamptz
);

insert into sessions (id, merchant_id, detection_source, agent_id, agent_verified, agent_verified_simulated, gap_note, opened_at) values (
  '3943684e-a1b7-4193-ac63-79c532b0e0fd'::uuid,
  '32b14be6-26e6-49df-a7af-79532f910510'::uuid,
  'none',
  null,
  false,
  true,
  'Order 14522: Unverified agent, no AgentReceipt session opened, no receipt (gap recorded)',
  '2026-10-26T19:00:00.000Z'::timestamptz
);

insert into grants (id, session_id, version, supersedes_grant_id, shopper_ref, agent_id, agent_verified, merchant_id, product_scope, size_min_cm, size_max_cm, colour_preference, currency, amount_max_cents, budget_limit_cents, payment_method_ref, shipping_method, shipping_max_cost_cents, delivery_by, return_policy_required, confirmed_at, expires_at, private_chat_hash, grant_json, system_metadata, schema_label, created_at, chain_seq, prev_hash, entry_hash) values (
  '7893c376-c429-4c62-a187-c16e21334cc5'::uuid,
  'e5262b18-5dfc-470d-a1dc-556a936b48df'::uuid,
  1,
  null,
  'Ivan Dijkstra',
  'instinct-kk14680',
  true,
  '32b14be6-26e6-49df-a7af-79532f910510'::uuid,
  'snowboard',
  150,
  165,
  null,
  'USD',
  50000,
  50000,
  'Demo PayPal',
  null,
  null,
  null,
  null,
  '2026-10-26T13:00:00.000Z'::timestamptz,
  '2026-10-27T13:00:00.000Z'::timestamptz,
  'sha256:3d29d9834520fc95a2d1c76bda55021b1d9721ecb6043438669f7bef48b8afc5',
  '{"agent_id":"instinct-kk14680","agent_verified":true,"amount_max_cents":50000,"budget_limit_cents":50000,"colour_preference":null,"confirmed_at":"2026-10-26T13:00:00.000Z","currency":"USD","delivery_by":null,"expires_at":"2026-10-27T13:00:00.000Z","merchant_id":"32b14be6-26e6-49df-a7af-79532f910510","payment_method_ref":"Demo PayPal","product_scope":"snowboard","return_policy_required":null,"shipping_max_cost_cents":null,"shipping_method":null,"shopper_ref":"Ivan Dijkstra","size_max_cm":165,"size_min_cm":150}'::jsonb,
  '{"checked":false,"data_sharing_limits":"grant fields only, this purchase only","priority":"P1","private_chat_hash_note":"Seeded demo row: no private chat exists, the hash is of a fixed label.","seeded_demo":true}'::jsonb,
  'VI-aligned demo representation',
  '2026-10-26T13:00:00.000Z'::timestamptz,
  1,
  'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  'sha256:12bacbc20e07eff0952a34d671c7a4fb7d8f65d311812d9d146a60ad6455d643'
);

insert into grants (id, session_id, version, supersedes_grant_id, shopper_ref, agent_id, agent_verified, merchant_id, product_scope, size_min_cm, size_max_cm, colour_preference, currency, amount_max_cents, budget_limit_cents, payment_method_ref, shipping_method, shipping_max_cost_cents, delivery_by, return_policy_required, confirmed_at, expires_at, private_chat_hash, grant_json, system_metadata, schema_label, created_at, chain_seq, prev_hash, entry_hash) values (
  '62b883a3-1f9e-45a2-ab49-8990d51e421d'::uuid,
  '67d5234f-2d0a-4214-a8f0-f7182da29f7b'::uuid,
  1,
  null,
  'Jemaih Soresky',
  'meta-muse-j0376672',
  true,
  '32b14be6-26e6-49df-a7af-79532f910510'::uuid,
  'snowboard',
  150,
  165,
  'Serpent',
  'USD',
  50000,
  50000,
  'Demo PayPal',
  null,
  null,
  '2026-10-30'::date,
  true,
  '2026-10-26T17:05:00.000Z'::timestamptz,
  '2026-10-27T17:05:00.000Z'::timestamptz,
  'sha256:70bec58dff8c3c082d5fab4040cb36fcb07ff22771e0637c52e8a29f602040b1',
  '{"agent_id":"meta-muse-j0376672","agent_verified":true,"amount_max_cents":50000,"budget_limit_cents":50000,"colour_preference":"Serpent","confirmed_at":"2026-10-26T17:05:00.000Z","currency":"USD","delivery_by":"2026-10-30","expires_at":"2026-10-27T17:05:00.000Z","merchant_id":"32b14be6-26e6-49df-a7af-79532f910510","payment_method_ref":"Demo PayPal","product_scope":"snowboard","return_policy_required":true,"shipping_max_cost_cents":null,"shipping_method":null,"shopper_ref":"Jemaih Soresky","size_max_cm":165,"size_min_cm":150}'::jsonb,
  '{"checked":false,"data_sharing_limits":"grant fields only, this purchase only","priority":"P1","private_chat_hash_note":"Seeded demo row: no private chat exists, the hash is of a fixed label.","seeded_demo":true}'::jsonb,
  'VI-aligned demo representation',
  '2026-10-26T17:05:00.000Z'::timestamptz,
  5,
  'sha256:70303c16f2617c5ad789606c632d7b00b4e8fc3aa62cc01ffb63956ea85d52ee',
  'sha256:b98616d5b1b45dd9babbeef70b028120fe470d02ecb149e1763f5c41a6dab87f'
);

insert into grants (id, session_id, version, supersedes_grant_id, shopper_ref, agent_id, agent_verified, merchant_id, product_scope, size_min_cm, size_max_cm, colour_preference, currency, amount_max_cents, budget_limit_cents, payment_method_ref, shipping_method, shipping_max_cost_cents, delivery_by, return_policy_required, confirmed_at, expires_at, private_chat_hash, grant_json, system_metadata, schema_label, created_at, chain_seq, prev_hash, entry_hash) values (
  '06f0c0fe-f24e-4817-a857-8b6b2cfefffe'::uuid,
  '30e321ed-b682-4c2e-a2a2-1789eb052e2b'::uuid,
  1,
  null,
  'Ivan Dijkstra',
  'instinct-kk14680',
  true,
  '32b14be6-26e6-49df-a7af-79532f910510'::uuid,
  null,
  150,
  165,
  null,
  'USD',
  50000,
  50000,
  'Demo PayPal',
  null,
  null,
  '2026-10-30'::date,
  true,
  '2026-10-26T18:00:00.000Z'::timestamptz,
  '2026-10-27T18:00:00.000Z'::timestamptz,
  'sha256:e9c234821a57377aaef2141763ddcb8ac004d4f3f9f4ac156924a21b00cc3d81',
  '{"agent_id":"instinct-kk14680","agent_verified":true,"amount_max_cents":50000,"budget_limit_cents":50000,"colour_preference":null,"confirmed_at":"2026-10-26T18:00:00.000Z","currency":"USD","delivery_by":"2026-10-30","expires_at":"2026-10-27T18:00:00.000Z","merchant_id":"32b14be6-26e6-49df-a7af-79532f910510","payment_method_ref":"Demo PayPal","product_scope":null,"return_policy_required":true,"shipping_max_cost_cents":null,"shipping_method":null,"shopper_ref":"Ivan Dijkstra","size_max_cm":165,"size_min_cm":150}'::jsonb,
  '{"checked":false,"data_sharing_limits":"grant fields only, this purchase only","priority":"P1","private_chat_hash_note":"Seeded demo row: no private chat exists, the hash is of a fixed label.","seeded_demo":true}'::jsonb,
  'VI-aligned demo representation',
  '2026-10-26T18:00:00.000Z'::timestamptz,
  10,
  'sha256:2d5018e714550dd0c35e15ce34e430fbe78587077c617c7ad692880f72f115ea',
  'sha256:5fa62b63e508ed02b3378721a02012899a2fad30f39392031e6a57857ab0ae29'
);

insert into proposals (id, grant_id, product_id, shown_item_price_cents, shown_total_cents, shown_returns_summary, shown_delivery, shown_at, confirmation_ref, confirmed_at, created_at, chain_seq, prev_hash, entry_hash) values (
  'a2bcdc69-c2a5-462c-a4bd-9a71b1c1e278'::uuid,
  '7893c376-c429-4c62-a187-c16e21334cc5'::uuid,
  '40c70768-77ac-4953-8bae-c75c8319fcf4'::uuid,
  44995,
  44995,
  'Final sale',
  'Standard, 5 days',
  '2026-10-26T13:04:00.000Z'::timestamptz,
  'PC-0041',
  '2026-10-26T13:04:00.000Z'::timestamptz,
  '2026-10-26T13:04:00.000Z'::timestamptz,
  2,
  'sha256:12bacbc20e07eff0952a34d671c7a4fb7d8f65d311812d9d146a60ad6455d643',
  'sha256:e57feeb7ae841dda18b191cd2e03161ebfd9a463c4014f90ac3c564ec2c617ab'
);

insert into proposals (id, grant_id, product_id, shown_item_price_cents, shown_total_cents, shown_returns_summary, shown_delivery, shown_at, confirmation_ref, confirmed_at, created_at, chain_seq, prev_hash, entry_hash) values (
  'b2c56689-9520-4273-ab75-d4f10bc9a559'::uuid,
  '62b883a3-1f9e-45a2-ab49-8990d51e421d'::uuid,
  '40c70768-77ac-4953-8bae-c75c8319fcf4'::uuid,
  44995,
  null,
  'Easy returns',
  'Friday',
  '2026-10-26T17:09:00.000Z'::timestamptz,
  'PC-12322',
  '2026-10-26T17:09:00.000Z'::timestamptz,
  '2026-10-26T17:09:00.000Z'::timestamptz,
  6,
  'sha256:b98616d5b1b45dd9babbeef70b028120fe470d02ecb149e1763f5c41a6dab87f',
  'sha256:1bd6f632aca1710a80bc92c01a208c29c20383d2e148e21d4b7ed617a050a2d4'
);

insert into proposals (id, grant_id, product_id, shown_item_price_cents, shown_total_cents, shown_returns_summary, shown_delivery, shown_at, confirmation_ref, confirmed_at, created_at, chain_seq, prev_hash, entry_hash) values (
  'bba873ee-4369-4db7-a0a1-25afc38260a7'::uuid,
  '06f0c0fe-f24e-4817-a857-8b6b2cfefffe'::uuid,
  'd53088eb-40e0-4fa5-b2f8-1b81e9c7c37e'::uuid,
  48983,
  48983,
  'Free returns',
  'Friday',
  '2026-10-26T18:04:00.000Z'::timestamptz,
  'PC-13422',
  '2026-10-26T18:04:00.000Z'::timestamptz,
  '2026-10-26T18:04:00.000Z'::timestamptz,
  11,
  'sha256:5fa62b63e508ed02b3378721a02012899a2fad30f39392031e6a57857ab0ae29',
  'sha256:157c0ddeb78e945f7b92402925dbca1f4b87b477cfd5c32a6cb335d58183f38a'
);

insert into actions (id, grant_id, seq, type, detail, agent_believed_terms, image_evidence_ref, created_at, chain_seq, prev_hash, entry_hash) values (
  '76d863d9-1a70-4f2c-a461-89e8f4dda335'::uuid,
  '7893c376-c429-4c62-a187-c16e21334cc5'::uuid,
  1,
  'checkout',
  '{"agent_summary":{"returns":"Final sale"},"brand":"Burton","colour":"Serpent","delivery_date":"2026-10-31","item_price_cents":44995,"payment_method":"Demo PayPal","product_id":"40c70768-77ac-4953-8bae-c75c8319fcf4","product_name":"Spellbinder Snowboard 2026/2027","shipping_cents":0,"shipping_method":"standard","size_cm":156,"total_cents":44995}'::jsonb,
  '{"returns":"Final sale"}'::jsonb,
  null,
  '2026-10-26T13:06:00.000Z'::timestamptz,
  3,
  'sha256:e57feeb7ae841dda18b191cd2e03161ebfd9a463c4014f90ac3c564ec2c617ab',
  'sha256:2db9e3553cf217953ea823e1ea8e9c150600a4cbf4532cb4895399776c108ed0'
);

insert into actions (id, grant_id, seq, type, detail, agent_believed_terms, image_evidence_ref, created_at, chain_seq, prev_hash, entry_hash) values (
  '8a17f175-cd1e-4cbf-a40b-46e5b2d78667'::uuid,
  '62b883a3-1f9e-45a2-ab49-8990d51e421d'::uuid,
  1,
  'checkout',
  '{"agent_summary":{"returns":"Easy returns"},"brand":"Burton","colour":"Serpent","delivery_date":"2026-10-30","item_price_cents":44995,"payment_method":"Demo PayPal","product_id":"40c70768-77ac-4953-8bae-c75c8319fcf4","product_name":"Spellbinder Snowboard 2026/2027","shipping_cents":6000,"shipping_method":"expedited","size_cm":156,"total_cents":50995}'::jsonb,
  '{"returns":"Easy returns"}'::jsonb,
  null,
  '2026-10-26T17:11:00.000Z'::timestamptz,
  7,
  'sha256:1bd6f632aca1710a80bc92c01a208c29c20383d2e148e21d4b7ed617a050a2d4',
  'sha256:1b07e5e94bc5b417652fea36356c801ffc29578e98840b9d4399d0671905ced1'
);

insert into actions (id, grant_id, seq, type, detail, agent_believed_terms, image_evidence_ref, created_at, chain_seq, prev_hash, entry_hash) values (
  '75de345c-a0c5-4a77-af7e-29145feecbb0'::uuid,
  '06f0c0fe-f24e-4817-a857-8b6b2cfefffe'::uuid,
  1,
  'checkout',
  '{"agent_summary":{"returns":"Free returns"},"brand":"Lib Tech","colour":null,"delivery_date":"2026-10-29","item_price_cents":48983,"payment_method":"Demo PayPal","product_id":"d53088eb-40e0-4fa5-b2f8-1b81e9c7c37e","product_name":"T. Rice Orca Snowboard 2025/2026","shipping_cents":0,"shipping_method":"standard","size_cm":156,"total_cents":48983}'::jsonb,
  '{"returns":"Free returns"}'::jsonb,
  null,
  '2026-10-26T18:06:00.000Z'::timestamptz,
  12,
  'sha256:157c0ddeb78e945f7b92402925dbca1f4b87b477cfd5c32a6cb335d58183f38a',
  'sha256:fc1044fc8d1290f99f01d766df16f543ca6fd7974a5386517a506d2db7f40c3c'
);

insert into receipts (id, receipt_ref, order_ref, grant_id, proposal_id, merchant_id, terms_snapshot, action_summary, mismatch_results, problems_found, recommendation, missing_components, image_evidence_ref, schema_label, created_at, chain_seq, prev_hash, entry_hash) values (
  '1c573160-7666-4ebf-aa5f-2f974e1c79f9'::uuid,
  'AR-2026-0041',
  null,
  '7893c376-c429-4c62-a187-c16e21334cc5'::uuid,
  'a2bcdc69-c2a5-462c-a4bd-9a71b1c1e278'::uuid,
  '32b14be6-26e6-49df-a7af-79532f910510'::uuid,
  '{"brand":"Burton","colour":"Serpent","expedited_delivery_days":4,"expedited_shipping_cents":6000,"formal_returns":"final_sale","formal_terms_text":"Final Sale","merchant":"Northwind Outfitters","price_cents":44995,"product_id":"40c70768-77ac-4953-8bae-c75c8319fcf4","product_name":"Spellbinder Snowboard 2026/2027","size_cm":156,"standard_delivery_days":5,"standard_shipping_cents":0,"terms_version":"v1"}'::jsonb,
  '{"brand":"Burton","colour":"Serpent","delivery_date":"2026-10-31","item_price_cents":44995,"order_status":"Confirmed","payment_method":"Demo PayPal","product_name":"Spellbinder Snowboard 2026/2027","shipping_cents":0,"shipping_method":"standard","size_cm":156,"total_cents":44995}'::jsonb,
  '[{"actual":"$449.95 total","cause":null,"cited_fields":["amount_max_cents","budget_limit_cents"],"field":"Budget","grant":"$500.00 max","merchant_terms":"Item $449.95, standard shipping free","next_action_who":null,"result":"match"},{"actual":"156cm","cause":null,"cited_fields":["size_min_cm","size_max_cm"],"field":"Size","grant":"150-165cm","merchant_terms":"156cm","next_action_who":null,"result":"match"},{"actual":"Serpent","cause":null,"cited_fields":["colour_preference"],"field":"Colour","grant":null,"merchant_terms":"Serpent","next_action_who":null,"result":"unspecified"},{"actual":"Agent told customer \"Final sale\"","cause":null,"cited_fields":["return_policy_required"],"field":"Returns","grant":null,"merchant_terms":"Final sale","next_action_who":null,"result":"unspecified"},{"actual":"Sat 31 Oct 2026","cause":null,"cited_fields":["delivery_by"],"field":"Delivery","grant":null,"merchant_terms":"Standard 5 days","next_action_who":null,"result":"unspecified"},{"actual":"Standard","cause":null,"cited_fields":["shipping_method"],"field":"Shipping method","grant":null,"merchant_terms":"Standard free, expedited $60.00","next_action_who":null,"result":"unspecified"},{"actual":"Northwind Outfitters","cause":null,"cited_fields":["merchant_id"],"field":"Merchant","grant":"Northwind Outfitters only","merchant_terms":"Northwind Outfitters","next_action_who":null,"result":"match"},{"actual":"Demo PayPal","cause":null,"cited_fields":["payment_method_ref"],"field":"Payment method","grant":"Demo PayPal","merchant_terms":"Demo PayPal","next_action_who":null,"result":"match"}]'::jsonb,
  0,
  'represent',
  array[]::text[],
  null,
  'VI-aligned demo representation',
  '2026-10-26T13:07:00.000Z'::timestamptz,
  4,
  'sha256:2db9e3553cf217953ea823e1ea8e9c150600a4cbf4532cb4895399776c108ed0',
  'sha256:70303c16f2617c5ad789606c632d7b00b4e8fc3aa62cc01ffb63956ea85d52ee'
);

insert into receipts (id, receipt_ref, order_ref, grant_id, proposal_id, merchant_id, terms_snapshot, action_summary, mismatch_results, problems_found, recommendation, missing_components, image_evidence_ref, schema_label, created_at, chain_seq, prev_hash, entry_hash) values (
  '04b3af6a-486e-4a01-a9c0-2d81f7450bec'::uuid,
  'AR-2026-0042',
  '12322',
  '62b883a3-1f9e-45a2-ab49-8990d51e421d'::uuid,
  'b2c56689-9520-4273-ab75-d4f10bc9a559'::uuid,
  '32b14be6-26e6-49df-a7af-79532f910510'::uuid,
  '{"brand":"Burton","colour":"Serpent","expedited_delivery_days":4,"expedited_shipping_cents":6000,"formal_returns":"final_sale","formal_terms_text":"Final Sale","merchant":"Northwind Outfitters","price_cents":44995,"product_id":"40c70768-77ac-4953-8bae-c75c8319fcf4","product_name":"Spellbinder Snowboard 2026/2027","size_cm":156,"standard_delivery_days":5,"standard_shipping_cents":0,"terms_version":"v1"}'::jsonb,
  '{"agent_summary_returns":"Easy returns","brand":"Burton","colour":"Serpent","delivery_date":"2026-10-30","item_price_cents":44995,"order_status":"Confirmed","payment_method":"Demo PayPal","product_name":"Spellbinder Snowboard 2026/2027","shipping_cents":6000,"shipping_method":"expedited","size_cm":156,"total_cents":50995}'::jsonb,
  '[{"actual":"$509.95 total","cause":"Agent treated the cap as item-only","cited_fields":["amount_max_cents","budget_limit_cents"],"field":"Budget","grant":"$500.00 max","merchant_terms":"Item $449.95 + expedited $60.00","next_action_who":"Merchant: concede the dispute","result":"mismatch"},{"actual":"Agent summary \"Easy returns\"","cause":"Agent summary \"Easy returns\" misrepresented the formal final-sale terms","cited_fields":["return_policy_required"],"field":"Returns","grant":"Returnable required","merchant_terms":"Final sale","next_action_who":"Merchant: concede the dispute","result":"mismatch"},{"actual":"156cm","cause":null,"cited_fields":["size_min_cm","size_max_cm"],"field":"Size","grant":"150-165cm","merchant_terms":"156cm","next_action_who":null,"result":"match"},{"actual":"Serpent","cause":null,"cited_fields":["colour_preference"],"field":"Colour","grant":"Serpent","merchant_terms":"Serpent","next_action_who":null,"result":"match"},{"actual":"Fri 30 Oct 2026 (expedited)","cause":null,"cited_fields":["delivery_by"],"field":"Delivery","grant":"By Fri 30 Oct 2026","merchant_terms":"Expedited 4 days, standard 5 days","next_action_who":null,"result":"match"},{"actual":"Expedited","cause":null,"cited_fields":["shipping_method"],"field":"Shipping method","grant":null,"merchant_terms":"Standard free, expedited $60.00","next_action_who":null,"result":"unspecified"},{"actual":"Northwind Outfitters","cause":null,"cited_fields":["merchant_id"],"field":"Merchant","grant":"Northwind Outfitters only","merchant_terms":"Northwind Outfitters","next_action_who":null,"result":"match"},{"actual":"Demo PayPal","cause":null,"cited_fields":["payment_method_ref"],"field":"Payment method","grant":"Demo PayPal","merchant_terms":"Demo PayPal","next_action_who":null,"result":"match"}]'::jsonb,
  2,
  'concede',
  array[]::text[],
  null,
  'VI-aligned demo representation',
  '2026-10-26T17:12:00.000Z'::timestamptz,
  8,
  'sha256:1b07e5e94bc5b417652fea36356c801ffc29578e98840b9d4399d0671905ced1',
  'sha256:572b79ef4cd7d904d6555ebde45cbf10fe08291708faf1285fc3e1865b504180'
);

insert into receipts (id, receipt_ref, order_ref, grant_id, proposal_id, merchant_id, terms_snapshot, action_summary, mismatch_results, problems_found, recommendation, missing_components, image_evidence_ref, schema_label, created_at, chain_seq, prev_hash, entry_hash) values (
  '05ea1c87-2f1f-40c1-ae7f-825ca10e9b17'::uuid,
  'AR-2026-0043',
  '13422',
  '06f0c0fe-f24e-4817-a857-8b6b2cfefffe'::uuid,
  'bba873ee-4369-4db7-a0a1-25afc38260a7'::uuid,
  '32b14be6-26e6-49df-a7af-79532f910510'::uuid,
  '{"brand":"Lib Tech","colour":null,"expedited_delivery_days":null,"expedited_shipping_cents":null,"formal_returns":"free","formal_terms_text":"Free returns within 30 days","merchant":"Northwind Outfitters","price_cents":48983,"product_id":"d53088eb-40e0-4fa5-b2f8-1b81e9c7c37e","product_name":"T. Rice Orca Snowboard 2025/2026","size_cm":156,"standard_delivery_days":3,"standard_shipping_cents":0,"terms_version":"v1"}'::jsonb,
  '{"agent_summary_returns":"Free returns","brand":"Lib Tech","colour":null,"delivery_date":"2026-10-29","item_price_cents":48983,"order_status":"Confirmed","payment_method":"Demo PayPal","product_name":"T. Rice Orca Snowboard 2025/2026","shipping_cents":0,"shipping_method":"standard","size_cm":156,"total_cents":48983}'::jsonb,
  '[{"actual":"$489.83 total","cause":null,"cited_fields":["amount_max_cents","budget_limit_cents"],"field":"Budget","grant":"$500.00 max","merchant_terms":"Item $489.83, standard shipping free","next_action_who":null,"result":"match"},{"actual":"Agent summary \"Free returns\"","cause":null,"cited_fields":["return_policy_required"],"field":"Returns","grant":"Returnable required","merchant_terms":"Free returns within 30 days","next_action_who":null,"result":"match"},{"actual":"156cm","cause":null,"cited_fields":["size_min_cm","size_max_cm"],"field":"Size","grant":"150-165cm","merchant_terms":"156cm","next_action_who":null,"result":"match"},{"actual":null,"cause":null,"cited_fields":["colour_preference"],"field":"Colour","grant":null,"merchant_terms":null,"next_action_who":null,"result":"unspecified"},{"actual":"Thu 29 Oct 2026 (standard)","cause":null,"cited_fields":["delivery_by"],"field":"Delivery","grant":"By Fri 30 Oct 2026","merchant_terms":"Standard 3 days","next_action_who":null,"result":"match"},{"actual":"Standard, no expedited charge","cause":null,"cited_fields":["shipping_method"],"field":"Shipping method","grant":null,"merchant_terms":"Standard free","next_action_who":null,"result":"unspecified"},{"actual":"Northwind Outfitters","cause":null,"cited_fields":["merchant_id"],"field":"Merchant","grant":"Northwind Outfitters only","merchant_terms":"Northwind Outfitters","next_action_who":null,"result":"match"},{"actual":"Demo PayPal","cause":null,"cited_fields":["payment_method_ref"],"field":"Payment method","grant":"Demo PayPal","merchant_terms":"Demo PayPal","next_action_who":null,"result":"match"}]'::jsonb,
  0,
  'represent',
  array[]::text[],
  null,
  'VI-aligned demo representation',
  '2026-10-26T18:07:00.000Z'::timestamptz,
  13,
  'sha256:fc1044fc8d1290f99f01d766df16f543ca6fd7974a5386517a506d2db7f40c3c',
  'sha256:42b958ec366751fec4bbc4215983f9ea0a2e9baf68444399d1a69d909df70499'
);

insert into disputes (id, receipt_id, reason, opened_at, created_at) values (
  '7460e1bd-ad98-4ba4-a47b-16749bc03b79'::uuid,
  '04b3af6a-486e-4a01-a9c0-2d81f7450bec'::uuid,
  'Customer disputed the order',
  '2026-10-26T17:30:00.000Z'::timestamptz,
  '2026-10-26T17:30:00.000Z'::timestamptz
);

insert into disputes (id, receipt_id, reason, opened_at, created_at) values (
  '6e4fe786-d78a-4b6e-a667-0b5b485e54a0'::uuid,
  '05ea1c87-2f1f-40c1-ae7f-825ca10e9b17'::uuid,
  'Claimed agent overstep — agent exceeded budget / bought outside grant',
  '2026-10-26T18:30:00.000Z'::timestamptz,
  '2026-10-26T18:30:00.000Z'::timestamptz
);

insert into dispute_events (id, dispute_id, event_type, decided_by, basis, created_at, chain_seq, prev_hash, entry_hash) values (
  '6ea4e418-d92e-44e0-ac1f-346f58ebbbc1'::uuid,
  '7460e1bd-ad98-4ba4-a47b-16749bc03b79'::uuid,
  'opened',
  null,
  '{}'::jsonb,
  '2026-10-26T17:30:00.000Z'::timestamptz,
  9,
  'sha256:572b79ef4cd7d904d6555ebde45cbf10fe08291708faf1285fc3e1865b504180',
  'sha256:2d5018e714550dd0c35e15ce34e430fbe78587077c617c7ad692880f72f115ea'
);

insert into dispute_events (id, dispute_id, event_type, decided_by, basis, created_at, chain_seq, prev_hash, entry_hash) values (
  '7f1e10b5-3d0d-4630-a53f-adb74d4f4aa0'::uuid,
  '6e4fe786-d78a-4b6e-a667-0b5b485e54a0'::uuid,
  'opened',
  null,
  '{}'::jsonb,
  '2026-10-26T18:30:00.000Z'::timestamptz,
  14,
  'sha256:42b958ec366751fec4bbc4215983f9ea0a2e9baf68444399d1a69d909df70499',
  'sha256:08ddb300754fad49a9f1e221158351bd98a577ba6e1ab9f553f43eeb38e3e9ad'
);

insert into dispute_events (id, dispute_id, event_type, decided_by, basis, created_at, chain_seq, prev_hash, entry_hash) values (
  '2a910e27-b16e-495e-aa36-e2d1c46079ab'::uuid,
  '6e4fe786-d78a-4b6e-a667-0b5b485e54a0'::uuid,
  'recommendation',
  'AgentReceipt (automatic)',
  '{"problems_found":0,"recommendation":"represent"}'::jsonb,
  '2026-10-26T18:31:00.000Z'::timestamptz,
  15,
  'sha256:08ddb300754fad49a9f1e221158351bd98a577ba6e1ab9f553f43eeb38e3e9ad',
  'sha256:6913f5b5fd7ca22146f320ef2bdf9e317044b9403d50f6ca809ffd2b31066136'
);

insert into dispute_events (id, dispute_id, event_type, decided_by, basis, created_at, chain_seq, prev_hash, entry_hash) values (
  'bc71b4fa-e57c-4564-ae17-3fb7ca465ada'::uuid,
  '6e4fe786-d78a-4b6e-a667-0b5b485e54a0'::uuid,
  'represented',
  'Northwind Outfitters',
  '{"receipt_ref":"AR-2026-0043"}'::jsonb,
  '2026-10-26T18:40:00.000Z'::timestamptz,
  16,
  'sha256:6913f5b5fd7ca22146f320ef2bdf9e317044b9403d50f6ca809ffd2b31066136',
  'sha256:a80b721c775154a7144e570678df1a2e3340a135acf8b9ff97d48371d680c469'
);

insert into dispute_events (id, dispute_id, event_type, decided_by, basis, created_at, chain_seq, prev_hash, entry_hash) values (
  'b16de077-2f58-487c-af2e-5100e6c9ab4b'::uuid,
  '6e4fe786-d78a-4b6e-a667-0b5b485e54a0'::uuid,
  'outcome_won',
  'Northwind Outfitters',
  '{"receipt_ref":"AR-2026-0043"}'::jsonb,
  '2026-10-26T18:50:00.000Z'::timestamptz,
  17,
  'sha256:a80b721c775154a7144e570678df1a2e3340a135acf8b9ff97d48371d680c469',
  'sha256:9df31ea018e1da2ecd6b7d51db3e7b12335e0923dde0d4955115212ecb3ebdf2'
);

-- The next chained entry gets chain_seq 18.
select setval('chain_seq_gen', 17, true);

commit;
