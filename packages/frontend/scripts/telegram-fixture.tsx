import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BuildingScopeProvider } from "../src/contexts/building-scope-context";
import { TelegramConnectionCard } from "../src/components/molecules/telegram-connection-card";
import { participantKeys } from "../src/hooks/use-participants";
import "../src/styles/index.css";

const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
function Fixture() {
  const [project, setProject] = useState("site");
  return <QueryClientProvider client={client}>
    <button onClick={() => void client.invalidateQueries()}>Refresh fixture</button>
    <button onClick={() => setProject((value) => value === "site" ? "other" : "site")}>Switch project</button>
    <button onClick={() => client.removeQueries({ queryKey: participantKeys.access(project) })}>Clear access</button>
    <BuildingScopeProvider key={project} projectId={project}>
      <TelegramConnectionCard key={project} projectId={project} projectName={project === "site" ? "Riverside" : "Other site"} />
    </BuildingScopeProvider>
  </QueryClientProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
