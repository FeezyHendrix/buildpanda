import type { Knex } from "knex";

// Placeholder until the measurement engine lands (implementation plan phase 2).
// Sessions pass straight to review with sheets still `pending`.
export async function generateForSession(_db: Knex, _sessionId: string): Promise<void> {}
