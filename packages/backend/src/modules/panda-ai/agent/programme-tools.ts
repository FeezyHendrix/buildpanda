import { agentRepository } from "./repository.ts";
import { fn, round2, tool, type AgentTool } from "./tool-helpers.ts";
import { optionalString, safeLen } from "./tool-input.ts";

export function programmeTools(): AgentTool[] {
  return [
    tool(fn("get_schedule","Get the project schedule: phases and activities with dates, % complete, milestones and dependency counts. Activities are named after the work they cover ('Excavate & blind culvert 1 ch 0+420'), so this is where a named piece of work appears on the programme. Use for any question about the timeline, Gantt, what is on schedule, or what is late."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const [phases, activities] = await Promise.all([repo.phases(ctx.projectId), repo.activities(ctx.projectId)]);
      const now = Date.now();
      return {
        output: {
          phases: phases.map((p) => ({ id: p.id, name: p.name, status: p.status })),
          activities: activities.map((a) => {
            const preds = a.predecessors;
            const depCount = Array.isArray(preds) ? preds.length : typeof preds === "string" ? safeLen(preds) : 0;
            const end = a.planned_end_at ? new Date(String(a.planned_end_at)).getTime() : null;
            return {
              name: a.name,
              status: a.status,
              start: a.planned_start_at,
              end: a.planned_end_at,
              percentComplete: Number(a.percent_complete ?? 0),
              isMilestone: Boolean(a.is_milestone),
              dependencyCount: depCount,
              overdue: end !== null && end < now && a.status !== "Completed",
            };
          }),
        },
      };
    }),

    tool(fn("get_buildings", "Get the buildings (blocks/structures) in this project with their status and progress. A project may contain several buildings that share one funding pool but each have their own programme of work. Use for questions like 'how is Block B tracking' or 'which building is furthest along'."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const buildings = await repo.buildings(ctx.projectId);
      return {
        output: {
          buildings: buildings.map((b) => ({
            id: b.id,
            name: b.name,
            code: b.code,
            status: b.status,
            progressPercent: Number(b.progress_percent ?? 0),
          })),
        },
      };
    }),

    tool(fn("get_delays", "Get all logged delays for the project with their cost impact and resolution status, each tied to the activity it stopped. Use for questions about delays, lost time, or schedule slippage — and to find out what has held up a particular piece of work."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const delays = await repo.delays(ctx.projectId);
      return {
        output: delays.map((d) => ({
          activity: d.activityName,
          reason: d.reason_code,
          costImpact: Number(d.cost_impact ?? 0),
          startedAt: d.started_at,
          resolved: d.resolved_at !== null,
          notes: d.description,
        })),
      };
    }),

    tool(fn("get_schedule_position", "Get the project's contractual schedule position: the contract completion date, the revised completion date after awarded extensions of time, EOT days approved and still pending (time claims are change requests of type eot_only), how far the projected finish has shifted from the baseline programme, and every delay with its days lost, culpability (contractor / client / neutral) and whether it is claimable as an EOT. Use for 'are we late', 'when do we finish now', 'what is our EOT position', 'what are liquidated damages exposure', 'who is at fault for the delays', or any question about completion, time risk or extensions of time. Liquidated-damages exposure is only reported once the contract carries an LD rate."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const [dates, delays, claims, shift] = await Promise.all([
        repo.scheduleDates(ctx.projectId),
        repo.delaysWithCulpability(ctx.projectId),
        repo.eotClaims(ctx.projectId),
        repo.timelineShift(ctx.projectId),
      ]);
      let eotDaysApproved = 0;
      let eotDaysPending = 0;
      for (const claim of claims) {
        if (claim.status === "Approved" || claim.status === "Executed") {
          eotDaysApproved += Number(claim.days_awarded ?? 0);
        } else if (claim.status === "Submitted") {
          eotDaysPending += Number(claim.time_impact_days ?? 0);
        }
      }
      const openDelays = delays.filter((d) => d.resolved_at === null);
      return {
        output: {
          startDate: dates?.start_date ?? null,
          completionDate: dates?.completion_date ?? null,
          revisedCompletionDate: dates?.revised_completion_date ?? dates?.completion_date ?? null,
          eotDaysApproved,
          eotDaysPending,
          // Needs the contract's LD rate and cap to be meaningful; never guessed.
          ldExposure: null,
          timelineShiftDays: Math.round(Number(shift?.shift ?? 0)),
          openDelayCount: openDelays.length,
          daysLostOpen: openDelays.reduce((sum, d) => sum + Number(d.days_lost ?? 0), 0),
          claims: claims.map((c) => ({
            title: c.title,
            status: c.status,
            daysClaimed: Number(c.time_impact_days ?? 0),
            daysAwarded: c.days_awarded === null ? null : Number(c.days_awarded),
            decidedAt: c.decided_at,
          })),
          delays: delays.map((d) => ({
            activity: d.activityName,
            reason: d.reason_code,
            daysLost: Number(d.days_lost ?? 0),
            culpability: d.culpability,
            eotClaimable: Boolean(d.eot_claimable),
            startedAt: d.started_at,
            endedAt: d.ended_at,
            resolved: d.resolved_at !== null,
          })),
        },
      };
    }),

    tool(fn("get_schedule_of_values", "Get the project's Schedule of Values: for each Build Stage, its scheduled contract value and the monthly billing lines — the period, the percentage of the stage value billed that period, the amount, and whether it has been billed yet. Use for questions about a stage's billing schedule, how a stage's value is spread across months, what is scheduled to be billed when, or how much of a stage is still unscheduled. BuildPanda only LOGS these figures; it does not move money.", { stage: { type: "string", description: "Optional stage name (or part of it) to filter to one build stage." } }), async (ctx, args) => {
      const repo = agentRepository(ctx.db);
      const rows = (await repo.scheduleOfValues(ctx.projectId)) as Array<{
        stage_name: string | null;
        stage_value: string | null;
        period: string;
        percent: string;
        amount: string;
        billed: boolean;
      }>;
      const stageFilter = optionalString(args.stage, 200)?.toLowerCase() ?? null;
      const byStage = new Map<
        string,
        {
          stage: string;
          scheduledValue: number;
          lines: Array<{ period: string; percent: number; amount: number; billed: boolean }>;
        }
      >();
      for (const r of rows) {
        const name = r.stage_name ?? "—";
        if (stageFilter && !name.toLowerCase().includes(stageFilter)) continue;
        let entry = byStage.get(name);
        if (!entry) {
          entry = { stage: name, scheduledValue: round2(Number(r.stage_value ?? 0)), lines: [] };
          byStage.set(name, entry);
        }
        entry.lines.push({
          period: r.period,
          percent: Number(r.percent),
          amount: round2(Number(r.amount)),
          billed: r.billed,
        });
      }
      return {
        output: {
          stages: [...byStage.values()].map((s) => {
            const scheduledToDate = round2(s.lines.reduce((sum, l) => sum + l.amount, 0));
            const billedToDate = round2(
              s.lines.reduce((sum, l) => (l.billed ? sum + l.amount : sum), 0),
            );
            return {
              stage: s.stage,
              scheduledValue: s.scheduledValue,
              scheduledToDate,
              billedToDate,
              unscheduled: round2(s.scheduledValue - scheduledToDate),
              lines: s.lines,
            };
          }),
        },
        navigate: "contract",
      };
    }),

    tool(fn("get_key_dates", "Get project key dates and milestones with their status (upcoming/met/missed)."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const dates = await repo.keyDates(ctx.projectId);
      return { output: dates.map((d) => ({ label: d.label, target: d.target_date, actual: d.actual_date, status: d.status })) };
    }),

    tool(fn("get_programme_baseline", "Compare the programme baseline (the dates agreed at handoff from the accepted proposal) with the current planned and actual dates for every activity and milestone. Use for 'are we behind the baseline', 'which activities slipped', 'when was X supposed to finish versus now', or schedule variance questions. slipDays is positive when the current planned finish is later than the baseline finish."), async (ctx) => {
      const repo = agentRepository(ctx.db);
      const rows = await repo.programmeBaseline(ctx.projectId);
      const dayMs = 86_400_000;
      const slip = (baseline: string | Date | null, planned: string | Date | null) =>
        baseline && planned ? Math.round((new Date(planned).getTime() - new Date(baseline).getTime()) / dayMs) : null;
      return {
        output: rows.map((r) => ({
          activity: r.name,
          stage: r.stage,
          milestone: Boolean(r.is_milestone),
          status: r.status,
          percentComplete: Number(r.percent_complete),
          baselineStart: r.baseline_start_at,
          baselineFinish: r.baseline_end_at,
          plannedStart: r.planned_start_at,
          plannedFinish: r.planned_end_at,
          actualStart: r.actual_start_at,
          actualFinish: r.actual_end_at,
          slipDays: slip(r.baseline_end_at, r.planned_end_at),
          fromProposalProgramme: Boolean(r.programme_task_id),
        })),
      };
    }),
  ];
}
