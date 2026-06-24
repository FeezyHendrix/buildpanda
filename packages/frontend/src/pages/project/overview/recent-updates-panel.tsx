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
          <ReactSVG src={icons.refresh} />
          <h3 className="text-[13px] font-semibold text-black-300">
            Latest Site Updates
          </h3>
        </div>
        <Link
          to={`/project/${projectId}/updates`}
          className="text-xs font-semibold text-[#004DE7] bg-white rounded-[100px] py-[4px] px-[16px]"
        >
          View All
        </Link>
      </div>

      <div className="bg-white rounded-[12px] h-full m-1 p-6">
        <div className="flex flex-col gap-6">
          {updates.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No updates yet</p>
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
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      <div className="rounded-[8px] w-full sm:w-[50%] relative">
      {/* <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-[#F6F6F6]"> */}
        {preview ? (
          <img
            src={preview.url}
            alt=""
            className='rounded-[8px] w-full h-full'
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-gray-300">
            <CalendarIcon className="size-5" />
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,#00000000_0%,#00000066_40%)] rounded-[8px]" />
        <Badge tone={UPDATE_CATEGORY_TONE[update.category]} size="sm" className="absolute bottom-4 left-3 bg-[#E6EDFD80] backdrop-blur-[12px] px-[8px] py-[4px] rounded-[2px] text-[11px] font-medium text-[#F6F6F6]">
            {UPDATE_CATEGORY_LABEL[update.category]}
          </Badge>
      </div>
      <div className='flex flex-col gap-2 w-full sm:w-[50%]'>
        <h1 className="text-[#131B2E] text-[16px] font-semibold">
          {update.title}
        </h1>
        <p className="text-[#606060] text-[13px]">
          {update.description}
        </p>
        <p className="text-black-300 text-[11px] font-medium">
          {formatTimeAgo(update.createdAt)} • By {update.author.name}
        </p>
        <Button variant="ghost" className='hover:bg-transparent hover:text-primary text-primary flex items-center justify-start pl-0 cursor-pointer'>
          <Link to={`/project/${update.projectId}/updates`} className='p-0'>View Full Update</Link>
        </Button>
      </div>
    </div>
  );
}
