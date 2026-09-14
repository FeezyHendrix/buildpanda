**BuildPanda user journey UX audit — 14 September 2026**

The main experience problem is continuity: the app contains useful capabilities, but users repeatedly have to rediscover the relevant record, reconstruct context, or work out the next step. Improving that continuity should precede broad navigation or visual changes.

This began as an implementation-based review of the primary web app and selected mobile Field Tools journeys. The findings below record the original diagnosis. A subsequent implementation and live browser audit used a dedicated frontend (`localhost:5183`), API (`localhost:3100`), and disposable database. Verification results and remaining coverage are recorded at the end. Priority reflects likely task impact, not measured frequency. The marketing site and internal admin console are outside this review.

P1 means a task blocker, potential loss of work, or misleading state to address first. P2 means repeated friction or an incomplete handoff. Proposed acceptance checks are broader than the automated cases completed so far.

**Journey coverage**

| User goal | Implementation reviewed | Assessment |
| --- | --- | --- |
| Join an invited project | Invitation, signup, sign-in, route guards, owner home | Invitation context survives some paths, but client identity and ordinary return links have gaps. |
| Create or import a project | Creation wizard, import wizard, shared wizard layout | Long initial setup; refresh does not restore working state. |
| Turn an opportunity into delivery | Lead drawer, proposal workspace, response panel, conversion preview | Useful prefills and a concrete conversion preview already exist; preserve them. |
| Decide what to do today | Workspace dashboard, project overview, attention and recommendation cards | Project selection and reporting dominate; actions lack a consistent destination. |
| Plan and unblock work | Activities, programme summary, task board; inspection/risk/change-request pages sampled | Links between delays and source records exist, but activity deep links are incomplete. |
| Review and decide | Approval list and detail dialog; selections sampled | Named reviewer actions differ between list and detail. |
| Request, order, and receive materials | Material register, action dialogs, delivery and PO creation handoffs | Good contextual operations; created PO handoff ends at a toast. |
| Bill, record payment, and close accounts | Invoice register/actions, finance tabs, final account/checklist | Contextual invoice creation exists; filters/details are not consistently resumable and closure steps are not actionable. |
| Find plans and collaborate | Plans list, chat selection, notification destination mapping | Plan review retains sheet identity; notifications lose record/conversation identity. |
| Capture and recover on site | Web quick capture; native project picker, document home, capture and sync implementations | Native offline foundations exist; web capture and sync recovery have different experience gaps. |

**Prioritized findings**

**UX-01 · P1 · A named reviewer loses decision actions inside approval details.**

The approval page computes the current user's ID and allows the requested reviewer to decide from the list. When it opens `ApprovalDetailDialog`, it passes `canDecide` but omits `currentUserId`. The dialog checks the requested reviewer against that missing ID, so a named reviewer can lose the actions after opening the evidence. This is a concrete prop/condition mismatch, not merely a preference about layout.

Make list and detail use the same reviewer eligibility and decision flow. Pass the identity consistently. Verify both a named reviewer and an unrelated user: opening details must retain the former's allowed actions and keep the latter's restricted. See [approval page](../packages/frontend/src/pages/project/approvals.tsx) and [detail dialog](../packages/frontend/src/components/molecules/approval-detail-dialog.tsx).

**UX-02 · P1 · An invited client must select a contractor-oriented identity.**

Project invitations send new users to signup with an email and project-invite redirect. Signup bypasses the persona questions for **organization** invites, but not project invites. Its only offered personas are Construction Company and Project Manager. An owner invited to follow a build therefore has no fitting choice. The app separately supports a `project_owner` home, making the inconsistency especially confusing. The resulting server-side account classification was not verified.

Introduce invitation-aware signup that establishes the invited relationship without asking clients to claim a professional identity. Acceptance: a new invited owner can verify email, join the intended project, and return later to an appropriate home. Preserve the existing invitation persistence across verification. See [project invitation](../packages/frontend/src/pages/accept-project-invite.tsx), [signup](../packages/frontend/src/pages/auth/sign-up.tsx), and [home routing](../packages/frontend/src/lib/route-guards.tsx).

**UX-03 · P1 · Refresh can strand a creation/import journey.**

Creation puts the current step in the URL while the entered values live in component state. Import likewise stores only the step in the URL; its mode, session ID, and project ID live in state. Reloading an import loses the IDs needed to render its steps, even if an earlier step has already created a server-side project. This can leave users unsure whether to resume or start again.

Persist a resumable draft/session identity and reconstruct the step from saved progress. Offer an explicit resume/abandon choice for partially completed imports. Acceptance: refresh after details, after project creation, and during optional uploads; recover the same project and progress without creating a duplicate. See [creation](../packages/frontend/src/pages/project/create.tsx) and [import](../packages/frontend/src/pages/import/index.tsx).

**UX-04 · P1 · Failed requests can look like an empty or healthy project.**

Dashboard and My Build default missing results to empty project lists without a query-error branch. Needs attention can default missing results to zero and say “Nothing needs your attention.” Tasks renders a spinner whenever there is no board, including after an initial request fails. Plans does not distinguish loading/error from an empty list. These states can mislead people into waiting, recreating data, or assuming there is no work.

Use distinct states for loading, genuinely empty, unavailable, forbidden, and stale cached data. Keep available sections usable when one request fails. Acceptance: force an initial failure and a background refresh failure; show recovery and never assert “nothing” based on missing data. See [dashboard](../packages/frontend/src/pages/dashboard/index.tsx), [My Build](../packages/frontend/src/pages/my-build.tsx), [attention card](../packages/frontend/src/pages/project/overview/needs-attention-card.tsx), [tasks](../packages/frontend/src/pages/project/tasks.tsx), and [plans](../packages/frontend/src/pages/project/plans.tsx).

**UX-05 · P1 · Sign-in can lose the original destination.**

Ordinary auth guards redirect to sign-in without the requested path. The API client's 401 handler also hard-navigates there without a return URL. Sign-in already supports `?redirect=`, but these paths do not supply it. A signed-out user opening a work link, or someone whose session expires, can land on a generic home after login and have to find the work again. Unsaved component state is also lost on that hard navigation.

Carry a validated local return path, including relevant query parameters, through login. Preserve recoverable drafts separately. Acceptance: open a task link while signed out and expire a session while drafting; login returns to the exact task and the draft is recoverable. See [route guards](../packages/frontend/src/lib/route-guards.tsx), [API client](../packages/frontend/src/api/client.ts), and [sign-in](../packages/frontend/src/pages/auth/sign-in.tsx).

**UX-06 · P2 · Notifications and alerts make users search a second time.**

Notification URLs are derived only from type and project ID. Task, RFI, and chat notifications route to whole sections. Chat selects its first project channel by default; the notification cannot identify a particular DM or mention. The “overdue RFIs” attention row links to the RFI page, whose filter starts at All. Tasks already supports `?task=`, demonstrating that some destination infrastructure exists.

Give notifications a record/conversation target and attention summaries a matching filter. Acceptance: an overdue-RFI summary opens overdue RFIs; a task notification opens that task; a mention opens the correct conversation and message, including after login. Provide a clear fallback if the record no longer exists. See [notification mapping](../packages/frontend/src/lib/notification-link.ts), [attention card](../packages/frontend/src/pages/project/overview/needs-attention-card.tsx), [RFIs](../packages/frontend/src/pages/project/rfis.tsx), [tasks](../packages/frontend/src/pages/project/tasks.tsx), and [chat](../packages/frontend/src/pages/project/chat.tsx).

**UX-07 · P2 · An activity URL does not identify the activity in the page.**

The router declares `schedules/activities/:activityId`, but `ProjectActivities` does not read that parameter to select, open, or focus a record. Both the collection and record URL render the same list state. A link can therefore look precise while leaving users to find the item manually.

Resolve the route ID to a detail view or focused row, with loading, missing, and unavailable states. Acceptance: direct load, refresh, and an in-app link all show the specified activity. See [routes](../packages/frontend/src/App.tsx) and [activities](../packages/frontend/src/pages/project/activities.tsx).

**UX-08 · P2 · The starting experience asks users to interpret the project before acting.**

The workspace dashboard mainly presents project cards. Project overview contains an attention card, but recommended actions sit below financial charts and the weather section. Attention is expressed as category counts rather than a consistently personalized work queue. The hypothesis is that daily users must inspect multiple projects and sections to assemble their priorities; this needs observation with real roles and project data.

Start with a role-appropriate “Needs my action” queue across projects, retaining project context, owner, due date, and the direct next action. Within a project, prioritize urgent work and blockers. Validate with a PM, site supervisor, and client locating their next three actions without searching individual modules. See [dashboard](../packages/frontend/src/pages/dashboard/index.tsx), [overview](../packages/frontend/src/pages/project/overview.tsx), and [recommendations](../packages/frontend/src/components/organisms/whats-next-card.tsx).

**UX-09 · P2 · Initial setup demands decisions before the first useful action.**

Project creation uses five or six steps, depending on persona, followed by review. Building type, timeline, and funding method are required before continuing through details; the project title is collected late. The hypothesis is that people importing an existing job or simply starting collaboration may not have all those answers ready.

Allow a minimal project start, then a resumable checklist tailored to the intended first task: invite people, add a plan, or set up the programme. Keep templates and the separate import capabilities. Acceptance: a user with only essential project information can reach a useful workspace; incomplete setup remains visible and can be completed later. See [creation](../packages/frontend/src/pages/project/create.tsx).

**UX-10 · P2 · Creating a purchase order does not take users into issuing it.**

The material order action correctly explains that its PO starts as a draft. On success it closes the dialog and shows the PO number in a toast, but offers no direct continuation into that draft. Users must locate the purchase-order register to perform the next necessary step.

Offer “Review draft PO” after creation, retaining the source order and supplier context. Acceptance: raise a PO from an order, open that exact draft, and continue toward issue without searching or re-entering information. See [material order dialogs](../packages/frontend/src/pages/project/materials/material-order-dialogs.tsx).

**UX-11 · P2 · Approval decisions have inconsistent feedback and context.**

List buttons submit a status directly. They do not receive mutation loading state, and the list decision handler supplies success feedback without a local error callback. The detail flow can include a written response and has an error handler. “Request changes” from the list can therefore omit the explanation that makes the request useful. The list also offers decisions for Resubmit, while the detail labels every non-Pending status as decided.

Use one decision interaction from both entry points: show the subject, capture a reason where needed, prevent repeated submission, and explain who acts next. Align the Resubmit lifecycle across views. Acceptance: reject/request changes with a reason, fail the request once, retry successfully, and verify the requester sees the reason and next action. See [approval page](../packages/frontend/src/pages/project/approvals.tsx) and [detail](../packages/frontend/src/components/molecules/approval-detail-dialog.tsx).

**UX-12 · P2 · Leaving and returning does not consistently preserve working context.**

RFI, approval, material, and invoice filters use local state; invoice detail selection is local too. Finance tabs and proposal tabs already preserve their selected tab in the URL, so resumability varies even within the same journey. The shared FormDrawer has no dirty-state contract. The lead drawer has separately saved notes, but its Create proposal action navigates without saving or warning about unsaved notes.

Make meaningful filters and selected records addressable. Protect substantive drafts on dismissal/navigation, using autosave or an explicit discard choice where appropriate. Acceptance: filter a register, inspect a record, navigate away and return; retain context. Type lead notes and create a proposal; notes must be saved or their loss made explicit. See [form drawer](../packages/frontend/src/components/molecules/form-drawer.tsx), [lead drawer](../packages/frontend/src/pages/sales/leads/lead-detail-drawer.tsx), [invoice register](../packages/frontend/src/pages/project/finances/invoices-tab.tsx), and [finance tabs](../packages/frontend/src/pages/project/finances/finance-tabs.tsx).

**UX-13 · P2 · Field capture needs a consistent recovery promise.**

Native Field Tools has a local outbox and visible retry/discard controls. Web quick capture uploads and posts directly, retains content after a failure while the sheet remains open, but clears it on dismissal. The native sync list identifies failed items by resource category and error rather than a recognizable record title/project and a direct edit route. Several failed RFIs can therefore be difficult to distinguish and repair.

Define the promise per client: saved on this device, pending upload, synced, or action required. Preserve web capture drafts where feasible; identify native failures by record and project and provide a repair path. Acceptance: capture offline, restart, reconnect, and recover a deliberately invalid record without guessing which item to discard. See [web capture](../packages/frontend/src/components/molecules/quick-capture-sheet.tsx) and [native sync](../packages/mobile/src/app/sync.tsx). Offline durability itself was not tested on a device.

**UX-14 · P2 · Access failures redirect without explaining the interruption.**

Feature and permission gates send users to the project overview or dashboard when unavailable. A user following a legitimate shared link can experience this as an incorrect link or lost click. This is a presentation finding, not a claim that backend authorization is missing.

Show the requested destination and why it cannot open, with a useful next step appropriate to the cause. Keep authorization enforcement unchanged. Acceptance: a disabled-feature link and an inaccessible record produce distinct explanations rather than an unexplained redirect. See [route guards](../packages/frontend/src/lib/route-guards.tsx).

**UX-15 · P2 · Financial closeout tells users what remains without opening the work.**

The final account includes a useful checklist for remaining certification, receipts, and retention. Each item is descriptive text; none links to the relevant action. This leaves users to translate a closing obligation into a finance destination. This review does not establish whether a complete operational handover workflow exists elsewhere.

Connect each outstanding step to the relevant records and allowed action. Distinguish financial settlement from overall project handover. Acceptance: a person completing closeout can move from an outstanding checklist item to the corresponding task and see the checklist update after completion. See [closing checklist](../packages/frontend/src/pages/project/finances/final-account/closing-checklist.tsx) and [final account](../packages/frontend/src/pages/project/finances/contracts-phases/final-account-section.tsx).

**Existing strengths to build on**

- Lead-to-proposal navigation carries client and brief data. Proposal tabs retain their URL state. Accepted-proposal conversion previews the sections and counts to carry into delivery.
- Materials supports contextual delivery recording and purchase-order creation, rather than making users manually duplicate the request.
- Task details already support a URL target. Finance tabs preserve other query parameters. Plan review receives the selected sheet identity.
- Activities expose inspection hold points and can link delays to RFIs, change requests, and material orders.
- Native Field Tools includes offline storage, sync visibility, and retry/discard controls. Its project picker distinguishes errors from cached data.

**Recommended order of work**

| Order | Deliverable | Findings | Completion evidence |
| --- | --- | --- | --- |
| 1 | Repair blocked and misleading paths | UX-01–05 | Named reviewer succeeds in detail; invited client joins without a false persona; refresh resumes setup; failures remain distinguishable; login returns to work. |
| 2 | Make actions lead to their exact work | UX-06, 07, 10, 11, 14 | Notification → record → decision/result works across roles, including deleted or inaccessible targets. |
| 3 | Preserve work across interruptions | UX-12, 13 | Navigation, refresh, dismissal, and offline recovery retain intended context or explicitly confirm discard. |
| 4 | Reshape daily use and setup around tasks | UX-08, 09, 15 | Observed users find priorities, start a project, and complete closeout with fewer detours. |

The product-level target journey is: **see what needs me → open the exact work with its context → act → understand the result and next owner → safely resume later**. Apply it across existing modules before adding more top-level destinations.

**Validation plan and unresolved coverage**

Run the acceptance checks above against disposable, populated projects as a PM/admin, site member, named reviewer, and invited client. Include signed-out links, slow/failed requests, expired sessions, a refresh midway through setup, and offline native capture. Observe behavior and console errors; successful rendering alone is insufficient.

For the broader experience hypotheses, observe representative users performing a first-project setup, morning triage, blocked-activity resolution, approval revision, material-to-PO handoff, and invoice/closeout journey. Measure task completion, time to first useful action, detours to find records, abandoned setup, lost drafts, and successful recovery. Establish baselines before setting numerical improvement targets.

Detailed takeoff editing/AI processing, full inspection execution, selection revision cycles, every team-role combination, payment mutation correctness, operational handover, and native device behavior remain to be exercised. This document is a cross-journey diagnosis with specific implementation evidence; it is not a claim that every screen or transaction has passed end-to-end testing.

**Implementation and browser verification — 14 September 2026**

The original project creation wizard is retained. Its answers survive refresh; investment is removed from the available choices. Template metadata now connects home builds to the new-build template and renovations to renovation, extension, and fit-out templates. Civil projects proceed directly to location because no civil templates exist. Changing the project type clears incompatible selections, and the API rejects incompatible template submissions. The initial quick-setup replacement was removed following product feedback. The shared support link uses `support@buildpanda.io`.

“Needs my action” follows the dashboard greeting and links assigned tasks, reviews, and RFIs to their records. It uses restrained colour and typography without decorative icons. The duplicate workspace selector beside the logo is removed. Approval, task, and RFI mutations invalidate the action queue.

Other changes cover safe sign-in return paths, invited-client signup, explicit query and access errors, saved import progress, shared form dismissal protection, approval decision consistency, persistent filters, exact notification destinations, activity links, the material-to-PO handoff, lead-note saving, web capture drafts, native outbox context, and financial closeout links. The notification destination column requires the included database migration.

The retained [journey cases](../packages/frontend/e2e/specs/user-journeys.spec.ts) and [handoff cases](../packages/frontend/e2e/specs/user-journey-handoffs.spec.ts) contain 16 Chromium checks, each passed during the audit and targeted reruns. Coverage includes real project creation and seeded stages, changing and restoring template choices, approval decisions, action-queue refresh, overdue filtering, sign-in return, query failure recovery, form dismissal, import refresh, invite signup entry, global chat links, activity details, disabled features, PO issuance, and mobile-web capture note recovery. Desktop and mobile browser inspection also checked greeting order, the removed selector, support destination, and horizontal overflow. Automated setup and requests used disposable local data; outgoing email was disabled.

The continuation adds 12 cases in [task and RFI recovery](../packages/frontend/e2e/specs/user-recovery.spec.ts) and [import and finance recovery](../packages/frontend/e2e/specs/import-finance-recovery.spec.ts), bringing the retained coverage to 28 cases. All 12 new cases and seven affected existing cases passed together in a 19-case Chromium run. Task creation and editing retain drafts across refresh and session expiry, clear them after saving, and protect priority-only changes. Task deletion keeps one confirmation and supports a failed request followed by retry. Task and RFI links open records outside the active filter; RFI editing uses the opened record rather than looking it up in the filtered list. Missing RFI details provide a return action and fit a 390px mobile viewport.

Manual import setup retains the created project when the session-link request fails, shows the error, and retries the link after refresh without creating another project. The browser check confirms exactly one project-creation request and verifies the restored session's project ID through the real API. Idle sessions stop polling; document mutations invalidate the session and pending/processing documents resume polling. Invoice and PO query failures offer retry instead of an empty register or zero summary, missing records provide a return to the current tab, and clearing invoice filters removes both status and search together.

Render review narrowed chat effects to the latest message ID, stabilized empty-message references, kept grouping outside the component, and moved image URL creation into effects with cleanup. Typing retained focus and draft text; opening pinned messages did not repeat read requests. This is targeted behavioral verification, not a complete React Profiler or performance benchmark.

The continuation also removes mirrored task-dialog state and avoids storage writes/state updates when draft values have not changed. Task field changes stay inside the form; static filter choices and empty finance lists keep stable references. The idle-import browser check observes more than two former polling intervals without an extra status request.

Frontend and E2E TypeScript checks passed again for the continuation; the earlier native changes passed TypeScript checking. Approval and project setup suites previously passed (29 cases including the added compatibility cases); this continuation changes no backend code. The full backend typecheck still reports existing errors in `panda-ai/voice-report/service.ts`. Native-device sync, actual photo upload recovery, end-to-end client invitation acceptance, file/programme import interruption recovery, all role combinations, every form's session-expiry recovery, and full closeout remain outside the completed live checks. The original acceptance criteria and user-observation work above remain the coverage target.

**Frontend focus — subsequent pass, 14 September 2026**

The requested scope is now the web frontend. This pass changes frontend implementation and browser tests only; backend and native changes listed above belong to earlier work.

Invitation lookup failures now offer retry and remain distinct from withdrawn or expired links. Acceptance checks fresh account identity, attempts automatic joining once per invitation/account, and exposes an explicit retry after failure. The account-mismatch screen has one clearly labelled account-switch action, keeps the return destination, and clears cached queries after successful sign-out. Storage failures cannot crash the invitation page.

Schedule and project-file imports retain their job IDs and entered details/selections across refresh. Loading or a failed job lookup no longer appears as a failed parse. A shared completion hook reuses the created project, retries the session/document handoff, and updates an existing document rather than blindly adding another. Before applying, the frontend checks the latest job to recover an application whose result was missed. Import review's Retry action opens the relevant upload step. Import switches now have accessible names.

The new [client invitation cases](../packages/frontend/e2e/specs/client-invitations.spec.ts) passed all three checks: preview failure/retry, actual account switching and failed acceptance followed by successful joining, and new-client signup through sign-in and acceptance into the intended project. The tests verify the client role cannot see internal project costs and that new invited clients receive the `project_owner` account type. Email verification uses the existing local fixture to mark the address verified; email delivery and the verification-link click were not exercised.

Both [uploaded import recovery cases](../packages/frontend/e2e/specs/upload-import-recovery.spec.ts) passed, alongside the existing manual-import recovery check. The programme case uploads and parses a real XML schedule, refreshes the details, recovers a failed lookup/link, and confirms exactly one apply request. It also exercises the review Retry action. The file case uses deterministic extraction responses with the real session/link/document API and verifies saved choices plus a failed document handoff without applying twice; it does not validate the extraction service itself. No unexpected browser console errors or warnings were reported during these cases.

Frontend and E2E TypeScript checks and the whitespace check passed. The retained browser coverage now totals 33 cases, with five new cases and one relevant regression passing in this pass. Remaining frontend coverage includes verification-link recovery, other interrupted forms, full closeout, and broader role combinations. Native-device work is deferred under the current scope.

**Account recovery, financial follow-through, and location step — 14 September 2026**

This continuation stays in the frontend. Verification and password recovery retain a validated return destination through the forms and authentication header links. A short-lived browser record holds only the email and destination so an email link opened in another tab can continue the same journey. Verification distinguishes expired/invalid tokens from a temporary request failure, offers resend or retry accordingly, and does not verify again on window focus or reconnect. An unverified sign-in opens a usable resend form. Password-reset failures retain entered fields; expired links offer a new request. Verification queries deduplicate in-flight work, while the resend countdown remains local to its form.

The four [account recovery cases](../packages/frontend/e2e/specs/auth-recovery.spec.ts) passed: expired verification followed by resend and real verification/acceptance into the invited project from a new tab; unverified sign-in recovery; a real password reset with failed-request retries and a new-tab return to the original project; and invalid reset-link recovery with an external redirect rejected. Verification uses locally signed test tokens accepted by the real endpoint; reset tokens are read from the disposable database. Email delivery remains disabled. The token-only email links currently emitted by the backend cannot carry the return destination to a different browser/device; that remains a server-side follow-up.

Final-account and funding-activity requests expose independent retry states. Invoice payments no longer display empty/zero totals when their lookup fails, and search plus selected invoices survive refresh in the URL. The separate deposits/releases ledger is labelled “Funding activity” and links to invoice payments, avoiding “No payment activity” after an invoice receipt has been recorded.

The browser audit exposed an allocation response mismatch: the API returns an array, while the frontend expected an `allocations` wrapper. The service types now match the response. Allocation editing derives untouched values from query data, keeps an explicit draft during refetch, reports save failures, and permits retry without losing edits. Its upper limit matches the API's net payable amount, and its edit permission uses the existing finance approval capability. The oversized invoice API file was split by extracting scan types.

All four [financial recovery cases](../packages/frontend/e2e/specs/closeout-recovery.spec.ts) passed across the file run and targeted reruns: independent final-account/funding retries; payment lookup, receipt detail refresh and unavailable-record recovery; a failed final receipt followed by retry, an updated settled checklist and navigation to the recorded receipt; and allocation edits surviving a stale-query reconnect, failed save, retry and reload. Closeout covers a fully certified contract without retention; retention release and operational handover remain outside this check.

Project creation step 3 now uses a centered, narrower form with state/city together and a compact optional IFC field. The unsupported map placeholder is removed. The model field shows the selected filename from the saved draft, permits replacement/removal, and rejects a non-IFC selection. The two existing creation/template browser cases passed, including creation of a real project. A separate browser check exercised 1440px and 390px layouts, model selection/validation, filename restoration after refresh, removal, and Back/Continue navigation without console errors or horizontal overflow. A read of the frontend served on port 5173 confirmed the updated source was available there.

The eight new cases bring retained journey coverage to 41. Thirteen distinct retained browser checks passed across this continuation's runs, including the three client-invitation regressions and two creation checks. Frontend and E2E TypeScript checks passed. These results do not represent an all-41-case run or complete coverage of every form and role; the earlier unresolved acceptance checks still apply.

**International project locations — 14 September 2026**

Creation now asks for a country without preselecting Nigeria. State, region, or province accepts free text and is optional; city or area remains required. Country choices reuse the existing bundled list, with the display list built outside the component. Country changes clear the previous region and city in the selection handler. Drafts retain all three fields, and incomplete locations return to the location step before review.

The country appears in the review and saved project address. A small extension to the existing project API accepts and stores country in the location JSON, allows an empty region, and keeps legacy callers without a country working without inferring one. No database migration is needed.

Five creation checks passed together: real project creation and draft restoration for Nigeria, Canada, and Singapore (without a region), country changes and incomplete-location recovery on mobile, and the existing template compatibility journey. Saved addresses and seeded stages were verified through the API; the creation checks reported no browser console errors or warnings. Desktop and 390px mobile screenshots were inspected, with no horizontal overflow. Port 5173 serves the updated form. Retained journey coverage is now 44 cases; this was a targeted five-case run.

All 15 project setup unit tests passed, including international address persistence, optional regions, and legacy locations. Frontend and E2E TypeScript checks and the whitespace check passed. The full backend typecheck still reports the same three existing errors in `panda-ai/voice-report/service.ts` at lines 312, 315, and 373.
