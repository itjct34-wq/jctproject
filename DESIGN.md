---
name: Japan Circular Trading (JCT)
description: Enamel Yard Board — classic used-vehicle export lot; shared tokens, public Persuade / ERP Operate
colors:
  jct-navy: "#14181C"
  jct-vermilion: "#C8102E"
  jct-gold: "#8B7E66"
  jct-canopy: "#0F3D2E"
  jct-panel: "#E8EAED"
  jct-surface: "#F2F3F5"
  jct-border: "#C5CAD0"
  jct-muted: "#3A424A"
  jct-muted-2: "#5A636C"
  primary: "#0F3D2E"
  primary-foreground: "#FFFFFF"
  brand: "#C8102E"
  brand-foreground: "#FFFFFF"
  background: "#E8EAED"
  foreground: "#14181C"
  card: "#FFFFFF"
  secondary: "#E2E5E9"
  muted: "#E2E5E9"
  muted-foreground: "#5A636C"
  accent: "#FCE8EC"
  accent-foreground: "#8A0B1F"
  destructive: "#C8102E"
  success: "#1A7A56"
  warning: "#B8740B"
  info: "#0F7BA8"
  border: "#C5CAD0"
  input: "#B8BEC5"
  ring: "#C8102E"
  gold: "#8B7E66"
  sidebar-glass: "#161A1E"
  sidebar-foreground: "#FAFAFA"
typography:
  display:
    fontFamily: "Oswald, Noto Sans JP, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Oswald, Noto Sans JP, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
  title:
    fontFamily: "Oswald, Noto Sans JP, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.02em"
  body:
    fontFamily: "Barlow, Noto Sans JP, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Barlow, Noto Sans JP, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.06em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  "2xl": 64px
rounded:
  sm: "0.25rem"
  md: "0.5rem"
  lg: "0.5rem"
  full: "0.5rem"
shadows:
  sm: "0 4px 14px rgba(20, 24, 28, 0.06)"
  md: "0 10px 28px rgba(20, 24, 28, 0.08)"
  lg: "0 16px 40px rgba(20, 24, 28, 0.12)"
components:
  button-primary: "Signal crimson fill, uppercase tracked label, 8px radius, 44px min height on public"
  button-secondary: "White enamel on asphalt border, uppercase"
  card: "White enamel plaque, canopy-green top rule, soft asphalt shadow"
  input: "White field, concrete border, crimson focus ring"
  navbar: "White bar, canopy-green bottom rule, BrandLogo lockup"
  sidebar: "Solid asphalt desk chrome (ERP), no frosted glass"
---

# Design System — Enamel Yard Board

## Personality

**Classic export lot, not SaaS glass.** The surface should feel like a dealership canopy and yard board: concrete underfoot, porcelain-enamel plaques for stock, canopy green for authority, signal crimson for “buy / inquire.” Trust comes from inventory photos and FOB clarity — never invented testimonials.

## Color

### Color Strategy
**Full palette** — asphalt ink, lot concrete, canopy green, and signal crimson each own real regions (footer/nav accents, page ground, header rule / filters, CTAs).

### Primary
- **Lot Asphalt** (`jct-navy` `#14181C`): Ink, footer, ERP sidebar. Legacy token name kept for cascade.

### Secondary
- **Canopy Green** (`jct-canopy` `#0F3D2E` / `primary`): Heritage dealership canopy — header rule, filter active chips, ERP primary.

### Tertiary
- **Signal Crimson** (`jct-vermilion` / `brand` `#C8102E`): Public CTAs, price labels, focus rings. Use sparingly on ERP.

### Neutral
- **Lot Concrete** (`jct-panel` / `background`): Page canvas.
- **Enamel White** (`card`): Stock cards and panels.
- **Brushed Brass** (`jct-gold`): Quiet metal accent only — never terracotta cream drama.

### Named Rules
**The Print Freeze Rule.** `OfficialTradeDocument` / invoice print roots stay conservative A4 letterhead — no yard tokens on print.

**The Operate Density Rule.** ERP keeps scanable tables and solid desk panels; expression lives in tokens and type, not frosted blur.

**The Inventory First Rule.** Photos and FOB price bars outrank decorative chrome.

## Typography

**Display Font:** Oswald (lot-banner condensed)
**Body Font:** Barlow
**JP:** Noto Sans JP
**Mono:** JetBrains Mono for stock codes

### Hierarchy
- Display Oswald for public titles and ERP stat values
- Body Barlow for UI density
- Uppercase tracked labels on public CTAs and filter captions

## Layout

Public: sticky enamel header, full-bleed lot hero, search plaque overlapping hero, inventory grids, asphalt footer.
ERP: collapsible asphalt sidebar, solid top bar, `#main-content` skip target, filter panels, list panels, fullscreen workforms.

**Spacing rhythm:** 8 / 16 / 24px. Public controls min-height 44px.

## Elevation & Depth

Solid enamel — soft offset shadows only. No Liquid Glass blur. ERP list/filter/stat cards are opaque white on concrete.

## Shapes

`--radius: 0.5rem` everywhere. No pill CTAs on public; squared enamel language.

## Components

### Buttons
- Primary: signal crimson, uppercase, enamel radius
- Secondary: white / asphalt border
- ERP primary: brand crimson; density `h-9` default

### Cards
- Stock cards: canopy top rule, enamel white, hover lift
- Price bar: crimson top rule on concrete inset

### Navigation
- Public: BrandLogo + underline-active nav
- ERP: neutral **ERP** wordmark only (no company logo in shell/login)

## Motion

1. Hero enter (staggered opacity/translate)
2. Hero ken burns on lot photo
3. Just-listed rail item slide-in; stock card hover lift

Honor `prefers-reduced-motion`.

## Do's and Don'ts

### Do
- Lead public heroes with **Japan Circular Trading** as the brand-scale signal
- Keep print letterhead frozen
- Prefer real vehicle photos over abstract gradients

### Don't
- Restore Liquid Glass / Outfit / navy-SaaS dual world
- Put company logos in ERP chrome
- Invent testimonials or fake stock
- Soft-polish the discarded navy/glass look
