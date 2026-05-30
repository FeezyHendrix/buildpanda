import { useNavigate } from "react-router-dom";
import { Button } from "@/components/atoms/button";
import { EmptyState } from "@/components/molecules/empty-state";
import emptyIcon from "@/assets/images/empty-icon.svg";
import circlePlusIcon from "@/assets/icons/circle-plus.svg";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 items-start justify-center pt-[150px]">
      <EmptyState
        icon={<img src={emptyIcon} alt="" className="size-[159px]" />}
        title="Welcome to Build Panda"
        description="Build and manage your construction projects in Nigeria with complete transparency and control — no matter where you live."
        action={
          <Button
            variant="ghost"
            size="md"
            className="text-base font-semibold leading-[120%] text-[#004DE7] hover:bg-[#004DE7]/5 active:bg-[#004DE7]/10"
            onClick={() => navigate("/project/create")}
          >
            <img src={circlePlusIcon} alt="" className="size-5" />
            Create your first project
          </Button>
        }
      />
    </div>
  );
}
