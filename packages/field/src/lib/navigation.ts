import { router } from "@/navigation";
/** Deep links and restored screens may have no navigation history. */
export function goBack(): void {
    if (router.canGoBack())
        router.back();
    else
        router.replace("/");
}
