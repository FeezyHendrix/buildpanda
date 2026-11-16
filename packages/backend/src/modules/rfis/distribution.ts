import { randomBytes, createHash } from "node:crypto";
import { generateId } from "../../lib/ids.ts";
import { toDistribution } from "./mappers.ts";
import type { RfisRepository } from "./repository.ts";
import type { RfiRow, RfiDistributionMember, RfiDistributionRole, DistributionInput, ExternalReplyResult, Actor } from "./types.ts";

export function hashReplyToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function rfiDistribution(repository: RfisRepository,
  loadRow: (projectId: string, rfiId: string) => Promise<RfiRow>,
  logEvent: (rfiId: string, type: string, actor: Actor | null, detail?: Record<string, unknown>) => Promise<void>,
) {
  return {
    async listDistribution(projectId: string, rfiId: string): Promise<RfiDistributionMember[]> {
      await loadRow(projectId, rfiId);
      const rows = await repository.listDistribution(rfiId);
      return rows.map(toDistribution);
    },

    async addDistribution(
      projectId: string,
      rfiId: string,
      input: DistributionInput,
      actor: Actor,
      tokenTtlDays: number,
    ): Promise<{ member: RfiDistributionMember; replyToken: string | null }> {
      await loadRow(projectId, rfiId);
      const external = !input.userId && Boolean(input.email);
      const role: RfiDistributionRole = input.role ?? (external ? "responder" : "viewer");

      let replyToken: string | null = null;
      let tokenHash: string | null = null;
      let expiresAt: string | null = null;
      if (external && role === "responder") {
        replyToken = randomBytes(32).toString("base64url");
        tokenHash = hashReplyToken(replyToken);
        expiresAt = new Date(Date.now() + tokenTtlDays * 24 * 60 * 60 * 1000).toISOString();
      }

      const row = await repository.addDistribution({
        id: generateId("rfid"),
        rfi_id: rfiId,
        user_id: input.userId ?? null,
        email: input.email ?? null,
        name: input.name ?? null,
        role,
        reply_token_hash: tokenHash,
        token_expires_at: expiresAt,
      });
      await logEvent(rfiId, "distribution_added", actor, {
        email: input.email ?? null,
        userId: input.userId ?? null,
        role,
      });
      return { member: toDistribution(row), replyToken };
    },

    async replyByToken(rawToken: string, body: string): Promise<ExternalReplyResult> {
      const member = await repository.distributionByTokenHash(hashReplyToken(rawToken));
      if (!member) return { ok: false, rfiSubject: "", rfiNumber: 0, reason: "not_found" };

      const rfi = await repository.findById(member.rfi_id);
      if (!rfi) return { ok: false, rfiSubject: "", rfiNumber: 0, reason: "not_found" };

      if (member.token_consumed_at) {
        return { ok: false, rfiSubject: rfi.subject, rfiNumber: rfi.number, reason: "consumed" };
      }
      if (member.token_expires_at && new Date(member.token_expires_at) < new Date()) {
        return { ok: false, rfiSubject: rfi.subject, rfiNumber: rfi.number, reason: "expired" };
      }

      await repository.addComment({
        id: generateId("rfic"),
        rfi_id: rfi.id,
        author_id: member.user_id ?? `external:${member.id}`,
        author_name: member.name ?? member.email ?? "External responder",
        body,
        is_proposed_response: true,
        created_at: new Date().toISOString(),
      });
      await repository.consumeDistributionToken(member.id);
      await logEvent(rfi.id, "external_response_proposed", null, {
        email: member.email,
      });
      return { ok: true, rfiSubject: rfi.subject, rfiNumber: rfi.number };
    },

  };
}
