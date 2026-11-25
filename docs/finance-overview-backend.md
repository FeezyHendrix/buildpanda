# Finance overview — backend notes

The redesigned finance overview (`pages/project/finances.tsx` and `finances/overview/*`) reads
only existing endpoints (`GET /finances/summary`, the reporting snapshot, invoices, finance events,
change-request counts). Nothing breaks without backend work, but the **Record funding** drawer and
one figure need a decision from the backend side.

## 1. Photo proof on a funding record (UI built, not sent yet)

The Record funding drawer shows an optional **Photo proof** upload ("JPG or PNG, max 10MB"). The
frontend picks and validates the file (type, size) but **does not send it**, because:

- `POST /projects/:id/finances/deposits` takes only `amount`, `description` (1–200) and `entryDate`,
  with `additionalProperties: false`, so an extra field is a 400.
- Even if the file were uploaded separately, nothing would link it to the deposit. A "proof" that is
  silently dropped is worse than no field in a record people will rely on in a dispute.

What is needed (the same shape milestones already have: `proof_file_name`, `proof_verified`):

- `proofFileId` (optional, a file already uploaded through the files module for that project) on the
  deposit body.
- Store it on the ledger row and return it on the funding trail events as
  `proof: { fileId, fileName } | null`, so the Funding Trail card can offer "View proof".
- Validate that the file belongs to the project and is JPG, PNG (or PDF, since bank slips are
  often PDFs); max 10MB. Check `finances:manage` as the deposit route does.
- Say whether proof is **verified** later by someone else (as milestone proof is) or is just attached.

Once this exists the frontend change is small: upload the picked file in `handleSubmit` of
`record-deposit-dialog.tsx` and pass `proofFileId` through `useFundProject`. Until then a picked file
is discarded on submit, so users are not told the proof was recorded.

## 2. "Retention held" shows a percentage in the design

In the Contract health card the design shows **Retention held — 0%**. The app shows the retention
**amount** (`summary.retentionHeld`, e.g. ₦0.00), because a percentage of what is not stated would be
guessing. If product wants a percentage, say which: retention held as a share of the adjusted contract
(`retentionHeld / adjustedContract`) or the contract's retention **rate** (a term on the contract).
Either is cheap to add to `GET /finances/summary` as `retentionPercent`; until then the amount stays.

## 3. Nothing else needed

- The Contract position, Full Statement, LD exposure, change-order counts and funding figures are all
  already on `GET /finances/summary`; the Full Statement lines are the same figures, re-ordered.
- Funding currency: the drawer's amount shows the project's currency only. The deposit endpoint has no
  currency field, so funding in a different currency would need one (and a defined conversion).
