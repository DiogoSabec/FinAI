# Mobile UX/UI Pass — Design

**Date:** 2026-05-07
**Scope:** Full mobile pass across all pages. Floor: 390px. Visual style: open to redesign.

## Goals

Make FinAI feel native on a phone (390px+). Replace desktop-first patterns (left sidebar, wide tables, hover-only affordances) with thumb-friendly mobile patterns (bottom tabs, stacked cards, bottom sheets). Preserve the gold-on-black aesthetic.

## Breakpoint tokens

Replace ad-hoc 1240 / 980 / 640 with named breakpoints used consistently:

- `--bp-md: 980px` — sidebar collapses, mobile chrome appears
- `--bp-sm: 768px` — bottom nav active, table → card view, modals → sheets
- `--bp-xs: 480px` — dense single-column mode

## 1. Navigation

**≥ 980px:** Existing fixed left sidebar, unchanged.

**≤ 980px:** Slim 56px sticky top bar (hamburger · page title · contextual action slot). Hamburger opens existing slide drawer.

**≤ 768px:** Add a fixed bottom tab bar with 4 tabs:
1. Dashboard
2. Expenses
3. Income
4. AI Advisor

The drawer remains accessible via the hamburger and contains every page (overflow + active highlighting still works). Bottom tab uses gold accent on active, with icon + 11px label.

**Behavior:**
- Drawer supports edge-swipe-to-open (right-swipe within 24px of left edge) and swipe-to-close on itself
- Drawer + bottom nav respect `env(safe-area-inset-*)`
- Body has `overscroll-behavior-y: none` and drawer has `overscroll-behavior: contain`

## 2. Tables → stacked cards

Affected pages: Expenses, Income, Subscriptions, Accounts.

A new `.list-card-view` markup is rendered alongside the existing `<table>`. CSS toggles visibility:
- ≥ 769px: table visible, cards hidden
- ≤ 768px: cards visible, table hidden

Card layout per row:
- Top: title (left, truncates) + amount (right, color-coded, tabular-nums)
- Meta: category badge · account · date (small, muted, ellipsis)
- Trailing `⋯` button → action sheet (Edit / Delete / Change category / Mark transfer / Toggle hidden)
- Tap card body → inline expand for notes/details (not modal)
- Select mode: leading checkbox + `is-selected` background; shift-tap range select preserved

This pass keeps each page's existing structure and just adds the card view + the action sheet locally. A future refactor can extract a shared `<TransactionList>` component.

## 3. Filter bar

On ≤ 768px:
- Search input is full-width, 44px, sticky under top bar
- Filters (category / month) become horizontally-scrolling pill chips with `scroll-snap-type: x mandatory`
- Total/count summary moves to a thin line under search

## 4. Modals → bottom sheets

On ≤ 640px, `.modal` becomes a sheet:
- Anchored to bottom (overlay uses `align-items: flex-end`)
- `border-radius: 28px 28px 0 0`, full-width, `max-height: 90dvh`
- Drag handle pill at top
- Slide-up enter animation
- Sticky footer with primary action stretched full width
- `.form-row` collapses cleanly to single column

## 5. Bulk action bar

On ≤ 768px, `.bulk-bar`:
- Repositioned to `bottom: calc(64px + env(safe-area-inset-bottom) + 12px)` to clear the bottom nav
- Spans `left: 12px; right: 12px`, no transform
- Stacks: count + hint on top row, action buttons in 2-col grid below

## 6. AI Advisor

On ≤ 768px:
- Chat region fills `100dvh - topbar - bottomnav`
- Bubbles `max-width: 92%`
- Quick-prompt chips horizontally scroll
- Input bar sticky inside chat region, with `padding-bottom: env(safe-area-inset-bottom)`
- Page padding removed in this view (chat is the page)

## 7. Dashboard

Stat cards: 2-up at 480–768px, 1-up below 480px (currently 1-up below 980px). Charts get `overflow-x: auto` with a sensible `min-width` so they remain legible.

## 8. Cross-cutting polish

- All tap targets ≥ 44×44 (audit `.btn-sm`, badge buttons, `⋯` menus)
- Inputs use `font-size: 16px` minimum on phones (suppresses iOS zoom-on-focus)
- `100vh` → `100dvh` for full-height layouts
- Hover styles wrapped in `@media (hover: hover)` so they don't stick on touch
- `viewport-fit=cover` in `index.html` meta + safe-area insets on all fixed chrome
- `tabular-nums` on all currency values

## Out of scope

- Server-side / API changes
- Refactoring duplicate table markup into shared component (separate task)
- New features beyond responsive behavior
- Animation overhaul (only what's needed for sheet / drawer / bottom nav)

## Files touched (expected)

- `client/index.html` — viewport meta
- `client/src/App.jsx` + `App.css` — top bar, bottom nav, breakpoint tokens, safe-area
- `client/src/components/Sidebar/*` — drawer polish, edge swipe
- `client/src/components/BottomNav/*` (NEW)
- `client/src/components/Expenses/Expenses.jsx` + Expenses.css (NEW) — card view, action sheet
- `client/src/components/Income/Income.jsx` + .css (NEW)
- `client/src/components/Subscriptions/Subscriptions.jsx` + .css
- `client/src/components/Accounts/Accounts.jsx` + .css (NEW if missing)
- `client/src/components/AIAdvisor/AIAdvisor.css` — full-height phone layout
- `client/src/components/Dashboard/Dashboard.css` — stat-card density tiers
