import type { ChatMessage } from "@/lib/project-types";

export function ReadReceipt({ message }: { message: ChatMessage }) {
  const recipients = message.recipientCount ?? 0;
  if (recipients === 0) return null;

  const readBy = message.readBy ?? 0;
  const allRead = readBy >= recipients;

  let label: string;
  if (readBy === 0) {
    label = "Sent";
  } else if (recipients === 1) {
    label = "Read";
  } else if (allRead) {
    label = "Read by all";
  } else {
    label = `Read by ${readBy}`;
  }

  return (
    <span
      className={allRead ? "text-[10px] font-medium text-primary-500" : "text-[10px] text-gray-400"}
      title={message.readAt ? `Read ${new Date(message.readAt).toLocaleString()}` : "Delivered"}
    >
      {allRead ? "✓✓" : "✓"} {label}
    </span>
  );
}
