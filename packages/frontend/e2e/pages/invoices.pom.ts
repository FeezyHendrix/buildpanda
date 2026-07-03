import { type Page, type Locator, expect } from "@playwright/test";
import { ProjectNav } from "./project-nav";

// Create is a full page (finances/invoices/new), not a drawer. Payment + balance
// integrity is asserted at the API/DB layer in the spec, not on screen.
export class InvoicesPage {
  private readonly nav: ProjectNav;

  constructor(
    private readonly page: Page,
    private readonly projectId: string,
  ) {
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

  // VAT is zeroed so balanceDue equals `amount` exactly — the reconciliation
  // spec asserts amountPaid + balanceDue === amount after each payment.
  async createInvoice(vendor: string, amount: number, trade = "Electrical"): Promise<void> {
    await this.newButton().click();
    await this.page.waitForURL(
      `**/project/${this.projectId}/finances/invoices/new`,
    );

    await this.page.getByLabel(/vendor \/ payee/i).fill(vendor);
    await this.page.getByLabel(/^trade$/i).fill(trade);
    await this.page.getByLabel(/line 1 description/i).fill(trade);
    await this.page.getByLabel(/line 1 quantity/i).fill("1");
    await this.page.getByLabel(/line 1 rate/i).fill(String(amount));
    await this.page.getByLabel(/^vat \(%\)$/i).fill("0");

    await this.page
      .getByRole("button", { name: /create invoice|^create$/i })
      .first()
      .click();

    await this.page.waitForURL(
      `**/project/${this.projectId}/finances/invoices`,
    );
    await expect(this.row(vendor)).toBeVisible();
  }
}
