export type LifecycleStage = {
  name: string;
  /** What BuildPanda does at this stage. Stages without one are not shown in the platform diagram. */
  detail: string | null;
};

/** The stages of a build, in order. The hero list and the platform diagram both read from here. */
export const lifecycleStages: ReadonlyArray<LifecycleStage> = [
  { name: "Enquiry", detail: "Leads captured and qualified" },
  { name: "Estimate", detail: "Takeoffs, rates, costing" },
  { name: "Proposal", detail: "Issued, tracked, signed" },
  { name: "Project", detail: null },
  { name: "Planning", detail: "Programme and budget set" },
  { name: "Construction", detail: "Tasks, progress, documents" },
  { name: "Inspections", detail: "Verified on site" },
  { name: "Milestones", detail: "Approved for release" },
  { name: "Payments", detail: "Certified and tracked" },
  { name: "Handover", detail: "Complete record, closed out" },
];
