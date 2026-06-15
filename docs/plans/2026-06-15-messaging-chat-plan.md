# Messaging & Chat — Implementation Plan

**Status:** Draft for review
**Date:** 2026-06-15
**Scope:** Slack/Teams-style messaging inside BuildPanda — channels, DMs, @mentions of anyone, references/tags to *any* system entity, in-app notifications, and the edge cases that make it feel great.

---

## 1. Product decisions (locked)

| Decision | Choice |
|---|---|
| Realtime transport | **WebSockets + Redis pub/sub** (full duplex; enables typing, presence, read receipts). Fanout across the Node cluster forks via Redis. |
| Channel scoping | **Per-project channels** (each project auto-gets `#general`) **+ org-wide company channels** **+ DMs / group DMs**. |
| Who can chat | **Company staff AND external participants** (client / architect / inspector / guest). "Tag everybody" = anyone with access to that channel/project. |
| Reference unfurl policy | **Permission-aware**: a reader who can see the entity gets a rich card; a reader who cannot gets a neutral "Restricted item" chip — no leaked details. |

---

## 2. What already exists (build on, don't reinvent)

Grounded in the current codebase:

- **Notifications** — `packages/backend/src/modules/notifications/` (`types.ts` `NOTIFICATION_TYPES` + groups, `service.ts` `notify(userId, type, {title, body, projectId})`, `repository.ts`, `routes.ts` list/mark-read/preferences). Tables: `notifications(id,user_id,type,title,body,project_id,read_at,created_at)` + `notification_preferences(user_id,type,in_app_enabled,email_enabled)`. Frontend bell + `hooks/use-notifications.ts` (already polls via `refetchInterval`). **Messaging notifications slot in as new types + a per-channel mute layer.**
- **Rich text + mentions prior art** — the RFI response drawer uses a **Tiptap** editor (`components/molecules/rich-text-editor.tsx`: `StarterKit + extension-image + extension-placeholder`) plus a separate **reference picker** control (`components/molecules/rfi-detail-dialog.tsx` → `ReferencePicker`) that inserts entity references; references are stored as a JSON column; images upload via the **S3 presign** flow. **Note:** `@tiptap/extension-mention` + `@tiptap/suggestion` are **already installed** as dependencies but **not yet wired** into the editor — the chat composer adds the `@`-mention extension on top of this base. Reuse the editor + the reference-picker pattern for the chat composer.
- **People / taggable users** — `GET /projects/:id/participants` (now includes the project/org **owner**) + `useParticipants`; org members via `member` table / `use-organization`. A user = `{ id, name, email }` (avatar by initials via `Avatar`).
- **Auth context** — `request.orgRoles` (org→role map) + `request.projectRoles` (project→participant-role map) populated per request in `plugins/auth-context.ts`; `requireProjectAccess` / `requireProjectWrite` / `requireProjectPermission`. Public routes are allowlisted by regex. **This is exactly the per-reader access oracle the permission-aware unfurl needs.**
- **Redis + jobs + cluster** — `lib/queue/index.ts` `QueueManager` wraps BullMQ over a single IORedis connection (or inline fallback). Backend runs in **Node cluster mode** (`src/cluster.ts`): N HTTP forks, exactly one worker-fork. **A WebSocket server lives in every fork → cross-fork delivery REQUIRES Redis pub/sub.**
- **Module conventions** — backend: `types.ts` / `repository.ts` / `service.ts` / `routes.ts`, inline `as const` JSON schemas, factory + DI, registered in `server.ts`. Frontend: `pages/` + `hooks/` + `query-keys.ts` factory + dialogs. Canonical slice to copy: `modules/queries/` (backend), `pages/project/action-items.tsx` (frontend).
- **No realtime transport exists today** — this is net-new.

---

## 3. Architecture

### 3.1 Transport (WebSockets + Redis pub/sub)

```
client  ──WS──►  fork A  ──┐
client  ──WS──►  fork B  ──┼──►  Redis pub/sub channel "msg:<channelId>"
client  ──WS──►  fork C  ──┘        every fork SUBSCRIBES; on publish,
                                    each fork pushes to its own local sockets
```

- Add `@fastify/websocket`. One WS endpoint `GET /ws` (auth via the existing session cookie on the upgrade request — reuse `auth-context` to resolve `request.user`; reject unauth upgrades).
- A `RealtimeHub` (`lib/realtime/index.ts`): owns local socket registry keyed by `userId`, **two dedicated IORedis connections** (one `publisher`, one `subscriber` — BullMQ's connection cannot be shared for pub/sub). Reuse `config.redis.url`; **inline/no-redis mode falls back to in-process delivery only** (single fork), mirroring `QueueManager`'s dual-mode.
- Server emits domain events (`message.created`, `message.updated`, `message.deleted`, `reaction.changed`, `typing`, `presence`, `read.updated`, `channel.updated`, `unread.changed`) by `publish("rt:<scope>", payload)`; the hub relays to relevant local sockets.
- **Subscription model:** client subscribes to the channels it's a member of + its own user-scope (for DMs, mentions, unread). Server authorizes every subscribe against `projectRoles`/`orgRoles`/channel membership.
- **Graceful degradation:** the same data is always reachable via REST + React Query; WS is an accelerator. If the socket drops, the client polls (existing pattern) and reconnects with backoff. This guarantees correctness even if realtime hiccups.

### 3.2 Sends are REST, deltas are WS

POST a message over normal HTTP (validated, persisted, returns the row) → server publishes `message.created` to Redis → all forks push to subscribers. This keeps writes simple/idempotent and avoids WS-only write paths.

### 3.3 Data model (new migration `YYYYMMDD_messaging.ts`)

```
channels
  id, type ('project' | 'org' | 'dm' | 'group_dm'), name (null for dm),
  project_id (nullable FK projects ON DELETE CASCADE),
  organization_id (nullable),
  is_private boolean, topic text null, archived_at timestamptz null,
  created_by_id, created_at, updated_at
  CHECK: project channels have project_id; org channels have organization_id; dm/group_dm have neither

channel_members
  id, channel_id FK ON DELETE CASCADE, user_id FK ON DELETE CASCADE,
  role ('admin' | 'member'),
  last_read_message_id null, last_read_at null,
  muted boolean default false, notify_level ('all' | 'mentions' | 'none') default 'all',
  added_by_id, created_at
  UNIQUE(channel_id, user_id)

messages
  id, channel_id FK ON DELETE CASCADE, author_id FK user ON DELETE SET NULL,
  body text, content_html text null,           -- Tiptap doc (sanitized) + plaintext for search
  parent_message_id null (threads),
  references jsonb default '[]',                -- [{ type, id, label }]  (entity refs)
  mentions jsonb default '[]',                  -- [{ kind:'user'|'here'|'channel', userId? }]
  attachments jsonb default '[]',               -- [{ fileId, url, name, mime, size }]
  edited_at null, deleted_at null,              -- soft delete (audit + "message deleted" tombstone)
  created_at
  INDEX(channel_id, created_at), INDEX(parent_message_id)

message_reactions
  id, message_id FK ON DELETE CASCADE, user_id, emoji,
  UNIQUE(message_id, user_id, emoji)

message_reads            -- optional richer read receipts (group DMs / channels)
  channel_id, user_id, last_read_message_id, updated_at   (or fold into channel_members)

pinned_messages
  id, channel_id, message_id, pinned_by_id, created_at
```

- **Plaintext for search**: store a `body` plaintext alongside `content_html`; add a Postgres `tsvector` GIN index later (Phase 4 search). Follows how RFI stores both.
- **References** mirror the RFI `references` JSON shape exactly so the existing reference picker + render components are reused.

### 3.4 Backend module (`modules/messaging/`)

Standard 3-layer slice (copy `modules/queries/` shape):
- `types.ts` — `Channel`, `ChannelRow`, `Message`, `MessageRow`, enums (`CHANNEL_TYPES`, `NOTIFY_LEVELS`) as `const`.
- `repository.ts` — channel CRUD, membership, paginated message reads (keyset by `created_at,id`), reactions, reads, pins, unread counts.
- `service.ts` — business rules: membership/authorization, mention parsing, reference validation, notification fan-out (via `notificationsService`), realtime publish (via `RealtimeHub`), entity→channel back-links.
- `routes.ts` — REST endpoints (below), inline `as const` schemas, registered in `server.ts`.

### 3.5 Permission-aware unfurl (the security core)

Two-stage:
1. **At send:** server stores references as opaque `{type,id,label}` (label is the title at send-time, but DO NOT trust it for display).
2. **At read (per request, per reader):** an **unfurl resolver** takes the message's references and the **current reader's** `AccessContext` and, for each ref, calls the owning module's service "can this user read X?" → returns either a card DTO (`{title, status, url, icon}`) or `{ restricted: true }`. The client renders a redacted chip for restricted refs.
   - Built as a small registry: `referenceResolvers[type] = async (id, ctx) => Card | Restricted`. Each entity module contributes a resolver that reuses its existing access check (e.g. RFI uses `requireProjectAccess` logic; documents check project membership).
   - **Never** send entity details to a reader who fails the check — the redaction happens server-side, not in the client.
   - Same principle for **@mentions of users not in the channel** and **cross-project references**.

---

## 4. API surface (REST)

```
# Channels
GET    /channels                         list my channels (project + org + dm), with unread counts
POST   /channels                         create (project/org/private/group_dm)
GET    /channels/:id                     channel detail + my membership
PATCH  /channels/:id                     rename/topic/archive (admin)
POST   /channels/:id/members             add members (authorized against project/org access)
DELETE /channels/:id/members/:userId     remove member
PATCH  /channels/:id/members/me          mute / notify_level / mark-read
POST   /channels/dm                      open-or-get a 1:1 DM with a user
GET    /projects/:id/channels            channels for a project (auto #general)

# Messages
GET    /channels/:id/messages            keyset pagination (before/after cursor), unfurls resolved per-reader
POST   /channels/:id/messages            send (body, content_html, references, mentions, attachments, parent_message_id)
PATCH  /messages/:id                     edit (author, within window) -> edited_at
DELETE /messages/:id                     soft delete -> tombstone
GET    /messages/:id                     permalink fetch (+ context)
POST   /messages/:id/reactions           toggle emoji
POST   /channels/:id/pins / DELETE       pin/unpin
GET    /channels/:id/thread/:rootId      thread messages

# Discovery / people / refs
GET    /channels/:id/members             taggable people for this channel (+ @here/@channel)
GET    /references/search?q=&types=      typeahead over referenceable entities the CALLER can see
GET    /search/messages?q=&channelId=    message search (Phase 4)

# Realtime
GET    /ws                               websocket upgrade (cookie auth)
```

All routes: `additionalProperties:false` schemas, `requireAuth`, channel-membership checks; IDOR-safe (every `:id` re-checked against the caller's access, never trust client-supplied scope).

---

## 5. Frontend

- **Feature slice:** `pages/messaging/` (a `/messages` workspace) + an in-project `Chat` tab (`/project/:id/chat` scoped to that project's channels). Hooks `hooks/use-channels.ts`, `hooks/use-messages.ts`, `query-keys.ts` `channelKeys`/`messageKeys`. Lazy-routed in `App.tsx`.
- **Realtime client:** a single `RealtimeProvider` (context) owning the WS connection, reconnect/backoff, and a dispatch that **writes into the React Query cache** (`setQueryData`) on `message.created` etc. — so the UI is React-Query-first and WS just patches the cache. Falls back to `refetchInterval` when disconnected.
- **Composer:** reuse `rich-text-editor.tsx` (Tiptap) — add a **user mention** suggestion (`@`) sourced from `/channels/:id/members`, and an **entity reference** suggestion (`#` or a "+ Reference" button) sourced from `/references/search` (reuse the RFI `ReferencePicker`). Image/file via the existing S3 presign upload.
- **Message list:** virtualized/infinite scroll (keyset), day separators, grouped consecutive messages, jump-to-unread divider, hover actions (react / reply-in-thread / pin / edit / delete / copy-link / **"Create action item / RFI from message"**).
- **Unfurl rendering:** a `<ReferenceCard>` that renders the resolver DTO, or a muted "Restricted item" chip when `restricted`.
- **Sidebar:** channel list grouped (Project channels, Company channels, Direct messages) with unread badges + mute state; "+ New channel / New message".
- **Mentions/avatars:** reuse `Avatar`. `@here`/`@channel` rendered distinctly.

---

## 6. Notifications integration

- **New `NOTIFICATION_TYPES`:** `chat_mention`, `chat_dm`, `chat_channel_message` (respect per-channel `notify_level`), `chat_thread_reply`, `chat_reaction` (optional, default off).
- **Fan-out rules (in `messaging.service`):**
  - Direct `@user` → `chat_mention` to that user (unless self, unless channel muted to `none`).
  - DM message → `chat_dm` to the other member(s).
  - Channel message → `chat_channel_message` only to members whose `notify_level = 'all'` and who are **offline** (presence check via hub) — online members get the live WS push instead, no bell spam.
  - Thread reply → `chat_thread_reply` to thread participants + root author.
  - **Referenced-entity watchers:** when a message references an entity, notify that entity's owner/assignee/ball-in-court (e.g. referencing an RFI pings its ball-in-court) — **only if they have access** — type `chat_mention` with entity context. (Very on-brand: connects chat to the work.)
- **Respect `notification_preferences`** (in_app/email per type) — already enforced by `notificationsService`.
- **Email fallback** (Phase 3): if a mentioned/DM'd user is offline and hasn't read within N minutes (BullMQ delayed job), send an email digest of missed mentions. Reuse the mail + queue infra.
- **Unread + badges:** per-channel unread counts (cheap: `messages.created_at > member.last_read_at`), a global unread badge on the Messages nav, and the bell for mentions/DMs. WS `unread.changed` keeps counts live; `mark-read` clears.

---

## 7. Edge cases that make it great (the "what else" the user asked for)

**Permissions / security (highest priority, per-project-participant model):**
- Permission-aware unfurls (redacted chip) — §3.5.
- Referencing an entity in a channel whose members can't all see it → each reader sees their own access-resolved view; no leak.
- **Mid-conversation access revocation:** when a participant is revoked from a project, remove them from that project's channels (or block new fetches) and stop their WS subscription; past messages they already received are not retroactively scrubbed, but they lose forward access. Define this explicitly.
- **@channel/@here blast control:** large channels (esp. with external clients) — confirm-dialog above a member threshold; respect mute.
- IDOR everywhere: channel/message ids re-checked against the caller's membership; DM endpoints verify both parties.
- Private channels invisible in discovery to non-members.
- Sanitize `content_html` server-side (Tiptap → allowlist) to prevent stored XSS in a multi-tenant chat.

**Delivery / realtime correctness:**
- Cross-fork fanout via Redis pub/sub (cluster mode) — §3.1.
- Optimistic send with a client temp-id, reconciled when the persisted row arrives (dedupe by temp-id).
- Strict ordering (server `created_at` + tiebreak `id`); client sorts on insert.
- Reconnect with backoff; on reconnect, fetch "messages since last seen" (catch-up), not a full reload.
- Duplicate-suppression if a message arrives via both WS and a refetch.
- Typing indicators (ephemeral, WS-only, debounced, never persisted).
- Presence/online status (WS heartbeat; "active/away"); drives the offline-notification rule.
- Read receipts (DMs + small group DMs; opt-out friendly).
- Backpressure: cap message size, attachment count/size (reuse `config.uploads.maxFileBytes`), rate-limit sends.

**Productivity / "great experience":**
- **Forward a message → create an action item / RFI / query** (turn chat into tracked work) — flagship construction-PM feature; reuse existing create services + stamp a back-reference.
- **Entity → conversation back-link:** an RFI/activity/etc. shows "Discussed in #channel" when referenced (reverse index over `messages.references`).
- Message **permalink** (deep link that scrolls to + highlights a message, with access check).
- **Search** across messages (tsvector) + jump to referenced entities; scoped to channels the caller can see.
- Pinned messages per channel; channel topic/description.
- Reactions (emoji), quote-reply, threads, drafts (local), edit window + "edited" marker, soft-delete tombstone.
- Jump-to-unread, unread divider, "N new messages" pill, mark-channel-read, mark-all-read.
- Slash commands later (`/giphy` no; `/rfi`, `/task`, `/poll` maybe) — keep extensible but out of MVP.
- Mobile/responsive + keyboard shortcuts (Slack-like) — polish phase.
- Accessibility: focus management, screen-reader-friendly message list, ARIA live region for new messages.
- i18n-ready strings; timezone-aware timestamps (app already has formatters).
- Empty states, loading skeletons, error/retry on send.

**Data lifecycle:**
- Soft-delete + audit (who/when); optional retention policy per org (Phase 5).
- Channel archive (not delete) to preserve history.
- Cascade rules tied to project deletion (project channels CASCADE; DMs persist).

---

## 8. Phasing (incremental, each phase shippable)

Each phase lists deliverables **and an executable QA scenario** (tool + concrete steps + expected result). "Two users" = two authenticated browser sessions (e.g. `qa-company@buildpanda.test` as staff + a second account added as a project participant). Backend live checks run against a running server; cluster checks run the built server with `CLUSTER_WORKERS=3 REDIS_URL=redis://localhost:6379`.

**Phase 0 — Foundation (no realtime yet)**
- Migration (channels, channel_members, messages, reactions, pins).
- `modules/messaging` backend (channels + messages REST, membership/authz, keyset pagination).
- Auto-create `#general` per project; `/projects/:id/channels`.
- Frontend: in-project Chat tab, channel list, message list (polling via `refetchInterval`), basic composer (plain + @mention of project participants), send/edit/delete.
- Notifications: `chat_mention`, `chat_dm` types + bell integration.
- **QA scenario** — *Tool: migration rollback/re-apply + authenticated `curl` + Playwright (two users).*
  1. `pnpm --filter @buildpanda/backend db:migrate` then `db:rollback` then `db:migrate` again → migration up/down both succeed, no errors.
  2. As staff, `curl` `GET /projects/:id/channels` → returns an auto-created `#general` (HTTP 200, one channel).
  3. Playwright: user A opens the project Chat tab, sends "hello @UserB"; user B (participant on the same project) refreshes within the poll interval → sees the message; user B's bell shows a `chat_mention`.
  4. user A edits then deletes the message → user B sees "edited" then the tombstone after refetch.
  - **Expected:** message visible to both, mention notification reaches only user B (not user A), edit/delete reflected, migration reversible. tsc + build green both packages.

**Phase 1 — Realtime**
- `@fastify/websocket` + `RealtimeHub` + Redis pub/sub (cluster-safe) + inline fallback.
- `RealtimeProvider` on the client patching React Query cache; reconnect/backoff/catch-up.
- Live `message.created/updated/deleted`, unread counts, optimistic send.
- **QA scenario** — *Tool: built clustered server + a 2-socket Node/`wscat` script (or Playwright two-tab) + log assertions.*
  1. Build backend, run `CLUSTER_WORKERS=3 REDIS_URL=redis://localhost:6379 node dist/cluster.js`; confirm 3 forks (per the clustering plan's check).
  2. Open two WS clients that (the load balancer permitting) land on **different forks**; client A sends a message via `POST /channels/:id/messages`.
  3. **Expected:** client B receives `message.created` over WS within ~200ms (proving Redis pub/sub crosses forks); the message is NOT delivered twice; unread count for B increments live, then clears on `mark-read`.
  4. Kill client B's socket, send 2 messages, reconnect B → B receives a catch-up (messages-since-last-seen), not a full reload, and no duplicates.
  5. Mark B "online" then send a plain channel message → B gets the live WS push and **no** bell notification; mark B offline and repeat → B gets a bell notification (no double-notify when online).

**Phase 2 — References & permission-aware unfurls**
- `references` on messages; reference picker in composer (reuse RFI picker); `/references/search` (caller-scoped).
- Unfurl resolver registry + per-reader redaction; `<ReferenceCard>` / restricted chip.
- Entity→conversation back-link; referenced-entity watcher notifications.
- DMs + group DMs; org-wide company channels; private channels.
- **QA scenario** — *Tool: authenticated `curl` as two roles (staff + restricted client) + Playwright + a security assertion on the raw response.*
  1. Staff references an RFI the client cannot access in a mixed channel.
  2. `curl GET /channels/:id/messages` **as the client** → the reference is `{ restricted: true }` and the response body contains **no** RFI title/status/url (assert the secret string is absent from the payload — server-side redaction, not just hidden in UI).
  3. `curl` the same endpoint **as staff** → the reference resolves to a full card (title/status/url).
  4. Playwright: client sees a muted "Restricted item" chip; staff sees the card and clicking navigates to the RFI.
  5. `/references/search?q=` as the client never returns entities the client cannot see (IDOR check).
  - **Expected:** zero leakage of restricted entity data to the client in the JSON payload; back-link appears on the RFI for users who can see the channel.

**Phase 3 — Rich experience**
- Reactions, threads, pins, attachments/images (S3 presign), drafts, typing indicators, presence, read receipts.
- Per-channel mute / `notify_level`; @here/@channel with confirm; email-fallback digest job.
- **Forward message → create action item / RFI / query.**
- **QA scenario** — *Tool: Playwright (two users) + `curl` + a queue/email-capture check.*
  1. User A reacts 👍 to a message → user B sees the reaction count update live (WS); toggling removes it (unique constraint holds — no duplicate reactions for the same user/emoji).
  2. User A replies in a thread → only thread participants + root author get `chat_thread_reply`; the channel root shows a reply count.
  3. User A pins a message → it appears in the channel's pinned list for user B; unpin removes it.
  4. User A uploads an image (S3 presign) → renders inline for user B; oversized file is rejected (`config.uploads.maxFileBytes`).
  5. User B mutes the channel (`notify_level=none`) → a subsequent non-mention message produces **no** bell for B; a direct `@B` still notifies (mention overrides channel mute unless `none` explicitly chosen — confirm the chosen rule).
  6. With user B offline >10 min after a mention, assert an email-fallback job is enqueued (inspect the queue / captured email).
  7. "Forward → Create action item" on a message → an action item is created with a back-reference to the message; verify via `GET /projects/:id/action-items`.
  - **Expected:** each interaction propagates live to the second user; notification rules respected; forwarded item created and linked.

**Phase 4 — Search & polish**
- Message search (tsvector GIN), permalinks, jump-to-unread, keyboard shortcuts, mobile/responsive, a11y, empty/loading/error states.
- **QA scenario** — *Tool: `curl` + Playwright + a11y check.*
  1. Seed messages containing a unique token; `curl GET /search/messages?q=<token>` **as a member** returns the message; **as a non-member** of that channel returns nothing (scoped search, no leak).
  2. Open a message **permalink** as a member → the list scrolls to and highlights the message; as a non-member → access denied (not 200 with content).
  3. Playwright: scroll up triggers keyset pagination (older messages load, no dupes, order preserved); the "jump to unread" pill scrolls to the unread divider.
  4. Run an a11y pass (axe/Playwright) on the chat view → no critical violations; the new-message region is an ARIA live region; keyboard navigation reaches the composer and messages.
  - **Expected:** search is correct and access-scoped, permalinks are access-checked, pagination is stable, no critical a11y violations.

**Phase 5 — Lifecycle & admin**
- Retention policy, channel archive, audit, admin moderation, org-level chat settings.
- **QA scenario** — *Tool: `curl` as admin + non-admin + DB assertion.*
  1. Channel admin archives a channel → it moves to an "Archived" group, becomes read-only (POST message returns 4xx), history remains readable; non-admin cannot archive (403).
  2. Admin deletes another user's message → soft-deleted tombstone (audit row records who/when in DB); non-admin cannot delete others' messages (403).
  3. Set an org retention policy of N days and run the retention job → messages older than N days are soft-deleted/purged per policy; newer messages remain (assert via DB counts).
  4. **Access revocation:** revoke a participant from the project → they are removed from that project's channels and a subsequent `GET /channels/:id/messages` for them returns 403; staff still see the channel.
  - **Expected:** archive/delete/retention/revocation behave per policy with correct authorization and an audit trail.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Realtime fanout broken under cluster mode | Redis pub/sub from day one of Phase 1; inline fallback only for single-fork dev; explicit multi-fork live test in the phase's acceptance. |
| Data leak via unfurl/mention to a participant without entity access | Per-reader server-side resolver + redaction; never trust client; covered by a security test in Phase 2. |
| Bell spam from busy channels | Notify only offline members for plain channel messages; per-channel `notify_level`; mute. |
| WS auth on upgrade | Reuse cookie/session via `auth-context`; reject unauth upgrades; re-authorize every subscribe. |
| Stored XSS in multi-tenant chat | Server-side sanitize `content_html` (Tiptap allowlist) before persist. |
| Scope creep (this is large) | Strict phasing; Phase 0 ships value (channels + mentions) without realtime. |
| Message ordering / dupes with optimistic send + WS + polling | Server-authoritative ordering, temp-id reconciliation, dedupe on insert. |

---

## 10. Open questions for product (non-blocking; can default)

1. External participants in **org-wide** company channels — allowed, or company-only? (Default: org channels are company-only; clients only in project channels + DMs.)
2. Can clients **start** DMs with anyone, or only with staff on their project? (Default: only with staff on a shared project.)
3. Edit/delete window length + whether admins can delete others' messages. (Default: author edits anytime with "edited" marker; channel admins can delete; soft-delete always.)
4. Retention/compliance requirements per org. (Default: keep indefinitely + soft-delete; revisit Phase 5.)
5. Email-fallback timing (minutes offline before email). (Default: 10 min.)

---

## 11. Definition of done (per phase)

Each phase: backend tsc + build green, frontend tsc + build green, **live multi-fork verification** for any realtime/notification behavior (not just unit checks), permission/leak tests for Phase 2, and the feature exercised by a real user flow (two accounts) before sign-off. No realtime feature is "done" on "should work" — it must be demonstrated across forks.
