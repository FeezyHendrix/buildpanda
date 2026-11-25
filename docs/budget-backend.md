# Budget tab (billing sheet) — notes for the backend and product

Frontend: `pages/project/finances/budget-sheet-tab.tsx` and `finances/contract/billing-sheet*.tsx`.
Finance → *Budget & Invoices* is the existing sidebar entry and page; this restyles its
**Budget** tab to the new design. Nothing on this tab moves money: every figure is a
recorded amount.

## Built from the design, with these differences

- **Claim state column.** The design shows "Completed" there, which is the phase's own
  status, not a claim state. The column shows the claim's position (Pending, Claimable,
  Claimed, Certified, Paid) when the phase has one, and falls back to the phase status
  (Not started, In progress, Completed) when it has none. The status badge that used to sit
  under the phase name is gone, so a phase with a claim no longer shows its status. If both
  should show, the design needs a place for the second.
- **Group subtotals are gone.** The design has the two group headers ("Original contract",
  "Change orders") and a single **Total**; the per-group Subtotal rows and the phase-count
  chip were dropped. Once change orders carry phases, the Total includes both.
- **Drag handle.** Rows can be dragged to reorder (stage order, `PUT /stages/reorder`);
  the new order is the whole build's, so it also changes the Stages page. A change order's
  phases only reorder among themselves in the sense that the sheet groups them by contract.
- **Month columns** are not in the design (it shows the sheet before any month exists).
  They still appear between Variance and To date as before, 150px each, and the sheet
  scrolls sideways with the first two columns pinned.
- **To date** shows the amount; the cumulative % shows above it only once months exist.
- **Row menu** (Edit value, Schedule) is the house dropdown with filled icons.
- **Summary copy.** "For the selected build stage" is the design's wording for the
  contract-value card; the figure is the sum of every phase's scheduled value in the
  current building scope.

## Client-side only today

- Search filters the phases already loaded; there is no server filter.
- Committed, Actual and Variance need `finances:viewCosts` and read
  `GET /finances/stage-costs`; without it the columns (and the request) are not rendered.
