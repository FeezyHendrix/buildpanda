# Dashboard (project list) — backend notes

The redesigned dashboard (`pages/dashboard`) asks `GET /projects` to search, filter, sort and
page. Nothing is filtered in the browser.

## Query parameters

- `q` matches project `name` and `address`, case-insensitive (the box says "Search stages" in the
  design; it searches projects, so the placeholder should be confirmed).
- `createdFrom`, `createdTo` (`yyyy-mm-dd`) keep projects whose `createdAt` day falls between
  them, inclusive, in the server time zone. The design does not say which date it filters;
  creation date is the one that pairs with the "Date (Newest / Oldest First)" sort.
- `sort` is one of `recent` (`updatedAt` desc, the default), `name_asc`, `name_desc`, `newest`,
  `oldest`. Ties are broken by `id` so pages never repeat or drop a project.
- `page`, `pageSize` (max 100). The dashboard uses 12 per page; the design's "Showing 1 to 10 of
  20" is sample copy.

With any parameter the response is `{ items, total, page, pageSize }`. With none it is still the
plain array, which the other callers of the list rely on.

## Views removed

The design drops the grid/list switch, so the list view and its toggle were removed from the page.
No backend change.
