import { useSearchParams, Link } from "react-router-dom";
import { PageHeader } from "@/components/molecules/page-header";
import { BackArrowIcon } from "@/components/atoms/project-nav-icons";
import { cn } from "@/lib/utils";

import { OrgTab } from "./tabs/org-tab";
import { AccountTab } from "./tabs/account-tab";
import NotificationSettings from "./notifications";
import { IntegrationTab } from "./tabs/integration-tab";
import { ComplianceTab } from "./tabs/compliance-tab";

const TABS = [
  { id: "organization", label: "Organization" },
  { id: "account", label: "Account" },
  // { id: "members", label: "Members & Permissions" },
  { id: "notifications", label: "Notifications" },
  { id: "integration", label: "Integration" },
  { id: "compliance", label: "Compliance" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const activeTabId = (searchParams.get("tab") as TabId) || "organization";

  return (
    <div className="mx-auto max-w-[636px] w-full py-8">
      <div className="mb-4 flex flex-col items-start gap-3">
        <Link
          to="/dashboard"
          aria-label="Back to dashboard"
          className="mt-0.5 inline-flex gap-2 shrink-0 items-center justify-center text-black-500 font-medium text-caption-l hover:underline"
        >
          <BackArrowIcon className="size-5" />
          <span>Go Back</span>
        </Link>
        <PageHeader
          title="Settings"
          description="Manage your project preferences, permissions, and configuration."
          className="flex-1"
        />
      </div>
      <div className="mt-6 flex flex-col">
        <div className="border-gray-200">
          <nav className="-mb-px flex space-x-2" aria-label="Tabs">
            {TABS.map((tab) => {
              const isActive = activeTabId === tab.id;
              return (
                <Link
                  key={tab.id}
                  to={`?tab=${tab.id}`}
                  className={cn(
                    "whitespace-nowrap px-4 py-2 !text-caption-l font-semibold border-[0.5px] rounded-full",
                    isActive
                      ? "border-none bg-black-500 text-white"
                      : "border-border border text-black-500 hover:border-gray-300 hover:text-gray-700",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mx-auto mt-8 w-full max-w-[636px]">
          {activeTabId === "organization" && <OrgTab />}
          {activeTabId === "account" && <AccountTab />}
          {activeTabId === "notifications" && <NotificationSettings />}
          {activeTabId === "integration" && <IntegrationTab />}
          {activeTabId === "compliance" && <ComplianceTab />}
        </div>
      </div>
    </div>
  );
}
