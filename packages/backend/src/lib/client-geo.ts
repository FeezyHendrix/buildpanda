import geoip from "geoip-lite";
import type { FastifyRequest } from "fastify";

export function clientIp(request: FastifyRequest): string | null {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(",")[0]?.trim() ?? null;
  }
  return request.ip || null;
}

export function countryFromIp(ip: string | null): string | null {
  if (!ip) return null;
  const geo = geoip.lookup(ip);
  return geo?.country ?? null;
}
