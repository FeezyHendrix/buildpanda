# Contracts & Phases — backend notes

The redesigned Contracts & Phases page (`pages/project/finances/contracts-phases-page.tsx` and
`contracts-phases/*`, plus the Terms and Final account sections) reads only existing endpoints
(`/contracts`, `/stages`, `/finances`, `/finances/summary`). Nothing breaks without backend work;
the items below are what the designs imply but the API does not provide yet.

## 1. A contract number (`INV-2026-001`)

Every row and the contract sheet show a number under the contract name. The `Contract` record has
no such field, so the UI shows `contract.reference` when present and falls back to the kind
("Main contract" / "Change order").

Needed on `GET /projects/:id/contracts` (and the create response):

- `reference: string | null`, generated on create, unique per project, never edited afterwards.
  The design's `INV-2026-001` shape reads like an invoice number; a contract probably wants its own
  prefix (e.g. `CON-2026-001`). Product to decide.

## 2. Pagination on the contracts list

The list pages **on the client**, 10 per page ("Showing 1 to 10 of 20 Contracts"), because
`GET /contracts` returns the whole array. That is fine for tens of contracts. If a build can reach
hundreds, add `page` / `pageSize` / `q` and return `{ items, total, page, pageSize }` like
`GET /projects`; the page already tracks `page` and `total`, so only the hook changes.

## 3. Signed contract document

The Details tab's drop zone says "PDF or DOCX (max. 10MB)". The upload goes through the existing
files module, which has no MIME allow-list and enforces `config.uploads.maxFileBytes`. The UI also
accepts images (a scan of the signed paper) and checks 10MB itself. To make the hint true:

- Confirm `maxFileBytes` is 10MB for this use, or state the real limit.
- Decide whether a signed contract may be an image, and if not restrict the type server-side.

## 4. Things in the designs that were not built

- **"Photo proof (optional)" at the bottom of the Terms tab.** It matches the Record funding drawer
  exactly and a contract has nothing to attach a photo to, so it looks pasted. Not built. If a
  contract really does need an attachment on its terms (a side letter, for instance) the backend
  needs a `termsDocumentId` on the contract terms; say so and it is a small addition.
- **"Pending Approval" as the placeholder of every empty term.** There is no approval step on contract
  terms, so an unset term reads "Not set". If terms are meant to go through approval, that needs a
  state per term set (`draft | pending_approval | approved`) and an approver, which is a feature, not
  a label.
- **Advance percentage and Recovery rate repeated under Payment terms.** They are the same two fields
  as under Advance / mobilisation; showing them twice would let two inputs edit one value. Payment
  terms keeps its one field.
- **Section titles "Billing Months" (Details) and "Phase 3" (Phases).** The first does not describe
  the grid beneath it (kind, trade, entity, total, date, phases); the second reads as a count. The
  tabs keep "Details" and "Phases · 3".
- **Inline status change on a list row.** The design shows a status pill only, so status is changed in
  the Edit drawer, where "Signed needs the signed document" can explain itself.
- **"Open related records" on the closing checklist.** The design shows it on the first step only;
  the app shows it on every step that is still open, since each one points at a different page.

## 5. Phases tab (list, phase drawer, stage value, schedule of values)

These screens read existing endpoints (`/stages`, `/stages/:id/schedule-of-values`). Nothing breaks
without backend work.

- **Billing months are months, the design shows a day.** Each schedule line's date field reads
  `DD/MM/YYYY`, but the Schedule of Values stores a `period` of `YYYY-MM`, and the line under it says
  "Sept 2026". The field is a month picker. If a billing line is meant to carry a day, the API needs
  `period` to become a date; say so and the percent/amount maths is unchanged.
- **Phase status wording.** The design shows an orange "Pending" pill for a phase that has not started.
  The app used "Not started"; the stage status value is still `Pending`, so only the label changed.
- **Phase dates in the drawer.** The sub-line is `startDate – endDate` from the stage; where a stage has
  no dates it falls back to its `dateRange` text, then to the contract name alone.
- **Used labour hours / used material costs** left the list (the design has Est. labour hours and Total
  costs only) and live in the phase drawer. No API change.
- **Mock values in the design.** The phase drawer's "Material budget 10 h" is a money figure in the app
  (it is `materialBudget`), and its second "Details" heading is titled "Estimates and costs".
- **Pagination.** Phases page on the client, 10 per page, for the same reason as contracts (§2).
