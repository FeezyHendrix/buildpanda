import { UnrecoverableError } from "bullmq";
import type { ErrorReport, SlackTransportOptions } from "./types.ts";

function explanation(report: ErrorReport): string {
  if (report.kind === "react")
    return "React could not render this part of the page. The component stack identifies the affected view.";
  if (report.kind === "resource")
    return "The browser could not load a page resource. The resource path is recorded below.";
  if (report.kind === "fatal")
    return "The backend reported a fatal error. Review the operation, stack, and process logs for the shutdown or restart.";
  if (report.context.status === 401)
    return "The API rejected the request because authentication was missing or invalid.";
  if (report.context.status === 403)
    return "The API refused this request. Review the caller's effective permissions and record scope.";
  if (report.context.status === 429)
    return "The API rate limit rejected this request.";
  if (
    report.kind === "http" &&
    !report.context.status &&
    !report.client?.request?.status
  )
    return "The browser did not receive a usable HTTP response. Connectivity, timeouts, or CORS can cause this; the report does not establish which.";
  if (report.context.status && report.context.status >= 500)
    return "The backend failed while handling this request. Match the request ID with the server logs and the frontend report.";
  if (report.kind === "mutation")
    return "An application write failed. The report does not prove whether the server applied the write before the failure.";
  return "The application reported an error. Use the stack, operation, and preceding events to establish the cause.";
}
export function slackPayload(report: ErrorReport) {
  const section = (text: string) => ({
    type: "section",
    text: { type: "plain_text", text: text.slice(0, 2900), emoji: false },
  });
  const context = report.context;
  const details = [
    `Environment: ${report.environment} | Release: ${report.release}`,
    `Event: ${report.id} | Group: ${report.fingerprint}`,
    `Occurred: ${report.occurredAt} | Last seen: ${report.lastSeenAt} | Occurrences in this notification: ${report.count}`,
    `Kind: ${report.kind} | Level: ${report.level}`,
    `Request: ${context.method ?? report.client?.request?.method ?? "n/a"} ${context.route ?? "n/a"}`,
    `Status: ${context.status ?? report.client?.request?.status ?? "n/a"} | Duration: ${context.durationMs ?? report.client?.request?.durationMs ?? "n/a"}ms | Request ID: ${context.requestId ?? report.client?.request?.requestId ?? "n/a"}`,
    `Authenticated user at intake: ${context.userId ?? "anonymous"} | Workspace at intake: ${context.organizationId ?? "unknown"} | Requested project ID: ${context.projectId ?? "unknown"}`,
    `Operation: ${context.operation ?? "n/a"} | Queue: ${context.queue ?? "n/a"} | Job ID: ${context.jobId ?? "n/a"}`,
    JSON.stringify(context.tags ?? {}),
  ].join("\n");
  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${report.source.toUpperCase()} ${report.level}: ${report.name}`.slice(
          0,
          140,
        ),
        emoji: false,
      },
    },
    section(`${explanation(report)}\n\n${report.message}`),
    section(details),
  ];
  const add = (label: string, text: string) => {
    if (text)
      for (let index = 0; index < text.length; index += 2700)
        blocks.push(
          section(
            `${label}${index ? " (continued)" : ""}\n${text.slice(index, index + 2700)}`,
          ),
        );
  };
  add("Stack", report.stack || "No stack was supplied.");
  add("Caused by", report.causes.join("\n\n"));
  add("React components", context.componentStack ?? "");
  if (report.server)
    blocks.push(
      section(
        `Server: Node ${report.server.node} | PID ${report.server.pid} | Uptime ${report.server.uptimeSeconds}s | Memory RSS ${report.server.rssMB}MB / heap used ${report.server.heapUsedMB}MB`,
      ),
    );
  if (report.client) {
    blocks.push(
      section(
        `Page: ${report.client.route} | Frontend event: ${report.client.eventId}\nBrowser session: ${report.client.sessionId} | Frontend release: ${report.client.release}\n${JSON.stringify(report.client.browser)}`,
      ),
    );
    add(
      "Recent actions and requests (oldest first)",
      report.client.breadcrumbs
        .map(
          (crumb) =>
            `${crumb.at} ${crumb.type}: ${crumb.description}${crumb.status ? ` [${crumb.status}]` : ""}${crumb.durationMs !== undefined ? ` ${crumb.durationMs}ms` : ""}${crumb.requestId ? ` request=${crumb.requestId}` : ""}`,
        )
        .join("\n"),
    );
  }
  const safeName = report.name
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return {
    text: `${report.source.toUpperCase()} ${safeName} (${report.fingerprint}, ${report.count} occurrence${report.count === 1 ? "" : "s"})`,
    blocks,
    mrkdwn: false,
    unfurl_links: false,
    unfurl_media: false,
  };
}
export function createSlackTransport(options: SlackTransportOptions) {
  const url = new URL(options.webhookUrl);
  if (
    url.protocol !== "https:" ||
    !["hooks.slack.com", "hooks.slack-gov.com"].includes(url.hostname) ||
    !url.pathname.startsWith("/services/") ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "ERROR_SINK_SLACK_WEBHOOK_URL must be a Slack incoming webhook URL.",
    );
  const send = options.fetch ?? globalThis.fetch;
  return async (report: ErrorReport): Promise<number | undefined> => {
    let response: Response;
    try {
      response = await send(options.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackPayload(report)),
        signal: AbortSignal.timeout(5000),
        redirect: "error",
      });
    } catch {
      throw new Error(
        "Slack error report delivery is unavailable or timed out.",
      );
    }
    if (response.status === 429) {
      const seconds = Number(response.headers.get("Retry-After"));
      await response.body?.cancel();
      return Number.isFinite(seconds) && seconds > 0
        ? Math.min(seconds * 1000, 3_600_000)
        : 60_000;
    }
    await response.body?.cancel();
    if (!response.ok) {
      const message = `Slack error report delivery failed (HTTP ${response.status}).`;
      if (response.status >= 400 && response.status < 500)
        throw new UnrecoverableError(message);
      throw new Error(message);
    }
  };
}
