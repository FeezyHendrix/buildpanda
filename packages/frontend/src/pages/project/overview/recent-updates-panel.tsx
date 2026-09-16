import { Link } from "react-router-dom";
import { ReactSVG } from "react-svg";
import { icons } from "@/assets/icons/icons";
import { Card } from "@/components/atoms/card";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { CalendarIcon } from "@/components/atoms/project-nav-icons";
import { formatTimeAgo } from "@/lib/formatters";
import { UPDATE_CATEGORY_LABEL, UPDATE_CATEGORY_TONE } from "@/lib/project-meta";
import type { ProjectUpdate } from "@/lib/project-types";
import { EmptyState } from "@/components";

interface RecentUpdatesPanelProps {
  updates: ProjectUpdate[];
  projectId: string;
  className?: string;
}

export function RecentUpdatesPanel({
  updates,
  projectId,
  className,
}: RecentUpdatesPanelProps) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between py-3 px-5">
        <div className="flex gap-2 items-center">
          <h3 className="text-[13px] font-semibold text-black-300">
            Latest Site Updates
          </h3>
        </div>
        <Link
          to={`/project/${projectId}/updates`}
          className="text-xs font-semibold text-[#004DE7] hover:underline"
        >
          View All
        </Link>
      </div>

      <div className="h-full px-5 pb-5">
        <div className="flex flex-col gap-6">
          {updates.length === 0 ? (
            <EmptyState
              variant="inline"
              title="No updates yet"
              icon={<ReactSVG src={icons.updateEmpty} />}
              description="Progress updates posted on this project will appear here."
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {updates.map((update) => (
                <li key={update.id}>
                  <UpdatePreview update={update} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

    </Card>
  );
}

function UpdatePreview({ update }: { update: ProjectUpdate }) {
  const preview = update.media[0];
  return (
    <div className="flex flex-row items-start gap-3 sm:gap-4">
      <div className="relative h-[88px] w-[120px] shrink-0 overflow-hidden rounded-[8px] sm:h-[112px] sm:w-[168px]">
        {preview ? (
          <img
            src={preview.url}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center rounded-[8px] bg-[#F0F2F5] text-gray-300">
            <CalendarIcon className="size-8" />
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#00000000_0%,#00000066_40%)] rounded-[8px]" />
        <Badge tone={UPDATE_CATEGORY_TONE[update.category]} size="sm" className="absolute bottom-2 left-2 rounded-[2px] bg-[#E6EDFD80] px-2 py-1 text-[10px] font-medium text-[#F6F6F6] backdrop-blur-[12px]">
          {UPDATE_CATEGORY_LABEL[update.category]}
        </Badge>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h1 className="line-clamp-2 text-[15px] font-semibold leading-5 text-[#131B2E]">
          {update.title}
        </h1>
        <p className="line-clamp-2 text-[12px] leading-4 text-[#606060]">
          {update.description}
        </p>
        <p className="text-[10px] font-medium text-black-300">
          {formatTimeAgo(update.createdAt)} • By {update.author.name}
        </p>
        <Button variant="ghost" className="flex items-center justify-start p-0 text-xs text-primary hover:bg-transparent hover:text-primary">
          <Link to={`/project/${update.projectId}/updates`} className="p-0">View full update</Link>
        </Button>
      </div>
    </div>
  );
}
