import { ComingSoon } from "@/components/molecules/coming-soon";
import { PageHeader } from "@/components/molecules/page-header";
import { MessagesIcon } from "@/components/atoms/project-nav-icons";

export default function ProjectMessages() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-6 py-8 sm:px-10">
      <PageHeader
        title="Messages"
        description="Centralized communication with your contractors, inspectors, and project team."
      />
      <ComingSoon
        icon={<MessagesIcon className="size-6" />}
        iconTone="brand"
        title="Messaging is being built"
        description="Threaded conversations, voice notes, and attachments — all tied to your project context — are landing soon."
      />
    </div>
  );
}
