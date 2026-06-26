import type { FastifyPluginAsync } from "fastify";
import { NotFoundError } from "../../lib/errors.ts";
import { openStoredFile } from "../../lib/file-storage.ts";
import { publicTokenRateLimit } from "../../plugins/security.ts";
import { renderInvoicePdf } from "./invoice-pdf.ts";
import { invoicesRepository } from "./repository.ts";
import { invoicesService } from "./service.ts";

const tokenParams = {
  type: "object",
  required: ["token"],
  additionalProperties: false,
  properties: { token: { type: "string", minLength: 1 } },
} as const;

const publicInvoiceRoutes: FastifyPluginAsync = async (fastify) => {
  const repository = invoicesRepository(fastify.db);
  const service = invoicesService(repository);

  fastify.get<{ Params: { token: string } }>(
    "/public/invoices/:token",
    { schema: { params: tokenParams }, config: { rateLimit: publicTokenRateLimit } },
    async (request) => {
      const invoice = await service.markViewed(request.params.token);
      return { invoice };
    },
  );

  fastify.get<{ Params: { token: string } }>(
    "/public/invoices/:token/pdf",
    { schema: { params: tokenParams }, config: { rateLimit: publicTokenRateLimit } },
    async (request, reply) => {
      const invoice = await service.markViewed(request.params.token);
      const row = await repository.findById(invoice.id);
      if (!row) throw new NotFoundError("Invoice");
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `inline; filename="invoice-${encodeURIComponent(invoice.number ?? invoice.id)}.pdf"`);
      if (invoice.pdfStorageKey) {
        return reply.send(await openStoredFile(invoice.pdfStorageKey));
      }
      const org = await repository.organizationForProject(row.project_id);
      return reply.send(await renderInvoicePdf(invoice, org ?? null));
    },
  );
};

export default publicInvoiceRoutes;
