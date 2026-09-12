import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Input, INPUT_CLASS } from "@/components/atoms/input";
import { Label } from "@/components/atoms/label";
import type { ClientResponse } from "@/api/proposals";
import { cn } from "@/lib/utils";

interface Props {
  clientName: string;
  submitting: boolean;
  error: string | null;
  onRespond: (body: { action: ClientResponse; name?: string; message?: string }) => void;
}

const COPY: Record<ClientResponse, { title: string; hint: string; confirm: string }> = {
  accept: {
    title: "Accept this proposal",
    hint: "Typing your name is your signature. The contractor receives it with the date and time.",
    confirm: "Accept and sign",
  },
  change_requested: {
    title: "Request changes",
    hint: "Tell the contractor what you would like changed. They will send a revised proposal.",
    confirm: "Send request",
  },
  decline: {
    title: "Decline this proposal",
    hint: "Optional: let the contractor know why.",
    confirm: "Decline",
  },
};

// Three responses on one link. Accepting requires a typed name; asking for
// changes requires a message; declining takes an optional reason.
export function RespondPanel({ clientName, submitting, error, onRespond }: Props) {
  const [action, setAction] = useState<ClientResponse | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const ready = action === "accept" ? name.trim().length > 1 : action === "change_requested" ? message.trim().length > 3 : true;

  if (!action) {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="primary" className="flex-1" onClick={() => setAction("accept")}>
          Accept proposal
        </Button>
        <Button variant="secondary" className="flex-1" onClick={() => setAction("change_requested")}>
          Request changes
        </Button>
        <Button variant="secondary" className="flex-1 text-red-600 hover:bg-red-50" onClick={() => setAction("decline")}>
          Decline
        </Button>
      </div>
    );
  }

  const copy = COPY[action];
  return (
    <div className="rounded-lg border border-line bg-gray-50 p-4">
      <p className="text-sm font-semibold text-gray-900">{copy.title}</p>
      <p className="mt-1 text-xs text-gray-500">{copy.hint}</p>
      <div className="mt-4 flex flex-col gap-3">
        {action === "accept" ? (
          <div className="flex flex-col gap-1.5">
            <Label>Your full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={clientName} autoComplete="name" />
          </div>
        ) : null}
        {action !== "accept" ? (
          <div className="flex flex-col gap-1.5">
            <Label>{action === "decline" ? "Reason (optional)" : "What should change?"}</Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className={cn(INPUT_CLASS, "h-auto min-h-24 py-3")}
              placeholder={action === "decline" ? "We went with another contractor" : "Please leave out the boundary wall and split the roof stage in two"}
            />
          </div>
        ) : null}
        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={submitting} onClick={() => setAction(null)}>
            Back
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={!ready}
            className={cn(action === "decline" && "bg-red-600 hover:bg-red-700")}
            onClick={() => onRespond({ action, name: name.trim() || undefined, message: message.trim() || undefined })}
          >
            {copy.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
RespondPanel.displayName = "RespondPanel";
