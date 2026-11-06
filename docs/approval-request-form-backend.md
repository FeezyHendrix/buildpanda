# New approval request form — what the backend needs to provide

Frontend: `components/molecules/upsert-approval-dialog.tsx`,
`components/molecules/approval-attachments-field.tsx`, opened from the **New approval
request** button on `pages/project/approvals.tsx`.
Backend module: `packages/backend/src/modules/approvals` (`POST /projects/:id/approvals`).

Read together with `docs/approvals-page-backend.md` (the list page); §2 there defines the
attachment data model this form depends on and is not repeated in full here.

The form was redesigned (title "New approval request", button "Send for approval") and now
has an **Attachments** field and a **Category** / **Approver** picker. Everything except the
attachments already works against the current API; the attachments are the one blocker.

## 1. What each field sends today

| Field (label) | Request field | Notes |
|---|---|---|
| What needs approval? | `title` | required, max 200 |
| Category | `category` | optional, max 80 (free text) |
| Decision needed by | `dueDate` | optional `yyyy-mm-dd` |
| More Information | `description` | optional, max 4000, plain text |
| Approver | `requestedReviewerId` | optional; empty = "Anyone who can approve" |
| Attachments | — | **not sendable yet** (see §2) |

"Send for approval" is enabled as soon as the title is filled, as before; category, date,
description and approver are optional (the design shows them filled, but "anyone who can
approve" has always been a valid choice and is kept).

## 2. Required: accept attachments on create

The create body schema has `additionalProperties: false` and no `attachments` property, so
sending one is a 400. The frontend therefore keeps the picker working but does **not** send
files: a constant `APPROVAL_ATTACHMENTS_ENABLED = false` in `packages/frontend/src/api/approvals.ts`
gates it, and the form tells the user "File upload is not switched on for approvals yet" if
they pick files meanwhile. Flip the constant once the backend below ships.

### 2.1 Contract

`POST /projects/:id/approvals`

```json
{
  "title": "Living room floor tile selection",
  "category": "Finishes",
  "description": "We're proposing 600 × 1200mm matte porcelain tiles…",
  "dueDate": "2026-09-02",
  "requestedReviewerId": "usr_…",
  "attachments": [{ "fileId": "file_…" }, { "fileId": "file_…" }]
}
```

How the frontend produces `fileId`s: for each picked file it first calls the existing
`POST /files` (multipart, with `projectId` before the file part) and collects the returned
ids, then sends the create call with those ids. If any upload fails the create is not sent
and the user sees the error, so the approval is never created with half its files.

### 2.2 Validation the server must do (the UI checks are convenience only)

* **At most 5 attachments** per request (UI: "Max 5 uploads"). 422 above that.
* **Only PNG, JPG/JPEG or PDF.** Validate by **content sniffing**, not the filename or the
  client-sent `mimeType`. 422 otherwise, naming the offending file.
* **Max size 10 MB per file** (the UI limit). The files module allows 25 MB in general;
  pick one number and state it in the error.
* Every `fileId` must exist, belong to the **same project**, have been **uploaded by the
  caller**, and not already be attached to another record. Otherwise a user could attach a
  file they can't see. 422/403 with the file named.
* No duplicate `fileId` in one request.
* The approval row and its attachment rows are written in **one transaction**.

### 2.3 Storage

Use the `approval_attachments` table described in `docs/approvals-page-backend.md` §2.1.
Plain uploads use `file_id`; attachments picked from the project's documents (future) use
`document_id` + the pinned `document_version_id`. Uploaded files are stored as-is, but the
row must record the uploader and timestamp (actor + time: this is a contractual record).

Uploaded-but-never-attached files (the user closes the form after the upload step) will be
orphaned; add them to the existing orphan-file sweep, or accept a short TTL on files not
linked to any record.

### 2.4 Response

`201` returns the approval as the list does, including `attachments[]` (first 3) and
`attachmentCount`, so the page can show the chips without a refetch. Shape in
`docs/approvals-page-backend.md` §2.3.

### 2.5 Editing

The edit form hides the Attachments field (the update endpoint cannot change them). Decide
the rule and document it: attachments may be added/removed only while the approval is
`Pending`; once decided, changing them must create a new revision rather than rewrite what
was approved (`docs/approvals-page-backend.md` §5). If attachment editing is wanted in the
form later, add `attachments` (add/remove ids) to `PATCH /projects/:id/approvals/:approvalId`.

## 3. Recommended: real approver list

The Approver dropdown is filled from the **task assignee** list (`useAssignableUsers`). That
list is "who can be given a task", which is not the same as "who can approve": it can
include people without the approval-decide capability, and the request would then sit with
someone who is forbidden to decide it.

Add `GET /projects/:id/approvals/approvers` returning only project participants who hold
the decide capability (`canDecideApprovals`), as `[{ id, name, role, avatarUrl? }]`. On
create/update, **reject a `requestedReviewerId` who is not one of them** (422) rather than
accepting it. The option "Anyone who can approve" stays: it sends `requestedReviewerId:
null`.

## 4. Recommended: categories from the server

The Category list (Finishes, Fittings, Materials, Structural, Other) is hard-coded in the
frontend. Add `GET /projects/:id/approval-categories` (defaults seeded per project, editable
by project managers) or a project setting, and keep `category` free text on the approval for
history. Until then the frontend list stays as is.

## 5. Validation and errors on create

* `dueDate`: valid `yyyy-mm-dd`; reject dates before the project's start date. A date in the
  past is allowed but should be accepted with the response flagging it, or rejected, whichever
  product decides; today it is accepted.
* `title`: trim, non-empty, max 200. `description`: max 4000.
* Return field-level errors so the form can point at them:
  `{ "message": "…", "fields": { "attachments": "…", "requestedReviewerId": "…" } }`
  (the form currently shows one error banner under the fields).
* Permission: `approvals:manage` to create (unchanged). A user who can create but not decide
  must not be able to name themselves the approver of their own request unless the project
  allows self-approval (the ledger already tracks `selfApproved` for materials; mirror that).

## 6. Notifications and Panda AI

* On create, notify `requestedReviewerId` (or every user who can decide when null): title,
  requester, due date, attachment count, deep link `/project/:id/approvals?approval=:approvalId`
  (the deep link already opens the detail dialog).
* Panda AI's `get_open_items` already lists open approvals; include `attachmentCount` and
  the requested reviewer so a PM can ask "what is waiting on whom".

## 7. Frontend follow-ups once this ships

* Set `APPROVAL_ATTACHMENTS_ENABLED = true` in `api/approvals.ts` and delete the
  "not switched on" notice in `upsert-approval-dialog.tsx`.
* Swap `useAssignableUsers` for the approvers endpoint (§3) in `pages/project/approvals.tsx`.
* Replace the hard-coded `CATEGORY_OPTIONS` with the categories endpoint (§4).
* Map field-level errors onto the inputs (§5).
