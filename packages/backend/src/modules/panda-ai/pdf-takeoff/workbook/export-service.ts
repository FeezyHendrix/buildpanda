// Turning a take-off's workbook into a download.
//
// The whole of the freshness guarantee is one line: it calls
// `workbook.read`, which recalculates from the live bill on every call and
// re-reads once if the measurements moved while it was calculating. There is no
// second path that could serve a stored figure, because this service owns no
// cache and the stored snapshot's numbers are never consulted.
//
// It therefore CANNOT hydrate or calculate anything itself. Doing so would be a
// second implementation of the workbook's maths, and the exported file would
// eventually disagree with the screen.

import type { Knex } from "knex";
import { NotFoundError } from "../../../../lib/errors.ts";
import { buildWorkbookXlsx } from "./export-xlsx.ts";
import { preconWorkbookRepository } from "./repository.ts";
import type { WorkbookService } from "./service.ts";

export interface WorkbookExportFile {
  readonly fileName: string;
  readonly buffer: Buffer;
}

/**
 * The project this take-off belongs to, injected rather than queried here.
 *
 * The name lives in the take-off's own repository, and copying its join into
 * this module's SQL would be a second place to keep correct.
 */
export type ProjectNameLookup = (sessionId: string) => Promise<string | null>;

const MAX_FILE_NAME_STEM = 60;

const fileStem = (title: string): string =>
  title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, MAX_FILE_NAME_STEM) || "takeoff";

export function workbookExportService(db: Knex, workbook: WorkbookService, projectName: ProjectNameLookup) {
  const repo = preconWorkbookRepository(db);

  return {
    async exportXlsx(sessionId: string, actor: string, signal?: AbortSignal): Promise<WorkbookExportFile> {
      const [session, project] = await Promise.all([repo.sessionById(sessionId), projectName(sessionId)]);
      if (!session) throw new NotFoundError("Preconstruction session");

      const document = await workbook.read(sessionId, actor, signal);
      const buffer = await buildWorkbookXlsx(document, {
        projectName: project,
        sessionTitle: session.title,
        generatedAt: new Date(),
      });
      return { fileName: `Takeoff-workbook-${fileStem(session.title)}.xlsx`, buffer };
    },
  };
}

export type WorkbookExportService = ReturnType<typeof workbookExportService>;
