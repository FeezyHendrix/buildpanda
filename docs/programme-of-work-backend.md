# Programme of work — what the backend still needs to provide

Frontend: `packages/frontend/src/pages/project/schedule.tsx` (+ `schedule/`).
Backend: `modules/activities`, `modules/stages`, `modules/key-dates`, `modules/daily-logs`,
`modules/reporting` (the snapshot the figures read).

The page was redesigned: four stat cards (Work Items, Daily Logs, Timeline Shift, Projected
End), an **Import programme** / **Export Programme** pair of buttons, and a framed chart with
Undo/Redo in the task grid header, a Start Date and Duration column, an add-task "+" column,
and a Milestone / Task / Delay legend. Everything draws from data the API already returns, so
nothing is blocked; the items below are what is approximated in the browser or not yet saved.

## 1. Export Programme is not a real export

The button downloads a **JSON dump built in the browser** (the report figures, the milestones,
activities and daily logs). "Export Programme" implies a file a planner can open. Add

`GET /projects/:id/programme/export?format=xlsx|xml|pdf&buildingId=`

* `xlsx`: one row per activity: WBS / parent, name, planned start/end, **baseline** start/end,
  duration, percent complete, predecessors (type + lag), delays (reason, days lost, resolved).
* `xml`: Microsoft Project XML, so it round-trips with the existing **Import programme**.
* `pdf`: the chart as printed.
* Honour the viewer's building scope and their `schedule` view right; return an audit entry
  (who exported what, when). Stream the file with a sensible name and
  `Content-Disposition: attachment`.

Frontend change once it ships: call it from `downloadReport()` instead of building the blob.

## 2. The four figures should come from the server

All four are shown on the page; three are worked out in the browser today:

| Card | Today | Needed |
|---|---|---|
| **Work Items** `1/3`, "↓ 2 remaining" | counted from the loaded activities | return `{ total, completed, remaining }` in the reporting snapshot, and **define what counts**: summary rows and milestones are probably not "work items" |
| **Daily Logs** "logged today" | the page filters every daily log by today's date **in the viewer's timezone** and drops voided ones | `dailyLogsToday` in the snapshot, computed in the **project's timezone** |
| **Timeline Shift** `0d`, "no net change", "On Schedule" | `timelineShiftDays` from the snapshot | confirm the unit (**working days**) and the sign (**positive = behind**); also return `status: "on_schedule" \| "behind" \| "ahead"` so the label is not inferred |
| **Projected End** `May 12 / 2026` | `revisedCompletionDate` (after approved extensions of time), else `completionDate` | confirm that is the intended meaning of "Projected End"; the old label said "Revised completion … after approved extensions of time" |

Two figures the old strip showed are **no longer on the page**: *Milestone cost* and *Delay
cost*. Delay cost still appears as a badge above the cards when delays exist. If product wants
either back, they already exist on the report.

## 3. Delay length on the chart

A delay with zero days lost is drawn one day wide and the Duration column reads "1 day"; the
design shows "0 days" for a delivery that cost no time. Return the delay's true `daysLost`
and `endedAt` on each delay (already present) and decide whether a zero-length delay is a
point on the chart; today the chart cannot draw a zero-width bar.

## 4. What makes a bar blue

The legend says **Milestone** (dark blue), **Task** (green), **Delay** (orange outline). The
chart paints summaries and milestones blue and everything else green. In the design a plain
row, *Roofing Installation*, is blue as well. If that is meant to be a distinct kind of work
item (e.g. a milestone with a duration), the activity needs a flag or type for it
(`isMilestone` is currently a zero-length point). Please confirm the rule.

## 5. Adding a row from the chart

The design keeps the "+" column. A row added there exists **only in the browser**, because
work items are created from Site activity; the page now blocks the action and says so. To
make "+" real:

* `POST /projects/:id/activities` accepting `parentActivityId`, `phaseId`, `plannedStartAt`,
  `plannedEndAt`, `isMilestone`, and a position (`afterActivityId`);
* `PATCH` for indent / outdent (change `parentActivityId`) and reorder;
* the same optimistic-update + undo contract the drag editor already has
  (`use-schedule-editor.ts`).

Deleting a row from the chart (keyboard Delete) is also not wired; decide whether it should be.

## 6. Editing rules the server must enforce

Dragging a bar sends `PATCH` with new dates. The server must (the page only mirrors this):

* refuse a change by someone without `schedule: manage`;
* **record the baseline** the first time a date moves, never overwrite it afterwards;
* log who moved what and when (a programme change can be a claim);
* re-evaluate the critical path and the timeline shift after every change.

## 7. Panda AI

If the agent has a tool for the programme, make sure it can answer "what is the timeline shift
today", "which delays are open" and "when does the project now finish" from the same snapshot
fields as the cards (§2), so a PM never gets two answers.
