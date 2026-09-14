import { useSearchParams, Link } from "react-router-dom";
import { PageHeader } from "@/components/molecules/page-header";
import { BackArrowIcon } from "@/components/atoms/project-nav-icons";
import { cn } from "@/lib/utils";

import { OrgTab } from "./tabs/org-tab";
import { AccountTab } from "./tabs/account-tab";
import { MembersTab } from "./tabs/members-tab";
import NotificationSettings from "./notifications";
import { IntegrationTab } from "./tabs/integration-tab";
import { ComplianceTab } from "./tabs/compliance-tab";

const TABS = [
  { id: "organization", label: "Organization" },
  { id: "account", label: "Account" },
  { id: "members", label: "Members & Permissions" },
  { id: "notifications", label: "Notifications" },
  { id: "integration", label: "Integration" },
  { id: "compliance", label: "Compliance" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const activeTabId = (searchParams.get("tab") as TabId) || "organization";

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-10">
      <div className="mb-4 flex items-start gap-3">
        <Link
          to="/dashboard"
          aria-label="Back to dashboard"
          className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-black/5 hover:text-ink"
        >
          <BackArrowIcon className="size-4" />
        </Link>
        <PageHeader
          title="Settings"
          className="flex-1"
        />
      </div>
      <div className="mt-6 flex flex-col">
        <div className="border-b border-line-hair">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {TABS.map((tab) => {
              const isActive = activeTabId === tab.id;
              return (
                <Link
                  key={tab.id}
                  to={`?tab=${tab.id}`}
                  className={cn(
                    "whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium",
                    isActive
                      ? "border-primary-600 text-primary-600"
                      : "border-transparent text-ink-muted hover:border-line hover:text-gray-700",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-8">
          {activeTabId === "organization" && <OrgTab />}
          {activeTabId === "account" && <AccountTab />}
          {activeTabId === "members" && <MembersTab />}
          {activeTabId === "notifications" && (
            <div className="-mx-6 -my-8 sm:-mx-10">
              <NotificationSettings />
            </div>
          )}
          {activeTabId === "integration" && <IntegrationTab />}
          {activeTabId === "compliance" && <ComplianceTab />}
        </div>
      </div>
    </div>
  );
}
