-- §8.7a: add the Effect Creator V2 save-bundle columns to `designs`.
-- Stores the two F1-bound truths + a lightweight library-card projection:
--   editable_recipe — the remix substrate (OutlineDocument: baseSnapshot + commands + generator + style)
--   locked_payload  — the manufacturing/proof record (ApprovedEffectPayload, content-addressed)
--   effect_spec     — a small render projection {effectType, size, payload_hash, final_bbox} for listing
-- All nullable + additive (non-breaking; existing rows/GLB-design flow unaffected).
--
-- DEPLOY NOTE: applying this to production is a deliberate deploy step (supabase db push / migration
-- pipeline) — do NOT run it from a dev build. The §8.7a code is pure (no DB writes); §8.7b wires the
-- actual save/load + auth + Cloudinary upload once this column set is live.

alter table if exists public.designs
  add column if not exists editable_recipe jsonb,
  add column if not exists locked_payload  jsonb,
  add column if not exists effect_spec      jsonb;

-- Index public, approved effects by payload identity for dedupe/lookup (cheap, partial).
create index if not exists idx_designs_payload_hash
  on public.designs ((effect_spec ->> 'payload_hash'))
  where is_public = true and moderation_state = 'approved';
