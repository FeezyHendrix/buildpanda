# Verification pass — road dogfood fixes

Re-run of the 13 Sep 2026 dogfood scenarios through the UI on the same project
(Ikorodu–Sagamu Link Road Rehabilitation (Section 2),
`prj_99ea3fe0-16a7-4c83-a333-dc3ba79611f1`), signed in as QA Reviewer,
workspace Precon QA Builders. Verification only — no code was changed.

Screenshots referenced below are in `docs/dogfood-2026-09-13/verify-shots/`.

## Summary

**The twelve "fix these first" items: 10 fixed, 2 partial, 0 untouched.**
The two partials are both about *surfacing* rather than modelling — server errors
that are still swallowed (item 7) and the overview's cost figures still reading ₦0
(item 9).

**The delay cascade: the mechanism now works.** A 3-day client-culpable delay
logged through the UI moved the activity, its successor, the look-ahead, the linked
key date, the overview's schedule KPI, the needs-attention list and Panda AI's
answer. Of the 48 cells in the original table, 6 are not applicable, 36 now behave
and 6 still do not. The six that still do not are two distinct defects repeated
across rows: **the Gantt page's own "Timeline shift" and "Projected end" KPIs are
still hard-zero** (0 d / 26 Mar 2027) while every other page reads +4 days /
01 Apr 2027, and **Panda AI still does not state the effect of delays on the
completion date**.

**Extension of time works end to end.** A claim raised from the claimable delays,
submitted and approved for 3 days moved the revised completion 29 Mar → 01 Apr 2027
and the *contractual* Practical completion key date 27 Mar → 30 Mar 2027, and LD
exposure is now measured against the revised date (₦850,000/day against
01 Apr 2027, capped at ₦85,420,000). A contractor-culpable delay cannot be made
EOT-claimable in the UI and does not appear in the claimable list. **The standalone
EOT register existed and worked; it is being folded into change orders** — by the
end of this run `/change-requests` already carried the claims as type "Extension of
time only" with the same days-claimed / days-awarded / revised-completion figures,
and a "Time claims" filter.

**Still broken (the honest list):**

1. **"Mark executed" on a change order fails silently** — POST `/execute` returns
   400 with a good message ("Sign the change order contract before executing it")
   and the UI shows nothing. `verify-shots/mark-executed-400-silent.jpg`
2. **Duplicate invite still shows the raw Axios string** "Request failed with
   status code 409". `verify-shots/invite-409-raw-axios.jpg`
3. **Gantt "Timeline shift 0 d" / "Projected end Mar 26, 2027"** — stale while the
   overview and finance pages read +4 days / 01 Apr 2027.
   `verify-shots/gantt-timeline-shift-0d.jpg`
4. **Overview "Budget used ₦0" and "Cost variance ₦0"** against ₦26,950,000 of
   actual on the billing sheet; S-curve and Budget-vs-Actual both "No data
   available". `verify-shots/overview-low-badge-zero-budget.jpg`
5. **Overview header risk badge still reads "Low"** with one open High risk — and
   the risk register page explicitly says "Open high risks 1 — drives the project
   risk badge". Same screenshot as above.
6. **Panda AI "what changed on culvert 1" is verbatim the same failure** — it still
   checks drawing markups only and does not widen the search, despite two delayed
   culvert-1 activities, RFI-1, CR-002, a High risk, an inspection and a material
   order naming it. `verify-shots/panda-culvert1-not-found.jpg`
7. **Panda AI's site-diary summary still treats a future-dated log as a normal
   day** (15 September, today is the 13th) and still carries no diary narrative or
   activities.
8. **Two answers to "how many days were missed"** — daily log page "Missed days 1
   … today and non-working days included", overview "Working days missed 6", while
   Settings → Programme defines the calendar as Mon–Sat.
9. **Look-ahead status is still a free dropdown** (Draft / Under Review / Approved)
   in the edit form — no explicit Approve action recording approver and time.
10. **Material-log ledger renders the delivery note under a "Void reason:" label**
    on live, non-voided receipts — a new display bug introduced by the delivery
    work. `verify-shots/material-log-void-reason-label.jpg`
11. **Activity work-item library is still NRM2 building sections** — no asphalt,
    sub-base or culvert items for a road job.
12. **Practical completion (30 Mar 2027) and the project's revised completion
    (01 Apr 2027) disagree by 2 days** — my own +3 award moved both correctly, so
    the drift is historical: an earlier award moved the revised date but not the
    contractual key date. Defects-liability end did not move at all.

---

## A. The twelve "fix these first" items

| # | Finding | Was | Now | Verdict | Evidence |
|---|---|---|---|---|---|
| 1 | Weather / inspection-category chips submit the form | Weather could never be saved from the UI; every inspection was "Structural" | Weather chips are `type="button"` with `aria-pressed`; clicking Rain toggles and the dialog stays open. Saved Rain / 26 °C on 13 Sept from the UI. Inspection category is now a `<select>` with civils categories (Earthworks & formation, Drainage, Pavement, Materials testing, Structural, Safety, …) plus "+ Add a category" | **PASS** | Daily-log day drawer → Add conditions → saved "Weather Rain, Temperature 26°C". Inspections → Request an inspection saved "VERIFY - side drain invert level check ch 1+200" with category **Drainage** |
| 2 | A delay is a note, not a schedule event | No days lost, end, culpability or EOT flag; Gantt "Timeline shift 0 d"; key dates untouched; Gantt drew a 1-day stop as 6 days | Delay dialog carries reason (now incl. Utility Strike, Third Party, Late RFI Response, Late Payment, Unforeseen Conditions), started/ended, **days lost (working days)**, culpability, EOT-claimable and links to RFI / change request / material order. Choosing "Client Approval" auto-set culpability `client` and EOT `Yes`. Logging 3 days moved TMP approval & signage **14–18 Sept → 17–22 Sept** and its successor Break out failed asphalt **24 Sept–6 Oct → 28 Sept–9 Oct**. The Gantt now draws each delay as its own short bar ("Delay: Client Approval") and shows the dependency link | **PASS** (one caveat: the Gantt page's *Timeline shift* KPI is still 0 d — see section B) | Section B below; `verify-shots/gantt-timeline-shift-0d.jpg` |
| 3 | Deleting a stage with activities → 500, UI hides it | Dialog closed, stage stayed, nothing said | Confirm dialog shows the server's 409 in place: "Stage has 4 activities and a value of 42500000 — reassign them first". Stage stays | **PASS** (cosmetic: the value is unformatted, not ₦42,500,000) | Build stages → Mobilisation & site establishment → row menu → Delete → Delete |
| 4 | "Optional" location makes every new activity fail with 400 | "Request failed with status code 400" under the Panda bubble | Created "VERIFY - blank location activity" with Location left blank — saved, no error. Form also now carries Progress slider and a Predecessors picker with FS/SS/FF/SF and lag | **PASS** | Site activity → Add activity → Start from blank instead |
| 5 | Payments have no guards | ₦90m accepted against ₦85m; Draft paid straight to Paid; future receipts accepted; paid invoice hard-deleted with receipts | ₦25,000,000 against a ₦19,178,125 balance is refused in place: "This is more than the ₦19,178,125.00 outstanding. Tick 'record as an overpayment' if that is intended", with an explicit opt-in that records the excess as a credit. A receipt dated 20 Sept is refused: "A recorded receipt cannot be dated in the future — this payment has not happened yet" (`max=2026-09-13` on the input). The paid invoice's row menu offers **Void** (reason required, "keeps the certificate and every receipt … reverses its figures") instead of Delete | **PASS** — except the Draft-invoice guard, **not tested** (no Draft invoice on the project and creating one would have polluted the ledger) | Budget & invoices → Payments → Add payment; Invoices → IS2-ADV-001 row menu |
| 6 | Rich-text editors carry the previous record into the next | RFI 3 saved with RFI 2's question; task 3 shipped with task 2's description; CR edit lost the saved reason | Raised "VERIFY RFI A" with a distinctive body, reopened Raise RFI → subject empty, editor `is-editor-empty`. Same for New task. CR-001's Edit dialog loads its saved reason in full. RFI Edit now exists; overdue badge, count and filter are present ("⚠ 1 overdue", "⚠ Overdue 2 days" on RFI-2) | **PASS** | RFIs, Tasks, Change orders → CR-001 → Edit |
| 7 | Server errors swallowed on finance and setup pages | Contract upload 500, invoice save 400, "Mark executed" 400, stage delete 500 — all silent; raw Axios string elsewhere | Stage delete and both payment guards now show the server's message. **"Mark executed" still fails silently**: POST `/change-requests/:id/execute` → 400 `{"error":"Sign the change order contract before executing it"}`, UI unchanged, no toast, no inline error. **Duplicate invite still renders "Request failed with status code 409"** | **PARTIAL** | `verify-shots/mark-executed-400-silent.jpg`, `verify-shots/invite-409-raw-axios.jpg` |
| 8 | Client role preset says finance is hidden but grants it | Card read "Finance details hidden by default"; matrix ticked FINANCES View + Dispute; backend enforced one flat `finances.view` | FINANCES row now reads **View / ViewCosts / Manage / Approve / Dispute**. Selecting the Client preset ticks View=true, **ViewCosts=false**, Manage=false, Approve=false, Dispute=true. The misleading "hidden by default" copy is gone. New presets present: Resident Engineer, Quantity Surveyor, Site Agent, Surveyor, Foreman, Materials Engineer | **PASS** — not confirmed from a client's own session (no invitee credentials; same limitation as the original run). Cosmetic: "ViewCosts" is shown raw camelCase | People → Invite someone… → Client preset |
| 9 | Four pages give four answers to "how much have we spent and been paid" | Overview ₦0/₦0/cash ₦85m; waterfall Certified ₦0 Paid ₦0; Payments ₦85m; Phases ₦20.75m | Finance overview is now one model: Adjusted contract ₦854,200,000 − Certified gross ₦20,187,500 = Still to certify ₦834,012,500; Amount paid ₦0; Unpaid certified ₦20,187,500; Retention ₦1,009,375; Funding (₦85m deposited) explicitly excluded from the waterfall. The overview Cash KPI and Panda AI both agree exactly. **But** the overview still reads Budget used ₦0 and Cost variance ₦0 against ₦26,950,000 actual on the billing sheet, its S-curve and Budget-vs-Actual say "No data available", and the Payments tab still headlines Paid ₦85,000,000 (it counts the payable advance alongside the receivable certificate) | **PARTIAL** | Finance overview, Budget & invoices (Budget / Payments tabs), Overview; `verify-shots/overview-low-badge-zero-budget.jpg` |
| 10 | Progress cannot be set anywhere | Not in drawer, table or Gantt; PATCH stored nothing | Inline "Percent complete" input on every activity row. Set 40 on the VERIFY activity → PATCH `/activities/:id`, still 40 after a full reload | **PASS** — note the status stayed "Planned" at 40 % (status derives from actual start/end by design, but a PM would read 40 % as in progress) | Site activity → Progress column |
| 11 | Panda AI does not know today's date | October orders reported as "past their needed-by dates"; future log treated as a normal day; report opened "On track, 0 NGN" | Asked directly: *"Today's date is Sunday, 13 September 2026. The project's revised completion date is 1 April 2027."* Both correct. "Which material orders are late" no longer calls October orders overdue | **PASS** — but the Panda AI page's own AI Summary still opens "currently on track" while the overview says Behind plan with 10 delayed activities and 7 days lost | Panda AI assistant |
| 12 | Orders are not linked to anything | No stage/activity picker; free-text supplier; delivered goods never reached cost; Committed counted Draft and Cancelled | New material order form carries **Stage**, **Site activity**, **Supplier** (combobox on the register, not free text), **Unit rate**, **Estimated cost**, **Expected delivery**. The crushed-stone order displays "Julius Berger Quarry Abeokuta · Base course (crushed stone, 150 mm) · Crushed stone delivery & spread". Committed material cost is labelled "Live orders only — cancelled ones are excluded". Recording a delivery (8 t, DN-VERIFY-01, 12 Sept) moved the order to "Partially delivered · 8 of 20" and wrote a ledger receipt dated 12 Sept with supplier and DN | **PASS** — "a PO can be born Received" not re-tested (PO create no longer accepts `status`, per the fix notes) | Materials → New material order; Reinforcement order → Record delivery; Material log |

---

## B. The delay cascade

### What was logged

| Action | Detail |
|---|---|
| Setup | Added predecessor **TMP approval & signage → Break out failed asphalt** (Finish-to-start, no lag) and linked key date **TMP approved** to the activity **TMP approval & signage**. Neither link existed — see "the dependency gap" below |
| Client delay | Reason **Client Approval**, started 09 Sept 2026, **3 days lost**, culpability auto-set **Client's risk**, EOT-claimable auto-set **Yes** |
| Contractor delay | Reason **Equipment Breakdown** on Centreline setting out, started 10 Sept, **2 days lost**, culpability auto-set **Contractor**, EOT **No** |
| EOT claim | EOT-003 "VERIFY EOT — Ministry TMP approval 3 days late", 3 days claimed, citing the client delay; submitted then approved with 3 days awarded |

### The six checks, on the fresh client delay

| Check | Was | Now | Verdict |
|---|---|---|---|
| Activity dates | Unchanged | TMP approval & signage **14–18 Sept → 17–22 Sept** (+3 working days on the Mon–Sat calendar) | **PASS** |
| Successors / Gantt | Successors did not move; "Timeline shift 0 d"; a 1-day stop drawn as 6 days | Successor **Break out failed asphalt 24 Sept–6 Oct → 28 Sept–9 Oct**. The Gantt draws each delay as a separate short bar sized by days lost and shows the dependency connector. **But the Gantt page still reads "Timeline shift 0 d" and "Projected end Mar 26, 2027"** while the overview reads "+4 days" and "01 Apr 2027". It did register "10 open delays" | **PARTIAL** |
| Look-ahead | No flag; open delays never showed | The activity in "Coming up" and in the approved look-ahead both show the new dates and a **⚠ Delayed** chip; the list has a Delays column | **PASS** |
| Key date | "Culverts complete" still 27 Nov; key dates not linkable to an activity | **TMP approved 18 Sept → 22 Sept**, rendered as "22 Sept 2026 · revised from 18 Sept 2026", and the row shows "Delivered by TMP approval & signage". Key dates now carry a 🔒 Contractual flag | **PASS** |
| Overview | "2 delayed"; not in Needs attention | Needs attention: "10 delayed activities · 7 days lost" (was 9 · 2 before my delays). Schedule KPI count moved 9 → 10. New **COMPLETION POSITION** block: Contract completion 26 Mar 2027, Revised completion 01 Apr 2027, Extension of time ✓ 6 days awarded, Timeline shift +4 days | **PASS** |
| Panda AI | Listed; days parsed from free text; no EOT split | Lists every delay with **Reason, Cost impact, Notes and Culpability from data** — "Culpability: Client - claimable as EOT", "Contractor risk", "Unforeseen conditions - EOT and cost claim", "Third party/community". Picked up my new contractor delay within a minute. **But it never states the effect on completion** — no revised completion, no timeline shift, no total EOT — and October/November delays are still listed as current with no "has not happened yet" distinction | **PARTIAL** |

### The eight original scenarios, mapped to today

The eight events are still on the project. I logged one fresh delay of each
culpability rather than re-staging all eight; the rows below mark ✓ where I saw the
behaviour directly, ✓ᵐ where the same mechanism applies but I did not re-stage that
specific event, and ✗ where it still fails.

| Scenario | Activity dates | Successors / Gantt | Look-ahead | Key date | Overview | Panda AI |
|---|---|---|---|---|---|---|
| 1 · Rain, 10 Sep (1 day) | ✓ᵐ | ✗ no predecessors seeded; Gantt shift 0 d | ✓ delayed chip | n/a | ✓ counted with days lost | ✓ "Weather (Rain) … 1 day lost. Non-culpable" |
| 2 · NNPC pipeline strike at culvert 1 (6 days) | ✓ᵐ | ✗ culverts 2/3 have no predecessor links | ✓ᵐ | ✓ᵐ linkable; "Culverts complete" not linked in the data | ✓ counted | ✓ "Utility Strike … Unforeseen conditions - EOT and cost claim" |
| 3 · Laterite late and short | ✓ᵐ order→activity link now exists on the form | — | ✓ materials gap shown on look-ahead | ✓ᵐ | ✓ "1 material orders late" in Needs attention | ✗ Panda says "there are currently no late material orders" for the same order the UI flags Late |
| 4 · TMP approved 7 days late (client) | ✓ **re-run** | ✓ **re-run** successor moved / ✗ Gantt KPI | ✓ **re-run** | ✓ **re-run** | ✓ **re-run** | ✓ culpability + EOT from data / ✗ no completion effect |
| 5 · Grader breakdown (3 days) | ✓ᵐ | ✗ Gantt shift 0 d | — | n/a | ✓ counted | ✓ "Equipment Breakdown … Contractor culpable" |
| 6 · Advance paid 11 days late | n/a | n/a | n/a | n/a | ✓ invoice row now carries a **"Paid 11d late"** badge | ✓ᵐ |
| 7 · RFI answered 9 days late | ✓ᵐ | — | — | — | ✓ "⚠ 1 overdue" count, Overdue filter, "⚠ Overdue 2 days" on RFI-2, "3 RFIs (1 overdue)" in Open items | ✓ "Client Approval … Late response to RFI-002 caused a 9-day delay" |
| 8 · Community blockade (1 day) | ✓ᵐ | ✗ Gantt shift 0 d | — | n/a | ✓ counted | ✓ "Community Protest … Third party/community" |

**Cell count:** 48 cells, 6 not applicable, **36 behave**, **6 still fail** — five of
those are the Gantt "Timeline shift 0 d" KPI repeated across rows plus Panda's
late-order wording, and the "no completion effect" note on row 4.

### The dependency gap (new finding, not in the original report)

The cascade only reaches successors where somebody has entered a predecessor. All
32 seeded activities have **no predecessors**; the edit form says so plainly — "No
predecessors — a delay on this activity will not move anything before it". I had to
add the TMP → break-out link by hand before the successor would move. The same is
true of key dates: nine of ten are "Not linked to an activity", so nine of ten still
cannot be moved by a delay. The machinery is correct; the project's data does not
yet use it, and nothing in the UI prompts a PM to fill the links in.

### Culpability

| Check | Result |
|---|---|
| Reason list carries attribution | **PASS** — Utility Strike, Third Party, Late RFI Response, Late Payment, Unforeseen Conditions all present; culpability is a first-class field (Contractor's risk / Client's risk / Neutral event) |
| Default culpability by reason | **PASS** — "Client Approval" → `client` + EOT Yes; "Equipment Breakdown" → `contractor` + EOT No, automatically |
| Contractor delay cannot be claimed as EOT | **PASS** — the Yes button does nothing while culpability is contractor, and the form states "A contractor-culpable delay cannot be claimed as an extension of time." The 2-day Equipment Breakdown delay does **not** appear in the claim form's claimable list, which shows only client/neutral delays with a ▼ Client / ▬ Neutral marker |

### Extension of time

| Check | Was | Now | Verdict |
|---|---|---|---|
| EOT register | None anywhere (zero hits in frontend or backend) | Existed as `/extensions-of-time` with claims, days claimed/awarded, submit and decide. **Being folded into change orders** — by the end of this run the same three claims appeared on `/change-requests` as type "Extension of time only" with a "Time claims" filter and the same KPIs (Revised completion 01 Apr 2027, Contract date 26 Mar 2027, Days awarded 6, Days claimed undecided 0) | **PASS**, register now carried by change orders |
| Claim from claimable delays | "CR-003 Extension of time — 14 days" moved nothing | Claim form lists only claimable delays with activity, reason, date, working days and culpability; ticking one cites it ("1 delay cited") | **PASS** |
| Approval moves completion | Practical completion stayed 26 Mar 2027 | Awarding 3 days moved revised completion **29 Mar → 01 Apr 2027** and the contractual **Practical completion key date 27 Mar → 30 Mar 2027** ("revised from 26 Mar 2027"). The decide dialog states "The revised completion date and every contractual key date move by this many days" | **PASS** — but the two figures now disagree by 2 days (01 Apr vs 30 Mar) because an earlier award moved the project date and not the key date; and **Defects liability ends (26 Mar 2028) did not move at all** |
| LD exposure against the revised date | Never shown | Finance overview: "Contract dates & liquidated damages … Lateness is measured against the revised completion date once an approved extension of time has moved it. LD exposure is what the employer could levy today — it is not deducted anywhere and nothing here is a debt." Completion 26 Mar 2027 · Revised 01 Apr 2027 · EOT 6 awarded · **LD exposure ₦0.00, ₦850,000/day against 01 Apr 2027 · capped at ₦85,420,000.00** | **PASS** |

---

## C. Spot-checks, one per remaining section

| Section | Item picked (the worst) | Was | Now | Verdict |
|---|---|---|---|---|
| Setting up the job | New project wizard — no civil type, no dates, no client, budget a range capped at ₦1m | Step 1 now offers **"Civil / Infrastructure — Roads, drainage, bridges and other linear or public works, measured by chainage and section"**. Step 4 asks what you are building (Road / highway, Drainage & culverts, Bridge or structure) and leads with a single **Contract sum** field: "A contract sum is one number, not a range." Step 5 is new: **Project title, Client / employer, Commencement date, Contract completion date** — "The dates are the frame every schedule figure is measured against." The fabricated blueprint-review step with invented "Uploaded documents" is gone from the flow | **PARTIAL** — the min–max range and its ₦1M-capped quick picks are still there below the contract sum; "Project Timeline" is still a bucket (Under 6 months / 6–12 / …) alongside the real dates; step 3 location is still only State + "City or Area" with no address, chainage or coordinates and still reads "your next dream project"; step 2's templates are all residential even after choosing Civil | 
| | (secondary) Activity work-item library | NRM2 building sections, nothing for asphalt, kerbs or culverts | Unchanged — 16 NRM2 sections, no asphalt, no sub-base, no culvert. There is now a "Start from blank instead" escape | **FAIL** |
| On site | Daily log — no date picker, future log saved then vanished, 200 h for 8 workers accepted, missed days counts Sundays | "Add my log" opens **"Which day are you logging? Defaults to today. You can write up an earlier day at any time."** with `max=2026-09-13`, so future dates cannot be chosen. The day drawer carries **Void day**, an **Add activity hours** row (activity picker filtered to activities planned across that day) and a client-feed opt-in that is **off by default** ("logging hours is a diary entry, not a stakeholder update"). Entering 200 h for 8 workers warns rather than blocks: "⚠ 200h across 8 workers is over 12h each. Save it if that is right — otherwise check the figure." Settings → Programme now exposes the working calendar (Mon–Sat ticked, Sun off) and holidays | **PASS** — except the missed-days figure: the daily-log page says "Missed days **1** — days between the first log and today with no log — **today and non-working days included**" while the overview says "Working days missed **6**". Two pages, two numbers, and the daily-log copy contradicts the Mon–Sat calendar |
| | (secondary) Look-aheads — "Approved" is a dropdown anyone can set | Delay chips are there on both the cards and the list; the detail view shows each activity's live (shifted) dates with ⚠ Delayed | **PARTIAL** — the edit form still has a free **Status** select `Draft / Under Review / Approved`; no Approve action recording approver and time |
| Buying and hiring | Status moves — one-click "Move to…", no quantity, date, DN or receiver; no Cancel or Rejected | Row menu is now **View deliveries / Record delivery / Raise a purchase order / Edit / Cancel order / Reject**. The delivery dialog asks Quantity received, Delivery date, Delivery note number, Received by, **Load rejected** (with "A failed load still arrived on site — record it so it stands against the supplier") and Notes, and states what it will do: "Moves the order to partially delivered or delivered from the quantities / Books the goods into the material log as a receipt against this note / Books no cost — this order has no unit rate." Recording 8 t against a 20 t order produced "Partially delivered · 8 of 20" and a ledger receipt dated 12 Sept 2026, supplier Federated Steel, DN DN-VERIFY-01 | **PASS** — one new bug: the ledger row renders the delivery note under a **"Void reason:"** label on live, unvoided receipts (both the new one and the pre-existing DN-JB-11427). A per-entry "Negative stock" chip also persists on a cement row although the material is back to 680 bags and the KPI reads "Needs attention 0 · All levels healthy" |
| Money | Two ledgers — invoices and payments on one side, deposits and milestone gates on the other; waterfall fed by deposits | One waterfall built from certificates and their receipts, with funding explicitly separated and labelled: "Funding is not certification — none of it appears in the contract waterfall above, which is built from certificates and the receipts recorded on them." Figures: Original ₦850,000,000 + Variations ₦4,200,000 = Adjusted ₦854,200,000 − Certified gross ₦20,187,500 = Still to certify ₦834,012,500; Amount paid ₦0; Unpaid certified ₦20,187,500; Retention held ₦1,009,375. Funding shows Funds deposited ₦85,000,000, Milestones released ₦0 with a funding trail. Billing sheet cells now carry a **Claim State** (Claimable / Certified / Forecast) with "Add month" and a removable forecast column. Phase budgets fall back to scheduled value, labelled "from value" | **PASS** — the Payments tab still headlines "Paid ₦85,000,000" by mixing the payable advance with the receivable certificate, and the advance invoice is still labelled "Vendor · Civil engineering / roadworks" rather than a client advance |
| Admin | Risks — no way to add one in the UI, static header badge, edit dialog opened empty | Dedicated **Risk register** page in the sidebar with **Add risk**, filters (Live / All / Open / Mitigated / Occurred / Closed), per-risk actions **Mark mitigated / It happened / Close out / Edit / Delete**, an "Activity at risk" link, and a KPI that says "Open high risks **1** — drives the project risk badge". The edit dialog opens with the full saved description | **PARTIAL** — the page is right, but the **overview header badge still reads "Low"** with that one open High risk, which is exactly the original symptom |
| | (secondary) People / team | Presets had no RE, QS, site agent, surveyor or foreman; initials came out "F(" and "EL"; invited people not assignable | Presets now include Resident Engineer, Quantity Surveyor, Site Agent, Surveyor, Foreman, Materials Engineer; Team and People are one page; initials are correct (BA, TO, CN, AE, FB, MI, GO); invited people appear in the RFI ball-in-court list marked "(invited)" | **PASS** |
| Panda AI | "What changed on culvert 1" | Verbatim the same answer: "I could not find any information regarding changes on Culvert 1. It appears there are no drawing markups or comments available for this project." | **FAIL** |

---

## D. Panda AI — the five questions, verbatim

Asked through the assistant on the project. Every figure cross-checked against the
pages.

### Q1 · "what is outstanding on the contract"

> Here is the outstanding position on the contract for the Ikorodu–Sagamu Link Road Rehabilitation (Section 2):
>
> Adjusted Contract Value: 854,200,000 NGN
> Certified Gross to Date: 20,187,500 NGN
> Amount Paid to Date: 0 NGN
> Retention Held: 1,009,375 NGN
> Outstanding to Certify: 834,012,500 NGN
> Certified Awaiting Payment: 20,187,500 NGN
>
> Liquidated Damages Exposure:
>
> Days Late: 0
> Rate Per Day: 850,000 NGN
> Cap Amount: 85,420,000 NGN
> Amount: 0 NGN
>
> Summary of Cost vs Budget by Stage: … Mobilisation & site establishment: Scheduled Value 42,500,000 NGN, Actual 20,750,000 NGN, Variance 21,750,000 NGN … Drainage — box culverts (3 no.): Scheduled Value 110,500,000 NGN, Actual 0 NGN, Committed 30,800,000 NGN, Variance 79,700,000 NGN … (Additional stages can be summarized similarly if needed.)

**Every figure matches the finance overview exactly.** Was: contract fields only,
never mentioned the advance, the sent IPC, retention or remaining value, and claimed
"All phases are pending". **Verdict: PASS.** Residual: it still does not mention the
₦85m advance or advance recovery, and it truncates the stage list itself.

### Q2 · "which material orders are late"

> There are currently no late material orders. However, there is one order that is partially delivered:
>
> Material: Crushed stone base 0/31.5
> Quantity: 2400.00 m³
> Supplier: Julius Berger Quarry Abeokuta
> Status: Partially Delivered
> Needed By: 20 October 2026
> Expected Delivery At: 22 October 2026
> Days Late: 0 (Supplier promised delivery after the needed date)
> Estimated Cost: 14,880,000 NGN

Was: three October orders called "past their needed-by dates" and the one late
September order omitted. The date error is gone and the forecast slip is spotted.
**Verdict: PARTIAL** — the Materials page puts a red **Late** chip on this same
order and the overview's needs-attention says "1 material orders late", while Panda
opens with "there are currently no late material orders". Three surfaces, two
answers.

### Q3 · "summarise this week's site diary"

> Here's a summary of this week's site diary from 8 September to 15 September 2026:
>
> September 15: Weather Not recorded, Temperature 30°C, Workers 12/12, Hours Worked 100.00
> September 13: Weather Rain, Temperature 26°C, Workers 0/14, Hours Worked 0.00
> September 12: Weather Sunny, Temperature 30°C, Workers 8/8, Hours Worked 48.00
> September 11: Weather Cloudy, Temperature 27°C, Workers 14/14, Hours Worked 126.00
> September 10: Weather Rain, Temperature 24°C, Workers 0/14, Hours Worked 0.00
> September 9: Weather Cloudy, Temperature 29°C, Workers 13/14, Hours Worked 117.00
> September 8: Weather Sunny, Temperature 33°C, Workers 12/12, Hours Worked 108.00
>
> Weekly Overview:
> Total Workers Present: Varied daily, with a maximum of 14 on September 11.
> Total Hours Worked: 499.00 hours across the week.
> Weather Impact: Rain on September 10 and 13 resulted in no workers on site.

Headcounts, weather and temperatures match the daily-log table for 8–13 Sept
(including the Rain / 26 °C I entered today). **Verdict: FAIL on the original
complaint** — **15 September, two days in the future, is still listed as a normal
day**, the stated range runs to 15 September, and the 499 h total includes that
day's 100 h against the page's 489 h. Still no diary narrative, no per-day entries
and no activities, which was the other half of the finding.

### Q4 · "what changed on culvert 1"

> I could not find any information regarding changes on Culvert 1. It appears there are no drawing markups or comments available for this project.
>
> You may want to check the latest drawings or any project documents for updates, or provide more specific details about what you're looking for.

**Verdict: FAIL — unchanged, word for word in substance.** On the same project at
the same moment: two delayed culvert-1 activities (Excavate & blind culvert 1
ch 0+420 with a 6-day utility-strike delay, Cast culvert 1 base & walls), RFI-1
"Culvert 1 invert level conflicts with existing NNPC pipeline at ch 0+420",
CR-002 "Relocate culvert 1 by 8 m to clear NNPC pipeline", a High risk "NNPC
pipeline strike at culvert 1 (ch 0+420)", an inspection "Culvert 1 ch 0+420 - base
slab reinforcement" and a material order "Precast box culvert units — culvert 1
ch 0+420". It still picks one tool (markups) and does not widen on an empty result.
`verify-shots/panda-culvert1-not-found.jpg`

### Q5 · "what is delaying the project"

> The project is currently facing several delays, which are summarized below:
>
> **Import Laterite & Spread** — Reason: Material Delivery · Cost Impact: 2,400,000 NGN · Notes: First laterite delivery (3,000 m³ due 16 Nov) arrived late on 21 Nov with only 1,800 m³. Spreading starts 5 days late. · **Culpability: Contractor culpable, no extension of time (EOT).**
> **Cast Culvert 1 Base & Walls** — Reason: Other · Notes: Delay due to NNPC pipeline strike at ch 0+425 … Slips 6 days (start 26 Oct, finish 09 Nov). · **Culpability: Unforeseen conditions - EOT.**
> **Excavate & Blind Culvert 1 ch 0+420** — Reason: Utility Strike · Cost Impact: 1,850,000 NGN · Notes: Excavator exposed an unmarked 12-inch NNPC products pipeline, leading to a stop-work notice. Six working days lost pending NNPC survey and relocation decision. · **Culpability: Unforeseen conditions - EOT and cost claim.**
> **Cut to Formation ch 0+000–1+200** — Reason: Equipment Breakdown · Cost Impact: 950,000 NGN · Notes: Motor grader hydraulic pump failure; replacement arrived late. 3 days lost. · **Culpability: Contractor culpable.**
> **Cart Away to Approved Tip** — Reason: Community Protest · Cost Impact: 420,000 NGN · Notes: Residents blocked the haul route for a day over dust issues. · **Culpability: Third party/community.**
> **Compact & CBR Tests** — Reason: Client Approval · Notes: Late response to RFI-002 caused a 9-day delay. · **Culpability: Client.**
> **TMP Approval & Signage** — Reason: Client Approval · Notes: Approval delayed by 7 days, impacting work start. · **Culpability: Client - claimable as EOT.**
> **Site Office & Lab Setup** — Reason: Client Approval · Notes: Approval for the site compound layout came back 2 days late.
> **Centreline Setting Out ch 0+000–2+400** — Reason: Equipment Breakdown · Notes: Total station failure caused 2 days lost. · **Culpability: Contractor risk.**
> **Hoarding & Site Security** — Reason: Weather (Rain) · Notes: 1 day lost due to rain; resolved.
> **Plant Mobilisation** — Reason: Weather (Rain) · Notes: Heavy rain caused flooding and delivery issues; 1 day lost. Non-culpable.

Culpability and EOT status now come from the record, not from parsed free text — and
it picked up the 2-day contractor delay I had logged minutes earlier. **Verdict:
PARTIAL** — it still ends there. No revised completion date, no timeline shift, no
total EOT awarded, and October/November delays are still presented as current with
nothing to say they have not happened yet. The `get_schedule_position` data that the
overview renders is not reaching this answer.

### Bonus · date and completion awareness

> Today's date is Sunday, 13 September 2026.
> The project's revised completion date is 1 April 2027.

Both correct and consistent with the pages.

---

## What could not be tested, and why

| Not tested | Why |
|---|---|
| Plan / document / contract-document upload, markups, revision supersession, permit and CO attachments, photo attachments | **The object store on port 9000 is still not running** — same environment gap as the original run. The typed 503 "storage unavailable" path and the "keep the draft when a photo fails" behaviour could therefore not be exercised |
| Payment against a **Draft** invoice | No Draft invoice exists on the project and creating one purely to test the guard would have left a stray certificate in the ledger |
| The Client role preset **from a client's own session** | Invited participants have no password and the invite email goes nowhere locally — the same limitation the original run recorded. The preset's permission set was verified from the invite matrix instead |
| "A PO can be born Received" and the PO issue/receive/cancel/close ladder | Time; the fix notes say PO create and edit no longer accept `status`, which was not confirmed in the UI |
| Delete-activity "refuses while an approved look-ahead references it" | The activity I deleted was not among the approved look-ahead's seven selected activities, so the guard was not triggered. The confirm did warn "This permanently removes the activity and its logged delays" |
| The standalone `/extensions-of-time` page as a permanent surface | It worked when I exercised it, but it is being folded into change orders mid-run on instruction; the claims already appear under Change orders with the same figures |

## Test records left on the project

Clearly labelled so the next run can recognise them: inspection "VERIFY - side drain
invert level check ch 1+200" (Drainage, 25 Sept), RFI-6 "VERIFY RFI A — carryover
check", task "VERIFY TASK A — carryover check", EOT-003 / change order "VERIFY EOT —
Ministry TMP approval 3 days late" (3 days awarded), a daily log for 13 Sept
(Rain, 26 °C, 0 crew), a delivery DN-VERIFY-01 (8 t) against the reinforcement
order, two delays on TMP approval & signage (+3, client) and Centreline setting out
(+2, contractor), a predecessor link TMP → Break out failed asphalt, and the key
date "TMP approved" linked to its activity. The temporary activity "VERIFY - blank
location activity" was deleted.

## One environment note

Midway through the run the backend restarted (another agent editing files) and the
SPA **signed itself out** and redirected to `/auth/sign-in`, even though the session
was still valid — an API call from the same page returned 200 immediately
afterwards. A reload a minute later restored the session. Worth a look: a momentary
backend blip should not log a user out.
