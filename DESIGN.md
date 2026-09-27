# BuildPanda — Design System

This document **records what already exists**. It is not a proposal and it does not
introduce a new look: every value below was read out of the source, and the source
stays the single point of truth.

| Concern | Lives in |
|---|---|
| Every colour, radius, shadow, font and animation token | `packages/frontend/src/styles/index.css` (Tailwind v4 `@theme`) |
| Font loading | `packages/frontend/index.html` |
| Atoms | `packages/frontend/src/components/atoms/` |
| Take-off sheet viewer | `packages/frontend/src/components/molecules/precon-sheet-viewer/` |

Tailwind v4 is configured in CSS, so **there is no `tailwind.config.ts`**. A token
declared as `--color-primary-500` is used as `bg-primary-500` / `text-primary-500`.
Add tokens to the `@theme` block; never re-declare a palette in a component.

---

## Typography

One family, one stack:

```css
--font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
```

Loaded from Google Fonts in `index.html` as a variable font, weights **200–800**,
upright and italic, with `display=swap` and `preconnect` to both font hosts.

Practical scale as used across the app: body copy `text-sm` (`text-base` below `lg`
on inputs, so iOS does not zoom), table cells `text-[13px]`, table headers
`text-[11px] font-semibold capitalize`, tool-palette labels `text-[10px]`, badges
`text-[11px]`/`text-xs`. Buttons and headings are `font-semibold`; nothing in the
product uses `font-bold`.

---

## Palette

### Primary — the brand blue

`#004DE7` is BuildPanda. It is the only accent that means "this is the action".

| Token | Hex | Token | Hex |
|---|---|---|---|
| `primary-50` | `#E6EDFD` | `primary-500` | **`#004DE7`** |
| `primary-100` | `#B0C8F8` | `primary-600` | `#0046D2` |
| `primary-200` | `#8BACF1` | `primary-700` | `#0037A4` |
| `primary-300` | `#5488EF` | `primary-800` | `#002A7F` |
| `primary-400` | `#3371EE` | `primary-900` | `#002061` |

`--color-brand: #004DE7` is the same value under a semantic name.

### Semantic roles — reach for these before a numbered step

| Token | Hex | Meaning |
|---|---|---|
| `ink` | `#131B2E` | Default text |
| `ink-subtle` | `#414141` | Secondary text |
| `ink-muted` | `#606060` | Captions, metadata |
| `ink-disabled` | `#B5B5B5` | Disabled text |
| `ink-inverted` | `#FFFFFF` | Text on a dark or brand fill |
| `ink-hover` | `#004DE7` | Text that becomes a link on hover |
| `line` | `#EDEDED` | Standard border |
| `line-hair` | `#F0F0F0` | Table row divider |
| `line-hover` | `#C8C8C8` | Border on hover |
| `line-dark` | `#111111` | Border on a dark surface |
| `surface` | `#FFFFFF` | Card / panel |
| `surface-alt` | `#F6F6F6` | Input fill, table head, inset panel |
| `surface-track` | `#F6F6F6` | Slider / progress track |
| `surface-info` | `#E6EDFD` | Informational banner |
| `surface-brand` | `#EDE7FF` | Brand-tinted panel |
| `sidebar-flyout` | `#111111` | Sidebar fly-out |

### Greys

`grey-50 #EDEDED`, `grey-100 #C8C8C8`, `grey-200 #ADADAD`, `grey-300 #888888`,
`grey-400 #717171`, `grey-500 #4D4D4D`, `grey-600 #464646`, `grey-700 #373737`,
`grey-800 #2A2A2A`, `grey-900 #202020`.

`black-50 #E7E7E7`, `black-100 #B5B5B5`, `black-200 #929292`, `black-300 #606060`,
`black-400 #414141`, `black-500 #111111`, `black-600 #0F0F0F`, `black-700 #0C0C0C`,
`black-800 #090909`, `black-900 #070707`.

### Status

Each status has a full 50–900 scale; these are the steps actually used.

| Status | Tint | Base | Deep | Aliases |
|---|---|---|---|---|
| Success | `success-50 #E8F7EE` | `success-500 #1B8E45` | `success-700 #10592C` | — |
| Error | `error-50 #FDECEC` | `error-500 #C72525` | `error-700 #8A1919` | `negative-*` |
| Warning | `warning-50 #FFF3E0` | `warning-500 #C26A00` | `warning-700 #824600` | `pending-*` |
| Info | `primary-50 #E6EDFD` | `primary-500 #004DE7` | `primary-700 #0037A4` | `other-*` |
| Neutral | `neutral-50 #F6F6F6` | `neutral-500 #606060` | `neutral-600 #414141` | — |

Accent (used for the AI / Panda surfaces): `accent-50 #EDE7FF`,
`accent-500 #5A3DD0`, `accent-600 #4A30B0`. Data-viz extras: `mint-500 #1AE592`,
`lime-500 #C8FF00`.

---

## Radius, shadow, spacing

```css
--radius: 0.625rem;                     /* 10px */
--radius-sm: calc(var(--radius) - 4px); /*  4px */
--radius-md: calc(var(--radius) - 2px); /*  8px */
--radius-lg: var(--radius);             /* 10px */
--radius-xl: calc(var(--radius) + 4px); /* 14px */

--shadow-card:   0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-drawer: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
--shadow-focus:  0 0 0 2px rgb(17 24 39 / 0.1);
```

Controls are `rounded-lg`, cards are `rounded-2xl`, chips and badges are
`rounded-full`. Focus is **always** a ring, never an outline, and always the same
ring: `focus-visible:ring-2 focus-visible:ring-gray-900/10`.

> **Known defect — the ring above does not render outside the take-off editor.**
> `styles/index.css` declares `:focus-visible { outline: none !important; box-shadow:
> none !important }` (and the same for `:focus`), which deletes the ring on every
> control in the product — verified in Chromium on the `Button` and `Input` atoms
> (`:focus-visible` matches, computed `box-shadow`/`outline` are `none`). This is a
> WCAG 2.4.7 failure.
>
> The take-off editor now opts back in: a `[data-takeoff-focus] :focus-visible` rule
> placed **after** those resets restores a `primary-500` 2px outline, scoped to the
> sheet viewer (it is keyboard-driven, one shortcut per tool). Verified painting:
> `outline: solid 2px rgb(0, 77, 231)` on a real `Tab` traversal.
>
> Every other screen is still unfixed. Deleting the two resets is the correct
> product-wide fix and would make the documented ring work everywhere; because it
> unhides focus on every screen at once it needs its own visual QA pass, and the
> scoped take-off block should be deleted at the same time.

Spacing uses the
default Tailwind 4px step; control heights are fixed (`h-8`, `h-10`, `h-11`,
`h-12`, `h-14`) so rows align without ad-hoc padding.

---

## Atoms

38 atoms in `packages/frontend/src/components/atoms/`. Every one is a
`forwardRef`ed function component with a `displayName`, composes classes through
`cn()` from `@/lib/utils`, and accepts `className` last so a caller can override.
New visual work composes these; it does not restyle them.

### Button — `button.tsx`

```ts
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";
```

| Variant | Classes |
|---|---|
| `primary` | `bg-[#004DE7] text-white hover:bg-[#0041c4] active:bg-[#003aad]` |
| `secondary` | `bg-[#F6F6F6] text-gray-900 hover:bg-gray-200 active:bg-gray-300` |
| `ghost` | `bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200` |
| `danger` | `bg-transparent text-red-600 hover:bg-red-50 active:bg-red-100` |

Sizes: `sm h-8 px-3 text-xs`, `md h-10 px-4 text-sm`, `lg h-12 px-5 text-sm`.
Base: `relative inline-flex items-center justify-center gap-2.5 rounded-lg font-semibold`
plus the standard focus ring and `disabled:cursor-not-allowed disabled:opacity-50`.

Two behaviours matter more than the styling: `type` defaults to `"button"`, so a
chip or row action inside a form cannot submit it by accident (forms pass
`type="submit"` explicitly); and `loading` swaps the label for a centred `Spinner`
while keeping the button's width, sets `aria-busy` and disables it.

### Spinner — `spinner.tsx`

```ts
type SpinnerSize = "xs" | "sm" | "md" | "lg";   // size-4 | size-6 | size-7 | size-8, all border-2
type SpinnerTone = "brand" | "current";
```

`brand` is `border-gray-200 border-t-[#004DE7]`; `current` is
`border-current/30 border-t-current`, for a spinner inside a coloured fill.

### Badge — `badge.tsx`

```ts
type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";
type BadgeVariant = "soft" | "solid" | "outline";
type BadgeSize = "sm" | "md";
```

`soft` (the default) is a `*-50` fill with `*-500` text; `solid` is a `*-500` fill
with white text; `outline` is a `*-500/40` border with `*-500` text. Sizes:
`sm h-5 gap-1 rounded-full px-2 text-[11px]`, `md h-6 gap-1.5 rounded-full px-2.5 text-xs`.

### Card — `card.tsx`

`rounded-2xl bg-white`, optionally `border border-[#EDEDED]` (`bordered`) and
`cursor-pointer transition-shadow hover:shadow-sm` + focus ring (`interactive`).
Padding: `none p-0`, `sm p-4`, `md p-5`, `lg p-6`.

### Input — `input.tsx`

Filled, borderless, ring on focus:

```
INPUT_BASE_CLASS  w-full rounded-lg bg-[#F6F6F6] font-sans text-base lg:text-sm text-gray-900
                  border-0 outline-none ring-0 placeholder:text-gray-400
                  focus-visible:ring-2 focus-visible:ring-gray-900/10
                  aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-300
                  disabled:cursor-not-allowed disabled:opacity-50
INPUT_CLASS       + h-14 px-4          (inputSize "md")
INPUT_SM_CLASS    + h-11 px-3          (inputSize "sm")
```

The two class constants are exported so a bare `<input>` inside a dense toolbar can
match without wrapping the whole component — this is how the sheet viewer's banners
do it.

### Table — `table.tsx`

Head `border-b border-[#EDEDED] bg-[#F6F6F6]`; header cell
`px-6 py-3 text-[11px] font-semibold capitalize text-black-300`; body cell
`px-6 py-3 text-[13px] text-[#131B2E]`; row `border-b border-[#F0F0F0] last:border-b-0`.

```ts
type CellAlign = "left" | "right" | "center";
type TableRowTone = "default" | "danger" | "muted" | "total";
```

`danger` `bg-error-50 text-error-700`, `muted` `text-black-200`,
`total` `bg-[#FAFAFA] font-semibold`. Money is always `align="right"`.

### Atoms the take-off viewer uses today

`Button`, `Spinner`, `ComboInput`, `UnitInput` and the `INPUT_SM_CLASS` constant.
It deliberately does **not** use `Card` or `Table`: the sheet is a canvas, and
panels floating over it are plain bordered divs so they stay dense.

---

## Motion

Two rules, both already enforced:

1. **GPU-only.** Every keyframe in `index.css` animates `opacity` and `transform`
   and nothing else — no `width`, `height`, `top` or `left`. Keep it that way:
   layout-affecting animation janks a zoomed drawing badly.
2. **Reduced motion is honoured globally**, so individual components do not have to
   remember:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

Tokens: `--animate-pop: pop 150ms ease-out forwards`,
`--animate-fade-in: fade-in 200ms ease-out forwards`,
`--animate-slide-up: slide-up 200ms ease-out forwards`. Named keyframes:
`pop`, `fade-in`, `slide-up`, `emoji-pop`, `search-slide-in` / `search-slide-out`,
`fab-backdrop-in` / `fab-backdrop-out`, `fab-sheet-in` / `fab-sheet-out`.

Durations sit between **150ms and 200ms** with `ease-out`. Anything slower reads as
lag in a tool people use all day.

---

## Take-off editor

The sheet viewer is `packages/frontend/src/components/molecules/precon-sheet-viewer.tsx`
plus ~35 files in the sibling folder: a tool palette on the left
(`tool-palette.tsx`, five groups from `PRECON_TOOL_GROUPS`, active tool
`bg-primary-50 font-semibold text-primary-700`), layers over the canvas
(`sheet-layers.tsx`,
`ink-layer.tsx`, `pins/pin-layer.tsx`, `viewport-layer.tsx`,
`symbol-matches-layer.tsx`, `overlay-layer.tsx`), and a status bar underneath.

### The tool palette is height-constrained — design for that

There are 18 tools and the rail is a fixed-height scroller inside the viewer pane,
so it can never show them all: at 1280×900 it fits 12, and the page itself does not
scroll. Overlay scrollbars measure 0px and paint nothing at rest, so the rail must
never rely on one to say "there is more". Three rules follow, and anything added to
the palette has to keep them true:

1. **`w-20` rail at `lg` and up only.** It is wrapped in a flex column that pins
   `RailScrollButton` chevrons (shown only when that direction can scroll) and an
   always-visible `All tools` footer. Labels wrap; none is ever clipped.
2. **Below `lg` the rail is replaced**, not squeezed — a `w-14` strip with Select,
   the active tool, and the `All tools` trigger. The canvas keeps the width.
3. **`tool-picker.tsx` is the guarantee.** A `role="dialog"` list of all 18, grouped,
   each row carrying label · unit, the shortcut, the hint, and — when blocked — the
   reason. Escape closes it and focus returns to the trigger.

A blocked tool takes `aria-disabled`, never the `disabled` attribute: it stays
focusable and clickable so that choosing it *states its reason* in the status bar
instead of silently doing nothing. The mode change is refused in the handler, so an
illegal tool still cannot be entered. `blockedReasonFor` decides; the status bar
names the tool and the reason, and offers `Set scale` whenever the sheet has none.

### Editor state model

`editor-state.ts` holds the editor's **mode** as two orthogonal discriminated
unions and nothing else:

- **`EditorGesture`** — what the pointer is doing: `idle`, `drawing`, `selecting`
  (rubber band), `moving`, `editing-vertex`, `panning`, `save-failed`.
- **`EditorSelection`** — what the inspector is looking at: `none`, `shapes`,
  `vertex`, `segment`.
- **`historyHead`** — index into the local draft history, advanced only by
  `BUMP_HISTORY` once a write has actually landed.

`editorReducer` is pure — no React, no imports, no network — so the rules are
testable under the plain node runner (`editor-state.test.ts`, wired into the
backend's `test:takeoff-editor`). The vertices themselves stay in `use-draft.ts`;
the saved geometry stays in the React Query cache. The load-bearing rules:

- Exactly one gesture is live; starting another implicitly cancels it.
- `CANCEL` always lands on `idle` and **never** touches the selection.
- `FINISH_DRAWING` only fires with two or more vertices.
- A failed save never costs the user in-flight work: `SAVE_FAILED` yields to a live
  gesture and only raises the `save-failed` banner from `idle`.
- Every no-op returns the same object, so `useReducer` skips the re-render.

`segment-model.ts` is the matching **logical segment model**: a segment is the span
between two consecutive vertices, *derived* from the vertex list rather than stored,
so it cannot drift from the geometry the backend holds. A closed shape gains the
wrap-around span only once it is a real polygon. This is what a `segment` selection
indexes, and what "split this line here" inserts into.

### Primitives later tasks need

These do not exist yet. When they are built they must come out of the tokens above —
no new palette, no new radius, no new font.

| Primitive | What it is | Intended tokens |
|---|---|---|
| **Vertex handle** | The grab target on each point of a selected shape. Needs a hit area larger than its visual size (touch and a trackpad at 400% zoom), and a distinct look when it is the one being dragged (`editing-vertex`). | `surface` fill, `primary-500` border; `primary-500` fill while dragging. Size in **screen** pixels, so it does not scale with the sheet. |
| **Selection ring** | The outline that marks a selected shape or the box a rubber band is drawing. Must stay legible over both white paper and dark hatching. | `primary-500` stroke with a `surface` halo; rubber band `primary-500/10` fill, `primary-500` dashed stroke. Stroke width in screen pixels. |
| **Snap indicator** | Transient marker showing what the cursor has snapped to — line end, midpoint, intersection, existing vertex — with the kind of snap readable at a glance. | `accent-500` so it never reads as "selected"; `--animate-pop` on appearance, which reduced motion already collapses. |
| **Inspector panel** | The right-hand panel for the current `EditorSelection`: a shape's measurement and bill line, a vertex's coordinates, a segment's length and deductions. Must render an empty state for `selection.kind === "none"`. | `surface` on `border-line`, `shadow-card`, dense rows on `line-hair`, labels `text-[11px] text-black-300`, values `text-[13px] text-ink`. Not a `Card`: square-ish, flush to the edge. |
| **Save-failed banner** | The `save-failed` recovery bar: the error, a retry for the held `pendingOp`, and a discard. | `error-50` on `border-error-100`, `error-700` text, `Button size="sm"`, matching the existing banners in `sheet-banners.tsx`. |

### Rules for anything added to the viewer

1. **Screen-space, not sheet-space, for chrome.** Handles, rings, snap markers and
   labels keep a constant on-screen size; only the drawing scales with zoom.
2. **No colour-only state.** Selected, hovered, snapped and erroring must each
   differ in shape or weight too, not just hue.
3. **Never block navigation.** Pan and zoom win over a half-drawn shape — that is
   why `START_PAN` cancels the drawing gesture.
4. **400-line ceiling per file** (`CLAUDE.md`). The viewer folder is already split
   by layer and by hook; keep extracting rather than appending.

## Take-off workbook

`packages/frontend/src/components/molecules/precon-workbook/`. A real spreadsheet
(Univer OSS 1.0.0) bound to the same measured bill the viewer draws. The engine is
loaded through a dynamic import and lives in its own chunk — nothing under
`precon-workbook/` may be imported eagerly from a route.

**The vendor is themed, not restyled.** `univer-theme.ts` overrides exactly two
things: the `primary` ramp (the table in "Primary" above, verbatim) and the font
(`--font-sans`). Univer's greys and status colours are left alone, because
replacing them wholesale is how a vendor component loses contrast on its own
disabled states. The ribbon is dropped (`toolbar: false`); the **formula bar,
worksheet tabs and statistic bar stay**, because those are the spreadsheet rather
than decoration around it. There is no Office ribbon clone.

### What a cell's appearance means

Three styles are injected into the document under fixed ids, so re-opening a
workbook reuses them rather than adding three more each time. A cell the user has
styled themselves is never overwritten.

| Style | Cell | Tokens |
|---|---|---|
| `bp-heading` | Generated column headings | `surface-alt` fill, `ink-subtle`, semibold, 11px |
| `bp-generated` | A measured figure — quantity, unit, amount, code | `#FAFAFA` fill, `ink`. Reads as the server's. |
| `bp-generated-editable` | Rate and description on a live line | `surface` fill, `ink`. Reads as yours, because it is. |

The distinction is load-bearing and is **not colour-only**: a locked cell also
refuses the keystroke and says why, so the state is reachable without seeing the
fill at all.

### Workbook primitives

| Primitive | What it is | Tokens |
|---|---|---|
| **Mode control** | Compact `Workbook · Drawings · Split` segmented control. Split is offered only when both panes fit (workbook 440px + drawing 480px); below that the requested mode is remembered and one pane is shown. | Segmented row on `surface-alt` in `rounded-lg`; active segment `surface` on `shadow-card` with `text-ink`, inactive `text-ink-muted`. `h-8`, `text-xs font-semibold`. |
| **Save status** | The one place that says saved / unsaved / saving / refused. Never says "Saved" while a save is in flight. | `text-[11px]`; saved `text-ink-muted`, unsaved `text-warning-700`, failed `text-error-600`. Dot + word, never a dot alone. |
| **Refusal list** | What the grid would not let through, each naming the worksheet, the cell and the reason. Replaces a silent strip. | `error-50` on `border-error-100`, `error-700`, rows on `line-hair`, `text-xs`. |
| **Conflict compare** | Side-by-side "yours / theirs" for a 409, with explicit Discard mine and Keep mine. Never auto-resolves. | `warning-50` on `border-warning-100`; the two columns on `surface` in `rounded-md`, labels `text-[11px] text-black-300`. |
| **Cell inspector** | The focused cell's address, value and formula, with a real editor. On a phone this IS the way to edit — it sits above the keyboard and the grid stays scrollable behind it. | `surface` on `border-line`, `shadow-drawer` when docked to the bottom; address `text-[11px] text-black-300`, editor `INPUT_SM_CLASS` in `font-mono`. |
| **Source action** | Per bound line: Remeasure (`measured`), Confirm basis (`legacy`), Draw measurement (`stated`), nothing (`narrative`). Always names the line it acts on. | `Button size="sm" variant="secondary"`; the basis as a `Badge` — `success` measured, `warning` legacy, `neutral` stated. |
| **Worksheet overflow picker** | `role="dialog"` list of every worksheet when the native tab strip runs out of room. Mirrors the viewer's `tool-picker.tsx`: Escape closes, focus returns to the trigger. | `surface`, `border-line`, `shadow-drawer`, rows `text-[13px]`, generated worksheets carry a `Badge size="sm"`. |

### Rules for anything added to the workbook

1. **A draft is never thrown away by something the user did not do.** Not by a
   realtime frame, not by a view toggle, not by a failed save, not by a refetch.
   That is why the workbook query is `staleTime: Infinity` and why
   `workbookKeys` is deliberately not nested under the snapshot key.
2. **Never show a figure the server has not calculated.** Generated formula cells
   ship with no cached value; the grid computes them. "Saved" is never displayed
   while a calculation is pending.
3. **Refuse loudly, never strip.** An edit the server would reject is refused at
   the keystroke with the reason, or listed in the refusal panel. A half-applied
   paste is the one outcome that is always wrong.
4. **Show `label`, never `name`.** A worksheet's `name` is what cross-sheet
   formulas spell and is pinned; `label` is the bill's current title.
5. **400-line ceiling per file**, as everywhere else.
