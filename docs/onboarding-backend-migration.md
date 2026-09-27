# Onboarding — how completion is tracked

The backend owns onboarding completion. This document records the shipped design
and, more usefully, why the obvious alternatives were rejected. There is no
longer a `localStorage` strategy and there is no `isOnboarded` field on the user.

---

## The single source of truth

`organization.onboarding_completed_at` (nullable timestamp, migration
`20260793_onboarding.ts`), read over HTTP:

| Endpoint | Auth | Returns / does |
|---|---|---|
| `GET /v2/onboarding/status` | `requireAuth` + `requireOrgScope` | `OnboardingStatusResponse` — the org's stored answers, `completed`, and `canComplete` |
| `POST /v2/onboarding` | `requireAuth` + `requireOrgPermission("organization", "update")` | Renames the org, stores country/state/size/usage, sets `user.name`/`user.phone` — **one transaction** |

### Why the flag is org-scoped, not per-user

Onboarding is "set up the company", and every answer except the
representative's name and phone is company data. Scoping it to the organization
buys the invited-employee case for free: someone who accepts an invitation into
an already-onboarded workspace reads `completed: true` and is never asked to
re-enter their employer's details. A per-user flag would re-prompt every new
hire for the company's country and size.

There is one real gap this leaves: an invited employee's `user.name` stays the
`displayNameFromEmail` placeholder, because nothing in the invite path collects
it. That is deliberately **not** a routing gate — blocking an employee behind a
full-screen company wizard to capture a surname is worse than a settings-page
prompt, and a second boolean would be a second source of truth. If it is ever
wanted, derive it (`user.phone IS NULL`); do not store it.

### Why it is not carried on the session

Putting the flag on the better-auth session (computed in
`databaseHooks.session.create.before` next to `activeOrganizationId`, surfaced
via `inferAdditionalFields`) was rejected on two counts. `session.cookieCache`
has `maxAge: 300`, so the value would be stale for up to five minutes at exactly
the moment it flips. Worse, the flag is org-scoped and the active org changes
mid-session via `authClient.organization.setActive`, so a value baked in at
session creation would be wrong after every org switch, with no refresh hook at
all. A React Query fetch keyed by org has neither problem.

---

## `canComplete`, and the lock-out it prevents

Only `owner` and `admin` carry `organization:update`; `member`, `viewer` and
`employee` do not. So a plain member of a workspace whose onboarding is
incomplete cannot submit the wizard. Without `canComplete` the guard would send
them to `/onboarding`, the POST would 403, and they would be stuck outside the
app with no route forward.

`GET /v2/onboarding/status` therefore reports whether **this caller** may submit,
and the guard treats "not completed" as actionable only when it is also
submittable.

> `canComplete` must stay listed in the route's `response` schema. Fastify strips
> properties absent from it, so dropping it there silently turns the field into
> `undefined` and every onboarding check degrades to "not required".

Pair this with the backfill: `20260796_backfill_onboarding_completed.ts` stamps
`onboarding_completed_at = createdAt` for organizations that predate the wizard.
Without it every existing workspace read as un-onboarded the moment the guard
shipped, locking out every non-owner member.

---

## Frontend contract

`packages/frontend/src/lib/route-guards.tsx` holds one predicate, and everything
routes through it:

```ts
function wizardRequired(status: OnboardingStatus | null | undefined): boolean {
  return Boolean(status && !status.completed && status.canComplete);
}
```

**It fails open on purpose.** Loading, errored, disabled, or a role that cannot
submit all yield `false`. Bouncing a user into a wizard whose POST would also
fail is strictly worse than letting them through, so only a *successful* status
response saying `completed: false` ever opens the wizard.

| Consumer | Uses |
|---|---|
| `RequireOnboarding` (`/onboarding`) | `needsOnboarding(...)`; exits with `homePathFor(accountType, false)` — hardcoded so the exit can never point back at `/onboarding` |
| `RequireCompany` (company routes) | `needsOnboarding(...)` **after** the `project_owner` check; this is what stops the wizard being skipped by deep-linking to `/dashboard` |
| `HomeRedirect` (`/`) | pending invites first, then `needsOnboarding(...)` |
| `sign-in.tsx`, `verify-email.tsx` | `resolveHomePath(accountType)` — the async pre-navigation equivalent, sharing `wizardRequired` so they cannot disagree with the guard |

Two ordering rules are load-bearing:

1. **Check `!signedIn` before the status query's `isPending`.** The query is
   `enabled: Boolean(orgId)`, and a disabled React Query reports `isPending`
   forever — testing it first leaves every signed-out visitor on a permanent
   loader.
2. **`onboardingKeys.status` is keyed by org id.** A bare key serves the previous
   org's answer after a switch, which is enough to open the wizard against the
   wrong company and rename it.

`useCompleteOnboarding` writes the mutation response straight into the cache with
`setQueryData` rather than only invalidating; an invalidate leaves a window in
which the guard on `/dashboard` still reads `completed: false` and bounces the
user back into the wizard they just finished.

---

## Things deliberately not done

- `POST /v2/onboarding` returns **idempotent success** when the org is already
  onboarded, rather than a 409. The only realistic re-submit is a retry after a
  lost response, and this also stops the endpoint doubling as a permanent
  "rename my company" vector. Later edits belong in `org-profile`.
- `RequireAuth` does **not** enforce onboarding. It wraps routes that project
  owners and project participants use, so a company-setup gate there would trap
  them.
