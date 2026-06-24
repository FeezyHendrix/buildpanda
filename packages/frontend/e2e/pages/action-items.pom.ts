import { type Page, type Locator, expect } from "@playwright/test";
import { FormDrawer } from "./base-drawer.pom";
import { ProjectNav } from "./project-nav";

// POM for the Action Items list (/project/:id/action-items). The same upsert
// FormDrawer ("New item" / "Edit action item") handles create and edit; rows
// render as cards with the title in a paragraph.
export class ActionItemsPage {
  readonly drawer: FormDrawer;
  private readonly nav: ProjectNav;

  constructor(
    private readonly page: Page,
    projectId: string,
  ) {
    this.drawer = new FormDrawer(page);
    this.nav = new ProjectNav(page, projectId);
  }

  async goto(): Promise<void> {
    await this.nav.goto("action-items");
    await this.newButton().waitFor({ state: "visible" });
    await expect(this.newButton()).toBeEnabled();
  }

  newButton(): Locator {
    return this.page.getByRole("button", { name: /new item/i });
  }

  row(title: string): Locator {
    return this.page.getByText(title, { exact: true });
  }

  // The card containing a given item, scoped from its title text up to the
  // interactive Card wrapper (so per-row actions resolve unambiguously).
  card(title: string): Locator {
    return this.page
      .locator("div", { has: this.page.getByText(title, { exact: true }) })
      .filter({ has: this.page.getByRole("button", { name: /^edit$/i }) })
      .last();
  }

  async create(title: string): Promise<void> {
    await this.newButton().click();
    await this.drawer.waitOpen(/new action item/i);
    await this.drawer.fillByLabel(/title/i, title);
    await this.drawer.saveAndClose(/^create$/i);
    await expect(this.row(title)).toBeVisible();
  }

  // Edit is a per-card "Edit" button (clicking the title opens a detail view, a
  // distinct surface). Scope to the card so the right row's drawer opens.
  async openEdit(title: string): Promise<void> {
    await this.card(title).getByRole("button", { name: /^edit$/i }).click();
    await this.drawer.waitOpen(/edit action item/i);
  }
}
