import type { Knex } from "knex";
import { projectsRepository } from "../projects/repository.ts";
import { projectsService } from "../projects/service.ts";
import { stagesRepository } from "../stages/repository.ts";
import { stagesService } from "../stages/service.ts";
import { budgetRepository } from "../budget/repository.ts";
import { budgetService } from "../budget/service.ts";
import { materialsEquipmentRepository } from "../materials-equipment/repository.ts";
import { materialsEquipmentService } from "../materials-equipment/service.ts";
import type { ProjectExtraction } from "./project-extraction.ts";

export interface ApplyExtractionSelection {
  metadata?: boolean;
  timeline?: boolean;
  budget?: boolean;
  materials?: boolean;
}

export interface ApplyExtractionResult {
  projectId: string;
  createdProject: boolean;
  phaseCount: number;
  budgetCategoryCount: number;
  materialCount: number;
}

function budgetTotal(extraction: ProjectExtraction): number {
  return extraction.budgetCategories.reduce((sum, c) => sum + c.total, 0);
}

export async function applyExtraction(
  db: Knex,
  extraction: ProjectExtraction,
  requestedBy: string,
  options: {
    projectId?: string;
    organizationId?: string | null;
    selection?: ApplyExtractionSelection;
  } = {},
): Promise<ApplyExtractionResult> {
  const selection: ApplyExtractionSelection = {
    metadata: true,
    timeline: true,
    budget: true,
    materials: true,
    ...options.selection,
  };

  const projects = projectsService(projectsRepository(db));
  const stages = stagesService(stagesRepository(db));
  const budget = budgetService(budgetRepository(db));
  const materials = materialsEquipmentService(materialsEquipmentRepository(db));

  let projectId = options.projectId ?? null;
  let createdProject = false;

  if (!projectId) {
    const total = budgetTotal(extraction);
    const created = await projects.create(
      {
        title: extraction.metadata.projectName?.trim() || "Imported Project",
        projectType: "build",
        location: {
          state: extraction.metadata.location?.split(",").pop()?.trim() || "Unknown",
          city: extraction.metadata.location?.split(",")[0]?.trim() || "Unknown",
          ownsLand: false,
        },
        details: {
          buildingType: "commercial",
          currency: "NGN",
          budgetMin: total,
          budgetMax: total,
          timeline: "0-3 months",
          fundingMethod: "self",
        },
        management: { involvementLevel: "high", riskOptions: [] },
      },
      requestedBy,
      options.organizationId ?? null,
    );
    projectId = created.id;
    createdProject = true;
  }

  let phaseCount = 0;
  if (selection.timeline && extraction.phases.length > 0) {
    const existing = await stages.list(projectId);
    for (const stage of existing) {
      await stages.remove(projectId, stage.id);
    }
    for (const phase of extraction.phases) {
      await stages.create(projectId, {
        name: phase.name,
        startDate: phase.startDate,
        endDate: phase.endDate,
      });
      phaseCount += 1;
    }
  }

  let budgetCategoryCount = 0;
  if (selection.budget && extraction.budgetCategories.length > 0) {
    const result = await budget.seedFromEstimateItems(
      projectId,
      extraction.budgetCategories.map((c) => ({ groupLabel: c.name, total: c.total })),
      "skip",
    );
    budgetCategoryCount = result.created;
  }

  let materialCount = 0;
  if (selection.materials && extraction.materials.length > 0) {
    const defaultNeededBy = new Date(Date.now() + 14 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const created = await materials.bulkCreateMaterialOrders(
      projectId,
      extraction.materials.map((m) => {
        const name = m.materialName.trim().slice(0, 200);
        return {
          title: name,
          materialName: name,
          quantity: m.quantity,
          unit: m.unit.slice(0, 40),
          estimatedCost: m.estimatedCost,
          supplier: null,
          neededBy: defaultNeededBy,
          notes: "Imported from project file",
        };
      }),
      requestedBy,
    );
    materialCount = created;
  }

  return { projectId, createdProject, phaseCount, budgetCategoryCount, materialCount };
}
