import { type Page, type Locator, expect } from "@playwright/test";
import { FormDrawer } from "./base-drawer.pom";
import { ProjectNav } from "./project-nav";

export interface ListUpsertConfig {
  // Project sub-route, e.g. "rfis" or "finances/invoices".
  route: string;
  // Accessible name of the create button (regex).
  createButton: RegExp;
  // Drawer title shown in create mode (regex), or null if the drawer has none.
  createTitle: RegExp | null;
  // Submit button label in create mode (regex).
  createSubmit: RegExp;
}

// Generic POM for the repeated "list with an upsert FormDrawer" shape that most
// project modules share (action items, RFIs, queries, change requests, permits,
// key dates, …). Each module supplies a small config; the lifecycle (open →
// ready → fill required fields → save → assert the row after invalidation) is
// identical, so it lives here once instead of being copy-pasted per module.
export class ListUpsertPage {
  readonly drawer: FormDrawer;
  private readonly nav: ProjectNav;

  constructor(
    private readonly page: Page,
    projectId: string,
    private readonly cfg: ListUpsertConfig,
  ) {
    this.drawer = new FormDrawer(page);
    this.nav = new ProjectNav(page, projectId);
  }

  async goto(): Promise<void> {
    await this.nav.goto(this.cfg.route);
    await expect(this.createBtn()).toBeEnabled();
  }

  createBtn(): Locator {
    return this.page.getByRole("button", { name: this.cfg.createButton }).first();
  }

  row(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  // Create a record by filling the given [label, value] fields (the first must
  // satisfy the drawer's required-field check so submit enables) and confirm the
  // drawer closes — React Query invalidation done, never racing the request.
  async create(fields: ReadonlyArray<readonly [RegExp, string]>): Promise<void> {
    await this.createBtn().click();
    if (this.cfg.createTitle) await this.drawer.waitOpen(this.cfg.createTitle);
    else await this.drawer.waitOpen();
    for (const [label, value] of fields) {
      await this.drawer.fillByLabel(label, value);
    }
    await this.drawer.saveAndClose(this.cfg.createSubmit);
  }
}
