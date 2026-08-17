# Invitation pre-signup endpoints needed (read + decline)

The "Join the team" screen (`packages/frontend/src/pages/accept-invitation.tsx`)
lets a person who was invited to an org but has **no account yet** view the
invitation and either accept (by signing up) or decline it, without signing in
first. Two backend endpoints are needed for this and neither exists yet. This
doc specifies both.

---

## Correction to an earlier version of this doc

An earlier pass of this doc claimed `organization.get-invitation` (better-auth)
was already public because its `use: [...]` list only contains `orgMiddleware`,
not `orgSessionMiddleware`. **That was wrong** — confirmed by testing in
incognito, which got "Invitation not found" for a real, pending invitation.
The actual handler body (not the middleware list) does this:

```js
// node_modules/better-auth/dist/plugins/organization/routes/crud-invites.mjs:452-453
const session = await getSessionFromCtx(ctx);
if (!session) throw APIError.fromStatus("UNAUTHORIZED", { message: "Not authenticated" });
```

So `get-invitation` requires a session too — it just checks it manually inside
the handler instead of via the `orgSessionMiddleware` wrapper, which is why
scanning only the `use: [...]` array missed it. **Neither `get-invitation` nor
`reject-invitation` nor `accept-invitation` is reachable without an account.**
That means an invited person with no account can't view the invitation *or*
decline it today — both need new public endpoints.

---

## Endpoints to add

```
GET  /v2/invitations/:id          — read (no auth)
POST /v2/invitations/:id/decline  — decline (no auth)
```

Suggested location: a new `packages/backend/src/modules/invitations/` module
(routes + service + repository, per `writing-backend-code`), or added next to
the existing custom invitation logic that already bypasses better-auth's
gated endpoints in `packages/backend/src/lib/auth.ts` (see
`hasPendingInvitation` at line 106 and `acceptPendingInvitationsForEmail`
around line 116 — the existing precedent for writing straight to the
`invitation` table instead of going through the org plugin).

**Trust model**: neither endpoint requires a session — the invitation ID
itself is the credential (it only ever reaches someone via the email it was
sent to). This mirrors how invite links work elsewhere (Slack, GitHub, etc.);
knowing the opaque ID is the access grant, same as a password-reset token.

### `GET /v2/invitations/:id`

Look up the invitation by `id` in the `invitation` table
(`packages/backend/src/db/migrations/20260603_organization_schema.ts:34-49` —
columns: `id`, `organizationId`, `email`, `role`, `status`, `expiresAt`,
`inviterId`). Join `organization` for the name.

- Not found, expired, or `status !== "pending"` → 404
  `{ "error": "Invitation not found", "code": "invitation_not_found" }`.
- Otherwise → 200 with **only** the fields needed to render the screen —
  do not leak `inviterId` or other org members' info to an unauthenticated
  caller:
  ```json
  { "organizationName": "Shalom Construction Ltd.", "email": "invited@x.com", "role": "member", "status": "pending" }
  ```

`packages/frontend/src/api/invitations.ts` — `invitationsApi.getPublic(id)` —
expects exactly this shape (see `PublicInvitation` type in that file).

### `POST /v2/invitations/:id/decline`

No body needed.

1. Same lookup as above. Not found / not pending → 404, same shape.
2. Update `status` to `"rejected"` — **use this exact string**, not
   `"declined"` or `"cancelled"`. It matches what better-auth's own
   authenticated `reject-invitation` sets
   (`adapter.updateInvitation({ status: "rejected" })`), so both paths produce
   identical downstream state and the existing `isResolved` / "already been
   {invitation.status}" messaging in `accept-invitation.tsx` reads correctly
   either way.
3. Return `200`. `invitationsApi.declinePublic(id)` only checks for a 2xx
   status, doesn't parse a body.

---

## Rate limiting

Both are unauthenticated. Recommend the same treatment given the sensitive
unauthenticated `/api/auth/*` routes in `packages/backend/src/lib/auth.ts:216-225`
(`customRules` on `rateLimit`) — a modest per-IP window (e.g. 20/min for the
read, 10/min for decline) stops casual abuse without needing session state.

---

## Files to touch (summary)

| File | Change |
|---|---|
| `packages/backend/src/modules/invitations/routes.ts` (new) | `GET /v2/invitations/:id`, `POST /v2/invitations/:id/decline` — no `requireAuth()` on either |
| `packages/backend/src/modules/invitations/service.ts` (new) | Shared "find pending invitation or 404" logic; decline sets `status: "rejected"` |
| `packages/backend/src/modules/invitations/repository.ts` (new) | Knex read (joined with `organization` for the name) + update on the `invitation` table |
| `packages/backend/src/server.ts` | Register the new route module (see how `onboardingRoutes` is registered around line 212) |

Frontend side (already done, no action needed): `api/invitations.ts`,
`hooks/use-invitations.ts`, and `pages/accept-invitation.tsx`. The frontend
**always** reads the invitation through the public endpoint —
`usePublicInvitation` → `GET /v2/invitations/:id` — because the invited person
has no account yet (better-auth's `get-invitation` 401s without a session). No
signed-in/out branching on the read path. Authenticated better-auth mutations
(`useAcceptInvitation`/`useRejectInvitation`) are still used for accept/decline
once signed in.

Dev-only mock: while `GET /v2/invitations/:id` and
`POST /v2/invitations/:id/decline` are missing, `api/invitations.ts` short-
circuits those two calls in `import.meta.env.DEV` builds with fabricated data
so the "Join the team" screen renders locally. Remove the mock (the
`useMockPublicInvitation` flag and mock branches) once the backend ships.

---

## Why this blocks local testing today

Until `GET /v2/invitations/:id` exists, the "Join the team" screen cannot show
real invitation data to a signed-out visitor at all — it has nothing to call.
The frontend is wired to the right (future) contract and carries a dev-only
mock so it can be tested locally; without the real endpoint deployed there's
no way to see it working end-to-end against real invitation data.
