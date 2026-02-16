# ONEMO Design Principles

> This file defines the visual and interaction standards for the ONEMO platform.
> Referenced by: `.claude/agents/design-review.md`, CLAUDE.md Quick Visual Check protocol.
> Status: **Skeleton** — fills in during milestone 5.41 (Design System & UX Definition).
> Sections marked `[TBD]` are placeholders for decisions not yet made.

---

## 1. Product Context

ONEMO is a custom magnetic Effect design platform. Customers create personalized decorative panels through a visual configurator. The experience must feel:
- **Premium** — this is a designed physical product, not a commodity
- **Visual-first** — the Effect preview is the hero, UI stays out of the way
- **Confident** — clear calls to action, no uncertainty about what happens next
- **Fast** — perceived performance matters as much as actual performance

## 2. Technology Stack

| Layer | Tool | Notes |
|-------|------|-------|
| Framework | Next.js (App Router) | Server components default, client where needed |
| Styling | Tailwind CSS | Utility-first. No inline styles. No CSS modules. |
| Commerce | Shopify (Storefront API + checkout) | Shopify owns checkout, cart, payments |
| Database | Supabase (PostgreSQL) | Canonical data store |
| Assets | Cloudinary | All images served via Cloudinary transforms |
| Hosting | Vercel | Edge functions, ISR where applicable |
| Icons | [TBD] | Lucide, Heroicons, or custom — to be decided |

## 3. Color Palette

> [TBD] — Define during 5.41. Will be extracted from Figma Variables.

### Structure (to be filled):
- **Brand primary:** [TBD]
- **Brand secondary:** [TBD]
- **Neutrals:** [TBD] — scale from white to black
- **Semantic:** success, warning, error, info
- **Surface colors:** background, card, elevated, overlay
- **Dark mode:** [TBD — scope decision needed]

### Rules (known):
- All colors defined in `tailwind.config.ts` as CSS custom properties
- No hardcoded hex values in components — always use Tailwind classes
- Minimum contrast: 4.5:1 normal text, 3:1 large text (WCAG AA)

## 4. Typography

> [TBD] — Define during 5.41.

### Structure (to be filled):
- **Font family:** [TBD]
- **Scale:** [TBD] — likely modular scale based on base size
- **Weights:** [TBD]
- **Line heights:** [TBD]

### Rules (known):
- Font loaded via `next/font` for zero layout shift
- Heading hierarchy must be visually distinct (size AND weight)
- Body text: minimum 16px on mobile
- All type defined in Tailwind config, used via utility classes

## 5. Spacing & Layout

> [TBD] — Define during 5.41.

### Structure (to be filled):
- **Base unit:** [TBD] — likely 4px or 8px
- **Spacing scale:** [TBD]
- **Grid system:** [TBD]
- **Max content width:** [TBD]
- **Container padding:** [TBD]

### Rules (known):
- Responsive breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), `2xl` (1536px)
- Mobile-first approach — base styles are mobile, add breakpoint modifiers up
- No magic numbers for spacing — use Tailwind spacing scale only
- Consistent internal padding within cards/containers

## 6. Components

> [TBD] — Component inventory built during 5.41.

### Core components (expected):
- Button (primary, secondary, ghost, destructive)
- Input / Textarea / Select
- Card / Panel
- Modal / Dialog
- Toast / Notification
- Navigation (header, footer, mobile nav)
- Effect configurator (the core product experience)
- Image display (Cloudinary-powered, responsive, lazy-loaded)

### Rules (known):
- All interactive elements must have visible focus states
- Buttons: minimum 44px touch target on mobile
- Loading states: skeleton screens preferred over spinners
- Error states: inline validation, not just toast notifications
- Components live in `src/components/` with clear naming

## 7. Images & Assets (Cloudinary)

### Rules (known):
- All images served via Cloudinary URL transforms — never serve raw uploads
- Use `f_auto,q_auto` for format/quality optimization
- Responsive images: use `srcset` or Next.js `<Image>` with Cloudinary loader
- Effect previews: highest quality, hero treatment
- Thumbnails: consistent aspect ratios, consistent sizing
- Placeholder: blur-up or dominant color while loading
- Alt text required on all images

## 8. Interactions & Motion

> [TBD] — Define during 5.41.

### Rules (known):
- Transitions: 150-300ms, ease-in-out for most UI transitions
- No motion for motion's sake — every animation should communicate state change
- Respect `prefers-reduced-motion` — disable non-essential animations
- Page transitions: [TBD]
- Micro-interactions on buttons, toggles: [TBD]

## 9. Accessibility (WCAG 2.1 AA)

### Non-negotiable:
- Semantic HTML: proper heading hierarchy, landmarks, form labels
- Keyboard navigation: all interactive elements reachable via Tab
- Focus visible: clear focus ring on all interactive elements
- ARIA: use when semantic HTML isn't sufficient, not as a first resort
- Color contrast: 4.5:1 minimum for normal text, 3:1 for large text
- Images: descriptive alt text (not "image of...")
- Forms: labels connected to inputs, error messages associated via `aria-describedby`
- Touch targets: minimum 44x44px on mobile

## 10. Shopify Integration Constraints

### Rules (known):
- Checkout is Shopify-owned — we don't control checkout UI
- Cart operations go through Storefront API — respect Shopify's rate limits
- Product data: Shopify is source of truth for pricing, inventory, variants
- SEO: product pages need structured data (JSON-LD) for Shopify products
- Don't fight Shopify patterns — extend them

## 11. Performance

### Rules (known):
- Core Web Vitals targets: LCP < 2.5s, FID < 100ms, CLS < 0.1
- Images: lazy load below the fold, eager load hero/above-fold
- Fonts: `font-display: swap`, preload critical fonts
- JavaScript: minimize client-side JS, prefer server components
- No layout shift from loading content — use fixed dimensions or skeleton screens

---

## Changelog

| Date | Change | Reference |
|------|--------|-----------|
| 2025-02-14 | Skeleton created | ONE-201 |
