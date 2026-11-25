# Budget & invoices — Invoices tab — notes for the backend and product

Frontend: `pages/project/finances/budget-invoices-page.tsx`, `invoices-tab.tsx`,
`invoices/` (table, KPIs, toolbar, sheet, timeline) and the composer in
`pages/project/invoices/` (`invoice-composer.tsx`, `composer-form.tsx`).

**The menu already exists.** Finance → *Budget & Invoices* is the sidebar entry and the
page already existed; this redesigns its **Invoices** tab, the invoice sheet and the
**New invoice** sheet. The **Budget** and **Payments** tabs have no new design and keep
their current content under the new tab row. The edit dialog (`UpsertInvoiceDialog`) is
unchanged, so Edit still opens the older form.

An invoice here is a **record of a bill raised or received**; nothing charges or pays anyone.

## Not built from the design

- **Status** select in More Options (default "Pending Approval"). The two footer buttons
  decide the status: **Save as Draft** creates a Draft, **Send Invoice** creates and sends
  it. A status field would contradict both. If an invoice should be creatable straight into
  "Pending approval" (Submitted) without being sent, that needs a third action.
- **"Save allocation" / "Add category"** in the sheet's More Options menu. They are the
  budget-allocation form's own buttons; that form is kept at the bottom of the sheet
  (`InvoiceBudgetAllocations`) with its own Add category and Save allocations.
- **Rate and Amount per item** are not in the sheet's design (Description, QTY, Unit only).
  They are kept as a small grey line under each description so the figures are not lost.

## Decisions to confirm

- **"Pending approval" is the Submitted status.** Sent, Queried, Partially paid and Void
  keep their own labels; they have no pill in the design (colours chosen to match).
- **Status moves.** The inline status select on each row is gone. Moves that the API
  allows (`nextStatuses`, e.g. Submitted → Approved) are now **Mark approved** / **Mark
  pending approval** entries in the row menu and the sheet's More Options. Send and Query
  keep their own dialogs.
- **Trade is no longer required on the form.** It sits inside More Options in the design,
  and a required field in a collapsed section is what made Save fail with nothing on screen
  once before. A blank trade is saved as the invoice type's name ("Vendor invoice"). If the
  API should accept an empty trade, this fallback can go.
- **KPI definitions** (all from the recorded invoices): *Total Outstanding* = balance due on
  issued, un-voided invoices; *Pending approval* = Submitted, valued at total invoiced;
  *Overdue* = status Overdue, valued at balance due; *Paid this month* = receipts dated in
  the current calendar month (overpayment credits excluded). A server summary
  (`GET /invoices/summary`) would stop the page summing the whole list.
- **Amount** in the table is the total invoiced (before the retention and WHT deductions);
  net payable is on the sheet and the composer.
- **Vendor contact** on the sheet is the recipient email, the only contact the invoice stores.
  A vendor phone (the design shows +234…) needs a field.

## Client-side only today

- `GET /projects/:id/invoices` returns every invoice. Search, the **Date** filter (on the
  issue date; an invoice with none drops out while a range is set), the status filter and
  paging (10 per page) all run in the browser. Wanted: `q`, `status`, `issueFrom`/`issueTo`,
  `page`, `pageSize` and a `total`.
- The blue download icon builds a CSV from the filtered list (invoice, status, date, vendor,
  amount, paid, balance). A server export would cover the whole register.
- The sheet's timeline is `GET /invoices/:id/history`. Its labels are Raised, Sent, Queried,
  Approved, Voided, Payment recorded and Payment removed; the design's "Reviewed" has no event.
