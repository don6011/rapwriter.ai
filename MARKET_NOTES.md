# Market Collapse Notes

## Price source of truth

- `scripts/sync-prep-studio-plans.mjs` is the current product definition: RapWriter Pro is `$7.99/month` or `$59/year`.
- Historical migrations and membership fixtures retain old prices so past records and compatibility tests remain reproducible. They are not live presentation sources.
- No live Market or membership UI contains the retired `$14.99`, `$24.99`, or `$29.99` offers.

## Retired tier assumptions

- `PremiumMarketplace.tsx` previously presented and branched across multiple artist tiers. Market now offers only Free and RapWriter Pro.
- `MembershipCard.tsx` previously exposed Elite, Producer Pro, and All Access purchase choices. It now shows independent Artist and Producer access without those upsells.
- `studio-room-access.ts` previously partitioned rooms across Pro and Elite. Current Pro receives the complete active room allowance; grandfathered `artist_studio` access remains recognized.
- `membership-access.ts` previously recommended `artist_studio`; current upgrade recommendations resolve to `artist_pro`.
- `studio/format.ts` and `client/membership-access.ts` deliberately retain labels/detection for grandfathered Elite and Producer Pro records.

## Entitlements

- No entitlement key was orphaned by the collapse.
- Elite/career keys such as `performance_coach`, `producer_messaging`, `elite_rooms`, and `exclusive_releases` are no longer sold, but remain on retired `artist_studio` records for grandfathered access.
- Former Producer Pro entitlements and limits are copied to `producer_free`; Producer HQ has no paid capability gate.
- Collaboration tables, APIs, and the dedicated workspace remain in place, but customer and producer entry points are hidden until that workflow is ready to relaunch.

## Deliberate product decisions

- Free artists can browse and purchase beats.
- Project and song storage are not artificially capped by the Market collapse.
- Free artists receive three starter beats; Pro unlocks the complete starter library.
- Producer beats remain purchasable by every artist tier.
- Existing marketplace product and entitlement rows are preserved for ownership history.
- Retired `artist_studio` and `producer_pro` rows remain for existing subscriptions and grants.
- Producer payouts and the zero-platform-fee path were not changed.
- `src/lib/server/stripe-connect.ts` and the payout execution path were not modified.

## Bottom navigation decision

Not implemented. Keeping Market in the primary dock protects beat discovery and producer reach. Removing it makes the app feel more creation-first, but pushes commerce into contextual entry points and may reduce marketplace liquidity. This requires an explicit product decision.
