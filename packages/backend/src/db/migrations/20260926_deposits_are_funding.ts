import type { Knex } from "knex";

/**
 * A recorded deposit was incrementing `amount_paid_to_date`, the figure that
 * means "paid against a certificate". Funding and certification are separate
 * ledgers, and letting a deposit move the payment figure is what made the
 * project overview, the finance waterfall and the payments tab disagree.
 *
 * Deposits move to `funds_deposited`, and the historic ones are moved back out
 * of the payment figure using the ledger that recorded them.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `UPDATE project_finances f
        SET funds_deposited = f.funds_deposited + d.total,
            amount_paid_to_date = GREATEST(f.amount_paid_to_date - d.total, 0)
       FROM (
         SELECT project_id, SUM(amount) AS total
           FROM payment_ledger
          WHERE type = 'Deposit'
          GROUP BY project_id
       ) d
      WHERE d.project_id = f.project_id`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(
    `UPDATE project_finances f
        SET funds_deposited = GREATEST(f.funds_deposited - d.total, 0),
            amount_paid_to_date = f.amount_paid_to_date + d.total
       FROM (
         SELECT project_id, SUM(amount) AS total
           FROM payment_ledger
          WHERE type = 'Deposit'
          GROUP BY project_id
       ) d
      WHERE d.project_id = f.project_id`,
  );
}
