# Change Orders board — notes for the backend and product

Frontend: `packages/frontend/src/pages/project/finances/change-orders-page.tsx`,
`change-orders/`, and the shared form `components/molecules/upsert-change-request-dialog.tsx`.
Route `finances/change-orders`, listed under **Finance** in the sidebar as **Change
Orders** (feature flag `workflow.changeRequests`, permission resource `change-requests`).

## It is a second view of the same records

There was already a **Change Requests** register (`/project/:id/change-requests`).
The board reads the same `GET /projects/:id/change-requests` list and writes through the
same create / update / action / delete calls, so nothing is duplicated and a card moves
only when an action on its sheet moves it. Both sidebar entries exist now. Decide whether
the register stays or the top-level entry is retired. The Finance overview's change-orders
card now links to the board. The New / Edit form is shared, so the register shows the
redesigned form too.

## Fields the design shows that the API does not carry (built, not sent)

- **Details → Add Image** on the New / Edit form: images attached to a change order.
  Needs a list of file ids (`attachmentFileIds`) via the files module.
- **Discussions → image button** beside Post: images on a comment
  (`attachmentFileIds` on the comment body).
- **Reply** on a comment: the API has no threads. Reply opens a new comment that begins
  with "@Name". If real threads are wanted, comments need a `parentId`.

## Behaviour decisions to confirm

- **Create saves a draft.** The form's button reads **Create** (the design), and on the
  board it creates a **Draft**, which is then submitted from its sheet (**Submit for
  decision**). On the register the form still says "Send for approval" and creates +
  submits, as before (`createLabel` prop).
- **Status pills, plus a type dropdown.** The latest design filters the board by status
  (All, Draft, Submitted, Approved, Executed; Rejected added). "All" shows every column,
  a status shows only that column. The earlier design's type filter (Variations,
  Omissions, Time Claims, Provisional Sums) is kept as a dropdown at the right of the
  same row, because the design no longer has a place for it.
- **Sheet actions sit in the header** (Reject · Approve; Draft: Submit for decision;
  Approved: Mark executed; Rejected: Revise and resubmit). **Cancel** in the footer only
  closes the sheet. There is no Edit button on the sheet: Edit Order is in the card menu.
  An executed order shows no actions.
- **Budget allocation** (allocating a cost across budget categories) is not in the design;
  it is kept under Discussions on the sheet for orders with a cost impact.
- **Reason** shows on the sheet only while there are no revisions; once submitted, the
  reason is read from the revision, as in the design.

## Not built from the design

- **Column header "+" and trash** (Submitted column, earlier design): a "+" duplicates
  **Change an Order**, and a column trash implies deleting every order in a status.
  Orders are contractual records (a signed contract or executed award refuses deletion).
- **Drag to move.** Status moves only through submit, approve, reject, resubmit and execute.
- **Avatar stack with "+3".** A change request has one `assigneeId`; the card shows that
  person's initials or "Unassigned". Stacks need an assignees / watchers list.

## Where the design departs from the data

- **Rejected column** added after Executed (the ladder has five statuses).
- **"Contract" chip** only when the order has produced a contract (`contractId`).
- **Time claims** read as "4 days claimed • 2 days awarded" instead of a cost; the form
  swaps Currency and Cost impact for **Days claimed** and the delay picker.

## Client-side only today

- The board loads **every** change request and filters by type in the browser. For a long
  register: a `type` filter and per-status paging or counts (`/change-requests/summary`
  already has the counts).
