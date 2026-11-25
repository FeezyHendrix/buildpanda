import geoip from "geoip-lite";
import type { FastifyRequest } from "fastify";

// Edge-set X-Real-IP first: the left of X-Forwarded-For is whatever the client sent. Keep in step with auth.ts ipAddressHeaders.
export function clientIp(request: FastifyRequest): string | null {
  const realIp = request.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
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
