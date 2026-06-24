import { type Page, type Locator, expect } from "@playwright/test";

// Page object for the shared FormDrawer (Base UI Dialog rendered as a right-side
// drawer). The SAME drawer handles create and edit, so this POM models the
// universal lifecycle: open → wait ready → fill → save → wait closed. Module
// POMs compose it; they fill module-specific fields, this handles the shell.
export class FormDrawer {
  readonly dialog: Locator;

  constructor(page: Page) {
    this.dialog = page.getByRole("dialog");
  }

  // Waits for the drawer (and its slide-in transition) to be ready for input.
  // Readiness is signalled by the first form field becoming editable, NOT by the
  // submit button — many drawers disable submit until required fields are filled.
  async waitOpen(title?: string | RegExp): Promise<void> {
    await this.dialog.waitFor({ state: "visible" });
    if (title) {
      await expect(this.dialog).toContainText(title);
    }
    const firstField = this.dialog.locator("input, textarea, [contenteditable='true']").first();
    await expect(firstField).toBeEditable();
  }

  async waitClosed(): Promise<void> {
    await this.dialog.waitFor({ state: "detached" });
  }

  submitButton(name: string | RegExp = /save|create|submit|add|send|request/i): Locator {
    return this.dialog.getByRole("button", { name });
  }

  cancelButton(): Locator {
    return this.dialog.getByRole("button", { name: /cancel/i });
  }

  // Prefer label; fall back to placeholder. Asserts editability first so we never
  // type into a field still mounting behind the transition.
  async fillByLabel(label: string | RegExp, value: string): Promise<void> {
    const field = this.dialog.getByLabel(label);
    await expect(field).toBeEditable();
    await field.fill(value);
  }

  async fillByPlaceholder(placeholder: string | RegExp, value: string): Promise<void> {
    const field = this.dialog.getByPlaceholder(placeholder);
    await expect(field).toBeEditable();
    await field.fill(value);
  }

  async selectByLabel(label: string | RegExp, value: string): Promise<void> {
    const field = this.dialog.getByLabel(label);
    await expect(field).toBeEnabled();
    await field.selectOption(value);
  }

  async save(name?: string | RegExp): Promise<void> {
    const btn = name ? this.submitButton(name) : this.submitButton();
    await expect(btn).toBeEnabled();
    await btn.click();
  }

  // Save and confirm the drawer fully closes — the canonical "mutation done"
  // signal (React Query invalidation runs and the drawer dismisses on success).
  async saveAndClose(name?: string | RegExp): Promise<void> {
    await this.save(name);
    await this.waitClosed();
  }
}
