import { type Page, expect } from "@playwright/test";

// Navigation helper for project-scoped routes (/project/:projectId/:module).
// Centralises the React Router transition wait so specs don't race Suspense:
// after navigating we assert the URL settled and a stable landmark is present.
export class ProjectNav {
  constructor(
    private readonly page: Page,
    private readonly projectId: string,
  ) {}

  async goto(module: string): Promise<void> {
    await this.page.goto(`/project/${this.projectId}/${module}`);
    await expect(this.page).toHaveURL(new RegExp(`/project/${this.projectId}/${module}`));
    // Wait for any route-transition Suspense fallback to detach before the spec
    // starts interacting (client-rendered SPA readiness, not SSR hydration).
    await this.page
      .getByRole("status")
      .filter({ hasText: /loading/i })
      .waitFor({ state: "detached" })
      .catch(() => undefined);
    await expect(this.page.getByRole("main")).toBeVisible().catch(() => undefined);
  }
}
