import type { Knex } from "knex";

const PROJECT_ID = "sample-project";

// Every row this seed writes carries this prefix so a re-run deletes exactly
// its own data and never touches a real conversation or a real notification.
const OWNED = "seed_chat_";

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function isoDaysAgo(days: number): string {
  return isoHoursAgo(days * 24);
}

// Chat renders an author's name by joining `messages.author_id` to `user`, and
// `channel_members.user_id` is a hard FK — the free-text "seed-pm" actor ids the
// rest of the sample data uses cannot carry a conversation. These three are
// name-only rows: no `account`, no `member`, so they cannot sign in and stay out
// of org mention pickers.
const CAST = [
  { id: `${OWNED}pm`, name: "Chidi Nwosu", email: "chidi.nwosu@sample.buildpanda.demo" },
  { id: `${OWNED}eng`, name: "Engr. David Okonjo", email: "david.okonjo@sample.buildpanda.demo" },
  { id: `${OWNED}qs`, name: "Amaka Eze", email: "amaka.eze@sample.buildpanda.demo" },
];
// Index 3 in an actor list is whoever is signed in, so the DM has the viewer on
// one side of it and the sample project's chat is not a room of strangers.
const VIEWER = 3;

interface SeedMessage {
  key: string;
  who: number;
  hoursAgo: number;
  body: string;
  parent?: string;
  quote?: string;
  refs?: { type: string; id: string; label: string }[];
  mentions?: number[];
  pin?: boolean;
  reactions?: { emoji: string; by: number[] }[];
}

interface SeedChannel {
  key: string;
  name: string | null;
  topic: string | null;
  dm?: boolean;
  // How stale the signed-in member's read cursor is, so the channel list shows a
  // believable unread badge instead of everything already read.
  viewerLastReadHoursAgo: number | null;
  messages: SeedMessage[];
}

const CHANNELS: SeedChannel[] = [
  {
    key: "general",
    name: "general",
    topic: "Day-to-day coordination for the Sample Project site, Lekki.",
    viewerLastReadHoursAgo: 4,
    messages: [
      { key: "g1", who: 0, hoursAgo: 52, pin: true, body: "Morning all. Block A first-floor slab formwork is up. We are chasing the props check before Thursday's pour — nobody touches concrete until it is signed off." },
      { key: "g2", who: 1, hoursAgo: 50, body: "I'll be on site tomorrow 9am for the props and the rebar check. Hold the pour until I sign it off.", reactions: [{ emoji: "👍", by: [0, 2] }] },
      { key: "g3", who: 2, hoursAgo: 48, body: "Noted. Concrete booked for Thursday 7am — 18m³, Grade 25, one pump.", refs: [{ type: "activity", id: "act-2", label: "Slab pour — Block A, Floor 1" }] },
      { key: "g4", who: 0, hoursAgo: 46, parent: "g2", body: "Gate pass arranged, security has your name at the Ikate entrance." },
      { key: "g5", who: 1, hoursAgo: 45, parent: "g2", body: "Thanks. Have the cube results from the ground-floor pour ready as well." },
      { key: "g6", who: 0, hoursAgo: 26, body: "LAWMA cleared the drain this morning, the access road is passable again. Trailers can come in from 7am." },
      { key: "g7", who: 2, hoursAgo: 5, mentions: [0], body: "@Chidi the tiler's revised quote is ₦850,000 over the flooring allowance — that is the approved porcelain upgrade, not a new ask.", refs: [{ type: "change_request", id: "chg1", label: "Upgrade ground-floor flooring to imported porcelain" }] },
      { key: "g8", who: 0, hoursAgo: 3, body: "Seen. I'll post it against the flooring line before the next valuation so the client sees it once, not twice." },
    ],
  },
  {
    key: "structural",
    name: "structural-works",
    topic: "Rebar, formwork and pour coordination — Block A.",
    viewerLastReadHoursAgo: 10,
    messages: [
      { key: "s1", who: 1, hoursAgo: 72, pin: true, body: "For the record: first-floor slab is Y16 top and bottom at 200 c/c. The bar note on Rev B is wrong. Build to Rev C only." },
      { key: "s2", who: 0, hoursAgo: 70, body: "Steel fixer has Rev C in hand. We have 38 lengths of 16mm on site, ordering another 60 today.", reactions: [{ emoji: "✅", by: [1] }] },
      { key: "s3", who: 1, hoursAgo: 68, body: "Raised the starter-bar question with the consultant. Nothing gets fixed at the column heads until the official response lands." },
      { key: "s4", who: 2, hoursAgo: 30, body: "Cube results from the ground-floor pour are in: 7-day crush at 19.4 N/mm². Comfortably on line for 25 at 28 days." },
      { key: "s5", who: 1, hoursAgo: 28, quote: "s4", body: "Good. No action needed, file it with the inspection pack.", reactions: [{ emoji: "🎉", by: [0, 2] }] },
      { key: "s6", who: 0, hoursAgo: 9, body: "Column C5 has honeycombing on the north face, roughly 150mm across. Photos went on today's daily log." },
      { key: "s7", who: 1, hoursAgo: 8, pin: true, body: "Chip it back to sound concrete, wet it, then re-render with an SBR slurry coat. Do not bury it — I want it on the snag list with a before and after photo." },
    ],
  },
  {
    key: "procurement",
    name: "procurement",
    topic: "Deliveries, purchase orders and supplier chase-ups.",
    viewerLastReadHoursAgo: 25,
    messages: [
      { key: "p1", who: 2, hoursAgo: 96, pin: true, body: "Cement moved to ₦4,700 a bag this week. We budgeted ₦4,500 — that is about ₦75,000 across the 250 bags still to come." },
      { key: "p2", who: 0, hoursAgo: 95, body: "Can we buy the balance now while the trailer is coming anyway?" },
      { key: "p3", who: 2, hoursAgo: 94, body: "Only if we have somewhere dry for 250 bags. The container is full of the German plumbing fixtures until the first-floor walls are up." },
      { key: "p4", who: 0, hoursAgo: 40, body: "Aluzinc sheets landed this morning — 180 counted off the truck against the delivery note, stacked under the shed.", refs: [{ type: "activity", id: "act-3", label: "Roofing installation — Block A" }], reactions: [{ emoji: "👏", by: [1, 2] }] },
      { key: "p5", who: 2, hoursAgo: 20, mentions: [0], body: "Waterproofing membrane is still a three-week lead time. If the order is not placed by Friday, roofing slips into June." },
      { key: "p6", who: 0, hoursAgo: 2, mentions: [2], body: "Placing it today. @Amaka send me the supplier's account details and I'll get the transfer done this afternoon." },
    ],
  },
  {
    key: "dm_eng",
    name: null,
    topic: null,
    dm: true,
    viewerLastReadHoursAgo: null,
    messages: [
      { key: "d1", who: 1, hoursAgo: 20, body: "Are you around for the props check tomorrow? I'd rather you were standing there when I sign it off." },
      { key: "d2", who: VIEWER, hoursAgo: 19, body: "Yes, I'll be on site from 8." },
      { key: "d3", who: 1, hoursAgo: 19, body: "Perfect. Bring the Rev C print, the copy in the site office is the old one." },
    ],
  },
];

async function clearOwnedRows(knex: Knex): Promise<void> {
  // channels cascade to members, messages, reactions and pins, so they only need
  // naming once; the user rows go last because members still point at them.
  if (await knex.schema.hasTable("update_comments")) {
    await knex("update_comments").where("id", "like", `${OWNED}%`).del();
  }
  if (await knex.schema.hasTable("notifications")) {
    await knex("notifications").where("id", "like", `${OWNED}%`).del();
  }
  if (await knex.schema.hasTable("notification_preferences")) {
    await knex("notification_preferences").where("id", "like", `${OWNED}%`).del();
  }
  if (await knex.schema.hasTable("channels")) {
    await knex("channels").where("id", "like", `${OWNED}%`).del();
  }
  await knex("user").where("id", "like", `${OWNED}%`).del();
}

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first();
  if (!project) return;

  await clearOwnedRows(knex);

  // Real sign-ups only: the admin metrics seed's synthetic users are not people
  // who will ever open this project.
  const viewers = await knex("user")
    .whereNot("id", "like", "demo_metrics_%")
    .orderBy("createdAt", "asc")
    .select<{ id: string }[]>("id");

  await knex("user").insert(
    CAST.map((c, i) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      emailVerified: true,
      createdAt: isoDaysAgo(120 - i),
      updatedAt: isoDaysAgo(1),
    })),
  );

  const actors = [...CAST.map((c) => c.id), viewers[0]?.id ?? CAST[0]!.id];
  const memberIds = Array.from(new Set([...CAST.map((c) => c.id), ...viewers.map((v) => v.id)]));

  const hasChannels = await knex.schema.hasTable("channels");
  const hasMessages = await knex.schema.hasTable("messages");
  const hasReactions = await knex.schema.hasTable("message_reactions");
  const hasPins = await knex.schema.hasTable("pinned_messages");
  const hasQuoted = hasMessages && (await knex.schema.hasColumn("messages", "quoted_message_id"));

  const channelRows: Record<string, unknown>[] = [];
  const memberRows: Record<string, unknown>[] = [];
  const messageRows: Record<string, unknown>[] = [];
  const reactionRows: Record<string, unknown>[] = [];
  const pinRows: Record<string, unknown>[] = [];

  for (const channel of CHANNELS) {
    const channelId = `${OWNED}chan_${channel.key}`;
    const sorted = [...channel.messages].sort((a, b) => b.hoursAgo - a.hoursAgo);
    const newest = sorted[sorted.length - 1]!;

    channelRows.push({
      id: channelId,
      type: channel.dm ? "dm" : "project",
      name: channel.name,
      topic: channel.topic,
      // The scope CHECK forbids a project id on a DM and demands one otherwise.
      project_id: channel.dm ? null : PROJECT_ID,
      organization_id: null,
      is_private: false,
      archived_at: null,
      created_by_id: CAST[0]!.id,
      created_at: isoHoursAgo(sorted[0]!.hoursAgo + 24),
      // The channel list sorts on this, so it has to track the last message.
      updated_at: isoHoursAgo(newest.hoursAgo),
    });

    // A DM is keyed by having exactly two members, so it gets the viewer and the
    // engineer and nobody else.
    const ids = channel.dm ? Array.from(new Set([actors[VIEWER]!, CAST[1]!.id])) : memberIds;
    ids.forEach((userId, idx) => {
      const isCast = userId.startsWith(OWNED);
      const lastRead = isCast
        ? isoHoursAgo(0)
        : channel.viewerLastReadHoursAgo === null
          ? null
          : isoHoursAgo(channel.viewerLastReadHoursAgo);
      memberRows.push({
        id: `${OWNED}cm_${channel.key}_${idx}`,
        channel_id: channelId,
        user_id: userId,
        role: userId === CAST[0]!.id ? "admin" : "member",
        last_read_message_id: null,
        last_read_at: lastRead,
        muted: false,
        notify_level: channel.key === "procurement" && !isCast ? "mentions" : "all",
        added_by_id: CAST[0]!.id,
        created_at: isoHoursAgo(sorted[0]!.hoursAgo + 24),
      });
    });

    for (const message of sorted) {
      const messageId = `${OWNED}msg_${message.key}`;
      messageRows.push({
        id: messageId,
        channel_id: channelId,
        author_id: actors[message.who]!,
        body: message.body,
        content_html: null,
        parent_message_id: message.parent ? `${OWNED}msg_${message.parent}` : null,
        ...(hasQuoted ? { quoted_message_id: message.quote ? `${OWNED}msg_${message.quote}` : null } : {}),
        references: JSON.stringify(message.refs ?? []),
        mentions: JSON.stringify((message.mentions ?? []).map((i) => ({ kind: "user", userId: actors[i]! }))),
        attachments: JSON.stringify([]),
        edited_at: null,
        deleted_at: null,
        created_at: isoHoursAgo(message.hoursAgo),
      });

      for (const [i, reaction] of (message.reactions ?? []).entries()) {
        for (const [j, who] of reaction.by.entries()) {
          reactionRows.push({
            id: `${OWNED}mrx_${message.key}_${i}_${j}`,
            message_id: messageId,
            user_id: actors[who]!,
            emoji: reaction.emoji,
            created_at: isoHoursAgo(Math.max(message.hoursAgo - 1, 0)),
          });
        }
      }

      if (message.pin) {
        pinRows.push({
          id: `${OWNED}pin_${message.key}`,
          channel_id: channelId,
          message_id: messageId,
          pinned_by_id: CAST[0]!.id,
          created_at: isoHoursAgo(Math.max(message.hoursAgo - 2, 0)),
        });
      }
    }
  }

  if (hasChannels) {
    await knex("channels").insert(channelRows);
    if (await knex.schema.hasTable("channel_members")) await knex("channel_members").insert(memberRows);
  }
  // Threads and quotes point at earlier rows in the same batch, so the insert has
  // to stay in the sorted (oldest-first) order built above.
  if (hasChannels && hasMessages) await knex("messages").insert(messageRows);
  if (hasChannels && hasMessages && hasReactions) await knex("message_reactions").insert(reactionRows);
  if (hasChannels && hasMessages && hasPins) await knex("pinned_messages").insert(pinRows);

  await seedNotifications(knex, viewers.map((v) => v.id));
  await seedUpdateComments(knex);
}

async function seedNotifications(knex: Knex, viewerIds: string[]): Promise<void> {
  // Nothing to fill a bell with until somebody has signed up on this machine.
  if (!viewerIds.length) return;

  const rfi = (await knex.schema.hasTable("rfis"))
    ? await knex("rfis").where({ project_id: PROJECT_ID }).orderBy("number", "asc").first<{ id: string; number: number; subject: string } | undefined>("id", "number", "subject")
    : undefined;

  const base = `/project/${PROJECT_ID}`;
  const feed = [
    { type: "chat_mention", hoursAgo: 5, read: false, title: "Amaka Eze mentioned you in #general", body: "The tiler's revised quote is ₦850,000 over the flooring allowance.", cta: `/messages?channel=${OWNED}chan_general&message=${OWNED}msg_g7` },
    { type: "chat_dm", hoursAgo: 20, read: false, title: "New message from Engr. David Okonjo", body: "Are you around for the props check tomorrow?", cta: `/messages?channel=${OWNED}chan_dm_eng&message=${OWNED}msg_d1` },
    { type: "change_request_submitted", hoursAgo: 30, read: false, title: "Change request submitted for decision", body: "Add a study partition on the first floor — ₦1,200,000, 10 days.", cta: `${base}/change-requests?open=chg2` },
    { type: "material_low_stock", hoursAgo: 34, read: false, title: "Cement OPC 42.5 is running low", body: "130 bags left against a reorder threshold of 50.", cta: `${base}/materials` },
    { type: "approval_requested", hoursAgo: 46, read: false, title: "An approval needs your decision", body: "First-floor slab pour is waiting on the structural sign-off.", cta: `${base}/approvals` },
    { type: "key_date_approaching", hoursAgo: 52, read: false, title: "Roof on (weathertight) is approaching", body: "Target date 20 June 2026. Waterproofing membrane is not ordered.", cta: `${base}/key-dates` },
    { type: "update_posted", hoursAgo: 70, read: true, title: "Roofing installation started", body: "Arinze Obi posted a progress update with three photos.", cta: `${base}/updates` },
    { type: "inspection_scheduled", hoursAgo: 96, read: true, title: "Structural Integrity inspection scheduled", body: "Foundation phase check with Engr. David Okonjo.", cta: `${base}/inspections` },
    { type: "budget_overrun", hoursAgo: 120, read: true, title: "Flooring is over plan", body: "The approved porcelain upgrade pushed the finishes line ₦850,000 above budget.", cta: `${base}/finances` },
    ...(rfi ? [{ type: "rfi_assigned", hoursAgo: 68, read: false, title: `RFI-${rfi.number} is in your court`, body: rfi.subject, cta: `${base}/rfis?rfi=${rfi.id}` }] : []),
  ];

  if (await knex.schema.hasTable("notifications")) {
    const hasCta = await knex.schema.hasColumn("notifications", "cta_url");
    await knex("notifications").insert(
      viewerIds.flatMap((userId, u) =>
        feed.map((n, i) => ({
          id: `${OWNED}ntf_${u}_${i}`,
          user_id: userId,
          type: n.type,
          title: n.title,
          body: n.body,
          project_id: PROJECT_ID,
          ...(hasCta ? { cta_url: n.cta } : {}),
          read_at: n.read ? isoHoursAgo(Math.max(n.hoursAgo - 4, 0)) : null,
          created_at: isoHoursAgo(n.hoursAgo),
        })),
      ),
    );
  }

  // Partial rows are enough: the service defaults an absent type to on, so these
  // only need to record the handful a PM would realistically have turned down.
  if (await knex.schema.hasTable("notification_preferences")) {
    const prefs = [
      { type: "chat_dm", inApp: true, email: false },
      { type: "chat_mention", inApp: true, email: true },
      { type: "document_uploaded", inApp: true, email: false },
      { type: "material_low_stock", inApp: true, email: false },
      { type: "update_posted", inApp: false, email: false },
      { type: "invoice_overdue", inApp: true, email: true },
    ];
    await knex("notification_preferences").insert(
      viewerIds.flatMap((userId, u) =>
        prefs.map((p, i) => ({
          id: `${OWNED}np_${u}_${i}`,
          user_id: userId,
          type: p.type,
          in_app_enabled: p.inApp,
          email_enabled: p.email,
          created_at: isoDaysAgo(30),
          updated_at: isoDaysAgo(30),
        })),
      ),
    );
  }
}

async function seedUpdateComments(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable("update_comments"))) return;

  const comments = [
    { key: "1", updateId: "u1", authorId: "seed-owner", authorName: "Homeowner", daysAgo: 2, body: "The roof looks good in the photos. How long before it is weathertight? We are still shipping furniture from the UK." },
    { key: "2", updateId: "u1", authorId: "seed-pm", authorName: "Site Manager", daysAgo: 2, body: "Sheets go on this week, ridge caps and flashing the week after. Weathertight by the end of the month if the rain holds off." },
    { key: "3", updateId: "u2", authorId: "seed-pm", authorName: "Site Manager", daysAgo: 3, body: "All fixtures counted against the packing list and moved into the locked container. Two cartons were dented but the ware inside is intact." },
    { key: "4", updateId: "u3", authorId: "seed-eng", authorName: "Engr. David Okonjo", daysAgo: 4, body: "Reinforcement alignment verified across grids A to F. Cube results attached to the inspection pack — no re-test required." },
    { key: "5", updateId: "u4", authorId: "seed-owner", authorName: "Homeowner", daysAgo: 1, body: "Is the drainage blockage going to affect the pour date?" },
    { key: "6", updateId: "u4", authorId: "seed-pm", authorName: "Site Manager", daysAgo: 1, body: "No. LAWMA cleared it this morning and the access road is open, so the mixer can still come in on Thursday." },
  ];

  // The demo-data migration's own updates are cascaded away when the Marbella
  // seed re-inserts the project, so only comment on ids that survived.
  const present = new Set(
    (await knex("project_updates")
      .where({ project_id: PROJECT_ID })
      .select<{ id: string }[]>("id")).map((r) => r.id),
  );
  const rows = comments.filter((c) => present.has(c.updateId));
  if (!rows.length) return;

  await knex("update_comments").insert(
    rows.map((c) => ({
      id: `${OWNED}uc_${c.key}`,
      update_id: c.updateId,
      author_id: c.authorId,
      author_name: c.authorName,
      body: c.body,
      created_at: isoDaysAgo(c.daysAgo),
    })),
  );
}
