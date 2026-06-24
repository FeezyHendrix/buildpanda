import { type Page, type Locator, expect } from "@playwright/test";
import { FormDrawer } from "./base-drawer.pom";
import { ProjectNav } from "./project-nav";

// POM for Invoices (/project/:id/finances/invoices). Covers creating an invoice
// via the upsert drawer ("New invoice" / "Add invoice"). Payment recording and
// balance verification are asserted at the API/DB layer in the spec — the brief
// requires financial integrity to be checked beyond the screen.
export class InvoicesPage {
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
    await this.nav.goto("finances/invoices");
    await this.newButton().waitFor({ state: "visible" });
    await expect(this.newButton()).toBeEnabled();
  }

  newButton(): Locator {
    return this.page.getByRole("button", { name: /new invoice/i }).first();
  }

  row(vendor: string): Locator {
    return this.page.getByText(vendor, { exact: true });
  }

  // Create an invoice and confirm it lands on the list after invalidation.
  // Vendor, trade and amount are all required for the submit to enable.
  async createInvoice(vendor: string, amount: number, trade = "Electrical"): Promise<void> {
    await this.newButton().click();
    await this.drawer.waitOpen(/new invoice/i);
    await this.drawer.fillByLabel(/vendor name/i, vendor);
    await this.drawer.fillByLabel(/^trade$/i, trade);
    await this.drawer.fillByLabel(/^amount$/i, String(amount));
    await this.drawer.saveAndClose(/add invoice/i);
    await expect(this.row(vendor)).toBeVisible();
  }
}
