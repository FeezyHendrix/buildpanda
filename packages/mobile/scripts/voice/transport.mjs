import { apiRequirement } from '../../src/lib/api-access.ts';
import { requireAccess, requireCurrentAccess } from '../../src/lib/project-access-store.ts';
export const calls = [];
export let respond = async () => ({});
export function setResponder(next) { calls.length = 0; respond = next; }
export class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
export async function request(path, init = {}) {
  const method = init.method ?? 'GET';
  const body = init.body ? JSON.parse(init.body) : {};
  const match = /^\/projects\/([^/]+)/.exec(path);
  const ticket = match ? requireAccess(match[1], apiRequirement(path, method, body)) : null;
  calls.push({ path, method, body });
  const result = await respond(path, method, body);
  if (ticket) requireCurrentAccess(ticket);
  return result;
}
