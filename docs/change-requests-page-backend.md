# Change Requests page — backend notes

The redesigned register (`pages/project/change-requests`) works against the existing
`/projects/:id/change-requests` endpoints. Everything below is what the backend does **not**
yet give it, so the page does it on the client today.

## Filtering and paging happen on the client

`GET /projects/:id/change-requests` only accepts `status`. The page therefore loads the whole
register and filters it in the browser:

- **Search keyword** — matches `title`, `description`, `reason`.
- **Cost Change from / to** — compares `costImpact` in the chosen currency (rows in another
  currency never match a range, there is no conversion).
- **Type** — `variation | omission | eot_only | provisional_sum`.
- **Pagination** — 10 per page over the filtered rows.

Recommended: add `q`, `type`, `currency`, `costFrom`, `costTo`, `page` and `pageSize` to the list
endpoint and return `{ items, total }`, so a long register is not shipped whole.

## "Request Revision" has no action

The design shows a third button, *Request Revision*. The ladder today is
`Draft → submit`, `Submitted → approve | reject`, `Rejected → resubmit`, `Approved → execute`.
A revision is requested by **rejecting with a reason**, after which the contractor resubmits.
The page does not add a button that would write a state the backend cannot hold. If a distinct
"revision requested" status is wanted it needs a new status, a `request-revision` action (reason
required, attributed, timestamped) and an entry in the revision history.

## Row actions follow the real lifecycle

The design shows Approve / Reject on a *Draft*. A draft has not been submitted, so nothing can
decide it and the submitter may not approve their own request (the API answers 409). Each row
offers only the next action for its status (Submit, Approve + Reject, Revise and resubmit, Mark
executed) through the same `ChangeRequestActions` the detail drawer uses.

## Not shown on the new design

The status summary strip and the "Approved impact" total were dropped from the page; the counts
are still available at `GET /projects/:id/change-requests/summary`.

## "Send for approval" is two requests

The New Change Request form's button creates the change request (`POST /change-requests`) and
then submits it (`POST /change-requests/:id/submit`). If the second call fails the record is left
as a Draft and the user is told. Recommended: accept `submit: true` on create so the two happen
in one transaction (and one audit entry), and a failed submit cannot leave a half-sent record.

## Reason for Change

New requests send `reason` plus `reasonHtml` generated from the plain text; editing keeps the
rich-text editor. If the form is to stay plain-text, the backend can drop `reasonHtml` for
change requests and the detail view can render `reason` alone.

## "Created by" on the detail modal

The modal's **Created by** cell has no source. A change request stores `submittedById` (set only
when it is submitted) and no creator, so a Draft has nobody to show and the cell reads "—". Once
submitted, the page resolves the submitter's name from the project's participants. Recommended:
store `createdById` on create and return `createdById` + `createdByName` on the list and detail
payloads, so the page stops looking names up and a draft shows who drafted it.

## Row actions in the modal

The design's footer has Submit for Decision, Reject and Approve side by side on a Draft. As with
the register rows, the modal offers only the real next actions for the status (Draft → Submit;
Submitted → Reject + Approve; Rejected → Revise and resubmit; Approved → Mark executed), through
`POST /change-requests/:id/:action`.
