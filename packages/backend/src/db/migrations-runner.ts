import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import type { Knex } from "knex";

// In dev this file runs from src/db (tsx, .ts migrations); in prod it is bundled
// to dist/ and migrations are compiled to dist/migrations (.js). Resolve both
// from this module's own location so the same code path works in either world.
const here = dirname(fileURLToPath(import.meta.url));
const fromDist = here.split(/[\\/]/).includes("dist");
const directory = resolve(here, "migrations");
const extension = fromDist ? ".js" : ".ts";

// knex_migrations records names as `<name>.ts` (dev ran them with tsx). In prod
// the files are `.js`, which knex would otherwise report as "missing" and refuse
// to run. This source reports every migration under its `.ts` name regardless of
// the on-disk extension, so the recorded history matches in both environments.
const migrationSource: Knex.MigrationSource<string> = {
  async getMigrations() {
    const files = await readdir(directory);
    return files
      .filter((f) => f.endsWith(extension))
      .map((f) => f.slice(0, -extension.length))
      .sort();
  },
  getMigrationName(name) {
    return `${name}.ts`;
  },
  async getMigration(name) {
    return (await import(
      pathToFileURL(resolve(directory, `${name}${extension}`)).href
    )) as Knex.Migration;
  },
};

export async function runMigrations(db: Knex): Promise<void> {
  const [batch, applied] = (await db.migrate.latest({ migrationSource })) as [number, string[]];
  process.stdout.write(
    `${JSON.stringify({ level: "info", scope: "migrations", batch, applied })}\n`,
  );
}
