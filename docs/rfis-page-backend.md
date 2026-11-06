# RFI page — what the backend needs to provide

Frontend: `packages/frontend/src/pages/project/rfis.tsx` (+ `rfis/`).
Backend module: `packages/backend/src/modules/rfis` (`GET /projects/:id/rfis`).

The page was redesigned: status pills (All / Open / Answered / Closed), a **Raise RFI**
button, and a right-hand column with **Search Keyword** and a **Filter** card (Priority,
From, To, Apply Filter, Reset). Each row now shows `RFI - n`, a status pill, a priority
pill, the due date, the subject, the question, and a `Responses (n)` chip.

Nothing is blocked: the page works on the current API. This document lists what is done
in the browser today and should move to the server before the register grows.

## 1. What works today with no backend change

| Design element | Source today |
|---|---|
| Status pills | `GET /projects/:id/rfis?status=Open\|Answered\|Closed` (already supported) |
| Row fields | `number`, `status`, `priority`, `dueDate`, `subject`, `question`, `commentCount` |
| "Medium Priority" | stored `priority = "Normal"`, shown as Medium (see §3) |
| "With <name>" (kept from the old row) | `ballInCourtName` |
| Overdue pill + red due date (kept) | derived in the browser from `dueDate` + `status` |
| Search Keyword | **browser**, over `number`, `subject`, `question`, `ballInCourtName` |
| Priority filter | **browser** |
| From / To | **browser**, on the RFI's **due date** |

The page fetches the whole register for the chosen status and narrows it locally. That is
fine for tens of RFIs, not for hundreds.

## 2. Recommended: server-side list query

`GET /projects/:id/rfis`

| param | meaning |
|---|---|
| `status` | existing; allow repeating |
| `overdue` | `true` → awaiting an answer (`Draft`/`Open`/`InReview`) with `due_date` before today, **in the project's timezone** |
| `q` | keyword over RFI number (`3`, `rfi 3`, `RFI-3`), subject, question, official response, ball-in-court name |
| `priority` | `Low` \| `Normal` \| `High` (repeatable) |
| `dueFrom`, `dueTo` | `yyyy-mm-dd`, inclusive, on `due_date` |
| `page`, `pageSize` | default 1 / 25, max 100 |
| `sort` | default `number desc`; allow `dueDate asc` |

Response: `{ items: Rfi[], total, page, pageSize, counts }` with
`counts: { all, open, answered, closed, overdue }` so the pills can show badges and the
Overdue pill can be offered without loading everything.

**Decide the date semantics.** The From/To fields filter the *due date* because that is the
date the row shows ("Due Sept 15") and the one a PM plans around. An RFI **without a due
date is excluded** whenever a range is set. If product prefers "date raised", say so and
the params become `raisedFrom` / `raisedTo` on `created_at`.

## 3. Priority naming

The enum is `Low | Normal | High`; the design says **Low / Medium / High**. The frontend maps
`Normal → "Medium Priority"`. Either keep that mapping (documented in the API reference) or
migrate the enum to `Medium`. If renamed, do it in one migration plus the validation schema,
the Panda AI tools and any exports, and keep accepting `Normal` on input for a release.

## 4. Overdue must be computed on the server

A late RFI response is a claimable delay (finding F36), so "overdue" is more than a label.
The browser decides it from the user's own clock and timezone, so two people can disagree
about the same RFI on the same day. Add to each RFI in the list and detail responses:

```json
{ "isOverdue": true, "overdueDays": 12 }
```

computed in the **project's timezone** with the same rule the frontend uses
(`status` is `Draft`/`Open`/`InReview` **and** `due_date < today`). The pill and the red
"Due" text then read from these fields, and the `overdue` filter in §2 uses the same rule.

## 5. "Responses (n)" must mean one thing

The chip shows `commentCount`. Define it explicitly and keep it identical in the list and in
the detail drawer:

* does it include proposed responses (`isProposedResponse`)? the official response? internal-only comments?
* does it exclude deleted/void comments?

If the answer is "all comments", rename the field to `responseCount` (and keep
`commentCount` as an alias for a release). If the viewer cannot see internal comments, the
count they get must not include them.

## 6. Visibility is enforced here, not in the page

RFIs carry `visibility: "internal" | "shared"`. The list endpoint must return only the RFIs
the caller is allowed to see (a client-side participant sees `shared` only), for every query
in §2 including `q` and `counts`. Search must never match text from an RFI the caller cannot
read. The page does not filter by visibility and must not be relied on to.

## 7. Ball in court

The row shows `With <ballInCourtName>`. That field is the display name of either a project
participant or an external contact. Do not return `ballInCourtEmail` in the **list** unless
the viewer may see it (it is on the detail already); the page does not use it.

## 8. Panda AI

If the RFI read tool in `modules/panda-ai/agent` filters RFIs, give it the same filters as
§2 (`priority`, `overdue`, due-date range) so "which high-priority RFIs are overdue?" works,
and mention them in the `SYSTEM_PROMPT`.

## 9. Frontend follow-ups once this ships

* In `pages/project/rfis.tsx`: send `q`, `priority`, `dueFrom`, `dueTo`, `overdue` and `page`
  instead of filtering `visible` locally; remove `matchesRfiSearch` / `matchesRfiFilters` in
  `pages/project/rfis/shared.ts`.
* Read `isOverdue` / `overdueDays` instead of `isRfiOverdue` / `rfiOverdueDays`
  (`lib/rfi-meta.ts`) in `rfis/rfi-row.tsx`.
* Show `counts` on the status pills and replace the "offer Overdue only when something is late"
  rule with `counts.overdue > 0`.
* Add numbered pagination (`NumberedPagination`) under the list.

---

# RFI detail drawer (open and closed)

Frontend: `components/molecules/rfi-detail-dialog.tsx` (+ `rfi-detail/`). The drawer is now
two panes: the record and its close / reopen action on the left, the responses and the
comment box on the right.

## 10. What works today

Everything in the design is served by `GET /projects/:id/rfis/:rfiId`, with two gaps below:
`status`, `priority`, `dueDate`, `question(Html)`, `ballInCourt*`, `comments[]`,
`officialResponse*`, `reopenedCount`, `changeRequestId`. "Mark as closed" and "Reopen RFI" call
the existing status transition.

## 11. Needed: names, not just ids

* **Created by** — the detail returns `createdById` only. The page looks the person up in the
  project participants and falls back to the actor on the `created` audit event, so it shows
  "—" for someone who left the project. Return `createdByName` on the RFI (list and detail).
* **Assigned to** — returned as `ballInCourtName`. Make sure it is filled for participants
  *and* external contacts (it is the only name the drawer has).

## 12. Decide: comments on a closed RFI

The Closed design shows the comment box. The service refuses a response on a `Closed` or `Void`
RFI (`ForbiddenError("This RFI is closed")`), so the drawer shows the box read-only with
"This RFI is closed. Reopen it to add a response." If the intent is that people can keep
commenting on a closed RFI, change the guard to allow **non-official, non-status-changing
comments** after closure (the official response and answered/closed transitions must stay
locked, and every such comment should be stamped so a closed record is not silently
rewritten). Until then the frontend behaviour above is correct.

## 13. Comment time

Each response shows a clock time (`10:34`) for today's comments and `5 Sept, 10:34` for older
ones, taken from `createdAt`. That is rendered in the **viewer's** timezone. For a contractual
record, return the timestamp in ISO-8601 with offset (it already is) and keep it that way; do
not send pre-formatted strings.

## 14. Keep: things the design does not show

The drawer still carries, below or beside the design: the official-response block and the
"post as the official response" option (managers), a reference picker on a response, the
history list, "Edit RFI", "Convert to change event" and the "↻ Reopened ×n" / overdue pills.
They are unchanged and need no backend work.
