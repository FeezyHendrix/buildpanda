// Minimal Microsoft Project MSPDI (.xml) for the programme import flow. The
// dotted WBS / outlineLevel>=2 forces backend `structureProgramme` down its
// deterministic `structureFromHierarchy` branch, so the parse NEVER calls the
// LLM — the test stays deterministic whether or not Panda AI is configured.
// Element names (UID/Name/WBS/OutlineLevel/Start/Finish/Duration/Milestone/
// Summary) are exactly what `dproject` reads.

interface ProgrammeTaskSpec {
  uid: number;
  name: string;
  wbs: string;
  outlineLevel: number;
  start: string; // yyyy-mm-ddThh:mm:ss
  finish: string;
  durationHours: number; // MS Project duration is PT<n>H0M0S
  summary?: boolean;
  milestone?: boolean;
}

function taskXml(t: ProgrammeTaskSpec): string {
  return [
    "    <Task>",
    `      <UID>${t.uid}</UID>`,
    `      <ID>${t.uid}</ID>`,
    `      <Name>${t.name}</Name>`,
    `      <WBS>${t.wbs}</WBS>`,
    `      <OutlineNumber>${t.wbs}</OutlineNumber>`,
    `      <OutlineLevel>${t.outlineLevel}</OutlineLevel>`,
    `      <Start>${t.start}</Start>`,
    `      <Finish>${t.finish}</Finish>`,
    `      <Duration>PT${t.durationHours}H0M0S</Duration>`,
    `      <DurationFormat>7</DurationFormat>`,
    `      <Milestone>${t.milestone ? 1 : 0}</Milestone>`,
    `      <Summary>${t.summary ? 1 : 0}</Summary>`,
    `      <PercentComplete>0</PercentComplete>`,
    "    </Task>",
  ].join("\n");
}

export interface ProgrammeFile {
  name: string;
  mimeType: string;
  buffer: Buffer;
  // Expected results the backend will derive, for assertions.
  expectedPhaseCount: number;
  expectedActivityCount: number;
}

export function buildProgrammeXml(projectName = "E2E Imported Programme"): ProgrammeFile {
  const tasks: ProgrammeTaskSpec[] = [
    // Phase A (summary) + one activity under it.
    { uid: 1, name: "Substructure", wbs: "1", outlineLevel: 1, start: "2026-02-02T08:00:00", finish: "2026-02-13T17:00:00", durationHours: 80, summary: true },
    { uid: 2, name: "Excavation & foundations", wbs: "1.1", outlineLevel: 2, start: "2026-02-02T08:00:00", finish: "2026-02-13T17:00:00", durationHours: 80 },
    // Phase B (summary) + one activity + one milestone under it.
    { uid: 3, name: "Superstructure", wbs: "2", outlineLevel: 1, start: "2026-02-16T08:00:00", finish: "2026-03-06T17:00:00", durationHours: 120, summary: true },
    { uid: 4, name: "Frame erection", wbs: "2.1", outlineLevel: 2, start: "2026-02-16T08:00:00", finish: "2026-03-06T17:00:00", durationHours: 120 },
    { uid: 5, name: "Weathertight milestone", wbs: "2.2", outlineLevel: 2, start: "2026-03-06T17:00:00", finish: "2026-03-06T17:00:00", durationHours: 0, milestone: true },
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Project xmlns="http://schemas.microsoft.com/project">',
    `  <Name>${projectName}</Name>`,
    `  <Title>${projectName}</Title>`,
    "  <StartDate>2026-02-02T08:00:00</StartDate>",
    "  <FinishDate>2026-03-06T17:00:00</FinishDate>",
    "  <Tasks>",
    tasks.map(taskXml).join("\n"),
    "  </Tasks>",
    "</Project>",
    "",
  ].join("\n");

  return {
    name: "e2e-programme.xml",
    mimeType: "application/xml",
    buffer: Buffer.from(xml, "utf-8"),
    // Two top-level summaries → 2 phases; children (excl. summaries) → 3 activities
    // (2 real + 1 milestone).
    expectedPhaseCount: 2,
    expectedActivityCount: 3,
  };
}
