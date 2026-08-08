alter table public.growth_events drop constraint if exists growth_events_event_name_check;
alter table public.growth_events add constraint growth_events_event_name_check check (event_name in (
  'campaign_viewed','campaign_claim_attempted','campaign_claimed','campaign_full','promo_started','promo_expired','promo_converted_to_paid',
  'referral_created','referral_registered','referral_qualified','referral_rewarded','membership_upgraded','membership_downgraded',
  'support_opened','help_article_viewed','ticket_started','ticket_submitted','ticket_replied','ticket_resolved',
  'ai_feature_started','ai_feature_completed','ai_feature_failed','ai_limit_reached','studio_dna_updated'
));
