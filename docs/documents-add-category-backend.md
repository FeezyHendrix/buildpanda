# Documents — Add Category Backend Changes

> Required to support the new Figma: **Add Category** panel inside the **Upload Document** drawer (`+ Add Category` link → inline "Go Back" form, same pattern as Build Stages' **Add Building Phase** — see `docs/build-stages-phases-backend.md`).

## 1. Summary

`document_categories` currently has **no create endpoint** and **no `project_id` column** — it's a small, effectively global, hand-seeded lookup table (`id, name, tone`, plus `group` added in a later migration). The new design lets a project member add a category on the fly while uploading a document, so categories need to become writable and project-scoped.

Frontend currently mocks this: newly "added" categories exist only in local component state (`documents.tsx`), are never persisted, and reset on reload. Selecting a mock category and uploading will fail against the real API (`categoryId not found`) until this ships.

## 2. Schema

### 2.1 Alter `document_categories`

```sql
alter table document_categories add column project_id text references projects(id) on delete cascade;
alter table document_categories add column group text not null default 'document'; -- already exists per 20260608 migration, confirm present
alter table document_categories add column created_by text references users(id);
alter table document_categories add column created_at timestamptz not null default now();

-- existing rows (seeded defaults) keep project_id = null → treated as global/shared categories
create index on document_categories(project_id, group);
```

`project_id` nullable: `null` = global default category (visible to every project, current seeded rows like "Contracts & Agreements", "Government Approvals", etc.), non-null = project-specific category added via **+ Add Category**. Mirrors the `building_phases` global-vs-project pattern used for stages.

### 2.2 No change to `project_documents`

`category_id` FK is already in place and unaffected.

## 3. Backfill

No backfill needed — existing rows simply get `project_id = null` (default), preserving current "shared categories" behavior for every project.

## 4. API — new / updated

### `GET /projects/:projectId/documents/categories` (existing, update query)
Return categories where `project_id is null or project_id = :projectId`, ordered global-first then by `created_at`. Keep current `fileCount`/`totalSize` aggregation (already join to `project_documents` by category + project).

### `POST /projects/:projectId/documents/categories` `{ name, group }` (new)
- Body: `{ name: string (1–60 chars, trimmed), group: "document" | "plan" }`.
- Creates a `document_categories` row with `project_id = :projectId`, `tone = "brand"` (default; no tone picker in the Figma).
- Returns the created `DocumentCategory` (same shape as the list endpoint, `fileCount: 0`, `totalSize: "0 MB"`).
- Validation: `name` unique per `(project_id, group)` — case-insensitive compare recommended (matches likely user expectation when re-typing "legal" vs "Legal").
- Used by the **Add Category** panel (`+ Add Category` link inside **Upload Document**).

### Optional (not required for v1, flag for product)
- `PATCH` / `DELETE` for project-scoped categories — Figma doesn't show edit/delete for categories yet, so skip unless requested.

## 5. Permissions

Reuse existing `documents:upload` gate (`canResourceAction(access, "documents", "upload")`) for `POST /documents/categories` — same permission that already gates the Upload Document drawer this feature lives inside. No new RBAC entry needed.

## 6. Frontend TODO once API lands

- `api/documents.ts` → add `createCategory(projectId, { name, group })`.
- `hooks/use-documents.ts` → add `useCreateDocumentCategory()` mutation, invalidate `documentKeys.categories(projectId)` on success.
- `pages/project/documents.tsx` → replace `localCategories` mock state + `handleCreateCategory` with the real mutation; `onCreateCategory` prop passed to `UploadDocumentDialog` should call the mutation and resolve the created category's real `id` (mutation likely needs to become async/awaited rather than returning a string synchronously — update `UploadDocumentDialogProps.onCreateCategory` signature to `(name: string) => Promise<string>` or handle success via callback).
- `components/molecules/upload-document-dialog.tsx` → wire the **Add Category** panel's "Save" button to the async mutation (loading state on the stacked "Save" button while pending, surface API validation errors e.g. duplicate name).

## 7. Testing

- Migration up/down.
- `POST /documents/categories` authz (`documents:upload` only) and validation (name length, duplicate name per project+group → 409 or 400).
- `GET /documents/categories` returns global (`project_id null`) categories for every project plus that project's own.
- Document upload with a newly created category's real id succeeds end-to-end.
- Two projects both adding a category named "Legal" don't collide (scoped by `project_id`).

## 8. Rollout

1. Deploy migration (nullable `project_id`, existing rows unaffected — no code change required yet).
2. Deploy backend with `POST /documents/categories` + updated `GET` filter.
3. Deploy frontend wiring (`useCreateDocumentCategory`, remove `localCategories` mock).
