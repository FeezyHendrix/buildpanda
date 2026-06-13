import type { FastifyPluginAsync } from "fastify";
import { NotFoundError } from "../../lib/errors.ts";

const CURRENCIES = ["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR"] as const;

const patchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    phone: { type: "string", maxLength: 50 },
    address: { type: "string", maxLength: 500 },
    contactEmail: { type: "string", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", maxLength: 320 },
    website: { type: "string", maxLength: 200 },
    defaultCurrency: { type: "string", enum: CURRENCIES },
    defaultTaxLabel: { type: "string", maxLength: 50 },
    defaultTaxPct: { type: "number", minimum: 0, maximum: 100 },
  },
} as const;

interface OrgProfilePatch {
  phone?: string;
  address?: string;
  contactEmail?: string;
  website?: string;
  defaultCurrency?: string;
  defaultTaxLabel?: string;
  defaultTaxPct?: number;
}

const orgProfileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/org-profile", async (request) => {
    const orgId = request.requireOrgScope();

    const org = await fastify.db("organization")
      .where({ id: orgId })
      .select(
        "id", "name", "slug", "logo",
        "phone", "address", "contact_email", "website",
        "default_currency", "default_tax_label", "default_tax_pct",
      )
      .first();
    if (!org) throw new NotFoundError("Organization");

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      phone: org.phone ?? null,
      address: org.address ?? null,
      contactEmail: org.contact_email ?? null,
      website: org.website ?? null,
      defaultCurrency: org.default_currency ?? "NGN",
      defaultTaxLabel: org.default_tax_label ?? "VAT",
      defaultTaxPct: Number(org.default_tax_pct ?? 7.5),
    };
  });

  fastify.patch<{ Body: OrgProfilePatch }>(
    "/org-profile",
    { schema: { body: patchBody } },
    async (request) => {
      const orgId = request.requireOrgPermission("orgProfile", "manage");

      const { phone, address, contactEmail, website, defaultCurrency, defaultTaxLabel, defaultTaxPct } =
        request.body;

      // The `organization` table is owned by better-auth: timestamps are
      // camelCase (`updatedAt`). The profile columns are snake_case. Both
      // conventions coexist on this one table.
      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (phone !== undefined) patch["phone"] = phone;
      if (address !== undefined) patch["address"] = address;
      if (contactEmail !== undefined) patch["contact_email"] = contactEmail;
      if (website !== undefined) patch["website"] = website;
      if (defaultCurrency !== undefined) patch["default_currency"] = defaultCurrency;
      if (defaultTaxLabel !== undefined) patch["default_tax_label"] = defaultTaxLabel;
      if (defaultTaxPct !== undefined) patch["default_tax_pct"] = defaultTaxPct;

      await fastify.db("organization").where({ id: orgId }).update(patch);

      const org = await fastify.db("organization")
        .where({ id: orgId })
        .select(
          "id", "name", "slug", "logo",
          "phone", "address", "contact_email", "website",
          "default_currency", "default_tax_label", "default_tax_pct",
        )
        .first();

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        phone: org.phone ?? null,
        address: org.address ?? null,
        contactEmail: org.contact_email ?? null,
        website: org.website ?? null,
        defaultCurrency: org.default_currency ?? "NGN",
        defaultTaxLabel: org.default_tax_label ?? "VAT",
        defaultTaxPct: Number(org.default_tax_pct ?? 7.5),
      };
    },
  );
};

export default orgProfileRoutes;
