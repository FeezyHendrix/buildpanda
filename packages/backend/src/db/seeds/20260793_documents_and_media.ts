import type { Knex } from "knex";

const PROJECT_ID = "sample-project";

/** Stable prefixes so a re-run deletes exactly this seed's rows and nothing else. */
const FILE_PREFIX = "file_seed_doc_";
const VERSION_PREFIX = "dver_seed_";
const SHARE_PREFIX = "share_seed_";

/** Mirrors lib/file-storage.ts so the `size` text matches what an upload would write. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

interface SeedVersion {
  /** Free text, exactly as the discipline numbers it — null where a revision letter is meaningless. */
  revision: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  notes: string | null;
  daysAgo: number;
}

/**
 * Revision histories hang off the documents the Marbella seed already inserted
 * (d1–d5). The last entry of each list is the live one: its file name is taken
 * from the document row itself, so the register and its history can never
 * disagree about what the current file is called.
 */
const HISTORIES: { documentId: string; versions: SeedVersion[] }[] = [
  {
    // Title documents are not revised, they are replaced: the vendor's photocopy
    // is worthless in a dispute, the Lands Bureau certified copy is the record.
    documentId: "d1",
    versions: [
      {
        revision: "Vendor scan",
        fileName: "C_of_O_Lagos_Villa_vendor_scan.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1_310_720,
        notes: "Photocopy handed over at exchange. Held only until the certified true copy came through.",
        daysAgo: 300,
      },
      {
        revision: "Certified true copy",
        fileName: "C_of_O_Lagos_Villa.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4_404_019,
        notes: "Certified true copy collected from the Lagos State Lands Bureau, Alausa. Stamped and sealed.",
        daysAgo: 268,
      },
    ],
  },
  {
    // Rev A went out for tender; Rev B is the setback fix that the open boundary
    // action item (ai1) is chasing with town planning.
    documentId: "d2",
    versions: [
      {
        revision: "Rev A",
        fileName: "Main_Structure_RevA.dwg",
        mimeType: "application/acad",
        sizeBytes: 7_654_195,
        notes: "Issued for tender. Superseded — do not build to this sheet.",
        daysAgo: 214,
      },
      {
        revision: "Rev B",
        fileName: "Main_Structure_RevB.dwg",
        mimeType: "application/acad",
        sizeBytes: 8_808_038,
        notes: "East elevation pulled back 0.4m to clear the planning setback. Awaiting sign-off from Engr. David Okonjo before block work continues.",
        daysAgo: 41,
      },
    ],
  },
  {
    // A permit is issued once. One version is the honest history, and it shows
    // the register does not invent revisions it does not have.
    documentId: "d3",
    versions: [
      {
        revision: null,
        fileName: "Env_Impact_Permit_2023.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 1_677_722,
        notes: "Photograph of the permit as posted on the site hoarding.",
        daysAgo: 331,
      },
    ],
  },
  {
    // An inspection report is drafted on site, marked up, then signed. All three
    // are kept because the marked-up copy is what the comments refer to.
    documentId: "d4",
    versions: [
      {
        revision: "Draft",
        fileName: "Site_Inspection_Q4_draft.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1_887_437,
        notes: "Site notes typed up the same evening. Photographs not yet attached.",
        daysAgo: 96,
      },
      {
        revision: "Marked up",
        fileName: "Site_Inspection_Q4_markup.pdf",
        mimeType: "application/pdf",
        sizeBytes: 3_670_016,
        notes: "Returned with comments on the rebar cover to the ground beams.",
        daysAgo: 88,
      },
      {
        revision: "Signed",
        fileName: "Site_Inspection_Q4.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4_404_019,
        notes: "Signed and sealed by Engr. David Okonjo. This is the copy filed with LASBCA.",
        daysAgo: 84,
      },
    ],
  },
  {
    // Expired on the register, so its single version is the original issue —
    // the renewal will arrive as a new document, not a revision of a dead one.
    documentId: "d5",
    versions: [
      {
        revision: null,
        fileName: "Env_Impact_Permit_2023.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2_411_724,
        notes: "Original issue. Lapsed — renewal application lodged with the Ministry of the Environment.",
        daysAgo: 331,
      },
    ],
  },
];

interface SeedShare {
  suffix: string;
  documentId: string;
  token: string;
  createdDaysAgo: number;
  expiresInDays: number | null;
  revokedDaysAgo: number | null;
  viewCount: number;
}

/**
 * Three shares that between them cover every state the share panel renders:
 * live, lapsed and pulled. The revoked one exists because sending a superseded
 * drawing outside the team is the mistake the revoke button is there to undo.
 */
const SHARES: SeedShare[] = [
  {
    suffix: "cofo",
    documentId: "d1",
    token: "ngvilla7k2qm4ra8ptcofo",
    createdDaysAgo: 22,
    expiresInDays: 60,
    revokedDaysAgo: null,
    viewCount: 9,
  },
  {
    suffix: "inspection",
    documentId: "d4",
    token: "ngvilla3xhd9wv5bq1insp",
    createdDaysAgo: 80,
    expiresInDays: 14,
    revokedDaysAgo: null,
    viewCount: 4,
  },
  {
    suffix: "drawing",
    documentId: "d2",
    token: "ngvilla6mzt2fp0cjy8dwg",
    createdDaysAgo: 46,
    // Still inside its window when it was pulled, so the panel reads "revoked"
    // rather than letting expiry quietly cover the mistake.
    expiresInDays: 90,
    revokedDaysAgo: 44,
    viewCount: 2,
  },
];

export async function seed(knex: Knex): Promise<void> {
  const project = await knex("projects").where({ id: PROJECT_ID }).first();
  if (!project) return;

  const hasFiles = await knex.schema.hasTable("uploaded_files");
  const hasVersions = await knex.schema.hasTable("document_versions");
  const hasShares = await knex.schema.hasTable("file_shares");
  const hasDocuments = await knex.schema.hasTable("project_documents");
  if (!hasDocuments) return;

  // Children first: a version points at a file, a share points at a document.
  if (hasShares) await knex("file_shares").where("id", "like", `${SHARE_PREFIX}%`).del();

  const documents = await knex("project_documents")
    .where({ project_id: PROJECT_ID })
    .whereIn(
      "id",
      HISTORIES.map((h) => h.documentId),
    )
    .select<{ id: string; file_name: string }[]>("id", "file_name");
  const fileNameById = new Map(documents.map((d) => [d.id, d.file_name]));

  if (hasVersions && documents.length > 0) {
    // By document, not by id prefix: anything else holding version 1 of these
    // documents would collide with the unique (document_id, version_no).
    await knex("document_versions")
      .whereIn(
        "document_id",
        documents.map((d) => d.id),
      )
      .del();
  }
  if (hasFiles) await knex("uploaded_files").where("id", "like", `${FILE_PREFIX}%`).del();

  if (documents.length === 0) return;

  // uploaded_files.owner_id is a hard FK to a real account, so the demo files
  // belong to the first human in the database. On a fresh DB there is nobody
  // yet: the versions still render from their own file_name and size, they just
  // have nothing to open. Re-run `pnpm db:seed` after signing up.
  const owner = hasFiles
    ? await knex("user")
        .where("id", "not like", "demo_metrics_%")
        .orderBy("createdAt", "asc")
        .first<{ id: string }>("id")
    : undefined;
  const ownerId = owner?.id ?? null;

  const fileRows: Record<string, unknown>[] = [];
  const versionRows: Record<string, unknown>[] = [];
  const documentPatches: { id: string; fileId: string | null; sizeBytes: number; versionId: string }[] = [];

  for (const history of HISTORIES) {
    const liveName = fileNameById.get(history.documentId);
    if (!liveName) continue;

    let currentVersionId = "";
    let currentFileId: string | null = null;
    let currentSizeBytes = 0;

    history.versions.forEach((version, index) => {
      const isLive = index === history.versions.length - 1;
      // The live version is whatever the register says the file is called.
      const fileName = isLive ? liveName : version.fileName;
      const versionNo = index + 1;
      const versionId = `${VERSION_PREFIX}${history.documentId}_${versionNo}`;
      const createdAt = isoDaysAgo(version.daysAgo);

      let fileId: string | null = null;
      if (ownerId) {
        fileId = `${FILE_PREFIX}${history.documentId}_${versionNo}`;
        fileRows.push({
          id: fileId,
          owner_id: ownerId,
          project_id: PROJECT_ID,
          file_name: fileName,
          mime_type: version.mimeType,
          size_bytes: version.sizeBytes,
          // Same shape as makeStorageKey(): the object itself is not in the
          // bucket, so a download 404s while every listing reads correctly.
          storage_path: `${ownerId}/${FILE_PREFIX}${history.documentId}_${versionNo}`,
          created_at: createdAt,
        });
      }

      versionRows.push({
        id: versionId,
        document_id: history.documentId,
        file_id: fileId,
        version_no: versionNo,
        revision_label: version.revision,
        file_name: fileName,
        size: formatBytes(version.sizeBytes),
        size_bytes: version.sizeBytes,
        notes: version.notes,
        // Attribution is an FK to an account, so the people named in the notes
        // (Engr. David Okonjo, the site manager) cannot be pointed at here.
        uploaded_by_id: ownerId,
        created_at: createdAt,
      });

      if (isLive) {
        currentVersionId = versionId;
        currentFileId = fileId;
        currentSizeBytes = version.sizeBytes;
      }
    });

    documentPatches.push({
      id: history.documentId,
      fileId: currentFileId,
      sizeBytes: currentSizeBytes,
      versionId: currentVersionId,
    });
  }

  if (hasFiles && fileRows.length > 0) await knex("uploaded_files").insert(fileRows);
  if (hasVersions && versionRows.length > 0) {
    await knex("document_versions").insert(versionRows);
    for (const patch of documentPatches) {
      await knex("project_documents").where({ id: patch.id }).update({
        current_version_id: patch.versionId,
        file_id: patch.fileId,
        size: formatBytes(patch.sizeBytes),
        size_bytes: patch.sizeBytes,
      });
    }
  }

  if (hasShares) {
    const shareRows = SHARES.filter((share) => fileNameById.has(share.documentId)).map((share) => ({
      id: `${SHARE_PREFIX}${share.suffix}`,
      project_id: PROJECT_ID,
      document_id: share.documentId,
      token: share.token,
      created_by: ownerId,
      expires_at:
        share.expiresInDays === null
          ? null
          : isoDaysAgo(share.createdDaysAgo - share.expiresInDays),
      revoked_at: share.revokedDaysAgo === null ? null : isoDaysAgo(share.revokedDaysAgo),
      view_count: share.viewCount,
      created_at: isoDaysAgo(share.createdDaysAgo),
    }));
    if (shareRows.length > 0) await knex("file_shares").insert(shareRows);
  }
}
