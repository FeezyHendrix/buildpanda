import type { FastifyPluginAsync } from "fastify";
import { NotFoundError } from "../../lib/errors.ts";
import { currencyCodeSchema } from "../../lib/currencies.ts";
import { invalidateOrgDefaultCurrency } from "../../lib/org-currency-cache.ts";

const patchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    phone: { type: "string", maxLength: 50 },
    address: { type: "string", maxLength: 500 },
    contactEmail: { type: "string", pattern: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", maxLength: 320 },
    website: { type: "string", maxLength: 200 },
    defaultCurrency: currencyCodeSchema,
    defaultTaxLabel: { type: "string", maxLength: 50 },
    defaultTaxPct: { type: "number", minimum: 0, maximum: 100 },
    paymentInstructions: { type: "string", maxLength: 2000 },
  },
} as const;

interface OrgProfilePatch {
  name?: string;
  phone?: string;
  address?: string;
  contactEmail?: string;
  website?: string;
  defaultCurrency?: string;
  defaultTaxLabel?: string;
  defaultTaxPct?: number;
  paymentInstructions?: string;
}

const orgProfileRoutes: FastifyPluginAsync = async (fastify) => {
  // The caller's effective permission map for their active org (built-in role
  // statements ∪ admin-assigned custom roles). Drives UI gating so the SPA
  // shows only the actions the member may actually perform.
  fastify.get("/org-permissions", async (request) => {
    const orgId = request.requireOrgScope();
    const perms = request.orgPermissions?.get(orgId);
    const permissions: Record<string, string[]> = {};
    if (perms) {
      for (const [resource, actions] of perms) permissions[resource] = [...actions];
    }
    return { organizationId: orgId, role: request.orgRoles.get(orgId) ?? null, permissions };
  });

  fastify.get("/org-profile", async (request) => {
    const orgId = request.requireOrgScope();

    const org = await fastify.db("organization")
      .where({ id: orgId })
      .select(
        "id", "name", "slug", "logo",
        "phone", "address", "contact_email", "website",
        "default_currency", "default_tax_label", "default_tax_pct",
        "payment_instructions",
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
      paymentInstructions: org.payment_instructions ?? null,
    };
  });

  fastify.patch<{ Body: OrgProfilePatch }>(
    "/org-profile",
    { schema: { body: patchBody } },
    async (request) => {
      const orgId = request.requireOrgPermission("orgProfile", "manage");

      const { name, phone, address, contactEmail, website, defaultCurrency, defaultTaxLabel, defaultTaxPct, paymentInstructions } =
        request.body;

      const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (name !== undefined) patch["name"] = name.trim();
      if (phone !== undefined) patch["phone"] = phone;
      if (address !== undefined) patch["address"] = address;
      if (contactEmail !== undefined) patch["contact_email"] = contactEmail;
      if (website !== undefined) patch["website"] = website;
      if (defaultCurrency !== undefined) patch["default_currency"] = defaultCurrency;
      if (defaultTaxLabel !== undefined) patch["default_tax_label"] = defaultTaxLabel;
      if (defaultTaxPct !== undefined) patch["default_tax_pct"] = defaultTaxPct;
      if (paymentInstructions !== undefined) patch["payment_instructions"] = paymentInstructions.trim() || null;

      await fastify.db("organization").where({ id: orgId }).update(patch);

      if (defaultCurrency !== undefined) invalidateOrgDefaultCurrency(orgId);

      const org = await fastify.db("organization")
        .where({ id: orgId })
        .select(
          "id", "name", "slug", "logo",
          "phone", "address", "contact_email", "website",
          "default_currency", "default_tax_label", "default_tax_pct",
          "payment_instructions",
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
        paymentInstructions: org.payment_instructions ?? null,
      };
    },
  );
};

export default orgProfileRoutes;
