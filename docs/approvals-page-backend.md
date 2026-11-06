# Approvals page — what the backend needs to provide

Frontend: `packages/frontend/src/pages/project/approvals.tsx` (+ `approvals/`).
Backend module: `packages/backend/src/modules/approvals` (client approvals share the
`approvals` table with material approvals, discriminated by `kind = 'client'`).

The page was renamed from **Client approvals** to **Approvals** (sidebar label, page title,
the role-builder permission label). The route (`/project/:id/approvals`), the permission
resource (`approvals`) and the `kind` value (`client`) are **unchanged** — no migration is
needed for the rename. Check any user-facing strings the backend sends (emails,
notifications, Panda AI tool descriptions such as `get_open_items`, which still says
"client approvals") and decide whether they should read "approvals" too.

## 1. What works today with no backend change

The new design is built on the data the API already returns, so nothing is blocked:

| Design element | Source today |
|---|---|
| Status pill, title, one-line description, "Due <date>" | `status`, `title`, `description`, `dueDate` |
| Category pill | `category` |
| Comment count | `commentCount` |
| "Needs my Approval" vs "Awaiting Approval" | `status = Pending`, split on the client by `requestedReviewerId` and the viewer's `canDecideApprovals` capability |
| Approve (no note) | `PATCH /projects/:id/approvals/:approvalId { status: "Approved" }` |
| Reject / Request Revision / View Changes | open the existing detail dialog, which already collects the required decision note |
| Search, status pills, date range, 10-per-page pagination | done on the client over the full list |

Status mapping (the stored enum is **not** changing):

| Stored `status` | Shown as |
|---|---|
| `Pending`, viewer may decide | Needs my Approval |
| `Pending`, viewer may not decide | Awaiting Approval |
| `Approved` | Approved |
| `Rejected` | Rejected |
| `Resubmit` | Changes Requested (button: View Changes) |

## 2. Required: attachments on an approval (the file chips)

The design shows file chips (icon by type, file name, "+N") on every request. The list
response has **no files today**; the create call accepts only a single
`documentId` / `documentVersionId` / `sourceMarkupId`. The frontend already has optional
fields and renders chips as soon as they appear.

### 2.1 Data model

New join table, e.g. `approval_attachments`:

| column | notes |
|---|---|
| `id` | uuid |
| `approval_id` | FK → `approvals.id`, cascade on delete |
| `document_id` | FK → documents (nullable if the file is a plain upload) |
| `document_version_id` | **required when `document_id` is set.** An approval is a contractual record: it approves *that revision*, so it must pin the version it was made against and never silently follow "latest" (see CLAUDE.md, "Is it revision-scoped?") |
| `file_id` | FK → files module, for files uploaded straight onto the request |
| `position` | display order |
| `created_by`, `created_at` | actor + timestamp |

Backfill: existing `documentId` / `documentVersionId` on an approval becomes the first
attachment row.

### 2.2 Create / edit

`POST /projects/:id/approvals` and `PATCH .../:approvalId` accept
`attachments: Array<{ documentId, documentVersionId } | { fileId }>` (max ~20; reject
duplicates). Keep the single `documentId` / `documentVersionId` fields working for the
existing "raise an approval from a drawing markup" flow (`sourceMarkupId`).

Editing attachments after a decision has been made must not rewrite what was approved.
Either block edits once `status` is `Approved` / `Rejected`, or record the change as a new
revision (see §5).

### 2.3 List and detail response

Add to each approval in `GET /projects/:id/approvals`:

```json
{
  "attachments": [
    {
      "id": "…",
      "fileName": "Matte_Brown_Door.png",
      "mimeType": "image/png",
      "sizeBytes": 183422,
      "url": "https://…signed…",
      "documentId": "…",
      "documentVersionId": "…",
      "isSuperseded": false
    }
  ],
  "attachmentCount": 5
}
```

* The list returns only the **first 3** (the page shows three chips and a "+N" for the
  rest, N = `attachmentCount − 3`). The detail endpoint returns all of them.
* `url` is a short-lived signed view URL, the same mechanism the documents module uses.
  Omit it (keep `fileName`) when the viewer may not open the file — the chip then renders
  as plain text.
* `isSuperseded` is true when a newer version of the document exists, so the UI can later
  flag "a newer revision exists" without a second call.
* Avoid N+1: load attachments for the whole page of approvals in one query.
* Permission: attachments are readable by anyone who can view the approval; the signed
  `url` additionally requires the viewer's `documents` view right.

## 3. Recommended: server-side list query (needed once registers grow)

Today the page fetches the whole register and filters in the browser. That is fine for tens
of items, not for hundreds. When this is built the frontend only swaps the data hook.

`GET /projects/:id/approvals`

| param | meaning |
|---|---|
| `q` | keyword over title, description, category, requested reviewer name |
| `status` | `Pending` \| `Approved` \| `Rejected` \| `Resubmit` (repeatable) |
| `needsMyDecision` | `true` → `Pending` items the caller may decide (applies the same rule as the PATCH guard below) |
| `submittedFrom`, `submittedTo` | `yyyy-mm-dd`, inclusive, on `created_at` in the project's timezone |
| `page`, `pageSize` | default 1 / 10, max 50 |
| `sort` | default: attention first (`Pending` decidable by caller, `Pending` other, `Resubmit`, then decided), then `created_at desc` |

Response: `{ items: Approval[], total: number, page: number, pageSize: number }`.

Optional: `counts: { needsMe, awaiting, approved, rejected, changesRequested }` so the
filter pills can show badges without extra calls.

> The date range filters on the **submission date** (`created_at`), not the due date. If
> product prefers "due date", say so and the param becomes `dueFrom` / `dueTo`.

Keep `kind = 'client'` in every query (the table is shared with material approvals).

## 4. Recommended: tell the client whether *they* may decide

The frontend currently re-implements the PATCH gate to decide whether to show Approve /
Reject / Request Revision:

> may decide = caller has `canDecideApprovals` **and** (no `requestedReviewerId` **or**
> `requestedReviewerId === caller.id`)

That rule belongs on the server. Add `viewerCanDecide: boolean` to each approval (list and
detail) computed with the exact guard the route uses, so the UI can never show a button the
API will refuse. Presentation must not be the authority (CLAUDE.md, "Authorization is not
presentation"); the route guard stays as it is.

## 5. Recommended: decisions as a record, not an overwrite

`approvals` stores a single `response` / `reviewed_by` / `reviewed_at`. A request that is
sent back ("Changes Requested"), revised and approved loses the earlier note and reviewer.
For a contractual sign-off that history is the point.

* Add append-only `approval_decisions` (`approval_id`, `decision`, `note`, `note_html`,
  `actor_id`, `decided_at`, `revision`) and write a row on every status change; keep the
  current columns as the denormalised latest decision.
* Add `POST /projects/:id/approvals/:approvalId/resubmit` (requester only, from `Resubmit`
  → `Pending`), which bumps a `revision` counter and accepts replacement `attachments`.
  Without it the "Changes Requested" state has no way back to the reviewer: today it is
  just a status the requester has to edit around.
* **View Changes** (the blue button on a Changes Requested card) currently opens the
  detail dialog, which shows the reviewer's note and the discussion. If a side-by-side of
  "what changed since the last revision" is wanted, the detail response needs
  `revisions: [{ revision, submittedAt, attachments[], decisionNote }]`.

## 6. Rules the server must enforce (the frontend only mirrors them)

* **A decision note is required to Reject or request changes** (`Rejected`, `Resubmit`);
  optional for `Approved`. Today only the dialog enforces this. The page's Approve button
  decides in one click with no note, and Reject / Request Revision open the dialog for the
  note — so the API must also return 422 when `response` is empty for those two statuses.
* Only the requested reviewer (when one is named), and only a user with the decide
  capability, may move an approval to a decision status. Keep the existing reviewer-only
  guard; stamp `reviewed_by` / `reviewed_at` on every decision.
* A settled approval (`Approved` / `Rejected`) is a record: either forbid editing its
  title / description / attachments, or version the edit (§5).
* Deleting an approval that has been decided should be refused or soft-deleted, not
  silently removed.

## 7. Notifications and Panda AI

* Notify the requested reviewer on create and on resubmit ("Needs your approval"), and the
  submitter on every decision. Use the new wording ("Approval", not "Client approval").
* Panda AI: `get_open_items` already lists open client approvals. If attachments are added,
  include `attachmentCount` and the decision-pending age so a PM can ask "which approvals
  are waiting on me and for how long". If a new read tool is added, register it in
  `agent/tools.ts` and mention it in the `SYSTEM_PROMPT`.

## 8. Frontend follow-ups once the above ships

* Swap `useApprovals(projectId)` for the paged / filtered endpoint and remove the
  client-side `matchesApprovalSearch` / `matchesSubmittedRange` / `sortByAttention` helpers
  in `pages/project/approvals/shared.ts`.
* Replace the local `mayDecide()` in `approvals.tsx` with `viewerCanDecide`.
* Read attachments from the response (types are already optional on `Approval` in
  `lib/project-types.ts`: `attachments?`, `attachmentCount?`).
* Wire **View Changes** to the revisions view if §5 is built.
