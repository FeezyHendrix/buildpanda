import type { ClientErrorReport } from "@/api/error-reports";

// Browsers cap keepalive bodies at 64 KB, and the server accepts 48 KB.
export function serializeErrorReport(report: ClientErrorReport): string {
  const bounded = { ...report, breadcrumbs: [...report.breadcrumbs] };
  let body = JSON.stringify(bounded);
  for (
    let pass = 0;
    pass < 40 && new TextEncoder().encode(body).length > 45_000;
    pass += 1
  ) {
    if (bounded.stack.length > 2000)
      bounded.stack = bounded.stack.slice(
        0,
        Math.floor(bounded.stack.length / 2),
      );
    else if ((bounded.componentStack?.length ?? 0) > 1000)
      bounded.componentStack = bounded.componentStack!.slice(0, 1000);
    else if (bounded.breadcrumbs.length) bounded.breadcrumbs.shift();
    else bounded.message = bounded.message.slice(0, 500);
    body = JSON.stringify(bounded);
  }
  return body;
}

/** Builds one page-exit batch under the keepalive body limit, or undefined when empty. */
export function serializeExitBatch(
  reports: ClientErrorReport[],
): string | undefined {
  const selected = reports
    .slice(0, 20)
    .map(
      (report) => JSON.parse(serializeErrorReport(report)) as ClientErrorReport,
    );
  if (!selected.length) return undefined;
  let body = JSON.stringify({ reports: selected });
  while (
    new TextEncoder().encode(body).length > 45_000 &&
    selected.some(
      (report) =>
        report.stack ||
        report.componentStack ||
        report.breadcrumbs.length ||
        report.message.length > 300,
    )
  ) {
    for (const report of selected) {
      report.stack = report.stack.slice(0, Math.floor(report.stack.length / 2));
      report.componentStack = report.componentStack?.slice(
        0,
        Math.floor(report.componentStack.length / 2),
      );
      report.breadcrumbs = report.breadcrumbs.slice(
        Math.ceil(report.breadcrumbs.length / 2),
      );
      report.message = report.message.slice(
        0,
        Math.max(300, Math.floor(report.message.length / 2)),
      );
    }
    body = JSON.stringify({ reports: selected });
  }
  while (
    new TextEncoder().encode(body).length > 45_000 &&
    selected.length > 1
  ) {
    selected.pop();
    body = JSON.stringify({ reports: selected });
  }
  return body;
}
