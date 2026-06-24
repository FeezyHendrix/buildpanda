import { type Page, type Locator, expect } from "@playwright/test";
import { FormDrawer } from "./base-drawer.pom";
import { ProjectNav } from "./project-nav";

// POM for the Kanban tasks board (/project/:id/tasks). Models the FormDrawer
// upsert (New task / edit) plus the board-level reads a spec asserts on.
export class TasksPage {
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
    await this.nav.goto("tasks");
    // Board readiness: the New task action is present and enabled.
    await expect(this.newTaskButton()).toBeEnabled();
  }

  newTaskButton(): Locator {
    return this.page.getByRole("button", { name: "New task" });
  }

  card(title: string): Locator {
    // Cards render the title in a paragraph; scope to the column region.
    return this.page.locator("p", { hasText: exact(title) }).first();
  }

  async openCreate(): Promise<void> {
    await this.newTaskButton().click();
    await this.drawer.waitOpen(/new task/i);
  }

  // Create a task by title (+ optional priority) and confirm the drawer closes
  // and the card appears — i.e. assert the post-invalidation DOM, not the
  // in-flight request.
  async createTask(title: string, priority?: "Low" | "Medium" | "High"): Promise<void> {
    await this.openCreate();
    await this.drawer.fillByLabel(/title/i, title);
    if (priority) {
      await this.drawer.dialog.getByRole("button", { name: exact(priority) }).click();
    }
    await this.drawer.saveAndClose(/create task/i);
    await expect(this.card(title)).toBeVisible();
  }

  async openCard(title: string): Promise<void> {
    await this.card(title).click();
    await this.drawer.waitOpen();
    await expect(this.page).toHaveURL(/\?task=/);
  }
}

// Build a RegExp that matches the full trimmed text (avoids substring collisions
// when one card title is a prefix of another).
function exact(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
}
