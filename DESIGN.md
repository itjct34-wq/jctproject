---
name: Japan Circular Trading (JCT)
description: Dual-surface export catalog and Liquid Glass ERP — navy/vermilion marketing, charcoal/brand-red ops
colors:
  jct-navy: "#0B1F33"
  jct-vermilion: "#D8392B"
  jct-gold: "#C4A35A"
  jct-panel: "#F3F5F7"
  jct-surface: "#EEF1F5"
  jct-border: "#DDE3E9"
  jct-muted: "#3B4C5D"
  jct-muted-2: "#4A5B6C"
  primary: "#0E2944"
  primary-foreground: "#FFFFFF"
  brand: "#DD3C2A"
  brand-foreground: "#FFFFFF"
  background: "#F2F6FA"
  foreground: "#0B1F33"
  card: "#FFFFFF"
  secondary: "#E8EEF4"
  muted: "#E9EEF3"
  muted-foreground: "#4F5F6C"
  accent: "#FEF1EF"
  accent-foreground: "#9B2B1F"
  destructive: "#C83222"
  success: "#1A7A56"
  warning: "#B8740B"
  info: "#0F7BA8"
  border: "#D4DCE6"
  input: "#CDD6E0"
  ring: "#DD3C2A"
  gold: "#C4A35A"
  sidebar-glass: "#0A1624"
  sidebar-foreground: "#FAFAFA"
typography:
  display:
    fontFamily: "Outfit, Noto Sans JP, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Outfit, Noto Sans JP, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Outfit, Noto Sans JP, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.011em"
  body:
    fontFamily: "Outfit, Noto Sans JP, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "-0.011em"
  label:
    fontFamily: "Outfit, Noto Sans JP, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.06em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
rounded:
  sm: "calc(1.125rem - 4px)"
  md: "calc(1.125rem - 2px)"
  lg: "1.125rem"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  control: "36px"
  touch: "44px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-foreground}"
    rounded: "12px"
    padding: "6px 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "#C73626"
    textColor: "{colors.brand-foreground}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.primary}"
    rounded: "12px"
    height: "36px"
  button-outline:
    backgroundColor: "rgba(255,255,255,0.6)"
    textColor: "{colors.foreground}"
    rounded: "12px"
    height: "36px"
  button-public-primary:
    backgroundColor: "{colors.jct-vermilion}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-public-secondary:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.jct-navy}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  chip-erp:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    typography: "{typography.label}"
  chip-status-brand:
    backgroundColor: "rgba(221,60,42,0.05)"
    textColor: "{colors.brand}"
    rounded: "6px"
    padding: "2px 6px"
  card-glass:
    backgroundColor: "rgba(255,255,255,0.72)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "12px"
  card-stat:
    backgroundColor: "rgba(255,255,255,0.9)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "12px"
  input-default:
    backgroundColor: "rgba(242,246,250,0.7)"
    textColor: "{colors.foreground}"
    rounded: "calc(1.125rem - 6px)"
    height: "36px"
    padding: "0 12px"
  nav-sidebar-active:
    backgroundColor: "rgba(221,60,42,0.12)"
    textColor: "{colors.sidebar-foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

# Design System: Japan Circular Trading (JCT)

## Overview

**Creative North Star: "The Twin Harbor"**

JCT is one product with two doors onto the same commercial truth. The public harbor is an export showroom — deep navy, vermilion CTAs, cream panels, and real yard photography that earn buyer trust without marketing theater. The operations deck is Liquid Glass ERP — charcoal primary chrome, refined brand-red accents, frosted panels over a soft atmospheric shell — built for dense, role-shaped daily work.

Personality is factual trade English on the public side and operable density on the ERP side. Expression belongs on the marketing shell; the ERP wordmark stays neutral **ERP** with no company logos in chrome. Light-only theming is intentional. Print letterhead stays conservative A4 navy/red tables and is never casually restyled.

**Key Characteristics:**
- Dual visual worlds that must not be collapsed without an explicit rebrand
- Liquid Glass ERP: frosted panels, shell glow, charcoal sidebar, brand-red signals
- Public marketing: navy/vermilion/gold, pill CTAs, catalog grids, stock photography
- Side-tab / left-edge accents are intentional status and hierarchy cues
- Coarse-pointer targets trend toward 44px; forms prefer visible labels
- `prefers-reduced-motion` respected on ERP chrome and workforms

## Colors

A shared trade palette (navy, vermilion, gold, cool paper) splits into public hex tokens and ERP HSL semantic roles — same family, different density.

### Primary
- **Harbor Charcoal** (`primary` / ERP `--primary`): Near-navy charcoal for ERP primary actions that are not brand-red, sidebar depth, and strong chrome. Paired with white foreground.
- **Export Navy** (`jct-navy` `#0B1F33`): Public headlines, nav wordmarks, secondary CTAs, and letterhead authority. Anchors marketing and print.

### Secondary
- **Trade Gold** (`jct-gold` / `gold` `#C4A35A`): Warm accent in shell glow and selected ERP stat accents; never the primary CTA.

### Tertiary
- **Vermilion Signal** (`jct-vermilion` `#D8392B` / ERP `brand`): Public primary CTAs and ERP brand actions, focus rings, sidebar active tint, page-title underlines, and left-edge accents. Rarity on ERP screens preserves scanability.

### Neutral
- **Cool Paper** (`background` / `jct-panel`): Soft blue-gray canvas for ERP shell and public panels.
- **Ink** (`foreground` / `jct-muted`): Body text and secondary copy.
- **Glass Border** (`border` / `jct-border`): Hairline structure on cards, filters, and tables.
- **Sidebar Night** (`sidebar-glass`): Near-opaque charcoal glass for ERP nav.

### Named Rules
**The Twin Door Rule.** Public navy/vermilion marketing and ERP Liquid Glass must stay distinct; do not restyle ERP chrome with public pill logos or collapse public pages into glass panels.

**The Accent Edge Rule.** Thick left borders, sidebar active bars, and stock-list row accents are intentional hierarchy — not decorative slop. Preserve them.

**The Print Freeze Rule.** `OfficialTradeDocument` / `invoice-print-root` keep conservative A4 navy/red tables; do not apply glass, brand gradients, or marketing radius.

## Typography

**Display Font:** Outfit (with Noto Sans JP, system-ui)
**Body Font:** Outfit (with Noto Sans JP)
**Label/Mono Font:** JetBrains Mono for stock codes and technical IDs

**Character:** Geometric sans with tight tracking for Latin; JP stack clears Japanese without forcing letter-spacing. Same family across surfaces; public display weights are bolder and more tracked for wordmarks.

### Hierarchy
- **Display** (700, clamp ~1.75–2.25rem, tight tracking): Public catalog titles and hero wordmarks (`.font-display`).
- **Headline** (600, ~1.5rem): Section titles on public and ERP page headers.
- **Title** (600, ~1.125rem): Card and panel titles.
- **Body** (400, 0.875rem, −0.011em): Default ERP and public body; denser than marketing sites.
- **Label** (600, 0.75rem, wide tracking / uppercase where chips and filter labels need scan): ERP chips, stat labels, filter field captions.
- **Mono** (600, 0.75rem): Chassis / stock identifiers.

### Named Rules
**The ERP Density Rule.** Prefer `text-sm` / `text-xs` in operate surfaces; reserve display sizes for public marketing and rare ERP page titles.

## Layout

ERP uses a collapsible sidebar + top bar + `#main-content` skip target; mobile opens a drawer (closes on route change and Escape) and may use a bottom tab bar. List pages follow master-detail: Card / list panel + Sheet or side panel. Filters use `.erp-filter-panel` / `.erp-filter-bar`; stats use `.erp-stat-card`. Large create/edit flows use fullscreen `DialogContent`.

Public site uses responsive catalog grids, sticky filter sidebars on desktop, and mobile filter drawers. Stock cards and home vehicle rails are established patterns — do not casually revert unrelated card styling.

**Spacing rhythm:** 8/12/16px on ERP chrome; filter controls default ~36px height, coarse pointer bumps toward 44px. Public primary controls target `min-height: 2.75rem` (44px).

## Elevation & Depth

Hybrid: ERP conveys depth primarily through frosted glass (modest backdrop blur + translucent white fills) over `--shell-glow`, plus soft glass shadows. Default `--glass-blur` is `12px` (sidebar `+4px`); list panels stay opaque without blur for scroll paint cost. Public surfaces stay flatter — white cards with light navy-tinted shadows (`0 4px 18px rgba(11,31,51,0.06)`).

### Shadow Vocabulary
- **Glass ambient** (`--glass-shadow` / `shadow-glass`): Stronger panels and sidebar (`0 14px 48px …` + inset highlight).
- **Glass soft** (`--glass-shadow-sm` / `shadow-glass-sm`): Filter bars, list panels, stat cards.
- **Public card** (`0 4px 18px rgba(11,31,51,0.06)`): Catalog cards and sticky filter panels.

### Named Rules
**The Scoped Glass Rule.** Glass utilities and `--shell-glow` apply only under `.erp-shell`. Public and print stay outside Liquid Glass.

## Shapes

Base radius token is generous (`--radius: 1.125rem`). ERP panels use `calc(var(--radius) - 2px)`; filter inputs slightly tighter (`−6px`). Buttons are `rounded-xl` (~12px). Public CTAs and chips are full pills (`9999px`). Status chips mix pills and small rounded-md for document-type badges.

## Components

### Buttons
- **Shape:** ERP `rounded-xl` (~12px); public primary/secondary full pill.
- **Primary (ERP):** Brand red fill, white text, `h-9` default; hover `brand/90`; focus ring uses brand/ring.
- **Primary (Public):** Vermilion pill, 44px min height, darker border companion.
- **Secondary / Outline / Ghost:** Secondary fill, glassy outline (`bg-card/60`), or ghost accent hover — ERP density, not marketing drama.
- **Press:** Slight `active:scale-[0.98]`; honor reduced motion.

### Chips
- **ERP:** Uppercase tracking chips (`.erp-chip*`) with pastel semantic borders (success/warning/danger/info/brand).
- **Public:** White pills with navy border; vermilion border on hover.

### Cards / Containers
- **Glass panels:** `.glass-panel` / `.glass-panel-strong` and ERP `.erp-list-panel`, `.erp-filter-panel`, `.erp-stat-card` — translucent fill, muted glass border, blur.
- **Stat cards:** Brand (or semantic) **3px left accent** — intentional.
- **Public stock cards:** White / panel surfaces with soft shadow; hover lifts border toward navy.

### Inputs / Fields
- **Style:** Border `input`, soft background, radius slightly below panel radius; filter search with leading icon inset.
- **Focus:** Brand/ring focus-visible rings (ERP); vermilion ring on public catalog filters.
- **Labels:** Visible Radix Label with required mark; avoid placeholder-only ERP fields.

### Navigation
- **ERP sidebar:** Dark glass, brand-tint + left bar on active item, muted inactive labels.
- **Public header:** Navy wordmark tracking, vermilion underline active, mobile full-screen drawer.
- **Mobile ERP:** Drawer + optional tab bar with brand dot on active.

### Signature: Stock list row
Soft row tint plus **thick left accent** (`vehicleListRowClass`) and text payment-status pills (not color alone). Commission due may add fuchsia inset ring; paid uses green label. Preserve accent semantics when adapting for touch.

## Do's and Don'ts

### Do:
- **Do** keep public marketing expression and ERP operate density as separate worlds under The Twin Door Rule.
- **Do** use brand/vermilion sparingly on ERP for primary actions, focus, and intentional left-edge accents.
- **Do** prefer visible labels, ~44×44px fullscreen close / coarse controls, and reduced-motion-safe chrome.
- **Do** scope Liquid Glass to `.erp-shell` and leave print letterhead untouched.

### Don't:
- **Don't** put company logos in ERP shell or login — neutral **ERP** wordmark only.
- **Don't** remove side-tab / left-border accents as “slop”; they are documented hierarchy.
- **Don't** invent dark-mode or restyle OfficialTradeDocument / invoice print roots for glass aesthetics.
- **Don't** invent testimonials, pricing theater, or unverified stock imagery on public surfaces.
