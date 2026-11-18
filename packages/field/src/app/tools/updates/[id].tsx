import { withProjectPermission } from "@/components/molecules/permission-gate";
import { goBack } from "@/lib/navigation";
import { useLocalSearchParams } from "@/navigation";
import { Spinner, Text } from "@/components/atoms";
import { Page } from "@/components/molecules/page";
import { UpdateCard } from "@/components/molecules/update-card";
import { CommentThread } from "@/components/updates/comment-thread";
import type { Db } from "@/db/client";
import { useLocalDb } from "@/db/provider";
import { useProjectUpdate } from "@/hooks/use-updates";
import { useFieldSession } from "@/lib/field-session";
function UpdateBody({ db, projectId, id }: {
    db: Db;
    projectId: string;
    id: string;
}) {
    const { update, isPending } = useProjectUpdate(db, projectId, id);
    if (isPending && !update) {
        return (<div className="field-stack items-center py-12">
        <Spinner size="md"/>
      </div>);
    }
    if (!update) {
        return (<div className="field-stack items-center py-12">
        <Text tone="secondary" className="text-[13px]">
          This update is no longer available.
        </Text>
      </div>);
    }
    return <div className="field-stack gap-5"><UpdateCard update={update} expanded/>
    <CommentThread db={db} projectId={projectId} updateId={update.id}/>
  </div>;
}
function UpdateDetail() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>();
    const { projectId } = useFieldSession();
    const { db, ready } = useLocalDb();
    return (<Page title="Update" onBack={() => goBack()}>
      {ready && db && projectId && id ? (<UpdateBody db={db} projectId={projectId} id={id}/>) : (<div className="field-stack items-center py-12">
          <Spinner size="md"/>
        </div>)}
    </Page>);
}
export default withProjectPermission(UpdateDetail, "/tools/updates/[id]");
