# Project overview — backend notes

The redesigned overview (`pages/project/overview`) reads the existing reporting snapshot and the
RFI, key-date, change-request-summary, finance-summary and weather endpoints. Nothing breaks
without backend work, but two parts of the design need data that does not exist yet.

## Attention Areas needs a feed with people on it

The design lists items like *"Approve MEP rough-in scope variation — Eng.Kanayo | MEP Engineer"*
with a **Blocking / Due Soon / Review** tag. Today the card is built from counts in the snapshot
("3 overdue RFIs"), so each row carries the tag and the area ("RFIs", "Approvals", …) but **no
person and no individual record**.

Recommended: `GET /projects/:id/attention-areas?limit=` returning, newest-urgent first:

```json
{
  "items": [
    {
      "id": "…",
      "kind": "rfi | approval | change_request | task | payment | inspection | permit | key_date",
      "tag": "blocking | due_soon | review",
      "title": "Approve MEP rough-in scope variation",
      "assignee": { "id": "…", "name": "Eng.Kanayo", "profession": "MEP Engineer" },
      "dueDate": "2026-07-30",
      "href": "/project/:id/approvals?…"
    }
  ],
  "total": 14
}
```

- `tag` is decided server-side so every client agrees: *blocking* = work cannot proceed until it is
  decided or fixed (overdue RFI, failed inspection, expired permit); *due soon* = a date within
  the look-ahead window; *review* = waiting on someone's decision.
- Must respect the caller's permissions (an item the user cannot open is not returned).
- `total` lets "View All" show how many more there are; the page currently expands the list in
  place and has no dedicated "all" route.

## Phases need real dates

The Programme Of Works stepper shows "From 12 Nov 2026 / To 11 Dec 2026". `project.timeline`
only carries `dateRange` as a display string, so the page splits it on "–". Please add
`startDate` / `endDate` (ISO) to each timeline phase so nothing depends on string formats.

## Not shown on the design

The cash-flow and budget charts, field activity, recent updates, risk factors and health trend
are not in the design. They were kept below the weather section rather than removed.
