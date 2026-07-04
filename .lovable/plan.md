# Make RapWriter.ai feel VC-backed

Right now the root route drops visitors straight into the Studio. VC-grade products have a clear front door (landing → sign in → product), visible traction, and a consistent motion language. This pass restructures the app around that shape without changing the product surface you've already built.

## 1. Route restructure

```
/                → NEW marketing landing (public)
/studio          → Ghost Studio (auth-gated, was /)
/marketplace     → unchanged (public browse, gated actions)
/auth            → sign in / sign up
/manifesto       → short "why we exist" page (linked from footer)
/changelog       → shipped updates (trust signal)
```

Every route gets its own `head()` with unique title, description, og:title, og:description.

## 2. Landing page (the investor demo surface)

Sections, top → bottom:
- Sticky glass nav: logo · Studio · Marketplace · Manifesto · Sign in · **Enter Studio** (gold)
- Hero: eyebrow "The Prep Studio™", H1 "Go from idea to Booth Ready™.", sub, dual CTA (Enter Studio / Watch 60s), animated waveform + live "295 writing right now" pill
- Logo strip: "Trusted by writers signed to —" (6 placeholder marks, greyscale)
- Product tour: 3 large screenshots of Studio / Marketplace / Booth Ready certificate with captions
- Metrics band: Songs Certified · Beats Licensed · Hours Written · Producers Onboarded (counts animate on scroll)
- Featured producers rail (pulls from marketplace-data)
- Testimonials: 3 quote cards, gold seal
- Pricing tease: Free · Writer · Studio (no checkout yet — CTA opens auth)
- FAQ (6 items, accordion)
- Footer: sitemap, socials, legal, "Made in Atlanta" mark

Motion: single Framer-Motion-style reveal on scroll (fade + 8px rise), waveform loop in hero, count-up on metrics. No confetti, no parallax overload.

## 3. Auth (Lovable Cloud)

Enable Lovable Cloud. Email + password and Google sign-in. `/auth` page with tabbed sign-in / sign-up matching the black+gold aesthetic. `_authenticated` layout wraps `/studio` and redirects unauthenticated users to `/auth`. Header shows avatar + menu when signed in. No profile fields for now (add later if needed) — just `auth.users`.

## 4. Trust & product signals

- Live "writing right now" ticker in landing hero and Studio header (client-side simulated for now, real once Cloud is wired)
- Changelog page seeded with 5 entries so the product feels alive
- Manifesto page — one long-form scroll, editorial typography
- Footer status dot ("All systems normal") + version tag

## 5. Visual & motion polish

- Extract shared primitives: `<SectionEyebrow>`, `<GoldButton>`, `<StatCounter>`, `<GlassCard>` so every surface matches
- Standardize section rhythm: 96px vertical padding, max-w-6xl, hairline dividers
- Add `--shadow-elevated` and `--gradient-radial-gold` tokens; retire ad-hoc gradients
- Global scroll-reveal hook (IntersectionObserver) — one animation vocabulary across the app
- Focus-visible gold ring on every interactive element
- Empty states in Studio get illustrated placeholders instead of blank panels

## 6. Out of scope this pass

- Payments / real subscription billing
- Real presence counts (uses simulated ticker)
- Producer onboarding flow
- Mobile-app-grade responsive rework beyond making landing + auth work on phones

## Technical notes

- New files: `src/routes/landing` becomes `src/routes/index.tsx` (replace current); `src/routes/studio.tsx`, `src/routes/auth.tsx`, `src/routes/_authenticated.tsx`, `src/routes/manifesto.tsx`, `src/routes/changelog.tsx`, plus `src/components/landing/*` and `src/components/site/{Nav,Footer}.tsx`
- Move existing Studio component mount from `/` to `/studio` route
- Lovable Cloud enablement adds Supabase client at `src/integrations/supabase/*` — Studio's local-storage drafts stay for now; migrating drafts to Cloud is a follow-up
- Update `__root.tsx` head metadata to real app copy (kills the "Lovable App" defaults)
- One shared `useScrollReveal` hook to avoid per-component animation code

Approve and I'll build it in that order: routes + landing shell first, then auth, then trust surfaces, then the polish pass.
