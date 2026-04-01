---
phase: 1
slug: ui-foundation
status: approved
shadcn_initialized: false
preset: not applicable
created: 2026-04-01
requirements: [UI-FOUNDATION-01]
---

# Phase 1 - UI Design Contract

> Visual and interaction contract for the current ProNeighbor web UI baseline.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | custom CSS primitives |
| Icon library | inline SVG + emoji (existing baseline) |
| Font | DM Sans (body), Playfair Display (headings) |

---

## Visual Hierarchy

1. Primary focal point: page-level primary CTA (`.btn-primary`) on each surface.
2. Secondary focal point: page title and section headers (`.page-title`, `.card-title`).
3. Tertiary focal point: supporting metadata and status labels (`.page-subtitle`, badges).

Rule: each screen should expose one dominant CTA in first viewport; no more than one high-contrast gradient button per card region.

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline chips |
| sm | 8px | Compact control spacing |
| md | 16px | Default content spacing |
| lg | 24px | Section padding |
| xl | 32px | Layout gutters |
| 2xl | 48px | Hero and section breaks |
| 3xl | 64px | Large page-level separation |

Exceptions: none

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.6 |
| Label | 14px | 600 | 1.4 |
| Heading | 26px | 800 | 1.2 |

**Label Typography Note:** Minimum 14px ensures sufficient contrast and supports browser zoom/accessibility scaling (200% zoom minimum). All labels must meet WCAG AA contrast ratio (4.5:1 for text).
| Display | 42px | 700 | 1.1 |

Constraints:
- Max font sizes in one view: 4 tokens.
- Max active weights in one view: 2 (body + emphasis).

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #FAF8F3 | App background and large surfaces |
| Secondary (30%) | #FFFFFF | Cards, panels, elevated containers |
| Accent (10%) | #0D6B6B | Primary CTA, active nav, focus ring |
| Destructive | #ff5c5c | Error text, destructive actions only |

Accent reserved for:
- Primary buttons (`.btn-primary`)
- Active navigation state (`.mobile-tab-item.active`, selected nav)
- Form focus state (`.form-input:focus`)
- Positive emphasis chips tied to selection state

Accent is not used for all interactive elements.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | Register as Expert |
| Empty state heading | No professionals found |
| Empty state body | Try adjusting your search or filters, then clear category filters if needed. |
| Error state | Sign-in failed. Check your credentials and try again. |
| Destructive confirmation | Cancel booking: This will cancel the session and refund escrow if eligible. Continue? |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not required |
| third-party registries | none | not applicable |

No third-party shadcn registry blocks are used in this phase.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-04-01