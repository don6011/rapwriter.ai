alter table public.product_entitlements
  drop constraint if exists product_entitlements_product_type_check;

alter table public.product_entitlements
  add constraint product_entitlements_product_type_check
  check (
    product_type in (
      'studio_room',
      'ai_style',
      'vocal_chain',
      'writing_pack',
      'ambient_pack',
      'theme',
      'bundle',
      'producer_profile',
      'beat_license'
    )
  );
