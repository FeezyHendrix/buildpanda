# Dashboard (project list) — backend notes

The redesigned dashboard (`pages/dashboard`) works against `GET /projects` as it is today. It
loads the whole list and does the rest in the browser, which is what the backend should take over.

## Done on the client today

- **Search** — matches project `name` and `address` (the box says "Search stages" in the design;
  it searches projects, so the placeholder should be confirmed).
- **Date range** — keeps projects whose `createdAt` day falls between From and To, inclusive.
  The design does not say which date it filters; creation date is the one that pairs with the
  "Date (Newest / Oldest First)" sort.
- **Sort** — Recently Updated (`updatedAt` desc), Name A–Z, Name Z–A, Date newest, Date oldest.
- **Pagination** — 12 per page over the filtered list. The design's "Showing 1 to 10 of 20" is
  sample copy.

## Recommended

Add to `GET /projects`: `q`, `createdFrom`, `createdTo`, `sort`
(`recent | name_asc | name_desc | newest | oldest`), `page`, `pageSize`, returning
`{ items, total }`. Until then a workspace with hundreds of projects ships them all on load.

## Views removed

The design drops the grid/list switch, so the list view and its toggle were removed from the page.
No backend change.
