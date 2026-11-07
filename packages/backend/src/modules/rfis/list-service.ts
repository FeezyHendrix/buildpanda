import type { RfiListRepository } from "./list-repository.ts";
import type { RfisRepository } from "./repository.ts";
import { localToday, toRfi } from "./service.ts";
import type { Rfi, RfiListQuery, RfiPage } from "./types.ts";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function rfiListService(list: RfiListRepository, rfis: RfisRepository) {
  // An external contact's email is on the detail for those who may open it; the
  // register only needs the name.
  const forList = (rfi: Rfi, companyCaller: boolean): Rfi => (companyCaller ? rfi : { ...rfi, ballInCourtEmail: null });

  return {
    async page(projectId: string, query: RfiListQuery, companyCaller: boolean): Promise<RfiPage> {
      const sharedOnly = !companyCaller;
      const today = localToday();
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));
      const [{ rows, total }, counts] = await Promise.all([
        list.search(projectId, query, sharedOnly, today, page, pageSize),
        list.counts(projectId, sharedOnly, today),
      ]);
      const commentCounts = await rfis.commentCounts(rows.map((r) => r.id));
      return {
        items: rows.map((r) => forList(toRfi(r, commentCounts.get(r.id) ?? 0), companyCaller)),
        total,
        page,
        pageSize,
        counts,
      };
    },

    /** The plain array the existing page reads; same filters, no paging. */
    async all(projectId: string, query: RfiListQuery, companyCaller: boolean): Promise<Rfi[]> {
      const sharedOnly = !companyCaller;
      const { rows } = await list.search(projectId, query, sharedOnly, localToday(), 1, 1000);
      const commentCounts = await rfis.commentCounts(rows.map((r) => r.id));
      return rows.map((r) => forList(toRfi(r, commentCounts.get(r.id) ?? 0), companyCaller));
    },
  };
}
