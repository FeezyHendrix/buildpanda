# Messaging — `profession` is missing from the channel members response

**Status: the backend does not return it. Please confirm against the design before changing it.**

## What the design needs

In a **direct message**, the chat header shows the other person's avatar and name, with their
**profession** underneath (architect, site engineer, QS …). The frontend reads it in
`packages/frontend/src/pages/project/chat/dm-header-title.tsx` as `other.profession`
(`ChannelMemberLite.profession?: string | null` in `lib/project-types.ts`). When it is missing the
header simply shows the name alone, so nothing breaks — the line just never appears.

## What the backend returns today

`GET /channels/:id/members` (`modules/messaging/routes.ts`) → `service.listMembers`:

```ts
// service.ts
return rows.map((m) => ({ id: m.user_id, name: m.name, email: m.email, role: m.role }));
```

and `repository.listMembers` only selects `cm.*`, `u.name`, `u.email`. There is no `profession`
in either layer, so it never reaches the client.

## What to change

`profession` already exists on the user (`user.profession`, migration `20260606_user_account_type`,
seeded in `db/seeds/20260100_demo_identity.ts`, declared in `lib/auth.ts`).

1. `repository.listMembers`: also select `u.profession as profession` and widen the row type.
2. `service.listMembers`: return `profession: m.profession ?? null`.
3. If direct-message channels are listed with their members elsewhere (the channel list payload),
   include the same field there, so the header does not depend on a second request.

## Check against the design

Please compare with the design before shipping: the profession line sits **below the name** in
the DM header only (not group channels), in small grey text, and is absent when the user has not
set one. Do not send a placeholder such as "Member" in its place.

Note: `pnpm dev` talks to the staging backend, so the line will not appear locally until this is
deployed to `master`.
