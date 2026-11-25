import "@/lib/error-reports/bootstrap";
import { createRoot } from "react-dom/client";
import { useState } from "react";
import api from "@/api/client";
import { queryClient } from "@/api/query-client";
import { ErrorBoundary } from "@/components/atoms/error-boundary";
import { reportFrontendError } from "@/lib/error-reports/client";
import {
  serializeErrorReport,
  type ClientErrorReport,
} from "@/api/error-reports";

function CrashedView() {
  throw new Error("Render fixture failed");
  return null;
}
function TestApp() {
  const [crash, setCrash] = useState(false);
  return (
    <>
      <button
        data-error-action="Save fixture"
        onClick={() => {
          void api
            .post("/qa/fail?token=PRIVATE_HTTP_QUERY", {
              password: "PRIVATE_BODY_PASSWORD",
            })
            .catch(() => undefined);
        }}
      >
        Failed API
      </button>
      <button
        data-error-action="Runtime fixture"
        onClick={() =>
          setTimeout(() => {
            throw new Error(
              "password=PRIVATE_RUNTIME_PASSWORD https://example.test/file?token=PRIVATE_RUNTIME_QUERY",
            );
          }, 0)
        }
      >
        Runtime
      </button>
      <button
        onClick={() => {
          void Promise.reject(new Error("Unhandled rejection fixture"));
        }}
      >
        Rejection
      </button>
      <button
        onClick={() => {
          void queryClient
            .fetchQuery({
              queryKey: ["qa"],
              queryFn: async () => {
                throw new Error("Query fixture failed");
              },
              retry: false,
            })
            .catch(() => undefined);
        }}
      >
        Query
      </button>
      <button
        onClick={() => {
          void queryClient
            .getMutationCache()
            .build(queryClient, {
              mutationFn: async () => {
                throw new Error("Mutation fixture failed");
              },
            })
            .execute(undefined)
            .catch(() => undefined);
        }}
      >
        Mutation
      </button>
      <button
        onClick={() =>
          console.error(
            new Error("Console fixture failed token=PRIVATE_CONSOLE_TOKEN"),
          )
        }
      >
        Console
      </button>
      <button onClick={() => setCrash(true)}>React crash</button>
      <button
        onClick={() => {
          void fetch("/api/qa/denied?token=PRIVATE_FETCH_QUERY");
        }}
      >
        Failed fetch
      </button>
      <button
        onClick={() => {
          for (let index = 0; index < 5; index++)
            reportFrontendError(new Error("Repeated fixture failure"), {
              kind: "runtime",
            });
        }}
      >
        Repeat
      </button>
      <button onClick={() => { const image = document.createElement("img"); image.src = "data:image/png;base64,PRIVATE_RESOURCE_DATA"; document.body.append(image); }}>Broken resource</button>
      <button onClick={() => console.error({ message: "Structured fixture failure", password: "PRIVATE_STRUCTURED_PASSWORD" })}>Structured console</button>
      <ErrorBoundary
        fallback={() => (
          <p role="alert">The view recovered through the error boundary.</p>
        )}
      >
        {crash ? <CrashedView /> : <p>Ready</p>}
      </ErrorBoundary>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<TestApp />);
Object.assign(window, {
  sizeTest: (report: ClientErrorReport) =>
    new TextEncoder().encode(serializeErrorReport(report)).length,
});
