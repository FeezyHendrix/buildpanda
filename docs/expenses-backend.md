# Expenses page — what the new design needs from the backend

Frontend: `packages/frontend/src/pages/project/finances/expenses-page.tsx`,
`expenses-tab.tsx` and `expenses/`. The page is built to the new designs
(list + charts, Record / Edit Expenses drawers, Manage Categories drawer).
Everything below is either a field the design shows that the API does not carry,
or a decision the design makes that the backend/product should confirm.

An expense is a **record of money spent off-platform** — nothing here moves money.

## 1. Photo proof on an expense (not sent)

The Record Expenses drawer has **Photo proof (optional)** — "JPG or PNG (max. 10MB)".
The frontend validates the type and size and holds the file, but does **not**
send it: `POST /projects/:id/transactions` has no field for it.

Needed:

- `proofFileId: string | null` on create and update, and on the `Transaction` DTO.
- Upload goes through the existing files module (`useUploadFile`), same as the
  receipt; accept `image/jpeg` and `image/png`, 10MB.
- Decide how it differs from **Receipt**. Receipt evidences the purchase (invoice,
  till slip); photo proof evidences the thing itself or the payment. They are two
  files on one record, so two ids.

Once the field exists: upload in `handleSubmit` of `expenses/expense-dialogs.tsx`
and pass the id. The Edit drawer in the design has no photo proof; if proof
should be editable after the fact, that design needs it added.

## 2. Receipt file types

The design says the receipt "Supports Excel, PDF, Word, CSV" (the old form took
images and PDF only). The frontend now offers
`image/*, .pdf, .doc, .docx, .xls, .xlsx, .csv`.

Please confirm:

- The files module accepts these (it has no MIME allow-list today) and what
  `config.uploads.maxFileBytes` is — the client does not check size, so a
  too-large receipt fails at upload with the server's message.
- `GET` signed URL works for non-image files. The old form previewed the receipt
  as an `<img>`; the drawer now shows a file row with a **View** link instead.
- The receipt's **file name** is not on the `Transaction` DTO, so an existing
  receipt shows as "Receipt attached". Return `receiptFileName` to show the real one.

## 3. Build stage is gone from the form and the table

The designs drop **Build stage** from the expense form and the **Build stage /
Created** columns from the table. `stageId` is still on the API and the DTO:

- A **new** expense is created with no stage and there is no way to set one.
- An **edit** keeps whatever `stageId` the record already has (it is sent back unchanged).

Stage attribution is what ties spend to a phase, so this needs a product decision:
either the design restores a Build stage field, or stage attribution moves elsewhere
(e.g. from the stage's own cost view). Nothing was removed from the API.

## 4. Credit / refund and Recoverable deposit — record-time only

The Record drawer shows both toggles; the Edit drawer does not. The frontend
sends the record's existing values on edit, so they cannot change after creation.
If that is intended (flipping a credit changes the sign of what was certified),
the API should **reject** changes to `credit` / `recoverable` on `PUT`. If not,
the Edit design needs the toggles.

In the table a credit shows as `−₦…` and credit / recoverable keep a small badge
beside the reference, since the design has no column for them.

## 5. List pagination and search

The table pages **on the client** (10 per page, "Showing 1 to 10 of 20 Expenses"):
`GET /projects/:id/transactions` returns every expense. Fine for a typical
project, heavy for a long one. Wanted: `page`, `pageSize` and a `total` on the
list response (the analytics endpoint already takes the same filters).

Search is now a live box (debounced 300ms) calling the existing `search` param;
it should keep matching title, vendor and reference.

## 6. CSV export

There are two export controls (the header **Export CSV** and the blue download
icon beside the filters). Both call the existing export with the **current
filters**. If the header button should always export everything, say so and it
will drop the filters.

## 7. Charts

Frontend only, no API change: the headline total is shown compact to three
decimals (`₦3.350M`), and the Monthly Spend axis uses round ticks computed from
`byMonth` (0, ¼, ½, ¾, max). Category colours come from `byCategory[].color`;
presets with no colour fall back to grey.
