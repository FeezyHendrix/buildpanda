import { useState } from "react";
import { FormDrawer } from "@/components/molecules/form-drawer";
import { Input } from "@/components/atoms/input";
import { useEditMessage } from "@/hooks/use-chat";
import type { ChatMessage } from "@/lib/project-types";

export function MessageEditDialog({ message, onClose }: { message: ChatMessage; onClose: () => void }) {
  const [body, setBody] = useState(message.body);
  const edit = useEditMessage(message.channelId);
  return <FormDrawer open onOpenChange={open => { if (!open) onClose(); }} title="Edit message"
    submitLabel="Save changes" submitting={edit.isPending} submitDisabled={!body.trim()} error={edit.error?.message}
    onSubmit={() => edit.mutate({ messageId: message.id, body }, { onSuccess: onClose })}>
    <Input aria-label="Message" value={body} onChange={event => setBody(event.target.value)} />
  </FormDrawer>;
}
